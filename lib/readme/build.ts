import { createBlock, type DynamicBadge, type InstallStep, type ReadmeBlock } from "@/lib/readme-blocks";
import { badgeUrl, type TechInfo } from "@/lib/readme/tech";
import { STRINGS, type ReadmeLang } from "@/lib/readme/i18n";
import { resolveIcon } from "@/lib/tech-icons";
import type { ReadmeFacts } from "@/lib/readme/analyze";
import type { AiReadmeContent } from "@/lib/readme/ai";
import type { GitHubProfile } from "@/lib/github";
import type { DetailedResult } from "@/lib/readme/detailed";
import type { ApiRoute } from "@/lib/readme-blocks";

export type ReadmeTemplateId = "modern" | "professional" | "minimal";

export const README_TEMPLATE_OPTIONS: { id: ReadmeTemplateId; label: string; description: string }[] = [
  { id: "modern", label: "Modern", description: "Renkli dalga başlık, rozetler, ikon satırı, içindekiler, geliştirici kartı" },
  { id: "professional", label: "Profesyonel", description: "Sade ve kurumsal: rozetler, içindekiler, tüm bölümler" },
  { id: "minimal", label: "Sade", description: "Başlık, özellikler, kurulum ve kullanım" },
];

export function isTemplateId(value: unknown): value is ReadmeTemplateId {
  return value === "modern" || value === "professional" || value === "minimal";
}

/** Eski kayıtlardaki şablon adlarını yenilerine çevirir. */
export function normalizeTemplateId(value: unknown): ReadmeTemplateId | null {
  if (isTemplateId(value)) return value;
  if (value === "detailed") return "professional";
  return null;
}

export interface BuildOptions {
  lang: ReadmeLang;
  template: ReadmeTemplateId;
  /** README başlığı (görünen ad). */
  title: string;
  /** Klon URL'i için repo sahibi/adı. */
  repoOwner: string | null;
  repoName: string;
  /** Repo GitHub'da mı (canlı rozetler için). */
  isOnGithub: boolean;
  /** Geliştirici kartı için GitHub profili. */
  profile: GitHubProfile | null;
  /** Standart/Detaylı modda kod haritası + AI içeriği. */
  detailed?: DetailedResult | null;
}

// ---------- renk ----------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").padEnd(6, "0").slice(0, 6);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function shade(hex: string, factor: number): string {
  return hexToRgb(hex)
    .map((v) => Math.max(0, Math.min(255, Math.round(v * factor))).toString(16).padStart(2, "0"))
    .join("");
}

/** Projenin teknolojilerinden dalga başlık gradyanı ve yazı rengi seçer (siyah/beyaz yakın renkler atlanır). */
const RUNTIME_TECHS = new Set(["Node.js", "JavaScript", "HTML5"]);

export function pickPalette(techs: TechInfo[]): { gradient: string; fontColor: string } {
  // Framework/kütüphane renkleri öncelikli; Node.js gibi her projede olanlar sona.
  const ordered = [...techs.filter((t) => !RUNTIME_TECHS.has(t.name)), ...techs.filter((t) => RUNTIME_TECHS.has(t.name))];
  const colors = ordered
    .map((t) => t.color.replace("#", ""))
    .filter((c) => /^[0-9a-f]{6}$/i.test(c))
    .filter((c) => {
      const l = luminance(c);
      return l > 0.08 && l < 0.85;
    });
  const unique = [...new Set(colors.map((c) => c.toUpperCase()))];
  const primary = unique[0] ?? "414868";
  const secondary = unique.find((c) => c !== primary) ?? shade(primary, 0.55);
  const fontColor = (luminance(primary) + luminance(secondary)) / 2 > 0.6 ? "1F2328" : "FFFFFF";
  return { gradient: `0:${secondary},100:${primary}`, fontColor };
}

// ---------- yardımcılar ----------

function installSteps(facts: ReadmeFacts, opts: BuildOptions): InstallStep[] {
  const s = STRINGS[opts.lang].steps;
  const steps: InstallStep[] = [];
  const cdTarget = /\s/.test(opts.repoName) ? `"${opts.repoName}"` : opts.repoName;
  if (opts.repoOwner) {
    steps.push({ label: s.clone, command: `git clone https://github.com/${opts.repoOwner}/${opts.repoName}.git\ncd ${cdTarget}` });
  }
  for (const step of facts.installSteps) {
    steps.push({ label: s[step.kind], command: step.command });
  }
  return steps;
}

/** Teknoloji listesinden ikon anahtarları (tekrar yok, en fazla 12). */
function iconKeys(techs: TechInfo[]): string[] {
  const keys: string[] = [];
  for (const t of techs) {
    const icon = (t.icon && resolveIcon(t.icon)) || resolveIcon(t.name);
    if (icon && !keys.includes(icon.key)) keys.push(icon.key);
  }
  return keys.slice(0, 12);
}

// ---------- ana kurucu ----------

