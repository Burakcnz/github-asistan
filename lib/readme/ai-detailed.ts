// Detaylı (çok aşamalı) README üretimi için Ollama çağrıları.
// Aşama 1: her modül grubunun özeti. Aşama 2: tüm özetlerden detaylı içerik sentezi.
import { OLLAMA_BASE_URL } from "@/lib/env";
import type { ReadmeLang } from "@/lib/readme/i18n";

export interface GroupSummary {
  summary: string;
  capabilities: { title: string; details: string[] }[];
  userActions: string[];
  routeDescriptions: Record<string, string>;
  envDescriptions: Record<string, string>;
}

export interface DetailedContent {
  tagline: string;
  overview: string;
  featureGroups: { emoji: string; title: string; items: string[] }[];
  workflow: { title: string; description: string }[];
  components: { name: string; role: string }[];
  usageFlows: { title: string; steps: string[] }[];
}

const langName = (lang: ReadmeLang) => (lang === "tr" ? "Turkish (Türkçe)" : "English");

function str(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").replace(/^#+\s*/, "").trim().slice(0, max);
}

const strList = (v: unknown, maxItems: number, maxLen: number): string[] =>
  Array.isArray(v) ? v.map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems) : [];

function strRecord(v: unknown, maxLen: number): Record<string, string> {
  const out: Record<string, string> = {};
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const s = str(val, maxLen);
      if (s) out[k.trim()] = s;
    }
  }
  return out;
}

function objList(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {})) : [];
}

const cleanEmoji = (v: unknown) => {
  const e = str(v, 8);
  return e && !/[a-z0-9]/i.test(e) ? e : "✨";
};

async function callOllamaJson(
  model: string,
  prompt: string,
  numPredict: number,
  timeoutMs: number
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: "json",
        options: { temperature: 0.3, num_ctx: 16384, num_predict: numPredict },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = String(data.response ?? "");
    try {
      return JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      return m ? JSON.parse(m[0]) : null;
    }
  } catch {
    return null;
  }
}

/** Aşama 1: bir modül grubunun ne yaptığını özetler. */
export async function summarizeGroup(
  model: string,
  projectName: string,
  groupText: string,
  lang: ReadmeLang
): Promise<GroupSummary | null> {
  const prompt = [
    `You are documenting the project "${projectName}". Below is a structural map of ONE part of its source code (file docstrings, class/function names, HTTP routes, CLI args, UI texts).`,
    "",
    groupText,
    "",
    `Describe what this part of the project does. Respond with JSON in ${langName(lang)}:`,
    `{"summary": "1-2 sentences: the responsibility of this part",`,
    ` "capabilities": [{"title": "2-5 words", "details": ["concrete thing it does"]}],`,
    ` "userActions": ["something an end user can do thanks to this part"],`,
    ` "routeDescriptions": {"METHOD /path": "short description"},`,
    ` "envDescriptions": {"ENV_NAME": "what it configures"}}`,
    "Rules: be concrete and specific (mention formats, providers, algorithms, limits you can see). 2-6 capabilities with 2-6 details each.",
    "Only describe what the map shows; do not invent. Plain text strings only. routeDescriptions only for routes listed above.",
  ].join("\n");

  const obj = await callOllamaJson(model, prompt, 1500, 180_000);
  if (!obj) return null;
  const capabilities = objList(obj.capabilities)
    .map((c) => ({ title: str(c.title, 60), details: strList(c.details, 8, 220) }))
    .filter((c) => c.title)
    .slice(0, 8);
  const summary = str(obj.summary, 400);
  if (!summary && capabilities.length === 0) return null;
  return {
    summary,
    capabilities,
    userActions: strList(obj.userActions, 8, 200),
    routeDescriptions: strRecord(obj.routeDescriptions, 160),
    envDescriptions: strRecord(obj.envDescriptions, 160),
  };
}

function parseDetailed(obj: Record<string, unknown> | null): DetailedContent | null {
  if (!obj) return null;
  const content: DetailedContent = {
    tagline: str(obj.tagline, 160),
    overview: typeof obj.overview === "string" ? obj.overview.trim().replace(/^#+\s*/gm, "").slice(0, 1500) : "",
    featureGroups: objList(obj.featureGroups)
      .map((g) => ({ emoji: cleanEmoji(g.emoji), title: str(g.title, 70), items: strList(g.items, 10, 260) }))
      .filter((g) => g.title && g.items.length > 0)
      .slice(0, 14),
    workflow: objList(obj.workflow)
      .map((w) => ({ title: str(w.title, 40), description: str(w.description, 220) }))
      .filter((w) => w.title)
      .slice(0, 8),
    components: objList(obj.components)
      .map((c) => ({ name: str(c.name, 60), role: str(c.role, 220) }))
      .filter((c) => c.name && c.role)
      .slice(0, 14),
    usageFlows: objList(obj.usageFlows)
      .map((f) => ({ title: str(f.title, 70), steps: strList(f.steps, 10, 240).map((s) => s.replace(/^\d+[.)]\s*/, "")) }))
      .filter((f) => f.title && f.steps.length > 0)
      .slice(0, 6),
  };
  return content.featureGroups.length > 0 || content.overview ? content : null;
}

function schemaText(lang: ReadmeLang): string {
  return [
    `Respond with JSON in ${langName(lang)}:`,
    `{"tagline": "one sentence (max 15 words)",`,
    ` "overview": "2-3 short paragraphs (separate with blank lines): what the project is, who it is for, what makes it useful",`,
    ` "featureGroups": [{"emoji": "one emoji", "title": "feature area name", "items": ["specific capability with concrete details"]}],`,
    ` "workflow": [{"title": "stage name (2-3 words)", "description": "what happens in this stage"}],`,
    ` "components": [{"name": "module or folder", "role": "its responsibility"}],`,
    ` "usageFlows": [{"title": "a task the user wants to do", "steps": ["action in the app"]}]}`,
    "Rules:",
    "- Cover ALL major areas of the project: aim for 6-12 featureGroups with 3-8 concrete items each (mention providers, formats, limits, options seen in the material).",
    "- workflow: 3-7 stages describing how data flows through the system end to end.",
    "- components: the main modules/folders and their roles.",
    "- usageFlows: 2-5 realistic tasks with 3-8 steps each, describing actions in the running app (not install commands).",
    "- Never invent features, platforms or integrations that are not visible in the material. Keep correct facts from the author's README.",
    `- Plain text inside strings (no markdown headings). All text in ${langName(lang)}.`,
  ].join("\n");
}

/** Aşama 2 (veya Standart modda tek çağrı): malzemeden detaylı README içeriği sentezler. */
export async function synthesizeDetailed(
  model: string,
  projectName: string,
  material: string,
  lang: ReadmeLang
): Promise<DetailedContent | null> {
  const prompt = [
    `You are writing a detailed, professional README for the project "${projectName}". Use the material below (analysis of the codebase, project docs and the author's existing README).`,
    "",
    material.slice(0, 30000),
    "",
    schemaText(lang),
  ].join("\n");
  return parseDetailed(await callOllamaJson(model, prompt, 3500, 300_000));
}
