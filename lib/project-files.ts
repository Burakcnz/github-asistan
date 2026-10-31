import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { IGNORED_FOLDERS } from "@/lib/folder-scanner";

const execFileAsync = promisify(execFile);

export interface PushFile {
  path: string;
  content: string;
  encoding: "utf-8" | "base64";
}

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
export const MAX_FILES = 3000;

// Asla yüklenmemesi gereken, sır içerebilecek dosyalar.
const SECRET_PATTERNS = [
  /^\.env(\..*)?$/i,
  /\.(pem|key|p12|pfx|keystore|jks|ppk)$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /^credentials(\.json)?$/i,
  /^service[-_]?account.*\.json$/i,
  /\.(db|sqlite|sqlite3|db-journal)$/i,
];

// Yüklemeye değmeyen büyük arşivler / derleme çıktıları.
const SKIP_EXTENSIONS = new Set([".zip", ".rar", ".7z", ".tar", ".gz", ".exe", ".dll", ".pdb", ".pyc", ".log"]);

export function isSecretFile(fileName: string): boolean {
  if (fileName === ".env.example" || fileName === ".env.sample") return false;
  return SECRET_PATTERNS.some((re) => re.test(fileName));
}

// git ls-files .gitignore'u zaten uygular; yine de bunlar asla yüklenmez.
const ALWAYS_SKIP_DIRS = new Set(["node_modules", ".venv", "venv", "__pycache__", ".next", ".git"]);

function shouldSkip(relPath: string, fromGit: boolean): boolean {
  const parts = relPath.split("/");
  const name = parts[parts.length - 1];
  const skipDirs = fromGit ? ALWAYS_SKIP_DIRS : IGNORED_FOLDERS;
  if (parts.slice(0, -1).some((p) => skipDirs.has(p))) return true;
  if (isSecretFile(name)) return true;
  return SKIP_EXTENSIONS.has(path.extname(name).toLowerCase());
}

export async function listWithGit(root: string): Promise<string[] | null> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-c", "core.quotepath=off", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: root, timeout: 15000, maxBuffer: 64 * 1024 * 1024, windowsHide: true }
    );
    return stdout.split("\0").filter(Boolean);
  } catch {
    return null;
  }
}

async function listWithWalk(root: string): Promise<string[]> {
  const out: string[] = [];
  const stack = [""];
  while (stack.length > 0 && out.length <= MAX_FILES * 2) {
    const rel = stack.pop()!;
    let entries;
    try {
      entries = await fs.readdir(path.join(root, rel), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!IGNORED_FOLDERS.has(entry.name) && entry.name !== ".git") stack.push(childRel);
      } else if (entry.isFile()) {
        out.push(childRel);
      }
    }
  }
  return out;
}

function isBinary(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, 8000);
  return sample.includes(0);
}

export interface CollectResult {
  files: PushFile[];
  skipped: number;
  error?: string;
}

/** Proje dosyalarını GitHub'a yüklenecek şekilde toplar (.gitignore dikkate alınır). */
export async function collectProjectFiles(root: string): Promise<CollectResult> {
  const hasGit = await fs
    .stat(path.join(root, ".git"))
    .then(() => true)
    .catch(() => false);
  const gitListed = hasGit ? await listWithGit(root) : null;
  const listed = gitListed ?? (await listWithWalk(root));
  const candidates = listed.map((p) => p.replace(/\\/g, "/")).filter((p) => !shouldSkip(p, !!gitListed));

  if (candidates.length > MAX_FILES) {
    return {
      files: [],
      skipped: 0,
      error: `Projede çok fazla dosya var (${candidates.length}). En fazla ${MAX_FILES} dosya yüklenebilir; .gitignore ekleyin.`,
    };
  }

  const files: PushFile[] = [];
  let skipped = listed.length - candidates.length;
  let total = 0;

  for (const rel of candidates) {
    const full = path.join(root, rel);
    let buffer: Buffer;
    try {
      const stat = await fs.stat(full);
      if (!stat.isFile() || stat.size > MAX_FILE_BYTES) {
        skipped++;
        continue;
      }
      buffer = await fs.readFile(full);
    } catch {
      skipped++;
      continue;
    }

    total += buffer.length;
    if (total > MAX_TOTAL_BYTES) {
      return {
        files: [],
        skipped,
        error: `Proje boyutu yükleme sınırını (${MAX_TOTAL_BYTES / 1024 / 1024} MB) aşıyor. Büyük dosyaları .gitignore'a ekleyin.`,
      };
    }

    files.push(
      isBinary(buffer)
        ? { path: rel, content: buffer.toString("base64"), encoding: "base64" }
        : { path: rel, content: buffer.toString("utf-8"), encoding: "utf-8" }
    );
  }

  return { files, skipped };
}