export function buildReadmeBlocks(facts: ReadmeFacts, ai: AiReadmeContent | null, opts: BuildOptions): ReadmeBlock[] {
  const { lang, template } = opts;
  const t = STRINGS[lang];
  const modern = template === "modern";
  const minimal = template === "minimal";
  const blocks: ReadmeBlock[] = [];
  const add = (type: Parameters<typeof createBlock>[0], data: Record<string, unknown>) =>
    blocks.push(createBlock(type, blocks.length, data, lang));

  const palette = pickPalette(facts.techs);
  const deep = opts.detailed?.content ?? null;
  const codemap = opts.detailed?.codemap ?? null;
  const summaries = opts.detailed?.groupSummaries ?? {};
  const tagline = deep?.tagline || ai?.tagline || "";
  const repoUrl = opts.repoOwner ? `https://github.com/${opts.repoOwner}/${opts.repoName}` : "";
  const dynamicBadges: DynamicBadge[] = opts.isOnGithub ? (modern ? ["stars", "forks", "last-commit"] : ["stars", "last-commit"]) : [];

  if (modern) {
    add("capsule-header", {
      type: "waving",
      height: 200,
      colorMode: "gradient",
      gradient: palette.gradient,
      text: opts.title,
      desc: tagline.length <= 70 ? tagline : "",
      fontSize: opts.title.length > 22 ? 44 : 56,
      fontColor: palette.fontColor,
      animation: "fadeIn",
    });
  }

  add("header", {
    title: opts.title,
    hideTitle: modern,
    tagline: modern && tagline.length <= 70 ? "" : tagline,
    description: deep?.overview || ai?.description || facts.description,
    badgeStyle: modern ? "for-the-badge" : "flat-square",
    dynamicBadges,
    showStars: false,
    showLicense: !!facts.license,
    showPRs: false,
    license: facts.license,
    version: !minimal && facts.version && !/^0\.0\.0$/.test(facts.version) ? facts.version : "",
    githubOwner: opts.repoOwner ?? undefined,
    githubRepo: opts.repoName,
    customBadges: [],
  });

  const icons = iconKeys(facts.techs);
  if (modern && icons.length > 0) {
    add("tech-icons", { icons, provider: "skill-icons", height: 48, spacing: 10, align: "center" });
  }

  if (!minimal) add("toc", { collapsed: modern });

  if (deep && deep.featureGroups.length > 0) {
    add("features", { items: [], groups: deep.featureGroups });
  } else if (ai && ai.features.length > 0) {
    add("features", { items: ai.features });
  }

  if (!minimal && facts.screenshots.length > 0) {
    add("image", { heading: t.headings.screenshots, url: facts.screenshots[0], alt: opts.title, height: 0, align: "center" });
  }

  // AI bileşen listesi yoksa kod haritasındaki modül açıklamalarından (docstring) kur.
  const components =
    deep?.components.length
      ? deep.components
      : (codemap?.groups ?? [])
          .map((g) => {
            const doc = summaries[g.id]?.summary || g.files.find((f) => f.doc)?.doc || "";
            const role = doc.split(/(?<=[.!?])\s/)[0] ?? "";
            return { name: g.id === "(kök)" ? "/" : `${g.id}/`, role: role.length > 140 ? role.slice(0, 137) + "…" : role };
          })
          .filter((c) => c.role)
          .slice(0, 12);
  if (!minimal && ((deep?.workflow.length ?? 0) > 0 || components.length > 0 || (codemap?.embedded.length ?? 0) > 0)) {
    add("architecture", {
      intro: "",
      steps: deep?.workflow ?? [],
      showDiagram: true,
      components,
      embedded: codemap?.embedded ?? [],
    });
  }

  if (!modern && !minimal && facts.techs.length > 0) {
    add("techstack", {
      items: facts.techs.map((tech) => ({ name: tech.name, description: "", badge: badgeUrl(tech, "flat-square") })),
    });
  }

  const steps = installSteps(facts, opts);
  if (steps.length > 0 || facts.prerequisites.length > 0) {
    add("installation", { prerequisites: facts.prerequisites, steps });
  }

  const typeNote = facts.type === "unity" ? t.unityUsage : facts.type === "web" ? t.webUsage : "";
  const aiSteps = ai && ai.usage.length > 0 ? ai.usage.map((u, i) => `${i + 1}. ${u}`).join("\n") : "";
  const usageText = [typeNote, aiSteps].filter(Boolean).join("\n\n");
  // Yapılandırma: .env.example + kodda kullanılan değişkenler, açıklamalar modül özetlerinden.
  const envDescriptions: Record<string, string> = {};
  for (const s of Object.values(summaries)) Object.assign(envDescriptions, s.envDescriptions);
  const configVars = new Map<string, { key: string; defaultValue: string; description: string }>();
  for (const e of facts.envVars) configVars.set(e.key, { key: e.key, defaultValue: "", description: e.description || envDescriptions[e.key] || "" });
  for (const e of codemap?.envVars ?? []) {
    const cur = configVars.get(e.key);
    if (cur) cur.defaultValue = cur.defaultValue || e.defaultValue;
    else configVars.set(e.key, { key: e.key, defaultValue: e.defaultValue, description: envDescriptions[e.key] || "" });
  }
  const useConfigBlock = !minimal && !!codemap && (configVars.size > 0 || (codemap.docs.length ?? 0) > 0);

  const usageFlows = deep?.usageFlows ?? [];
  if (facts.runCommand || facts.launcher || usageText || facts.envVars.length > 0 || usageFlows.length > 0) {
    add("usage", {
      command: facts.runCommand,
      launcher: facts.launcher,
      port: facts.port,
      text: usageFlows.length > 0 ? typeNote : usageText,
      flows: usageFlows,
      envVars: useConfigBlock ? [] : facts.envVars,
    });
  }

  if (useConfigBlock && codemap) {
    add("config", { vars: [...configVars.values()], docs: codemap.docs.map((d) => ({ path: d.path, title: d.title })) });
  }

  if (!minimal && codemap && codemap.routes.length > 0) {
    const routeDescriptions: Record<string, string> = {};
    for (const s of Object.values(summaries)) Object.assign(routeDescriptions, s.routeDescriptions);
    const routes: ApiRoute[] = codemap.routes
      .filter((r) => !/favicon|\.(html|ico|png|css|js)$/i.test(r.path))
      .map((r) => ({
        method: r.method,
        path: r.path,
        description: r.doc || routeDescriptions[`${r.method} ${r.path}`] || "",
        group: r.group === "(kök)" ? r.file : r.group,
      }));
    if (routes.length > 0) add("api", { routes, collapsed: true });
  }

  if (!minimal && facts.tree) add("structure", { tree: annotateTree(facts.tree, opts.detailed ?? null) });
  if (!minimal) add("contributing", { intro: t.contributingIntro, steps: [...t.contributingSteps] });
  if (facts.license) add("license", { type: facts.license, text: "", hasFile: facts.hasLicenseFile });

  if (modern && opts.profile) {
    add("author", {
      name: opts.profile.name,
      login: opts.profile.login,
      showAvatar: true,
      bio: opts.profile.bio,
      links: opts.profile.links.filter((l) => l.platform !== "github").slice(0, 6),
      style: "for-the-badge",
    });
  }

  if (modern) {
    add("footer", { gradient: palette.gradient, type: "waving", height: 110, starCta: !!repoUrl, repoUrl });
  }

  return blocks;
}

