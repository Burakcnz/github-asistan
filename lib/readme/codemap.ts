// Projenin kod haritası: AI kullanmadan dosyalardan sinyal (docstring, fonksiyon/sınıf adları,
// HTTP rotaları, ortam değişkenleri, CLI argümanları, arayüz metinleri) çıkarır ve alan gruplarına ayırır.
import { createHash } from "crypto";
import fs from "fs/promises";
import path from "path";
import { IGNORED_FOLDERS } from "@/lib/folder-scanner";
import { listWithGit } from "@/lib/project-files";

export interface RouteInfo {
  method: string;
  path: string;
  handler: string;
  doc: string;
  file: string;
  group: string;
}

export interface EnvVarInfo {
  key: string;
  defaultValue: string;
  files: string[];
}

export interface FileSignals {
  rel: string;
  size: number;
  doc: string;
  classes: string[];
  functions: { name: string; doc: string }[];
  routes: RouteInfo[];
  env: { key: string; defaultValue: string }[];
  cliArgs: { flag: string; help: string }[];
  uiTexts: string[];
}

export interface CodeGroup {
  id: string;
  files: FileSignals[];
  /** Dosya listesi + boyut + değişiklik zamanı özeti (önbellek anahtarı). */
  hash: string;
}

export interface DocInfo {
  path: string;
  title: string;
  headings: string[];
  excerpt: string;
}

export interface CodeMap {
  groups: CodeGroup[];
  routes: RouteInfo[];
  envVars: EnvVarInfo[];
  /** İç içe bağımsız repolar / gömülü bileşenler (içleri taranmaz). */
  embedded: string[];
  /** Veri/çıktı klasörleri (atlandı). */
  dataDirs: string[];
  docs: DocInfo[];
  sourceFileCount: number;
}

const SOURCE_EXT = new Set([".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".vue", ".svelte", ".html", ".cs", ".go", ".rs", ".java", ".kt", ".rb", ".php", ".lua", ".gd"]);
const SKIP_FILE = /(\.min\.js|\.d\.ts|\.test\.[jt]sx?|\.spec\.[jt]sx?|_test\.py|test_.*\.py)$/i;
const SKIP_DIRS = new Set([...IGNORED_FOLDERS, "tests", "test", "__tests__", "migrations", "site-packages", "vendor", "third_party", "static/vendor"]);
const MAX_SOURCE_FILES = 400;
const MAX_FILE_BYTES = 400 * 1024;
const GROUP_SPLIT_FILES = 25;

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const firstLine = (s: string) => s.trim().split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";

// ---------- listeleme ----------

async function walk(root: string): Promise<{ files: string[]; embedded: string[] }> {
  const files: string[] = [];
  const embedded: string[] = [];
  async function visit(rel: string, depth: number) {
    if (files.length > 20000 || depth > 8) return;
    let entries;
    try {
      entries = await fs.readdir(path.join(root, rel), { withFileTypes: true });
    } catch {
      return;
    }
    if (rel && entries.some((e) => e.name === ".git")) {
      embedded.push(rel);
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const child = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) await visit(child, depth + 1);
      } else if (e.isFile()) {
        files.push(child);
      }
    }
  }
  await visit("", 0);
  return { files, embedded };
}

async function listAll(root: string): Promise<{ files: string[]; embedded: string[] }> {
  const hasGit = await fs.stat(path.join(root, ".git")).then(() => true, () => false);
  if (hasGit) {
    const listed = await listWithGit(root);
    if (listed) {
      const embedded = listed.filter((p) => p.endsWith("/")).map((p) => p.replace(/\/$/, ""));
      const files = listed
        .filter((p) => !p.endsWith("/"))
        .map((p) => p.replace(/\\/g, "/"))
        .filter((p) => !p.split("/").slice(0, -1).some((seg) => SKIP_DIRS.has(seg) || seg.startsWith(".")));
      return { files, embedded };
    }
  }
  return walk(root);
}

// ---------- sinyal çıkarımı ----------

