export type GraphType = "stats" | "languages" | "trophy" | "activity-graph";

const STATS_BASE_URL = "https://github-readme-stats.vercel.app/api";
const STATS_LANGS_URL = "https://github-readme-stats.vercel.app/api/top-langs";
const TROPHY_URL = "https://github-profile-trophy.vercel.app";
const ACTIVITY_URL = "https://github-readme-activity-graph.vercel.app/graph";
const STREAK_URL = "https://streak-stats.demolab.com";

export function objectToQueryParams(obj: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, String(value));
    }
  }
  const str = params.toString();
  return str ? `?${str}` : "";
}

export function getStatsUrl(graph: GraphType, username: string): string {
  switch (graph) {
    case "stats":
      return `${STATS_BASE_URL}?username=${username}`;
    case "languages":
      return `${STATS_LANGS_URL}?username=${username}`;
    case "trophy":
      return `${TROPHY_URL}?username=${username}`;
    case "activity-graph":
      return `${ACTIVITY_URL}?username=${username}`;
    default:
      return "";
  }
}

export function getStatsCardUrl(
  username: string,
  theme = "dracula",
  options: Record<string, unknown> = {}
): string {
  const base = `${STATS_BASE_URL}?username=${username}&theme=${theme}&hide_border=true&show_icons=true`;
  return base + objectToQueryParams(options);
}

export function getTopLangsUrl(
  username: string,
  theme = "dracula",
  options: Record<string, unknown> = {}
): string {
  const base = `${STATS_LANGS_URL}?username=${username}&theme=${theme}&hide_border=true&layout=compact&langs_count=8`;
  return base + objectToQueryParams(options);
}

export function getTrophyUrl(
  username: string,
  theme = "dracula",
  options: Record<string, unknown> = {}
): string {
  const base = `${TROPHY_URL}?username=${username}&theme=${theme}&no-frame=true&column=7`;
  return base + objectToQueryParams(options);
}

export function getActivityUrl(
  username: string,
  theme = "dracula"
): string {
  return `${ACTIVITY_URL}?username=${username}&theme=${theme}`;
}

export function getStreakUrl(
  username: string,
  theme = "dracula"
): string {
  return `${STREAK_URL}?user=${username}&theme=${theme}`;
}

export type CapsuleTheme =
  | "cobalt" | "dracula" | "github-dark" | "holi" | "neon"
  | "radical" | "tokyonight" | "winter" | "gruvbox" | "nord"
  | "omni" | "blue" | "green" | "red" | "pink";

export interface CapsuleRenderParams {
  type: "waving" | "zigzag" | "diagonal" | "rounded" | "cylinder" | "cut" | "egg";
  height: number;
  section: "header" | "footer" | "before-footer";
  color: { type: "theme" | "gradient"; theme?: string; gradient?: string };
  text?: string;
  fontSize?: number;
  fontColor?: string;
  fontAlign?: number;
  fontAlignY?: number;
  animation?: string;
  desc?: string;
  descSize?: number;
  descAlign?: number;
  descAlignY?: number;
}

export function getBorderUrl(params: CapsuleRenderParams): string {
  const base = "https://capsule-render.vercel.app/api";
  const queryParts: string[] = [];

  queryParts.push(`type=${params.type}`);
  queryParts.push(`height=${params.height}`);
  queryParts.push(`section=${params.section}`);

  if (params.color.type === "gradient" && params.color.gradient) {
    queryParts.push(`color=${params.color.gradient}`);
  } else if (params.color.type === "theme" && params.color.theme) {
    queryParts.push(`color=${params.color.theme}`);
  }

  if (params.text) queryParts.push(`text=${encodeURIComponent(params.text)}`);
  if (params.fontSize) queryParts.push(`fontSize=${params.fontSize}`);
  if (params.fontColor) queryParts.push(`fontColor=${params.fontColor}`);
  if (params.fontAlign) queryParts.push(`fontAlign=${params.fontAlign}`);
  if (params.fontAlignY) queryParts.push(`fontAlignY=${params.fontAlignY}`);
  if (params.animation) queryParts.push(`animation=${params.animation}`);
  if (params.desc) queryParts.push(`desc=${encodeURIComponent(params.desc)}`);
  if (params.descSize) queryParts.push(`descSize=${params.descSize}`);
  if (params.descAlign) queryParts.push(`descAlign=${params.descAlign}`);
  if (params.descAlignY) queryParts.push(`descAlignY=${params.descAlignY}`);

  return `${base}?${queryParts.join("&")}`;
}

