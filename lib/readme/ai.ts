import { OLLAMA_BASE_URL } from "@/lib/env";
import type { ReadmeFacts } from "@/lib/readme/analyze";
import type { ReadmeLang } from "@/lib/readme/i18n";

export interface AiReadmeContent {
  tagline: string;
  description: string;
  features: { emoji: string; title: string; description: string }[];
  usage: string[];
}

const TIMEOUT_MS = 240_000;
const MODEL_PRIORITY = ["qwen2.5:14b", "qwen2.5-coder:14b", "mistral-nemo", "qwen2.5:7b", "qwen2.5-coder:7b", "llama3.1:8b", "qwen2.5:3b", "qwen2.5:1.5b"];

export async function listOllamaModels(): Promise<string[]> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models ?? []).map((m: { name: string }) => m.name).filter(Boolean);
  } catch {
    return [];
  }
}

export function pickModel(installed: string[], selected?: string | null, recommended?: string | null): string | null {
  // Embedding modelleri metin üretemez.
  const usable = installed.filter((m) => !/embed|bge|minilm/i.test(m));
  for (const wanted of [selected, recommended]) {
    if (!wanted) continue;
    const match = usable.find((m) => m === wanted || m === `${wanted}:latest` || m.startsWith(`${wanted}:`));
    if (match) return match;
  }
  for (const preferred of MODEL_PRIORITY) {
    const match = usable.find((m) => m.startsWith(preferred));
    if (match) return match;
  }
  return usable[0] ?? null;
}

function buildPrompt(facts: ReadmeFacts, lang: ReadmeLang): string {
  const language = lang === "tr" ? "Turkish (Türkçe)" : "English";
  const ctx: string[] = [
    `Project name: ${facts.name}`,
    `Project type: ${facts.type}`,
    facts.description && `Existing description: ${facts.description}`,
    facts.dependencies.length > 0 && `Dependencies: ${facts.dependencies.slice(0, 30).join(", ")}`,
    facts.techs.length > 0 && `Technologies: ${facts.techs.map((t) => t.name).join(", ")}`,
    Object.keys(facts.scripts).length > 0 && `package.json scripts: ${JSON.stringify(facts.scripts).slice(0, 600)}`,
    facts.runCommand && `Start command: ${facts.runCommand}`,
    facts.port && `Runs on: http://localhost:${facts.port}`,
    facts.routes.length > 0 && `HTTP routes: ${facts.routes.join(", ")}`,
    facts.envVars.length > 0 && `Environment variables: ${facts.envVars.map((e) => e.key).join(", ")}`,
    facts.tree && `File tree:\n${facts.tree.slice(0, 1500)}`,
    facts.infoText && `Notes written by the author:\n${facts.infoText.slice(0, 2000)}`,
    facts.existingReadme && `Current README (may be outdated):\n${facts.existingReadme.slice(0, 2500)}`,
    ...facts.codeSamples.map((s) => `--- ${s.file} ---\n${s.content}`),
  ].filter(Boolean) as string[];

  let context = ctx.join("\n\n");
  if (context.length > 14000) context = context.slice(0, 14000) + "\n…";

  return `You write README content for a software project. Read the project facts and source code below carefully and describe what THIS project actually does.

${context}

Respond with a single JSON object, written in ${language}, with exactly these keys:
{
  "tagline": "one sentence (max 15 words) saying what the project does",
  "description": "2-3 sentences: what problem it solves, who it is for, how it works at a high level",
  "features": [ { "emoji": "single emoji", "title": "2-4 words", "description": "one sentence on what this feature does" } ],
  "usage": [ "short step describing what the user does after the app starts" ]
}

Rules:
- Base everything on the code and facts above. Never invent features, integrations or platforms that are not visible in them.
- 3 to 6 features. Each description must add information beyond its title.
- 2 to 5 usage steps describing real actions in the running app (clicking, entering input, reading output). Do not repeat install or start commands.
- Do not mention the license, contributing, badges or the tech stack list.
- Plain text only inside the strings (no markdown headings, no HTML).
- All text in ${language}.`;
}

