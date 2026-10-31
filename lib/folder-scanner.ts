import fs from "fs/promises";
import path from "path";

export type ProjectType =
  | "nodejs"
  | "python"
  | "dotnet"
  | "rust"
  | "go"
  | "java"
  | "unity"
  | "web"
  | "unknown";

export interface ScannedProject {
  name: string;
  path: string;
  type: ProjectType;
  hasGit: boolean;
  hasReadme: boolean;
  fileCount: number;
  totalSize: number;
  lastModified: Date;
}

// Klasörler her taramada atlanır (hem proje tespiti hem dosya sayımı).
export const IGNORED_FOLDERS = new Set([
  "node_modules",
  ".git",
  "__pycache__",
  ".venv",
  "venv",
  "env",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".turbo",
  ".vercel",
  "coverage",
  ".windsurf",
  ".opencode",
  "opencode-data",
  ".vscode",
  ".idea",
  ".cache",
  "bin",
  "obj",
  "target",
  // Unity
  "Library",
  "Temp",
  "Logs",
  "UserSettings",
]);

// Bu dosyalardan biri varsa klasör bir projedir.
const PROJECT_MARKERS: { file: string; type: ProjectType }[] = [
  { file: "package.json", type: "nodejs" },
  { file: "requirements.txt", type: "python" },
  { file: "pyproject.toml", type: "python" },
  { file: "setup.py", type: "python" },
  { file: "Pipfile", type: "python" },
  { file: "Cargo.toml", type: "rust" },
  { file: "go.mod", type: "go" },
  { file: "pom.xml", type: "java" },
  { file: "build.gradle", type: "java" },
  { file: "build.gradle.kts", type: "java" },
];

const SOURCE_EXTENSIONS = new Set([
  ".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".cs", ".go", ".rs",
  ".java", ".kt", ".html", ".php", ".rb", ".lua", ".cpp", ".c", ".h",
]);

const README_FILES = ["readme.md", "readme.txt", "readme.rst", "readme"];

// Kategori klasörlerinin (ör. "Bitenler") içine en fazla bu kadar inilir.
const MAX_CONTAINER_DEPTH = 3;
// Tek proje için sayılacak maksimum dosya — devasa klasörlerde taramayı sınırlar.
const MAX_FILES_PER_PROJECT = 20000;
const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry {
  root: string;
  time: number;
  projects: ScannedProject[];
}

let cache: CacheEntry | null = null;
let inflight: { root: string; promise: Promise<ScannedProject[]> } | null = null;

async function readDirSafe(dir: string) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function detectType(names: string[]): ProjectType | null {
  const lower = new Set(names.map((n) => n.toLowerCase()));
  // Unity, .csproj ürettiği için .NET kontrolünden önce gelmeli.
  if (lower.has("assets") && lower.has("projectsettings")) return "unity";
  for (const marker of PROJECT_MARKERS) {
    if (lower.has(marker.file.toLowerCase())) return marker.type;
  }
  if (names.some((n) => n.endsWith(".csproj") || n.endsWith(".sln"))) return "dotnet";
  if (lower.has("index.html")) return "web";
  return null;
}

/** Klasörün içeriği proje gibi görünüyor mu? Dönen değer: proje tipi veya null (kategori klasörü). */
function classifyFolder(entries: { name: string; isFile: boolean; isDir: boolean }[]): ProjectType | null {
  const names = entries.map((e) => e.name);
  const type = detectType(names);
  if (type) return type;

  const hasGit = names.includes(".git");
  const hasSource = entries.some(
    (e) => e.isFile && SOURCE_EXTENSIONS.has(path.extname(e.name).toLowerCase())
  );
  if (hasGit || hasSource) return "unknown";
  return null;
}

async function measure(dir: string): Promise<{ fileCount: number; totalSize: number; lastModified: Date }> {
  let fileCount = 0;
  let totalSize = 0;
  let lastModified = 0;
  const stack = [dir];

  while (stack.length > 0 && fileCount < MAX_FILES_PER_PROJECT) {
    const current = stack.pop()!;
    const entries = await readDirSafe(current);
    const fileStats: Promise<void>[] = [];

    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_FOLDERS.has(entry.name)) stack.push(full);
      } else if (entry.isFile()) {
        fileCount++;
        fileStats.push(
          fs.stat(full).then(
            (s) => {
              totalSize += s.size;
              if (s.mtimeMs > lastModified) lastModified = s.mtimeMs;
            },
            () => undefined
          )
        );
      }
    }
    await Promise.all(fileStats);
  }

  if (!lastModified) {
    try {
      lastModified = (await fs.stat(dir)).mtimeMs;
    } catch {
      lastModified = Date.now();
    }
  }

  return { fileCount, totalSize, lastModified: new Date(lastModified) };
}

async function discover(dir: string, depth: number, out: { path: string; type: ProjectType; names: string[] }[]) {
  const dirents = await readDirSafe(dir);
  const children = dirents.filter(
    (d) => d.isDirectory() && !d.name.startsWith(".") && !IGNORED_FOLDERS.has(d.name)
  );

  await Promise.all(
    children.map(async (child) => {
      const childPath = path.join(dir, child.name);
      const entries = await readDirSafe(childPath);
      if (entries.length === 0) return;

      const type = classifyFolder(
        entries.map((e) => ({ name: e.name, isFile: e.isFile(), isDir: e.isDirectory() }))
      );

      if (type) {
        out.push({ path: childPath, type, names: entries.map((e) => e.name) });
      } else if (depth < MAX_CONTAINER_DEPTH) {
        await discover(childPath, depth + 1, out);
      }
    })
  );
}

async function runScan(rootPath: string): Promise<ScannedProject[]> {
  try {
    const stat = await fs.stat(rootPath);
    if (!stat.isDirectory()) return [];
  } catch {
    return [];
  }

  const found: { path: string; type: ProjectType; names: string[] }[] = [];
  await discover(rootPath, 1, found);

  const projects = await Promise.all(
    found.map(async (f) => {
      const metrics = await measure(f.path);
      return {
        name: path.basename(f.path),
        path: f.path,
        type: f.type,
        hasGit: f.names.includes(".git"),
        hasReadme: f.names.some((n) => README_FILES.includes(n.toLowerCase())),
        ...metrics,
      } satisfies ScannedProject;
    })
  );

  return projects.filter((p) => p.fileCount > 0).sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Çalışma alanındaki projeleri bulur. Sonuç 5 dk önbelleklenir; aynı anda gelen
 * istekler tek bir taramayı paylaşır.
 */
export async function scanFolder(rootPath: string, forceRefresh = false): Promise<ScannedProject[]> {
  const root = path.resolve(rootPath);

  if (!forceRefresh && cache && cache.root === root && Date.now() - cache.time < CACHE_TTL) {
    return cache.projects;
  }
  if (inflight && inflight.root === root) {
    return inflight.promise;
  }

  const promise = runScan(root)
    .then((projects) => {
      cache = { root, time: Date.now(), projects };
      return projects;
    })
    .finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });

  inflight = { root, promise };
  return promise;
}

export function invalidateScanCache() {
  cache = null;
}
