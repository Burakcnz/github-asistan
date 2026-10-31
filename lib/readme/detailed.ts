// Detay seviyesine göre kod haritası + AI aşamalarını yürütür.
import { buildCodeMap, describeGroup, type CodeMap } from "@/lib/readme/codemap";
import { summarizeGroup, synthesizeDetailed, type DetailedContent, type GroupSummary } from "@/lib/readme/ai-detailed";
import { getAppSetting, setAppSetting } from "@/lib/shared";
import type { ReadmeLang } from "@/lib/readme/i18n";

export type ReadmeDetail = "short" | "standard" | "detailed";

export const README_DETAIL_OPTIONS: { id: ReadmeDetail; label: string; description: string }[] = [
  { id: "short", label: "Kısa", description: "Hızlı özet (~10 sn)" },
  { id: "standard", label: "Standart", description: "Kod haritasından tek geçiş (~30 sn)" },
  { id: "detailed", label: "Detaylı", description: "Her modül ayrı okunur (büyük projede birkaç dakika)" },
];

export function isReadmeDetail(v: unknown): v is ReadmeDetail {
  return v === "short" || v === "standard" || v === "detailed";
}

export interface ProgressEvent {
  stage: "scan" | "group" | "synthesis" | "build";
  message: string;
  current: number;
  total: number;
}

export interface DetailedResult {
  codemap: CodeMap;
  content: DetailedContent | null;
  groupSummaries: Record<string, GroupSummary>;
  warnings: string[];
}

const MAX_GROUPS = 14;

