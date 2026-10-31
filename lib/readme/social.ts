// Sosyal medya rozetleri. Veri: lib/readme/data/social-icons.json
// (profile-readme-generator, MIT) + eksik platformlar.
import rawSocial from "./data/social-icons.json";

interface SocialBadge {
  n: string;
  message: string;
  color: string;
  logo: string;
  logoColor: string;
}

const EXTRA: SocialBadge[] = [
  { n: "github", message: "GitHub", color: "181717", logo: "github", logoColor: "white" },
  { n: "x", message: "X", color: "000000", logo: "x", logoColor: "white" },
  { n: "website", message: "Website", color: "0A66C2", logo: "googlechrome", logoColor: "white" },
  { n: "email", message: "E-posta", color: "D14836", logo: "gmail", logoColor: "white" },
  { n: "reddit", message: "Reddit", color: "FF4500", logo: "reddit", logoColor: "white" },
  { n: "mastodon", message: "Mastodon", color: "6364FF", logo: "mastodon", logoColor: "white" },
];

const ALL: SocialBadge[] = [...EXTRA, ...(rawSocial as SocialBadge[]).filter((s) => !EXTRA.some((e) => e.n === s.n))];
const BY_NAME = new Map(ALL.map((s) => [s.n, s]));
// Eski adlar / GitHub social_accounts sağlayıcı adları
BY_NAME.set("twitter", BY_NAME.get("x")!);
BY_NAME.set("blog", BY_NAME.get("website")!);
BY_NAME.set("generic", BY_NAME.get("website")!);
BY_NAME.set("gmail", BY_NAME.get("email")!);

export const SOCIAL_PLATFORMS = ALL.map((s) => s.n);

export type BadgeStyle = "for-the-badge" | "flat-square" | "flat" | "plastic" | "social";

export function socialBadgeUrl(platform: string, style: BadgeStyle = "for-the-badge"): string {
  const s = BY_NAME.get(platform.toLowerCase()) ?? { n: platform, message: platform, color: "555555", logo: platform, logoColor: "white" };
  const message = encodeURIComponent(s.message.replace(/-/g, "--").replace(/_/g, "__"));
  return `https://img.shields.io/badge/${message}-${s.color}?style=${style}&logo=${s.logo}&logoColor=${s.logoColor}`;
}

export function socialLabel(platform: string): string {
  return BY_NAME.get(platform.toLowerCase())?.message ?? platform;
}