function pyModuleDoc(text: string): string {
  const m = text.replace(/^(#.*\r?\n|\s*\r?\n)*/, "").match(/^[rubRUB]{0,2}("""|''')([\s\S]*?)\1/);
  return m ? clip(m[2].trim().replace(/\s+/g, " "), 240) : "";
}

function jsModuleDoc(text: string): string {
  const m = text.match(/^\s*(?:(?:"use client"|'use client');?\s*)?\/\*\*?([\s\S]*?)\*\//);
  if (m) return clip(m[1].replace(/^\s*\*\s?/gm, "").trim().replace(/\s+/g, " "), 240);
  const lines = text.split(/\r?\n/).slice(0, 6).filter((l) => l.trim().startsWith("//"));
  return clip(lines.map((l) => l.replace(/^\s*\/\/\s?/, "")).join(" ").trim(), 240);
}

function pyDocAfter(text: string, index: number): string {
  const rest = text.slice(index, index + 1500);
  const m = rest.match(/:\s*\r?\n\s+[rubRUB]{0,2}("""|''')([\s\S]*?)\1/);
  return m ? clip(firstLine(m[2]), 160) : "";
}

function extractPython(text: string, rel: string, prefixes: Map<string, string>): Omit<FileSignals, "rel" | "size" | "uiTexts"> {
  const classes = [...text.matchAll(/^class\s+(\w+)/gm)].map((m) => m[1]);
  const functions: { name: string; doc: string }[] = [];
  for (const m of text.matchAll(/^(\s{0,4})(?:async\s+)?def\s+(\w+)\s*\(/gm)) {
    if (m[2].startsWith("_")) continue;
    functions.push({ name: m[2], doc: pyDocAfter(text, (m.index ?? 0) + m[0].length) });
  }

  // APIRouter(prefix=...) ve Flask Blueprint(url_prefix=...)
  const localPrefix = new Map<string, string>();
  for (const m of text.matchAll(/(\w+)\s*=\s*(?:APIRouter|Blueprint)\(([^)]*)\)/g)) {
    const p = m[2].match(/(?:url_)?prefix\s*=\s*["']([^"']*)["']/)?.[1] ?? "";
    localPrefix.set(m[1], p);
  }
  const moduleKey = rel.replace(/\.py$/, "").replace(/\//g, ".");
  const includePrefix = prefixes.get(moduleKey) ?? prefixes.get(moduleKey.split(".").pop() ?? "") ?? "";

  const routes: RouteInfo[] = [];
  const routeRe = /@(\w+)\.(get|post|put|delete|patch|websocket|route|api_route)\(\s*["']([^"']*)["']([^)]*)\)\s*(?:\r?\n\s*@[^\n]*)*\r?\n\s*(?:async\s+)?def\s+(\w+)/g;
  for (const m of text.matchAll(routeRe)) {
    const [, obj, verb, p, rest, handler] = m;
    let methods = [verb.toUpperCase()];
    if (verb === "route" || verb === "api_route") {
      const ms = rest.match(/methods\s*=\s*\[([^\]]*)\]/)?.[1];
      methods = ms ? [...ms.matchAll(/["'](\w+)["']/g)].map((x) => x[1].toUpperCase()) : ["GET"];
    }
    if (verb === "websocket") methods = ["WS"];
    const full = (includePrefix + (localPrefix.get(obj) ?? "") + p).replace(/\/{2,}/g, "/") || "/";
    const doc = pyDocAfter(text, (m.index ?? 0) + m[0].length);
    for (const method of methods) routes.push({ method, path: full, handler, doc, file: rel, group: "" });
  }

  const env: { key: string; defaultValue: string }[] = [];
  for (const m of text.matchAll(/os\.(?:getenv|environ\.get)\(\s*["'](\w+)["']\s*(?:,\s*([^)\n]+))?\)/g)) {
    env.push({ key: m[1], defaultValue: (m[2] ?? "").trim().replace(/^["']|["']$/g, "") });
  }
  for (const m of text.matchAll(/os\.environ\[\s*["'](\w+)["']\s*\]/g)) env.push({ key: m[1], defaultValue: "" });

  const cliArgs = [...text.matchAll(/add_argument\(\s*["'](-{1,2}[\w-]+)["'][^)]*?(?:help\s*=\s*["']([^"']*)["'])?/g)].map((m) => ({
    flag: m[1],
    help: m[2] ?? "",
  }));

  return { doc: pyModuleDoc(text), classes, functions: functions.slice(0, 60), routes, env, cliArgs };
}

function extractJs(text: string, rel: string): Omit<FileSignals, "rel" | "size" | "uiTexts"> {
  const classes = [...text.matchAll(/(?:^|\s)class\s+(\w+)/g)].map((m) => m[1]);
  const functions: { name: string; doc: string }[] = [];
  const fnRe = /(?:\/\*\*([\s\S]*?)\*\/\s*)?(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+(\w+)|(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/g;
  for (const m of text.matchAll(fnRe)) {
    const name = m[2] ?? m[3];
    if (!name || name.startsWith("_")) continue;
    const doc = m[1] ? clip(firstLine(m[1].replace(/^\s*\*\s?/gm, "")), 160) : "";
    functions.push({ name, doc });
  }

  const routes: RouteInfo[] = [];
  // Next.js app router: app/**/route.ts
  const nextRoute = rel.match(/^(?:src\/)?app\/(.*?)\/?route\.(?:t|j)sx?$/);
  if (nextRoute) {
    const p = "/" + nextRoute[1].replace(/\([^)]*\)\//g, "").replace(/\[([^\]]+)\]/g, ":$1");
    for (const m of text.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)) {
      routes.push({ method: m[1], path: p.replace(/\/$/, "") || "/", handler: m[1], doc: "", file: rel, group: "" });
    }
  }
  // Express / Fastify / Hono
  for (const m of text.matchAll(/\b(?:app|router|server|fastify)\.(get|post|put|delete|patch)\(\s*["'`]([^"'`]+)["'`]/g)) {
    routes.push({ method: m[1].toUpperCase(), path: m[2], handler: "", doc: "", file: rel, group: "" });
  }

  const env: { key: string; defaultValue: string }[] = [];
  for (const m of text.matchAll(/(?:process\.env|import\.meta\.env)\.(\w+)(?:\s*(?:\|\||\?\?)\s*["'`]?([^"'`\s,;)]+))?/g)) {
    env.push({ key: m[1], defaultValue: m[2] ?? "" });
  }
  return { doc: jsModuleDoc(text), classes, functions: functions.slice(0, 60), routes, env, cliArgs: [] };
}

function extractHtmlTexts(text: string): string[] {
  const out: string[] = [];
  const clean = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&amp;/g, " ").replace(/\s+/g, " ").trim();
  const title = text.match(/<title>([^<]+)<\/title>/i)?.[1];
  if (title) out.push(`title: ${clean(title)}`);
  for (const m of text.matchAll(/<(h[1-3]|button|label|summary|option)[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const t = clean(m[2]);
    if (t.length >= 2 && t.length <= 60 && !/[{}$]/.test(t)) out.push(t);
  }
  for (const m of text.matchAll(/(?:placeholder|title|aria-label)=["']([^"']{3,60})["']/gi)) out.push(m[1]);
  return [...new Set(out)].slice(0, 50);
}

function extractGeneric(text: string): Omit<FileSignals, "rel" | "size" | "uiTexts"> {
  const classes = [...text.matchAll(/\b(?:class|struct|interface)\s+(\w+)/g)].map((m) => m[1]).slice(0, 30);
  const functions = [...text.matchAll(/\b(?:func|fn|public\s+(?:static\s+)?[\w<>[\]]+|private\s+[\w<>[\]]+|void|def)\s+(\w+)\s*\(/g)]
    .map((m) => ({ name: m[1], doc: "" }))
    .slice(0, 40);
  return { doc: jsModuleDoc(text), classes, functions, routes: [], env: [], cliArgs: [] };
}

// ---------- dokümanlar ----------

async function readDoc(root: string, rel: string): Promise<DocInfo | null> {
  try {
    const text = (await fs.readFile(path.join(root, rel), "utf-8")).slice(0, 60_000);
    const title = text.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? path.basename(rel, ".md");
    const headings = [...text.matchAll(/^#{2,3}\s+(.+)$/gm)].map((m) => m[1].trim()).slice(0, 25);
    const excerpt = clip(text.replace(/```[\s\S]*?```/g, "").replace(/^#.*$/gm, "").replace(/\s+/g, " ").trim(), 600);
    return { path: rel, title, headings, excerpt };
  } catch {
    return null;
  }
}

// ---------- ana fonksiyon ----------

export async function buildCodeMap(root: string): Promise<CodeMap> {
  const { files: all, embedded } = await listAll(root);

  // Veri/çıktı klasörleri: çok dosyalı ama kaynak oranı çok düşük üst klasörler.
  const byTop = new Map<string, { total: number; source: number }>();
  for (const rel of all) {
    if (!rel.includes("/")) continue;
    const top = rel.split("/")[0];
    const s = byTop.get(top) ?? { total: 0, source: 0 };
    s.total++;
    if (SOURCE_EXT.has(path.extname(rel).toLowerCase())) s.source++;
    byTop.set(top, s);
  }
  const dataDirs = [...byTop.entries()].filter(([, s]) => s.total >= 20 && s.source / s.total < 0.05).map(([d]) => d);
  const dataSet = new Set(dataDirs);

  const sources = all
    .filter((rel) => SOURCE_EXT.has(path.extname(rel).toLowerCase()) && !SKIP_FILE.test(rel))
    .filter((rel) => !dataSet.has(rel.split("/")[0]) && !embedded.some((e) => rel.startsWith(e + "/")));

  // Önem sırası: router/api/servis/motor/pipeline + giriş dosyaları önce.
  const score = (rel: string) => {
    let s = 0;
    if (/(^|\/)(api|routes?|routers?|controllers?)\//i.test(rel) || /router|routes/i.test(path.basename(rel))) s += 5;
    if (/(services?|engines?|core|pipelines?|lib)\//i.test(rel)) s += 3;
    if (/^(main|app|server|run|index|manage)\.[a-z]+$/i.test(path.basename(rel))) s += 4;
    s -= rel.split("/").length * 0.3;
    return s;
  };
  const selected = [...sources].sort((a, b) => score(b) - score(a)).slice(0, MAX_SOURCE_FILES);

  // include_router / register_blueprint önekleri (Python)
  const prefixes = new Map<string, string>();
  const stats = new Map<string, { size: number; mtime: number }>();
  const texts = new Map<string, string>();
  await Promise.all(
    selected.map(async (rel) => {
      try {
        const st = await fs.stat(path.join(root, rel));
        if (st.size > MAX_FILE_BYTES) return;
        stats.set(rel, { size: st.size, mtime: st.mtimeMs });
        texts.set(rel, await fs.readFile(path.join(root, rel), "utf-8"));
      } catch {
        // okunamadı
      }
    })
  );
  for (const [, text] of texts) {
    const aliasToModule = new Map<string, string>();
    for (const m of text.matchAll(/from\s+([\w.]+)\s+import\s+(\w+)(?:\s+as\s+(\w+))?/g)) {
      aliasToModule.set(m[3] ?? m[2], m[2] === "router" || m[2] === "bp" ? m[1] : `${m[1]}.${m[2]}`);
    }
    for (const m of text.matchAll(/(?:include_router|register_blueprint)\(\s*(\w+)(?:\.router)?\s*(?:,[^)]*?(?:url_)?prefix\s*=\s*["']([^"']*)["'])?/g)) {
      const mod = aliasToModule.get(m[1]);
      if (mod && m[2]) {
        prefixes.set(mod, m[2]);
        prefixes.set(mod.split(".").pop() ?? mod, m[2]);
      }
    }
  }

  const signals: FileSignals[] = [];
  for (const rel of selected) {
    const text = texts.get(rel);
    if (text === undefined) continue;
    const ext = path.extname(rel).toLowerCase();
    let base: Omit<FileSignals, "rel" | "size" | "uiTexts">;
    let uiTexts: string[] = [];
    if (ext === ".py") base = extractPython(text, rel, prefixes);
    else if ([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"].includes(ext)) base = extractJs(text, rel);
    else if ([".html", ".vue", ".svelte"].includes(ext)) {
      base = { ...extractJs(text, rel), doc: "" };
      uiTexts = extractHtmlTexts(text);
    } else base = extractGeneric(text);
    if (/\.(tsx|jsx)$/.test(ext)) uiTexts = extractHtmlTexts(text).slice(0, 25);
    signals.push({ rel, size: stats.get(rel)?.size ?? text.length, uiTexts, ...base });
  }

  // Gruplama
  const groupOf = (rel: string, depth: number) => {
    const parts = rel.split("/");
    if (parts.length === 1) return "(kök)";
    return parts.slice(0, Math.min(depth, parts.length - 1)).join("/");
  };
  const buckets = new Map<string, FileSignals[]>();
  for (const s of signals) {
    const g = groupOf(s.rel, 1);
    buckets.set(g, [...(buckets.get(g) ?? []), s]);
  }
  // Büyük grupları ikinci seviyeye böl
  for (const [g, list] of [...buckets.entries()]) {
    if (g === "(kök)" || list.length <= GROUP_SPLIT_FILES) continue;
    buckets.delete(g);
    for (const s of list) {
      const sub = groupOf(s.rel, 2);
      buckets.set(sub, [...(buckets.get(sub) ?? []), s]);
    }
  }

  const groups: CodeGroup[] = [...buckets.entries()]
    .map(([id, list]) => {
      const sorted = list.sort((a, b) => a.rel.localeCompare(b.rel));
      const hash = createHash("sha1")
        .update(sorted.map((s) => `${s.rel}:${stats.get(s.rel)?.size}:${Math.round(stats.get(s.rel)?.mtime ?? 0)}`).join("|"))
        .digest("hex")
        .slice(0, 16);
      for (const s of sorted) for (const r of s.routes) r.group = id;
      return { id, files: sorted, hash };
    })
    .sort((a, b) => b.files.reduce((n, f) => n + f.size, 0) - a.files.reduce((n, f) => n + f.size, 0));

  // Rotalar (tekrar yok) ve ortam değişkenleri
  const routeKey = new Set<string>();
  const routes: RouteInfo[] = [];
  for (const g of groups)
    for (const f of g.files)
      for (const r of f.routes) {
        const k = `${r.method} ${r.path}`;
        if (!routeKey.has(k)) {
          routeKey.add(k);
          routes.push(r);
        }
      }

  const envMap = new Map<string, EnvVarInfo>();
  for (const s of signals)
    for (const e of s.env) {
      if (/^(NODE_ENV|PATH|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|TEMP|TMP|PWD|PYTHONPATH|PYTHONIOENCODING|PYTHONUNBUFFERED|WINDIR|SYSTEMROOT|COMSPEC|USERNAME|COMPUTERNAME)$/.test(e.key)) continue;
      const cur = envMap.get(e.key) ?? { key: e.key, defaultValue: "", files: [] };
      // Anahtar/token benzeri değişkenlerin varsayılanı README'ye asla yazılmaz (kodda gerçek anahtar olabilir).
      const secretLike = /(KEY|SECRET|TOKEN|PASS|PWD|CLIENT_ID|PRIVATE|CREDENTIAL|AUTH)/i.test(e.key);
      const plainValue = /^[\w./:@-]{1,60}$/.test(e.defaultValue);
      if (!cur.defaultValue && !secretLike && plainValue && !/^(None|null|undefined)$/.test(e.defaultValue)) cur.defaultValue = e.defaultValue;
      if (!cur.files.includes(s.rel)) cur.files.push(s.rel);
      envMap.set(e.key, cur);
    }

  // Dokümanlar: kök ve docs/ altındaki .md'ler (README hariç)
  const docPaths = all
    .filter((rel) => /\.md$/i.test(rel) && !/^readme\.md$/i.test(rel) && !/(^|\/)(license|changelog|code_of_conduct|security|agents|claude|gemini|copilot-instructions)\.md$/i.test(rel))
    .filter((rel) => !rel.includes("/") || /^docs?\//i.test(rel))
    .filter((rel) => !embedded.some((e) => rel.startsWith(e + "/")))
    .slice(0, 12);
  const docs = (await Promise.all(docPaths.map((p) => readDoc(root, p)))).filter((d): d is DocInfo => !!d);

  return {
    groups,
    routes,
    envVars: [...envMap.values()].sort((a, b) => a.key.localeCompare(b.key)),
    embedded,
    dataDirs,
    docs,
    sourceFileCount: sources.length,
  };
}

/** Bir grubu AI'a verilecek kompakt metne çevirir (bütçe karakter). */
export function describeGroup(group: CodeGroup, budget = 9000): string {
  const lines: string[] = [`GROUP ${group.id} (${group.files.length} files)`];
  for (const f of group.files) {
    const parts: string[] = [`## ${f.rel}${f.doc ? ` — ${f.doc}` : ""}`];
    if (f.classes.length) parts.push(`classes: ${f.classes.slice(0, 15).join(", ")}`);
    const fns = f.functions.filter((fn) => !f.routes.some((r) => r.handler === fn.name));
    if (fns.length) parts.push(`functions: ${fns.slice(0, 25).map((fn) => (fn.doc ? `${fn.name} (${fn.doc})` : fn.name)).join("; ")}`);
    if (f.routes.length) parts.push(`routes: ${f.routes.map((r) => `${r.method} ${r.path}${r.doc ? ` — ${r.doc}` : r.handler ? ` [${r.handler}]` : ""}`).join("; ")}`);
    if (f.cliArgs.length) parts.push(`cli: ${f.cliArgs.map((a) => `${a.flag}${a.help ? ` (${a.help})` : ""}`).join(", ")}`);
    if (f.env.length) parts.push(`env: ${[...new Set(f.env.map((e) => e.key))].join(", ")}`);
    if (f.uiTexts.length) parts.push(`ui: ${f.uiTexts.slice(0, 30).join(" | ")}`);
    lines.push(parts.join("\n"));
  }
  const text = lines.join("\n");
  return text.length > budget ? text.slice(0, budget) + "\n…(kısaltıldı)" : text;
}