export type SocialPlatform =
  | "github" | "linkedin" | "twitter" | "x" | "discord" | "youtube"
  | "instagram" | "facebook" | "twitch" | "email" | "medium"
  | "dev.to" | "stackoverflow" | "codepen" | "reddit";

export interface SocialBadgeParams {
  label: string;
  message: string;
  color: string;
  logo: string;
  logoColor: string;
  style?: string;
}

const SOCIAL_DEFAULTS: Record<string, SocialBadgeParams> = {
  github: { label: "GitHub", message: "Follow", color: "181717", logo: "github", logoColor: "white" },
  linkedin: { label: "LinkedIn", message: "Connect", color: "0077B5", logo: "linkedin", logoColor: "white" },
  twitter: { label: "X (Twitter)", message: "Follow", color: "000000", logo: "x", logoColor: "white" },
  x: { label: "X (Twitter)", message: "Follow", color: "000000", logo: "x", logoColor: "white" },
  discord: { label: "Discord", message: "Join", color: "7289DA", logo: "discord", logoColor: "white" },
  youtube: { label: "YouTube", message: "Subscribe", color: "FF0000", logo: "youtube", logoColor: "white" },
  instagram: { label: "Instagram", message: "Follow", color: "E4405F", logo: "instagram", logoColor: "white" },
  facebook: { label: "Facebook", message: "Follow", color: "1877F2", logo: "facebook", logoColor: "white" },
  twitch: { label: "Twitch", message: "Follow", color: "9146FF", logo: "twitch", logoColor: "white" },
  email: { label: "Email", message: "Contact", color: "D44638", logo: "gmail", logoColor: "white" },
  medium: { label: "Medium", message: "Read", color: "000000", logo: "medium", logoColor: "white" },
  "dev.to": { label: "DEV.to", message: "Follow", color: "0A0A0A", logo: "dev-dot-to", logoColor: "white" },
  stackoverflow: { label: "Stack Overflow", message: "Profile", color: "F58025", logo: "stackoverflow", logoColor: "white" },
  codepen: { label: "CodePen", message: "Follow", color: "000000", logo: "codepen", logoColor: "white" },
  reddit: { label: "Reddit", message: "Join", color: "FF4500", logo: "reddit", logoColor: "white" },
};

export function getSocialImgUrl(
  platform: SocialPlatform,
  params?: Partial<SocialBadgeParams>
): string {
  const defaults = SOCIAL_DEFAULTS[platform] || { label: platform, message: "Follow", color: "555555", logo: platform, logoColor: "white" };
  const merged = { ...defaults, ...params };
  const style = merged.style || "for-the-badge";
  return `https://img.shields.io/badge/${encodeURIComponent(merged.label)}-${encodeURIComponent(merged.message)}-${merged.color}?style=${style}&logo=${merged.logo}&logoColor=${merged.logoColor}`;
}

export function getProfileViewsUrl(
  username: string,
  style: "flat" | "flat-square" | "for-the-badge" | "social" = "flat-square"
): string {
  return `https://komarev.com/ghpvc/?username=${username}&style=${style}`;
}

export function getSnakeUrl(username: string): string {
  return `https://raw.githubusercontent.com/${username}/${username}/snake-output/snake.svg`;
}
