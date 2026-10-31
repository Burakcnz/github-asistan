import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "-";
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "bugün";
  if (days === 1) return "dün";
  if (days < 7) return `${days} gün önce`;
  if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
  if (days < 365) return `${Math.floor(days / 30)} ay önce`;
  return `${Math.floor(days / 365)} yıl önce`;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export const PROJECT_TYPES: Record<string, { label: string; color: string }> = {
  nodejs: { label: "Node.js", color: "#f1e05a" },
  python: { label: "Python", color: "#3572A5" },
  dotnet: { label: ".NET", color: "#178600" },
  rust: { label: "Rust", color: "#dea584" },
  go: { label: "Go", color: "#00ADD8" },
  java: { label: "Java", color: "#b07219" },
  unity: { label: "Unity", color: "#c9d1d9" },
  web: { label: "Web", color: "#e34c26" },
  unknown: { label: "Diğer", color: "#8b949e" },
};

export function projectTypeLabel(type: string): string {
  return PROJECT_TYPES[type]?.label ?? type;
}

export function projectTypeColor(type: string): string {
  return PROJECT_TYPES[type]?.color ?? "#8b949e";
}

/** Projenin çalışma alanına göre üst klasörü (ör. "Bitenler"). Kökteyse boş döner. */
export function projectCategory(localPath: string, workspacePath: string | null | undefined): string {
  if (!workspacePath) return "";
  const norm = (p: string) => p.replace(/[\\/]+/g, "/").replace(/\/$/, "");
  const root = norm(workspacePath);
  const full = norm(localPath);
  if (!full.toLowerCase().startsWith(root.toLowerCase() + "/")) return "";
  const parts = full.slice(root.length + 1).split("/");
  return parts.length > 1 ? parts.slice(0, -1).join(" / ") : "";
}

/** Proje adından GitHub repo adı üretir (yükleme ve README klon URL'i aynı adı kullanır). */
export function sanitizeRepoName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function ownerFromGithubUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).pathname.split("/").filter(Boolean)[0] ?? null;
  } catch {
    return null;
  }
}

export type ApiError = Error & { status?: number; data?: unknown };

/** JSON API çağrısı; hata durumunda sunucunun mesajıyla Error fırlatır (status ve data eklenir). */
export async function apiFetch<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // JSON olmayan yanıt
  }
  if (!res.ok) {
    const serverError = (data as { error?: unknown } | null)?.error;
    const err = new Error(typeof serverError === "string" && serverError ? serverError : `İstek başarısız (${res.status})`) as ApiError;
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}
