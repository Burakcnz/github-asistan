import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { IGNORED_FOLDERS, type ProjectType } from "@/lib/folder-scanner";
import { LANGUAGE_TECH, TECH_BY_DEP, type TechInfo } from "@/lib/readme/tech";

const execFileAsync = promisify(execFile);

export interface ReadmeFacts {
  name: string;
  type: ProjectType;
  description: string;
  /** Manifestteki sürüm (package.json / pyproject / Cargo). */
  version: string;
  /** Manifestteki paket adı (repo adı önerisi için). */
  packageName: string;
  /** Mevcut README'nin ilk "# Başlık"ı. */
  readmeTitle: string;
  /** Mevcut README.md içeriği (varsa, kısaltılmış). */
  existingReadme: string;
  /** about/info/description dosyalarının içeriği. */
  infoText: string;
  dependencies: string[];
  techs: TechInfo[];
  scripts: Record<string, string>;
  prerequisites: string[];
  /** Klonlamadan sonraki kurulum adımları. */
  installSteps: { kind: "venv" | "activate" | "install" | "build" | "db" | "env"; command: string }[];
  runCommand: string;
  launcher: string;
  port: string;
  envVars: { key: string; value: string; description: string }[];
  license: string;
  hasLicenseFile: boolean;
  repo: { owner: string; name: string } | null;
  tree: string;
  routes: string[];
  screenshots: string[];
  /** AI için kod örnekleri. */
  codeSamples: { file: string; content: string }[];
}

// ---------- yardımcılar ----------

async function readText(file: string, maxBytes = 200 * 1024): Promise<string> {
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > maxBytes) return "";
    return await fs.readFile(file, "utf-8");
  } catch {
    return "";
  }
}

async function exists(file: string): Promise<boolean> {
  return fs.stat(file).then(
    () => true,
    () => false
  );
}

async function readJson<T>(file: string): Promise<T | null> {
  const text = await readText(file);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function headLines(text: string, lines: number, maxChars: number): string {
  return text.split(/\r?\n/).slice(0, lines).join("\n").slice(0, maxChars);
}

// ---------- Python import → pip paketi ----------

const PY_STDLIB = new Set(
  (
    "abc argparse array ast asyncio atexit base64 binascii bisect builtins bz2 calendar cgi cmath code codecs collections " +
    "colorsys concurrent configparser contextlib contextvars copy csv ctypes curses dataclasses datetime dbm decimal difflib " +
    "dis email encodings enum errno faulthandler fcntl filecmp fileinput fnmatch fractions ftplib functools gc getpass gettext " +
    "glob graphlib gzip hashlib heapq hmac html http imaplib importlib inspect io ipaddress itertools json keyword linecache " +
    "locale logging lzma mailbox math mimetypes mmap msvcrt multiprocessing netrc numbers operator optparse os pathlib pdb " +
    "pickle pkgutil platform plistlib poplib posixpath pprint profile pstats pty queue quopri random re readline reprlib " +
    "resource runpy sched secrets select selectors shelve shlex shutil signal site smtplib socket socketserver sqlite3 ssl " +
    "stat statistics string stringprep struct subprocess sys sysconfig tabnanny tarfile tempfile termios textwrap threading " +
    "time timeit tkinter token tokenize tomllib trace traceback tracemalloc tty turtle types typing unicodedata unittest urllib " +
    "uuid venv warnings wave weakref webbrowser winreg winsound wsgiref xml xmlrpc zipfile zipimport zlib zoneinfo __future__"
  ).split(" ")
);

const PY_IMPORT_TO_PIP: Record<string, string> = {
  cv2: "opencv-python",
  PIL: "pillow",
  sklearn: "scikit-learn",
  yaml: "pyyaml",
  bs4: "beautifulsoup4",
  dotenv: "python-dotenv",
  telegram: "python-telegram-bot",
  discord: "discord.py",
  win32api: "pywin32",
  win32con: "pywin32",
  win32gui: "pywin32",
  pywintypes: "pywin32",
  serial: "pyserial",
  Crypto: "pycryptodome",
  jwt: "pyjwt",
  docx: "python-docx",
  fitz: "pymupdf",
  google: "google-api-python-client",
  yt_dlp: "yt-dlp",
  magic: "python-magic",
  skimage: "scikit-image",
  attr: "attrs",
  OpenSSL: "pyopenssl",
};

function pipName(mod: string): string {
  return PY_IMPORT_TO_PIP[mod] ?? mod.toLowerCase().replace(/_/g, "-");
}

function parseRequirement(line: string): string | null {
  const clean = line.split("#")[0].trim();
  if (!clean || clean.startsWith("-")) return null;
  const m = clean.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)/);
  return m ? m[1].toLowerCase() : null;
}