/** Klasör ağacındaki üst klasörlere modül özetinden kısa açıklama ekler. */
function annotateTree(tree: string, detailed: DetailedResult | null): string {
  if (!detailed) return tree;
  const { groupSummaries, codemap } = detailed;
  const note = (dir: string): string => {
    if (codemap.embedded.includes(dir)) return "gömülü bileşen";
    if (codemap.dataDirs.includes(dir)) return "";
    const g = codemap.groups.find((x) => x.id === dir) ?? codemap.groups.find((x) => x.id.startsWith(dir + "/"));
    const summary = g ? groupSummaries[g.id]?.summary ?? "" : "";
    const first = summary.split(/(?<=[.!?])\s/)[0] ?? "";
    return first.length > 70 ? first.slice(0, 67).trimEnd() + "…" : first.replace(/\.$/, "");
  };
  // Veri/çıktı klasörlerini ve gömülü bileşenleri tek satıra indir; alt klasörlerdeki veri klasörlerini at.
  const hidden = new Set([...codemap.embedded, ...codemap.dataDirs]);
  const dataNames = new Set(codemap.dataDirs.map((d) => d.split("/").pop()));
  const kept: string[] = [];
  let collapsing = false;
  for (const line of tree.split("\n")) {
    const top = line.match(/^[├└]── (.+?)\/?$/);
    if (top) {
      collapsing = hidden.has(top[1]);
      kept.push(line);
      continue;
    }
    if (collapsing) continue;
    const child = line.match(/^│?\s+[├└]── (.+)\/$/);
    if (child && (dataNames.has(child[1]) || /^(outputs?|temp|tmp|cache|logs?|browser_data|tests?)$/i.test(child[1]))) continue;
    kept.push(line);
  }
  const width = Math.min(34, Math.max(...kept.filter((l) => /^[├└]── .+\/$/.test(l)).map((l) => l.length), 0) + 2);
  return kept
    .map((line) => {
      const m = line.match(/^[├└]── (.+)\/$/);
      if (!m) return line;
      const n = codemap.dataDirs.includes(m[1]) ? (detailed.codemap ? "veri / çıktı" : "") : note(m[1]);
      return n ? `${line.padEnd(width)}# ${n}` : line;
    })
    .join("\n");
}

/** Mevcut bir README.md'yi düzenlenebilir tek bir blok olarak içe aktarır. */
export function importMarkdownBlocks(markdown: string, lang: ReadmeLang): ReadmeBlock[] {
  return [createBlock("custom", 0, { title: "", content: markdown.trim() }, lang)];
}