function str(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").replace(/^#+\s*/, "").trim().slice(0, max);
}

function parseContent(raw: string): AiReadmeContent | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      json = JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;

  const features = Array.isArray(obj.features)
    ? obj.features
        .map((f) => {
          const item = (f ?? {}) as Record<string, unknown>;
          const emoji = str(item.emoji, 8);
          return {
            emoji: emoji && !/[a-z0-9]/i.test(emoji) ? emoji : "✨",
            title: str(item.title, 60),
            description: str(item.description, 240),
          };
        })
        .filter((f) => f.title && f.description && f.title.toLowerCase() !== f.description.toLowerCase())
        .slice(0, 8)
    : [];

  const usage = Array.isArray(obj.usage)
    ? obj.usage.map((u) => str(u, 240).replace(/^\d+[.)]\s*/, "")).filter(Boolean).slice(0, 6)
    : typeof obj.usage === "string"
      ? [str(obj.usage, 600)]
      : [];

  const content: AiReadmeContent = {
    tagline: str(obj.tagline, 160),
    description: str(obj.description, 700),
    features,
    usage,
  };
  return content.tagline || content.features.length > 0 ? content : null;
}

export type AiResult = { ok: true; content: AiReadmeContent } | { ok: false; reason: string };

export async function generateReadmeWithAi(model: string, facts: ReadmeFacts, lang: ReadmeLang): Promise<AiResult> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: buildPrompt(facts, lang),
        stream: false,
        format: "json",
        options: { temperature: 0.3, num_ctx: 8192, num_predict: 1200 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, reason: `Ollama hatası (${res.status}) ${text.slice(0, 120)}`.trim() };
    }
    const data = await res.json();
    const content = parseContent(String(data.response ?? ""));
    return content ? { ok: true, content } : { ok: false, reason: "AI yanıtı anlaşılamadı" };
  } catch (error) {
    const name = (error as Error)?.name;
    return {
      ok: false,
      reason: name === "TimeoutError" ? "AI yanıtı zaman aşımına uğradı" : `AI'ye ulaşılamadı: ${(error as Error)?.message ?? error}`,
    };
  }
}

/** Proje için GitHub repo adı ve başlık önerileri (en fazla 3). Başarısızsa boş liste. */
export async function suggestRepoNames(
  model: string,
  facts: ReadmeFacts,
  folderName: string
): Promise<{ repoName: string; title: string }[]> {
  const context = [
    `Folder name: ${folderName}`,
    facts.description && `Description: ${facts.description}`,
    facts.dependencies.length > 0 && `Dependencies: ${facts.dependencies.slice(0, 20).join(", ")}`,
    facts.infoText && `Notes: ${facts.infoText.slice(0, 800)}`,
    facts.existingReadme && `README: ${facts.existingReadme.slice(0, 1200)}`,
    ...facts.codeSamples.slice(0, 2).map((s) => `--- ${s.file} ---\n${s.content.slice(0, 1200)}`),
  ]
    .filter(Boolean)
    .join("\n\n");

  const prompt = `Suggest 3 good GitHub repository names for this project.

${context}

Respond with JSON: {"names":[{"repo":"short-kebab-case-name","title":"Human Readable Title"}]}
Rules: repo names are 2-4 words, lowercase kebab-case, ASCII only, describe what the project does, no words like copy/backup/final/test/main. Titles may keep Turkish characters if the project is Turkish.`;

  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false, format: "json", options: { temperature: 0.5, num_ctx: 4096, num_predict: 300 } }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const parsed = JSON.parse(String(data.response ?? "{}")) as { names?: { repo?: unknown; title?: unknown }[] };
    return (parsed.names ?? [])
      .map((n) => ({
        repoName: String(n.repo ?? "")
          .toLowerCase()
          .replace(/[^a-z0-9._-]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60),
        title: str(n.title, 60),
      }))
      .filter((n) => n.repoName.length >= 3)
      .slice(0, 3);
  } catch {
    return [];
  }
}
