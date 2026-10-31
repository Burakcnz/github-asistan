import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { IGNORED_FOLDERS } from "@/lib/folder-scanner";

const execFileAsync = promisify(execFile);

interface FileEntry {
  name: string;
  isDir: boolean;
  size: number;
  lastModified: string;
}

const LANGUAGE_BY_EXT: Record<string, string> = {
  js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", cjs: "JavaScript",
  ts: "TypeScript", tsx: "TypeScript",
  py: "Python", pyw: "Python",
  rs: "Rust",
  go: "Go",
  cs: "C#",
  java: "Java",
  kt: "Kotlin",
  rb: "Ruby",
  php: "PHP",
  swift: "Swift",
  lua: "Lua",
  c: "C", h: "C",
  cpp: "C++", hpp: "C++", cc: "C++",
  html: "HTML", htm: "HTML",
  css: "CSS", scss: "SCSS", less: "CSS",
  vue: "Vue",
  svelte: "Svelte",
  sql: "SQL",
  sh: "Shell", bash: "Shell",
  ps1: "PowerShell",
  bat: "Batch",
  json: "JSON",
  yml: "YAML", yaml: "YAML",
  md: "Markdown",
  toml: "TOML",
  xml: "XML",
};

// Dil yüzdesine yalnızca kod dosyaları katılır.
const CODE_LANGUAGES = new Set([
  "JavaScript", "TypeScript", "Python", "Rust", "Go", "C#", "Java", "Kotlin", "Ruby", "PHP",
  "Swift", "Lua", "C", "C++", "HTML", "CSS", "SCSS", "Vue", "Svelte", "SQL", "Shell", "PowerShell", "Batch",
]);

function getFileLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return LANGUAGE_BY_EXT[ext] || "Other";
}

async function languageStats(root: string): Promise<Record<string, number>> {
  const sizes: Record<string, number> = {};
  const stack = [root];
  let visited = 0;

  while (stack.length > 0 && visited < 5000) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    const stats: Promise<void>[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_FOLDERS.has(entry.name)) stack.push(full);
        continue;
      }
      const lang = getFileLanguage(entry.name);
      if (!CODE_LANGUAGES.has(lang)) continue;
      visited++;
      stats.push(
        fs.stat(full).then(
          (s) => {
            sizes[lang] = (sizes[lang] || 0) + s.size;
          },
          () => undefined
        )
      );
    }
    await Promise.all(stats);
  }

  const total = Object.values(sizes).reduce((a, b) => a + b, 0);
  if (!total) return {};

  const percentages: Record<string, number> = {};
  for (const [lang, size] of Object.entries(sizes).sort((a, b) => b[1] - a[1])) {
    const pct = Math.round((size / total) * 1000) / 10;
    if (pct >= 0.1) percentages[lang] = pct;
  }
  return percentages;
}

async function commitHistory(cwd: string) {
  const SEP = "\x1f";
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["log", "-20", `--pretty=format:%s${SEP}%aI${SEP}%an`],
      { cwd, timeout: 5000, windowsHide: true, encoding: "utf-8" }
    );
    return stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [message = "", date = "", author = ""] = line.split(SEP);
        return { message, date, author };
      });
  } catch {
    return [];
  }
}

async function listTopLevel(root: string): Promise<FileEntry[]> {
  let dirents;
  try {
    dirents = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const entries = await Promise.all(
    dirents
      .filter((d) => !d.name.startsWith(".") && !IGNORED_FOLDERS.has(d.name))
      .map(async (d) => {
        try {
          const stat = await fs.stat(path.join(root, d.name));
          return { name: d.name, isDir: d.isDirectory(), size: stat.size, lastModified: stat.mtime.toISOString() };
        } catch {
          return { name: d.name, isDir: d.isDirectory(), size: 0, lastModified: new Date().toISOString() };
        }
      })
  );

  return entries.sort((a, b) => (a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name)));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const project = await db.project.findUnique({
      where: { id },
      include: { readme: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
    }

    const exists = await fs
      .stat(project.localPath)
      .then((s) => s.isDirectory())
      .catch(() => false);

    const [entries, languagePercentages, commits] = exists
      ? await Promise.all([
          listTopLevel(project.localPath),
          languageStats(project.localPath),
          project.hasGit ? commitHistory(project.localPath) : Promise.resolve([]),
        ])
      : [[], {}, []];

    const folders = entries.filter((e) => e.isDir);
    const files = entries.filter((e) => !e.isDir);

    // Diskteki README.md: uygulamada README yoksa gösterilir, editörde içe aktarılabilir.
    let localReadme: string | null = null;
    if (exists) {
      const readmeFile = files.find((f) => /^readme\.md$/i.test(f.name));
      if (readmeFile && readmeFile.size < 512 * 1024) {
        localReadme = await fs.readFile(path.join(project.localPath, readmeFile.name), "utf-8").catch(() => null);
      }
    }

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        type: project.type,
        localPath: project.localPath,
        exists,
        fileCount: project.fileCount,
        totalSize: project.totalSize,
        lastModified: project.lastModified.toISOString(),
        hasGit: project.hasGit,
        hasReadme: project.hasReadme || !!project.readme,
        isOnGithub: project.isOnGithub,
        isHidden: project.isHidden,
        githubUrl: project.githubUrl,
        repoName: project.repoName,
        displayName: project.displayName,
        description: project.description,
        folders: folders.map((f) => ({ name: f.name, lastModified: f.lastModified })),
        files: files.map((f) => ({
          name: f.name,
          size: f.size,
          lastModified: f.lastModified,
          language: getFileLanguage(f.name),
        })),
      },
      readme: project.readme
        ? { content: project.readme.content, version: project.readme.version, source: "app" }
        : localReadme
          ? { content: localReadme, version: 0, source: "local" }
          : null,
      localReadme,
      commitHistory: commits,
      languagePercentages,
    });
  } catch (error) {
    console.error("Failed to get project:", error);
    return NextResponse.json({ error: "Proje yüklenemedi" }, { status: 500 });
  }
}