// ---------- dosya listeleme ----------

interface FileEntry {
  rel: string;
  name: string;
}

async function listFiles(root: string, maxDepth = 3, limit = 4000): Promise<FileEntry[]> {
  const out: FileEntry[] = [];
  async function walk(dir: string, rel: string, depth: number) {
    if (out.length >= limit) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= limit) return;
      if (e.name.startsWith(".") && e.name !== ".env.example") continue;
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!IGNORED_FOLDERS.has(e.name) && depth < maxDepth) await walk(path.join(dir, e.name), childRel, depth + 1);
      } else if (e.isFile()) {
        out.push({ rel: childRel, name: e.name });
      }
    }
  }
  await walk(root, "", 0);
  return out;
}

async function buildTree(root: string): Promise<string> {
  const MAX_PER_DIR = 14;
  const lines: string[] = [];

  async function walk(dir: string, prefix: string, depth: number) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const visible = entries
      .filter((e) => !e.name.startsWith(".") && !IGNORED_FOLDERS.has(e.name) && !/\.(pyc|log|bak|tmp)$/i.test(e.name))
      .sort((a, b) => (a.isDirectory() !== b.isDirectory() ? (a.isDirectory() ? -1 : 1) : a.name.localeCompare(b.name)));
    const shown = visible.slice(0, MAX_PER_DIR);
    for (let i = 0; i < shown.length; i++) {
      const e = shown[i];
      const last = i === shown.length - 1 && visible.length <= MAX_PER_DIR;
      lines.push(`${prefix}${last ? "└── " : "├── "}${e.name}${e.isDirectory() ? "/" : ""}`);
      if (e.isDirectory() && depth < 1) {
        await walk(path.join(dir, e.name), prefix + (last ? "    " : "│   "), depth + 1);
      }
    }
    if (visible.length > MAX_PER_DIR) lines.push(`${prefix}└── …`);
  }

  await walk(root, "", 0);
  return lines.join("\n");
}

// ---------- git ----------

async function gitRemote(root: string): Promise<{ owner: string; name: string } | null> {
  try {
    const { stdout } = await execFileAsync("git", ["remote", "get-url", "origin"], {
      cwd: root,
      timeout: 4000,
      windowsHide: true,
    });
    const m = stdout.trim().match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?\/?$/i);
    return m ? { owner: m[1], name: m[2] } : null;
  } catch {
    return null;
  }
}

// ---------- ana analiz ----------

const INFO_FILE_RE = /^(about|info|description|project|proje|aciklama|açıklama|hakkinda|hakkında)[\w-]*\.(md|txt)$/i;
const ENV_EXAMPLE_FILES = [".env.example", ".env.sample", ".env.template", "env.example"];
const LAUNCHER_RE = /\.(bat|cmd|ps1)$/i;
const SCREENSHOT_DIRS = ["screenshots", "screenshot", "images", "docs", "media", "img", ".github"];
const LAUNCHER_SKIP = /^(install|setup|kurulum|build|clean|uninstall|gradlew|mvnw|native|update|guncelle)/i;
const LAUNCHER_PREFER = /(start|baslat|başlat|run|calistir|çalıştır|launch|panel|app|main)/i;

function cleanReadme(md: string): string {
  return md
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .slice(0, 4000);
}

