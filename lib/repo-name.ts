// Klasör adından GitHub repo adı ve README başlığı önerir. İstemci/sunucu ortak (fs yok).

export type NameQuality = "good" | "ok" | "bad";

export interface NameAssessment {
  quality: NameQuality;
  /** Önerilen GitHub repo adı (hafif dokunuşla). */
  repoName: string;
  /** Önerilen README başlığı. */
  title: string;
  reasons: string[];
}

const TR_MAP: Record<string, string> = { ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I", ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U" };

const transliterate = (s: string) =>
  s.replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => TR_MAP[c]).normalize("NFKD").replace(/[̀-ͯ]/g, "");

// Kopya/yedek işaretleri: ad kötü sayılır (kullanıcıya sorulur).
const COPY_SUFFIX = /(?:[\s_.-]+\(?|\()(kopya|kopyas[ıi]|copy|yedek|backup|bak|old|eski|son|final|new|yeni)\)?[\s_.-]*\d*\s*$/i;
// Zip'ten çıkan ekler: sessizce temizlenir.
const ARCHIVE_SUFFIX = /[\s_.-]+(main|master)$/i;
const NUMBER_SUFFIX = /\s*\(\d+\)\s*$/;

const GENERIC = new Set([
  "proje", "projem", "project", "projects", "test", "tests", "deneme", "denemeler", "app", "uygulama", "untitled",
  "yeniklasor", "newfolder", "temp", "tmp", "asd", "asdf", "qwe", "qwerty", "aaa", "abc", "xyz", "demo", "sample",
  "example", "myapp", "myproject", "website", "site", "script", "scripts", "code", "kod", "program", "bot", "src",
]);

function stripSuffixes(name: string): { name: string; hadCopy: boolean; hadArchive: boolean } {
  let current = name.trim();
  let hadCopy = false;
  let hadArchive = false;
  for (let i = 0; i < 4; i++) {
    const before = current;
    current = current.replace(NUMBER_SUFFIX, "");
    if (COPY_SUFFIX.test(current) && current.replace(COPY_SUFFIX, "").trim()) {
      current = current.replace(COPY_SUFFIX, "");
      hadCopy = true;
    }
    if (ARCHIVE_SUFFIX.test(current)) {
      current = current.replace(ARCHIVE_SUFFIX, "");
      hadArchive = true;
    }
    current = current.trim();
    if (current === before) break;
  }
  return { name: current, hadCopy, hadArchive };
}

/** GitHub'ın kabul ettiği karakterlere indirger. Boşluk içeren adlar kebab-case olur; diğerlerinde büyük/küçük harf korunur. */
export function normalizeRepoName(folderName: string): string {
  const { name } = stripSuffixes(folderName);
  let s = transliterate(name);
  if (/\s/.test(s)) s = s.toLowerCase();
  return s
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 100);
}

const ACRONYMS = new Set(["ai", "api", "ui", "gui", "cli", "llm", "idm", "xdm", "mc", "tts", "ocr", "pdf", "url", "sdk", "db", "sql", "rpg", "fps", "io", "ml", "nlp", "seo", "css", "html", "json", "xml", "ide", "vr", "ar", "2d", "3d"]);
const BRANDS: Record<string, string> = {
  github: "GitHub", gitlab: "GitLab", youtube: "YouTube", javascript: "JavaScript", typescript: "TypeScript",
  nodejs: "Node.js", nextjs: "Next.js", openai: "OpenAI", chatgpt: "ChatGPT", minecraft: "Minecraft", discord: "Discord",
};

function titleWord(w: string): string {
  const lower = w.toLocaleLowerCase("tr");
  if (BRANDS[lower]) return BRANDS[lower];
  if (ACRONYMS.has(lower)) return w.toUpperCase();
  if (w !== lower) return w; // Zaten büyük harf içeriyor (ör. AniFrame, V2): dokunma
  const tr = /[çğıöşü]/.test(w) ? "tr" : "en";
  return w.charAt(0).toLocaleUpperCase(tr) + w.slice(1);
}

/** README başlığı: ekler temizlenir, ayraçlar boşluk olur, kelimeler düzgün büyük harflenir (Türkçe karakter korunur). */
export function prettyTitle(folderName: string): string {
  const { name } = stripSuffixes(folderName);
  return name.split(/[\s_-]+/).filter(Boolean).map(titleWord).join(" ").trim();
}

export function isValidRepoName(name: string): boolean {
  return /^[A-Za-z0-9._-]{1,100}$/.test(name) && name !== "." && name !== ".." && !name.endsWith(".git");
}

export function assessRepoName(folderName: string): NameAssessment {
  const reasons: string[] = [];
  const { hadCopy, hadArchive } = stripSuffixes(folderName);
  const repoName = normalizeRepoName(folderName);
  const title = prettyTitle(folderName) || repoName;
  const compact = repoName.toLowerCase().replace(/[^a-z0-9]/g, "");

  let quality: NameQuality = "good";
  const bad = (reason: string) => {
    quality = "bad";
    reasons.push(reason);
  };
  const ok = (reason: string) => {
    if (quality === "good") quality = "ok";
    reasons.push(reason);
  };

  if (!repoName) bad("Ad geçerli karakter içermiyor");
  if (hadCopy) bad("Adda kopya/yedek eki var");
  if (GENERIC.has(compact) || /^(yeni|new)?klasor\d*$/.test(compact)) bad("Ad çok genel");
  if (compact.length > 0 && compact.length < 3) bad("Ad çok kısa");
  if (/^\d+$/.test(compact)) bad("Ad yalnızca rakamlardan oluşuyor");
  if (repoName.length > 50) bad("Ad çok uzun");

  if (hadArchive) ok("Arşiv eki (-main/-master) kaldırıldı");
  if (/[çÇğĞıİöÖşŞüÜ]/.test(folderName)) ok("Türkçe karakterler GitHub için dönüştürüldü");
  if (/\s/.test(folderName.trim())) ok("Boşluklar tireye çevrildi");
  if (quality === "good" && repoName !== folderName.trim()) ok("Geçersiz karakterler düzeltildi");

  return { quality, repoName, title, reasons };
}
