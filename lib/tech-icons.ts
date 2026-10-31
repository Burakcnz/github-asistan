// Teknoloji ikonları. Veri: lib/readme/data/tech-icons.json
// (profile-readme-generator, MIT — bkz. lib/readme/data/LICENSE-profile-readme-generator.md)
import rawIcons from "./readme/data/tech-icons.json";

export type IconProvider = "skill-icons" | "devicons" | "simple-icons" | "shields";

export const ICON_PROVIDERS: { value: IconProvider; label: string }[] = [
  { value: "skill-icons", label: "Skill Icons" },
  { value: "devicons", label: "DevIcons" },
  { value: "simple-icons", label: "Simple Icons" },
  { value: "shields", label: "Shields rozet" },
];

interface RawIcon {
  n: string;
  c: string;
  a?: string[];
  sk?: string;
  dv?: string;
  si?: string;
  sh?: [string, string, string];
}

export interface TechIconConfig {
  /** Anahtar (ör. "nextjs"). */
  key: string;
  /** Görünen ad (ör. "Next.js"). */
  name: string;
  color: string;
  aliases: string[];
  providers: Partial<Record<IconProvider, string>>;
}

function displayName(raw: RawIcon): string {
  if (raw.sh) {
    const label = raw.sh[0].replace(/-[0-9A-Fa-f]{3,8}$/, "").replace(/--/g, "-").replace(/__/g, "_");
    if (label) return label;
  }
  return raw.n.charAt(0).toUpperCase() + raw.n.slice(1);
}

function toConfig(raw: RawIcon): TechIconConfig {
  const providers: Partial<Record<IconProvider, string>> = {};
  if (raw.sk) providers["skill-icons"] = `https://skillicons.dev/icons?i=${raw.sk}`;
  if (raw.dv) providers.devicons = `https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${raw.dv}`;
  if (raw.si) providers["simple-icons"] = `https://cdn.simpleicons.org/${raw.si}`;
  if (raw.sh) {
    const [label, logo, logoColor] = raw.sh;
    providers.shields = `https://img.shields.io/badge/${encodeURIComponent(label).replace(/%2D/gi, "-")}?logo=${logo}&logoColor=${logoColor}&style=for-the-badge`;
  }
  return { key: raw.n, name: displayName(raw), color: `#${raw.c || "8b949e"}`, aliases: raw.a ?? [], providers };
}

export const TECH_ICON_LIST: TechIconConfig[] = (rawIcons as RawIcon[]).map(toConfig);

export const TECH_ICONS: Record<string, TechIconConfig> = Object.fromEntries(TECH_ICON_LIST.map((t) => [t.key, t]));

const norm = (s: string) => s.toLowerCase().replace(/^@[^/]+\//, "").replace(/[\s._-]/g, "");

const BY_NAME = new Map<string, TechIconConfig>();
for (const t of TECH_ICON_LIST) {
  for (const k of [t.key, t.name, ...t.aliases]) {
    const n = norm(k);
    if (n && !BY_NAME.has(n)) BY_NAME.set(n, t);
  }
}

/** Anahtar, görünen ad veya takma adla ikonu bulur ("next.js", "nextjs", "js"...). */
export function resolveIcon(input: string): TechIconConfig | null {
  if (!input) return null;
  return TECH_ICONS[input.toLowerCase()] ?? BY_NAME.get(norm(input)) ?? null;
}

/** İstenen sağlayıcı yoksa sırayla diğerlerine düşer. */
export function getIconUrl(input: string, provider: IconProvider = "skill-icons"): string {
  const icon = resolveIcon(input);
  if (!icon) return "";
  const order: IconProvider[] = [provider, "skill-icons", "devicons", "simple-icons", "shields"];
  for (const p of order) if (icon.providers[p]) return icon.providers[p]!;
  return "";
}

export function searchIcons(query: string, limit = 60): TechIconConfig[] {
  const q = norm(query);
  if (!q) return TECH_ICON_LIST.slice(0, limit);
  const starts: TechIconConfig[] = [];
  const contains: TechIconConfig[] = [];
  for (const t of TECH_ICON_LIST) {
    const keys = [t.key, t.name, ...t.aliases].map(norm);
    if (keys.some((k) => k.startsWith(q))) starts.push(t);
    else if (keys.some((k) => k.includes(q))) contains.push(t);
  }
  return [...starts, ...contains].slice(0, limit);
}
