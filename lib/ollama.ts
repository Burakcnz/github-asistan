import { execFile, spawn } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import { OLLAMA_BASE_URL } from "@/lib/env";

const execFileAsync = promisify(execFile);

export interface OllamaStatus {
  installed: boolean;
  path: string | null;
  running: boolean;
  models: string[];
  recommendedModel: string;
}

export interface SystemInfo {
  ram: number;
  vram: number;
  cpu: string;
}

// Model adı doğrulaması: "qwen2.5:7b", "library/llama3:8b-instruct-q4_0" vb.
const MODEL_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._\-/]*(:[a-zA-Z0-9._\-]+)?$/;

export function isValidModelName(model: string): boolean {
  return model.length <= 200 && MODEL_NAME_RE.test(model);
}

function candidatePaths(): string[] {
  const paths: string[] = [];
  if (process.env.LOCALAPPDATA) {
    paths.push(path.join(/* turbopackIgnore: true */ process.env.LOCALAPPDATA, "Programs", "Ollama", "ollama.exe"));
  }
  if (process.env.ProgramFiles) {
    paths.push(path.join(/* turbopackIgnore: true */ process.env.ProgramFiles, "Ollama", "ollama.exe"));
  }
  return paths;
}

let cachedPath: { value: string | null; time: number } | null = null;

export async function findOllamaPath(): Promise<string | null> {
  if (cachedPath && Date.now() - cachedPath.time < 60_000) return cachedPath.value;

  let found: string | null = candidatePaths().find((p) => fs.existsSync(/* turbopackIgnore: true */ p)) ?? null;
  if (!found) {
    try {
      await execFileAsync("ollama", ["--version"], { timeout: 3000, windowsHide: true });
      found = "ollama";
    } catch {
      found = null;
    }
  }
  cachedPath = { value: found, time: Date.now() };
  return found;
}

export async function isOllamaRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

export async function listModels(): Promise<string[]> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.models ?? []).map((m: { name: string }) => m.name).filter(Boolean);
  } catch {
    return [];
  }
}

export async function startOllama(): Promise<boolean> {
  if (await isOllamaRunning()) return true;
  const ollamaPath = await findOllamaPath();
  if (!ollamaPath) return false;

  try {
    // Windows'ta Ollama'nın tepsi uygulaması sunucuyu pencere açmadan başlatır.
    const trayApp = process.platform === "win32" ? path.join(/* turbopackIgnore: true */ path.dirname(ollamaPath), "ollama app.exe") : "";
    const useTray = !!trayApp && fs.existsSync(/* turbopackIgnore: true */ trayApp);
    // Not: Windows'ta detached:true windowsHide'ı yok sayar ve konsol penceresi açar; kullanılmamalı.
    const child = useTray
      ? spawn(/* turbopackIgnore: true */ trayApp, [], { stdio: "ignore", windowsHide: true, detached: process.platform !== "win32" })
      : spawn(/* turbopackIgnore: true */ ollamaPath, ["serve"], { stdio: "ignore", windowsHide: true, detached: process.platform !== "win32" });
    child.on("error", () => undefined);
    child.unref();
  } catch {
    return false;
  }

  for (let i = 0; i < 15; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (await isOllamaRunning()) return true;
  }
  return false;
}

/**
 * Ollama HTTP API ile model indirir. Ollama'nın JSON satırları olduğu gibi aktarılır
 * ({status, completed, total}).
 */
export async function pullModel(model: string, signal?: AbortSignal): Promise<Response> {
  return fetch(`${OLLAMA_BASE_URL}/api/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, stream: true }),
    signal,
  });
}

let cachedSystemInfo: SystemInfo | null = null;

async function powershell(command: string): Promise<string> {
  const { stdout } = await execFileAsync("powershell", ["-NoProfile", "-Command", command], {
    timeout: 5000,
    windowsHide: true,
  });
  return stdout.trim();
}

export async function getSystemInfo(): Promise<SystemInfo> {
  if (cachedSystemInfo) return cachedSystemInfo;

  let ram = Math.round(os.totalmem() / 1024 ** 3);
  let cpu = os.cpus()[0]?.model?.trim() || "Bilinmiyor";
  let vram = 0;

  // nvidia-smi doğru VRAM verir (Win32_VideoController 4 GB'ta takılı kalır).
  try {
    const { stdout } = await execFileAsync(
      "nvidia-smi",
      ["--query-gpu=memory.total", "--format=csv,noheader,nounits"],
      { timeout: 5000, windowsHide: true }
    );
    vram = Math.round(parseInt(stdout.trim().split("\n")[0], 10) / 1024) || 0;
  } catch {
    if (process.platform === "win32") {
      try {
        const out = await powershell(
          "(Get-CimInstance Win32_VideoController | Measure-Object -Property AdapterRAM -Maximum).Maximum / 1GB"
        );
        vram = Math.round(parseFloat(out)) || 0;
      } catch {
        // VRAM bilinmiyor
      }
    }
  }

  if (!ram) ram = 8;
  if (!cpu) cpu = "Bilinmiyor";

  cachedSystemInfo = { ram, vram, cpu };
  return cachedSystemInfo;
}

export function recommendModel({ ram, vram }: SystemInfo): string {
  if (vram >= 16) return "qwen2.5:14b";
  if (vram >= 8) return "qwen2.5:7b";
  if (vram >= 4 || ram >= 16) return "qwen2.5:3b";
  return "qwen2.5:1.5b";
}

export async function getOllamaStatus(): Promise<OllamaStatus> {
  const [ollamaPath, running, systemInfo] = await Promise.all([
    findOllamaPath(),
    isOllamaRunning(),
    getSystemInfo(),
  ]);
  const models = running ? await listModels() : [];

  return {
    // Çalışıyorsa (ör. farklı konumda/Docker'da) kurulu say.
    installed: !!ollamaPath || running,
    path: ollamaPath,
    running,
    models,
    recommendedModel: recommendModel(systemInfo),
  };
}