/** README'nin ilk anlamlı paragrafı (rozet/başlık/HTML olmayan). */
function firstParagraph(md: string): string {
  for (const block of cleanReadme(md).split(/\n\s*\n/)) {
    const text = block.trim();
    if (!text || /^(#|<|!\[|\[!\[|\||[-*] |>)/.test(text)) continue;
    const plain = text.replace(/\s+/g, " ").replace(/[*_`]/g, "").trim();
    if (plain.length >= 30) return plain.slice(0, 400);
  }
  return "";
}

function pickPythonEntry(files: { name: string; content: string }[]): string {
  const PRIORITY = ["main.py", "app.py", "run.py", "start.py", "server.py", "gui.py", "panel.py", "bot.py", "uygulama.py", "manage.py"];
  const withMain = files.filter((f) => /if\s+__name__\s*==\s*["']__main__["']/.test(f.content)).map((f) => f.name);
  const ranked = (list: string[]) =>
    [...list].sort((a, b) => {
      const ia = PRIORITY.indexOf(a.toLowerCase());
      const ib = PRIORITY.indexOf(b.toLowerCase());
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })[0];
  if (withMain.length > 0) return ranked(withMain);
  const named = files.map((f) => f.name).filter((n) => PRIORITY.includes(n.toLowerCase()));
  return named.length > 0 ? ranked(named) : files[0]?.name ?? "";
}

function detectPortInText(text: string): string {
  const patterns = [
    /\.listen\(\s*(\d{4,5})/,
    /PORT\s*(?:\|\||\?\?|or)\s*(\d{4,5})/,
    /port\s*[=:]\s*(\d{4,5})/i,
    /--port[= ](\d{4,5})/,
    /-p (\d{4,5})\b/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1];
  }
  return "";
}

export async function analyzeForReadme(root: string, type: ProjectType, fallbackName: string): Promise<ReadmeFacts> {
  const facts: ReadmeFacts = {
    name: fallbackName,
    type,
    description: "",
    version: "",
    packageName: "",
    readmeTitle: "",
    existingReadme: "",
    infoText: "",
    dependencies: [],
    techs: [],
    scripts: {},
    prerequisites: [],
    installSteps: [],
    runCommand: "",
    launcher: "",
    port: "",
    envVars: [],
    license: "",
    hasLicenseFile: false,
    repo: null,
    tree: "",
    routes: [],
    screenshots: [],
    codeSamples: [],
  };

  const [files, tree, repo] = await Promise.all([listFiles(root), buildTree(root), gitRemote(root)]);
  facts.tree = tree;
  facts.repo = repo;
  const rootNames = files.filter((f) => !f.rel.includes("/")).map((f) => f.name);
  const hasRoot = (name: string) => rootNames.some((n) => n.toLowerCase() === name.toLowerCase());

  // Tarayıcı işaret dosyası bulamadıysa ("Diğer") içeriğe göre tahmin et.
  if (type === "unknown") {
    if (rootNames.some((n) => n.endsWith(".py"))) type = "python";
    else if (hasRoot("index.html")) type = "web";
  }
  facts.type = type;
  const techKeys = new Set<string>();
  const addTech = (dep: string) => {
    const key = dep.toLowerCase();
    if (TECH_BY_DEP[key]) techKeys.add(key);
  };

  // --- mevcut README ve bilgi dosyaları
  const readmeName = rootNames.find((n) => /^readme\.md$/i.test(n));
  if (readmeName) {
    facts.existingReadme = (await readText(path.join(root, readmeName))).slice(0, 6000);
    facts.readmeTitle =
      facts.existingReadme.match(/^#\s+(.+)$/m)?.[1]?.replace(/[*_`]/g, "").trim() ??
      facts.existingReadme.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]?.trim() ??
      "";
  }
  const infoNames = rootNames.filter((n) => INFO_FILE_RE.test(n));
  facts.infoText = (await Promise.all(infoNames.map((n) => readText(path.join(root, n), 50 * 1024))))
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 3000);

  // --- lisans
  const licenseName = rootNames.find((n) => /^(license|licence|copying)(\.(md|txt))?$/i.test(n));
  if (licenseName) {
    facts.hasLicenseFile = true;
    const text = (await readText(path.join(root, licenseName))).slice(0, 1500);
    if (/MIT License|Permission is hereby granted, free of charge/i.test(text)) facts.license = "MIT";
    else if (/Apache License/i.test(text)) facts.license = "Apache-2.0";
    else if (/GNU AFFERO/i.test(text)) facts.license = "AGPL-3.0";
    else if (/GNU LESSER/i.test(text)) facts.license = "LGPL-3.0";
    else if (/GNU GENERAL PUBLIC LICENSE[\s\S]*Version 2/i.test(text)) facts.license = "GPL-2.0";
    else if (/GNU GENERAL PUBLIC LICENSE/i.test(text)) facts.license = "GPL-3.0";
    else if (/Mozilla Public License/i.test(text)) facts.license = "MPL-2.0";
    else if (/BSD/i.test(text)) facts.license = "BSD-3-Clause";
    else if (/unlicense/i.test(text)) facts.license = "Unlicense";
  }

  // --- .env.example (gerçek .env ASLA okunmaz)
  const envName = files.find((f) => !f.rel.includes("/") && ENV_EXAMPLE_FILES.includes(f.name.toLowerCase()));
  if (envName) {
    const text = await readText(path.join(root, envName.name), 30 * 1024);
    let pendingComment = "";
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (line.startsWith("#")) {
        pendingComment = line.replace(/^#+\s*/, "");
        continue;
      }
      const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) {
        facts.envVars.push({ key: m[1], value: m[2].replace(/^["']|["']$/g, ""), description: pendingComment });
      }
      pendingComment = "";
    }
  }

  // --- launcher (.bat vb.)
  const launchers = rootNames.filter((n) => LAUNCHER_RE.test(n) && !LAUNCHER_SKIP.test(n));
  facts.launcher = launchers.find((n) => LAUNCHER_PREFER.test(n)) ?? (launchers.length === 1 ? launchers[0] : "");

  // --- ekran görüntüleri
  facts.screenshots = files
    .filter((f) => /\.(png|jpe?g|gif|webp)$/i.test(f.name))
    .filter((f) => {
      const dir = f.rel.split("/")[0].toLowerCase();
      const named = /screen|preview|demo|ekran|showcase/i.test(f.name);
      return (f.rel.split("/").length === 2 && SCREENSHOT_DIRS.includes(dir)) || named;
    })
    .filter((f) => !/icon|logo|favicon/i.test(f.name))
    .map((f) => f.rel)
    .slice(0, 3);

  const samples: { file: string; content: string }[] = [];
  const addSample = async (rel: string, lines = 60) => {
    if (samples.some((s) => s.file === rel)) return;
    const content = await readText(path.join(root, rel), 300 * 1024);
    if (content && !/^\s*$/.test(content)) samples.push({ file: rel, content: headLines(content, lines, 2500) });
  };

  // --- türe göre
  if (type === "nodejs" || hasRoot("package.json")) {
    const pkg = await readJson<{
      name?: string;
      description?: string;
      license?: string;
      main?: string;
      bin?: unknown;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      engines?: { node?: string };
      packageManager?: string;
    }>(path.join(root, "package.json"));
    if (pkg) {
      facts.description = pkg.description ?? "";
      facts.version = typeof (pkg as { version?: unknown }).version === "string" ? (pkg as { version: string }).version : "";
      facts.packageName = pkg.name ?? "";
      facts.license = facts.license || (typeof pkg.license === "string" ? pkg.license : "");
      facts.scripts = pkg.scripts ?? {};
      const deps = Object.keys(pkg.dependencies ?? {});
      const devDeps = Object.keys(pkg.devDependencies ?? {});
      facts.dependencies = deps;
      [...deps, ...devDeps].forEach(addTech);

      const pm = pkg.packageManager?.split("@")[0] ||
        (hasRoot("pnpm-lock.yaml") ? "pnpm" : hasRoot("yarn.lock") ? "yarn" : hasRoot("bun.lockb") || hasRoot("bun.lock") ? "bun" : "npm");
      const run = (script: string) => (pm === "npm" ? (script === "start" ? "npm start" : `npm run ${script}`) : `${pm} ${script}`);

      const nodeVer = pkg.engines?.node?.match(/\d+/)?.[0] ?? (await readText(path.join(root, ".nvmrc"))).match(/\d+/)?.[0];
      facts.prerequisites.push(nodeVer ? `Node.js ${nodeVer}+` : "Node.js 18+");
      facts.installSteps.push({ kind: "install", command: pm === "npm" ? "npm install" : `${pm} install` });
      if (deps.includes("prisma") || devDeps.includes("prisma")) {
        facts.installSteps.push({ kind: "db", command: "npx prisma db push" });
      }

      const scripts = facts.scripts;
      if (scripts.dev) facts.runCommand = run("dev");
      else if (scripts.start) facts.runCommand = run("start");
      else if (typeof pkg.main === "string") facts.runCommand = `node ${pkg.main}`;
      else if (hasRoot("index.js")) facts.runCommand = "node index.js";

      const all = new Set([...deps, ...devDeps]);
      const devScript = scripts.dev ?? scripts.start ?? "";
      if (all.has("next")) facts.port = detectPortInText(devScript) || "3000";
      else if (all.has("vite")) facts.port = detectPortInText(devScript) || "5173";
      else if (all.has("react-scripts")) facts.port = "3000";
      else if (all.has("nuxt")) facts.port = "3000";
      else if (all.has("astro")) facts.port = "4321";
      else if (all.has("@sveltejs/kit")) facts.port = "5173";

      const mainCandidates = [typeof pkg.main === "string" ? pkg.main : "", "server.js", "index.js", "app.js", "src/index.ts", "src/index.js", "src/main.ts", "src/main.tsx", "src/App.tsx", "app/page.tsx", "pages/index.tsx"]
        .filter(Boolean)
        .filter((rel) => files.some((f) => f.rel === rel));
      for (const rel of mainCandidates.slice(0, 3)) await addSample(rel);
      if (!facts.port && (all.has("express") || all.has("fastify") || all.has("koa") || all.has("hono"))) {
        facts.port = detectPortInText(samples.map((s) => s.content).join("\n")) || "3000";
      }
      if (all.has("electron")) facts.port = "";
    }
    // Next.js API rotaları
    facts.routes = files
      .filter((f) => /^(src\/)?app\/api\/.*route\.(t|j)s$/.test(f.rel))
      .map((f) => "/" + f.rel.replace(/^src\//, "").replace(/^app\//, "").replace(/\/route\.(t|j)s$/, ""))
      .slice(0, 20);
  }

  if (type === "python") {
    const pyFiles = files.filter((f) => f.name.endsWith(".py"));
    const rootPy = await Promise.all(
      pyFiles.filter((f) => !f.rel.includes("/")).map(async (f) => ({ name: f.name, content: await readText(path.join(root, f.rel), 300 * 1024) }))
    );

    // bağımlılıklar
    const reqs = new Set<string>();
    if (hasRoot("requirements.txt")) {
      (await readText(path.join(root, "requirements.txt"))).split(/\r?\n/).map(parseRequirement).forEach((r) => r && reqs.add(r));
    }
    let pyprojectText = "";
    if (hasRoot("pyproject.toml")) {
      pyprojectText = await readText(path.join(root, "pyproject.toml"));
      const depsBlock = pyprojectText.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
      depsBlock?.[1].match(/["']([^"']+)["']/g)?.forEach((d) => {
        const name = parseRequirement(d.replace(/["']/g, ""));
        if (name) reqs.add(name);
      });
      facts.description = pyprojectText.match(/^description\s*=\s*["'](.+?)["']/m)?.[1] ?? "";
      facts.version = pyprojectText.match(/^version\s*=\s*["'](.+?)["']/m)?.[1] ?? "";
      facts.packageName = pyprojectText.match(/^name\s*=\s*["'](.+?)["']/m)?.[1] ?? "";
      const lic = pyprojectText.match(/^license\s*=\s*(?:\{\s*text\s*=\s*)?["'](.+?)["']/m)?.[1];
      if (lic && !facts.license) facts.license = lic;
    }

    // requirements yoksa importlardan çıkar
    let inferredReqs = false;
    if (reqs.size === 0) {
      const localModules = new Set(pyFiles.map((f) => f.name.replace(/\.py$/, "")).concat(files.filter((f) => f.rel.includes("/")).map((f) => f.rel.split("/")[0])));
      for (const f of rootPy) {
        for (const m of f.content.matchAll(/^\s*(?:from\s+([A-Za-z_][\w]*)[\w.]*\s+import|import\s+([A-Za-z_][\w]*))/gm)) {
          const mod = m[1] ?? m[2];
          if (!mod || PY_STDLIB.has(mod) || localModules.has(mod)) continue;
          reqs.add(pipName(mod));
        }
      }
      inferredReqs = reqs.size > 0;
    }
    facts.dependencies = [...reqs];
    facts.dependencies.forEach(addTech);

    const pyVer =
      pyprojectText.match(/requires-python\s*=\s*["'][^\d]*(\d+\.\d+)/)?.[1] ??
      (await readText(path.join(root, ".python-version"))).match(/\d+\.\d+/)?.[0];
    facts.prerequisites.push(pyVer ? `Python ${pyVer}+` : "Python 3.10+");

    if (/\[tool\.poetry\]/.test(pyprojectText)) {
      facts.installSteps.push({ kind: "install", command: "poetry install" });
    } else if (reqs.size > 0 || pyprojectText) {
      facts.installSteps.push({ kind: "venv", command: "python -m venv .venv" });
      facts.installSteps.push({ kind: "activate", command: ".venv\\Scripts\\activate" });
      facts.installSteps.push({
        kind: "install",
        command: hasRoot("requirements.txt")
          ? "pip install -r requirements.txt"
          : pyprojectText && !inferredReqs
            ? "pip install -e ."
            : `pip install ${[...reqs].slice(0, 12).join(" ")}`,
      });
    }

    // çalıştırma
    const entry = pickPythonEntry(rootPy);
    const entryContent = rootPy.find((f) => f.name === entry)?.content ?? "";
    const has = (dep: string) => reqs.has(dep);
    if (hasRoot("manage.py")) {
      facts.runCommand = "python manage.py runserver";
      facts.port = "8000";
    } else if (has("streamlit") && entry) {
      facts.runCommand = `streamlit run ${entry}`;
      facts.port = "8501";
    } else if (entry) {
      const fastApiApp = rootPy.find((f) => /FastAPI\(/.test(f.content));
      if (fastApiApp && !/uvicorn\.run\(/.test(fastApiApp.content) && !/__main__/.test(fastApiApp.content)) {
        const varName = fastApiApp.content.match(/(\w+)\s*=\s*FastAPI\(/)?.[1] ?? "app";
        facts.runCommand = `uvicorn ${fastApiApp.name.replace(/\.py$/, "")}:${varName} --reload`;
        facts.port = "8000";
      } else {
        facts.runCommand = `python ${entry}`;
        facts.port =
          detectPortInText(entryContent) ||
          (has("fastapi") || has("uvicorn") ? "8000" : has("flask") ? "5000" : has("gradio") ? "7860" : "");
      }
      // GUI/CLI uygulamalarda port anlamsız
      if (!has("flask") && !has("fastapi") && !has("uvicorn") && !has("gradio") && !has("django") && !/flask|fastapi|uvicorn|http\.server|gradio/i.test(entryContent)) {
        facts.port = "";
      }
      await addSample(entry, 80);
    }
    for (const f of pyFiles.filter((f) => f.rel !== entry).sort((a, b) => a.rel.length - b.rel.length).slice(0, 2)) {
      await addSample(f.rel, 40);
    }
    // FastAPI/Flask rotaları
    for (const f of rootPy) {
      for (const m of f.content.matchAll(/@(?:app|router|bp|blueprint)\.(?:get|post|put|delete|patch|route)\(\s*["']([^"']+)["']/g)) {
        if (facts.routes.length < 20) facts.routes.push(m[1]);
      }
    }
  }

  if (type === "dotnet") {
    const csproj = files.find((f) => f.name.endsWith(".csproj"));
    const text = csproj ? await readText(path.join(root, csproj.rel)) : "";
    const fw = text.match(/<TargetFramework>net(\d+\.\d+)/)?.[1];
    facts.prerequisites.push(fw ? `.NET ${fw} SDK` : ".NET SDK");
    for (const m of text.matchAll(/<PackageReference\s+Include="([^"]+)"/g)) facts.dependencies.push(m[1]);
    facts.description = text.match(/<Description>(.+?)<\/Description>/)?.[1] ?? "";
    facts.installSteps.push({ kind: "build", command: "dotnet build" });
    facts.runCommand = "dotnet run";
    const program = files.find((f) => /Program\.cs$/.test(f.name));
    if (program) await addSample(program.rel);
  }

  if (type === "unity") {
    const ver = (await readText(path.join(root, "ProjectSettings", "ProjectVersion.txt"))).match(/m_EditorVersion:\s*(\S+)/)?.[1];
    facts.prerequisites.push(ver ? `Unity ${ver}` : "Unity Hub");
    const manifest = await readJson<{ dependencies?: Record<string, string> }>(path.join(root, "Packages", "manifest.json"));
    facts.dependencies = Object.keys(manifest?.dependencies ?? {})
      .filter((d) => !d.startsWith("com.unity.modules"))
      .slice(0, 20);
    const scripts = files.filter((f) => f.rel.startsWith("Assets/") && f.name.endsWith(".cs")).slice(0, 3);
    for (const s of scripts) await addSample(s.rel, 40);
  }

  if (type === "rust") {
    const cargo = await readText(path.join(root, "Cargo.toml"));
    facts.description = cargo.match(/^description\s*=\s*"(.+?)"/m)?.[1] ?? "";
    facts.version = cargo.match(/^version\s*=\s*"(.+?)"/m)?.[1] ?? "";
    facts.packageName = cargo.match(/^name\s*=\s*"(.+?)"/m)?.[1] ?? "";
    facts.license = facts.license || (cargo.match(/^license\s*=\s*"(.+?)"/m)?.[1] ?? "");
    const depsBlock = cargo.split(/^\[dependencies\]/m)[1]?.split(/^\[/m)[0] ?? "";
    facts.dependencies = [...depsBlock.matchAll(/^([\w-]+)\s*=/gm)].map((m) => m[1]);
    facts.prerequisites.push("Rust (cargo)");
    facts.installSteps.push({ kind: "build", command: "cargo build --release" });
    facts.runCommand = "cargo run --release";
    if (files.some((f) => f.rel === "src/main.rs")) await addSample("src/main.rs");
  }

  if (type === "go") {
    const mod = await readText(path.join(root, "go.mod"));
    const goVer = mod.match(/^go\s+(\d+\.\d+)/m)?.[1];
    facts.prerequisites.push(goVer ? `Go ${goVer}+` : "Go");
    facts.dependencies = [...mod.matchAll(/^\s+([\w./-]+)\s+v[\d.]+/gm)].map((m) => m[1]).slice(0, 20);
    facts.installSteps.push({ kind: "install", command: "go mod download" });
    facts.runCommand = "go run .";
    if (files.some((f) => f.rel === "main.go")) await addSample("main.go");
  }

  if (type === "java") {
    const gradle = (await readText(path.join(root, "build.gradle"))) || (await readText(path.join(root, "build.gradle.kts")));
    const isWrapper = hasRoot("gradlew") || hasRoot("gradlew.bat");
    const gradleCmd = isWrapper ? "./gradlew" : "gradle";
    if (gradle) {
      const javaVer = gradle.match(/JavaVersion\.VERSION_(\d+)|languageVersion\s*=\s*JavaLanguageVersion\.of\((\d+)\)/);
      facts.prerequisites.push(javaVer ? `Java ${javaVer[1] ?? javaVer[2]}+` : "Java (JDK)");
      if (/fabric-loom|net\.fabricmc/.test(gradle)) facts.dependencies.push("Fabric");
      if (/net\.minecraftforge|neoforged/.test(gradle)) facts.dependencies.push("Forge");
      facts.installSteps.push({ kind: "build", command: `${gradleCmd} build` });
      facts.runCommand = /fabric-loom|minecraftforge|neoforged/.test(gradle) ? `${gradleCmd} runClient` : `${gradleCmd} run`;
    } else if (hasRoot("pom.xml")) {
      facts.prerequisites.push("Java (JDK)", "Maven");
      facts.installSteps.push({ kind: "build", command: "mvn package" });
    } else {
      facts.prerequisites.push("Java (JDK)");
    }
  }

  if (type === "web") {
    facts.runCommand = "";
    await addSample("index.html", 60);
  }

  // --- açıklama yedekleri
  if (!facts.description && facts.existingReadme) facts.description = firstParagraph(facts.existingReadme);
  if (!facts.description && facts.infoText) {
    facts.description =
      facts.infoText.match(/^\s*(?:description|açıklama|aciklama)\s*:\s*(.+)$/im)?.[1].trim() ||
      firstParagraph(facts.infoText) ||
      facts.infoText.split(/\r?\n/).find((l) => l.trim().length > 30 && !/:\s*$/.test(l))?.trim() ||
      "";
  }

  // --- teknolojiler: dil + bilinen bağımlılıklar
  facts.dependencies.forEach(addTech);
  const techs: TechInfo[] = [];
  const langTech = LANGUAGE_TECH[type === "nodejs" ? (techKeys.has("typescript") ? "" : "javascript") : type];
  if (langTech) techs.push(langTech);
  if (type === "nodejs") techs.push(LANGUAGE_TECH.nodejs);
  for (const key of techKeys) techs.push(TECH_BY_DEP[key]);
  if (hasRoot("Dockerfile") || hasRoot("docker-compose.yml") || hasRoot("compose.yaml")) techs.push(LANGUAGE_TECH.docker);
  const seen = new Set<string>();
  facts.techs = techs.filter((t) => t && !seen.has(t.name) && seen.add(t.name)).slice(0, 12);

  if (envName) facts.installSteps.push({ kind: "env", command: `cp ${envName.name} .env` });

  facts.codeSamples = samples;
  return facts;
}