/** Mevcut README'nin "Özellikler/Features" bölümünü gruplu özelliklere çevirir (AI yokken). */
export function parseReadmeFeatures(markdown: string): DetailedContent["featureGroups"] {
  if (!markdown) return [];
  const section = markdown.match(/^##\s+[^\n]*(?:özellik|feature)[^\n]*\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/im)?.[1];
  if (!section) return [];
  const groups: DetailedContent["featureGroups"] = [];
  let current: DetailedContent["featureGroups"][number] | null = null;
  for (const line of section.split(/\r?\n/)) {
    const h = line.match(/^###\s+(?:\d+\.\s*)?(.+)$/);
    if (h) {
      const raw = h[1].trim();
      const emoji = raw.match(/^(\p{Extended_Pictographic}️?)\s*/u)?.[1] ?? "✨";
      current = { emoji, title: raw.replace(/^(\p{Extended_Pictographic}️?)\s*/u, "").replace(/[*_`]/g, ""), items: [] };
      groups.push(current);
      continue;
    }
    const b = line.match(/^\s*[-*]\s+(.+)$/);
    if (b) {
      if (!current) {
        current = { emoji: "✨", title: "", items: [] };
        groups.push(current);
      }
      current.items.push(b[1].replace(/\*\*/g, "").trim());
    }
  }
  return groups.filter((g) => g.items.length > 0).slice(0, 14);
}

/** AI sentezi başarısız olursa grup özetlerinden içerik kurar. */
function contentFromSummaries(summaries: Record<string, GroupSummary>, codemap: CodeMap): DetailedContent | null {
  const featureGroups: DetailedContent["featureGroups"] = [];
  for (const g of codemap.groups) {
    const s = summaries[g.id];
    if (!s) continue;
    for (const c of s.capabilities) {
      if (c.details.length > 0) featureGroups.push({ emoji: "✨", title: c.title, items: c.details });
    }
  }
  if (featureGroups.length === 0) return null;
  return {
    tagline: "",
    overview: "",
    featureGroups: featureGroups.slice(0, 12),
    workflow: [],
    components: codemap.groups.filter((g) => summaries[g.id]?.summary).map((g) => ({ name: g.id, role: summaries[g.id].summary })),
    usageFlows: [],
  };
}

function docsMaterial(codemap: CodeMap): string {
  return codemap.docs
    .map((d) => `DOC ${d.path}: ${d.title}\nsections: ${d.headings.join(" | ")}\n${d.excerpt}`)
    .join("\n\n")
    .slice(0, 5000);
}

export async function runDetailedAnalysis(opts: {
  root: string;
  projectId: string;
  userId: string;
  projectName: string;
  model: string | null;
  lang: ReadmeLang;
  detail: ReadmeDetail;
  existingReadme: string;
  onProgress?: (e: ProgressEvent) => void;
}): Promise<DetailedResult> {
  const { root, projectId, userId, projectName, model, lang, detail, existingReadme, onProgress } = opts;
  const warnings: string[] = [];

  onProgress?.({ stage: "scan", message: "Kod haritası çıkarılıyor", current: 0, total: 1 });
  const codemap = await buildCodeMap(root);
  const readmeExcerpt = existingReadme ? `AUTHOR README:\n${existingReadme.slice(0, 8000)}` : "";

  if (!model || detail === "short") {
    const groups = parseReadmeFeatures(existingReadme);
    return {
      codemap,
      content: groups.length > 0 ? { tagline: "", overview: "", featureGroups: groups, workflow: [], components: [], usageFlows: [] } : null,
      groupSummaries: {},
      warnings,
    };
  }

  const groupSummaries: Record<string, GroupSummary> = {};
  let material: string;

  if (detail === "standard") {
    const perGroup = Math.max(1200, Math.floor(16000 / Math.max(1, codemap.groups.length)));
    material = [
      `CODE MAP (${codemap.sourceFileCount} source files):`,
      ...codemap.groups.slice(0, MAX_GROUPS).map((g) => describeGroup(g, perGroup)),
      codemap.embedded.length ? `EMBEDDED COMPONENTS (not part of the code): ${codemap.embedded.join(", ")}` : "",
      docsMaterial(codemap),
      readmeExcerpt,
    ]
      .filter(Boolean)
      .join("\n\n");
  } else {
    // Detaylı: her grup ayrı özetlenir; değişmeyen gruplar önbellekten gelir.
    const cacheKey = `readmeCache:${projectId}`;
    let cache: { model: string; lang: string; groups: Record<string, { hash: string; summary: GroupSummary }> } = { model, lang, groups: {} };
    try {
      const raw = await getAppSetting(userId, cacheKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && parsed.model === model && parsed.lang === lang) cache = parsed;
    } catch {
      // bozuk önbellek
    }

    const groups = codemap.groups.slice(0, MAX_GROUPS);
    let cachedCount = 0;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const hit = cache.groups[g.id];
      onProgress?.({ stage: "group", message: `Modül okunuyor: ${g.id}`, current: i + 1, total: groups.length });
      if (hit && hit.hash === g.hash) {
        groupSummaries[g.id] = hit.summary;
        cachedCount++;
        continue;
      }
      const summary = await summarizeGroup(model, projectName, describeGroup(g, 9000), lang);
      if (summary) {
        groupSummaries[g.id] = summary;
        cache.groups[g.id] = { hash: g.hash, summary };
      } else {
        warnings.push(`"${g.id}" modülü özetlenemedi`);
      }
    }
    // Artık var olmayan grupları önbellekten at
    for (const id of Object.keys(cache.groups)) if (!groups.some((g) => g.id === id)) delete cache.groups[id];
    await setAppSetting(userId, cacheKey, JSON.stringify(cache)).catch(() => undefined);
    if (cachedCount > 0) onProgress?.({ stage: "group", message: `${cachedCount} modül önbellekten alındı`, current: groups.length, total: groups.length });

    material = [
      ...groups
        .filter((g) => groupSummaries[g.id])
        .map((g) => {
          const s = groupSummaries[g.id];
          const caps = s.capabilities.map((c) => `- ${c.title}: ${c.details.join("; ")}`).join("\n");
          return `PART ${g.id}: ${s.summary}\n${caps}${s.userActions.length ? `\nuser can: ${s.userActions.join("; ")}` : ""}`;
        }),
      codemap.embedded.length ? `EMBEDDED COMPONENTS (bundled third-party, not written by the author): ${codemap.embedded.join(", ")}` : "",
      docsMaterial(codemap),
      readmeExcerpt,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  onProgress?.({ stage: "synthesis", message: "README metni yazılıyor", current: 0, total: 1 });
  let content = await synthesizeDetailed(model, projectName, material, lang);
  if (!content) {
    warnings.push("AI sentezi başarısız oldu; modül özetlerinden oluşturuldu");
    content = contentFromSummaries(groupSummaries, codemap);
  }
  if (!content) {
    const groups = parseReadmeFeatures(existingReadme);
    if (groups.length) content = { tagline: "", overview: "", featureGroups: groups, workflow: [], components: [], usageFlows: [] };
  }
  return { codemap, content, groupSummaries, warnings };
}
