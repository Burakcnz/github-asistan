import { IconProvider } from "./tech-icons";
import { STRINGS, type ReadmeLang } from "./readme/i18n";
import type { BadgeStyle } from "./readme/social";

export type BlockType =
  | "header"
  | "capsule-header"
  | "features"
  | "techstack"
  | "tech-icons"
  | "social-links"
  | "profile-views"
  | "snake"
  | "installation"
  | "usage"
  | "structure"
  | "contributing"
  | "license"
  | "badges"
  | "stats"
  | "stats-cards"
  | "image"
  | "divider"
  | "toc"
  | "author"
  | "footer"
  | "architecture"
  | "api"
  | "config"
  | "custom";

/** Repo GitHub'dayken gösterilebilen canlı rozetler. */
export type DynamicBadge = "stars" | "forks" | "issues" | "last-commit" | "top-language" | "repo-size";

/** Tüm blok verilerinde bulunabilecek ortak alanlar. */
export interface BlockCommon {
  /** Bölüm başlığı (boşsa dile göre varsayılan kullanılır). */
  heading?: string;
  /** Bloğun üretildiği dil. */
  lang?: ReadmeLang;
}

export interface HeaderData extends BlockCommon {
  title: string;
  tagline: string;
  /** Başlığın altındaki tanıtım paragrafı. */
  description?: string;
  showStars: boolean;
  showLicense: boolean;
  showPRs: boolean;
  customBadges: { label: string; url: string; color: string }[];
  githubOwner?: string;
  githubRepo?: string;
  license?: string;
  /** Dalga başlık adı zaten gösteriyorsa başlığı gizle. */
  hideTitle?: boolean;
  badgeStyle?: BadgeStyle;
  /** Repo GitHub'dayken gösterilecek canlı rozetler. */
  dynamicBadges?: DynamicBadge[];
  version?: string;
}

export interface FeatureItem {
  emoji: string;
  title: string;
  description: string;
}

export interface FeatureGroup {
  emoji: string;
  title: string;
  items: string[];
}

export interface FeaturesData extends BlockCommon {
  items: FeatureItem[];
  /** Başlıklı özellik grupları (detaylı README). Varsa items'tan önce gösterilir. */
  groups?: FeatureGroup[];
}

export interface TechItem {
  name: string;
  description: string;
  badge: string;
}

export interface TechStackData extends BlockCommon {
  items: TechItem[];
}

export interface TechIconsData extends BlockCommon {
  icons: string[];
  provider: IconProvider;
  height: number;
  /** İkonlar arası boşluk (px). */
  spacing?: number;
  align: "left" | "center" | "right";
}

export interface InstallStep {
  label: string;
  command: string;
}

export interface InstallationData extends BlockCommon {
  prerequisites?: string[];
  steps: InstallStep[];
}

export interface EnvVar {
  key: string;
  value: string;
  description: string;
}

export interface UsageData extends BlockCommon {
  /** Çalıştırma komutu (kod bloğu olarak gösterilir). */
  command?: string;
  /** Windows başlatıcı dosyası (ör. baslat.bat). */
  launcher?: string;
  text: string;
  port: string;
  envVars: EnvVar[];
  /** Adım adım iş akışları (detaylı README). */
  flows?: { title: string; steps: string[] }[];
}

export interface StructureData extends BlockCommon {
  tree: string;
}

export interface ContributingData extends BlockCommon {
  intro?: string;
  steps: string[];
}

export interface LicenseData extends BlockCommon {
  type: string;
  text: string;
  /** Projede LICENSE dosyası var mı (bağlantı eklenir). */
  hasFile?: boolean;
}

export interface BadgesData extends BlockCommon {
  items: { label: string; url: string; color: string }[];
}

export interface StatsData extends BlockCommon {
  username: string;
  theme: string;
  showStars: boolean;
  showCommits: boolean;
  showContributions: boolean;
}

export interface StatsCardsData extends BlockCommon {
  username: string;
  theme: string;
  showStats: boolean;
  showLanguages: boolean;
  showTrophy: boolean;
  showActivity: boolean;
  direction: "row" | "column";
  align: "left" | "center" | "right";
}

export interface ImageData extends BlockCommon {
  url: string;
  alt?: string;
  height: number;
  align: "left" | "center" | "right";
}

export interface DividerData extends BlockCommon {
  style: "line" | "stars" | "blank";
}

export interface CapsuleHeaderData extends BlockCommon {
  type: "waving" | "zigzag" | "diagonal" | "rounded" | "cylinder" | "cut" | "egg";
  height: number;
  colorTheme: string;
  gradient: string;
  colorMode: "theme" | "gradient";
  text: string;
  /** Başlığın altındaki küçük yazı. */
  desc?: string;
  fontSize: number;
  fontColor: string;
  animation?: "fadeIn" | "twinkling" | "blink" | "scaleIn" | "";
}

export interface TocData extends BlockCommon {
  /** Kapalı açılır liste olarak göster. */
  collapsed: boolean;
}

export interface AuthorData extends BlockCommon {
  name: string;
  login: string;
  showAvatar: boolean;
  bio?: string;
  links: SocialLinkItem[];
  style: BadgeStyle;
}

export interface ArchitectureData extends BlockCommon {
  intro: string;
  /** Akış aşamaları (mermaid diyagramına çevrilir). */
  steps: { title: string; description: string }[];
  showDiagram: boolean;
  components: { name: string; role: string }[];
  /** Gömülü üçüncü taraf bileşenler. */
  embedded: string[];
}

export interface ApiRoute {
  method: string;
  path: string;
  description: string;
  group: string;
}

export interface ApiData extends BlockCommon {
  routes: ApiRoute[];
  /** Grupları açılır (<details>) göster. */
  collapsed: boolean;
}

export interface ConfigData extends BlockCommon {
  vars: { key: string; defaultValue: string; description: string }[];
  docs: { path: string; title: string }[];
}

export interface FooterData extends BlockCommon {
  gradient: string;
  type: CapsuleHeaderData["type"];
  height: number;
  /** "Beğendiysen yıldız ver" satırı. */
  starCta: boolean;
  repoUrl?: string;
}

export interface SocialLinkItem {
  platform: string;
  url: string;
}

export interface SocialLinksData extends BlockCommon {
  links: SocialLinkItem[];
  style: "for-the-badge" | "flat" | "flat-square" | "social";
  height: number;
  align: "left" | "center" | "right";
}

export interface ProfileViewsData extends BlockCommon {
  username?: string;
  style: "flat" | "flat-square" | "for-the-badge" | "social";
  align: "left" | "center" | "right";
}

export interface SnakeData extends BlockCommon {
  username: string;
}

export interface CustomData extends BlockCommon {
  title: string;
  content: string;
}

export type BlockData =
  | HeaderData
  | FeaturesData
  | TechStackData
  | TechIconsData
  | InstallationData
  | UsageData
  | StructureData
  | ContributingData
  | LicenseData
  | BadgesData
  | StatsData
  | StatsCardsData
  | ImageData
  | DividerData
  | CapsuleHeaderData
  | SocialLinksData
  | ProfileViewsData
  | SnakeData
  | TocData
  | AuthorData
  | FooterData
  | ArchitectureData
  | ApiData
  | ConfigData
  | CustomData;

export interface ReadmeBlock {
  id: string;
  type: BlockType;
  enabled: boolean;
  order: number;
  data: BlockData;
}

export const BLOCK_META: Record<BlockType, { label: string; icon: string; description: string }> = {
  header: { label: "Başlık", icon: "🎯", description: "Proje adı, kısa açıklama ve rozetler" },
  "capsule-header": { label: "Dalga Başlık", icon: "🌊", description: "capsule-render dalga görseli" },
  features: { label: "Özellikler", icon: "✨", description: "Projenin özellikleri" },
  techstack: { label: "Teknolojiler", icon: "🛠️", description: "Kullanılan teknoloji rozetleri" },
  "tech-icons": { label: "Teknoloji İkonları", icon: "🎨", description: "Görsel teknoloji ikonları" },
  "social-links": { label: "Sosyal Bağlantılar", icon: "🔗", description: "Sosyal medya rozetleri" },
  "profile-views": { label: "Profil Görüntülenme", icon: "👀", description: "Görüntülenme sayacı" },
  snake: { label: "Yılan Animasyonu", icon: "🐍", description: "Katkı grafiği animasyonu" },
  installation: { label: "Kurulum", icon: "📦", description: "Gereksinimler ve kurulum adımları" },
  usage: { label: "Kullanım", icon: "🚀", description: "Çalıştırma ve kullanım" },
  structure: { label: "Proje Yapısı", icon: "📁", description: "Klasör ağacı" },
  contributing: { label: "Katkıda Bulunma", icon: "🤝", description: "Katkı adımları" },
  license: { label: "Lisans", icon: "📄", description: "Lisans bilgisi" },
  badges: { label: "Özel Rozetler", icon: "🏷️", description: "Ek shields.io rozetleri" },
  stats: { label: "GitHub İstatistikleri", icon: "📊", description: "Profil istatistik kartları" },
  "stats-cards": { label: "İstatistik Kartları", icon: "📈", description: "İstatistik, dil ve kupa kartları" },
  image: { label: "Görsel", icon: "🖼️", description: "Görsel veya ekran görüntüsü" },
  divider: { label: "Ayırıcı", icon: "➖", description: "Bölüm ayırıcı" },
  toc: { label: "İçindekiler", icon: "📋", description: "Bölümlere bağlantılar" },
  author: { label: "Geliştirici", icon: "👤", description: "Avatar ve sosyal bağlantılar" },
  footer: { label: "Dalga Altbilgi", icon: "🌊", description: "Sayfa sonu dalgası ve yıldız çağrısı" },
  architecture: { label: "Nasıl Çalışır", icon: "⚙️", description: "Akış diyagramı ve bileşenler" },
  api: { label: "API Referansı", icon: "🔌", description: "HTTP uç noktaları tablosu" },
  config: { label: "Yapılandırma", icon: "🔧", description: "Ortam değişkenleri ve dokümanlar" },
  custom: { label: "Özel Bölüm", icon: "📝", description: "Serbest markdown içerik" },
};

export function createBlock(
  type: BlockType,
  order: number,
  data?: BlockData | Record<string, unknown>,
  lang: ReadmeLang = "tr"
): ReadmeBlock {
  const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    type,
    enabled: true,
    order,
    data: { ...getDefaultData(type, lang), ...(data as Record<string, unknown> | undefined) } as BlockData,
  };
}

export function getDefaultData(type: BlockType, lang: ReadmeLang = "tr"): BlockData {
  const s = STRINGS[lang];
  switch (type) {
    case "header":
      return {
        lang,
        title: "",
        tagline: "",
        description: "",
        showStars: false,
        showLicense: false,
        showPRs: false,
        customBadges: [],
      } as HeaderData;
    case "features":
      return { lang, items: [] } as FeaturesData;
    case "techstack":
      return { lang, items: [] } as TechStackData;
    case "tech-icons":
      return { lang, icons: [], provider: "skill-icons", height: 45, spacing: 8, align: "center" } as TechIconsData;
    case "capsule-header":
      return {
        lang,
        type: "waving",
        height: 120,
        colorTheme: "cobalt",
        gradient: "0:0d1117,50:1a1b26,100:414868",
        colorMode: "gradient",
        text: "",
        desc: "",
        fontSize: 60,
        fontColor: "FFFFFF",
        animation: "fadeIn",
      } as CapsuleHeaderData;
    case "social-links":
      return { lang, links: [], style: "for-the-badge", height: 28, align: "center" } as SocialLinksData;
    case "profile-views":
      return { lang, style: "flat-square", align: "center" } as ProfileViewsData;
    case "snake":
      return { lang, username: "" } as SnakeData;
    case "installation":
      return { lang, prerequisites: [], steps: [] } as InstallationData;
    case "usage":
      return { lang, command: "", text: "", port: "", envVars: [] } as UsageData;
    case "structure":
      return { lang, tree: "" } as StructureData;
    case "contributing":
      return { lang, intro: s.contributingIntro, steps: [...s.contributingSteps] } as ContributingData;
    case "license":
      return { lang, type: "MIT", text: "", hasFile: false } as LicenseData;
    case "badges":
      return { lang, items: [] } as BadgesData;
    case "stats":
      return {
        lang,
        username: "",
        theme: "tokyonight",
        showStars: true,
        showCommits: true,
        showContributions: true,
      } as StatsData;
    case "stats-cards":
      return {
        lang,
        username: "",
        theme: "tokyonight",
        showStats: true,
        showLanguages: true,
        showTrophy: false,
        showActivity: false,
        direction: "row",
        align: "center",
      } as StatsCardsData;
    case "image":
      return { lang, url: "", alt: "", height: 0, align: "center" } as ImageData;
    case "divider":
      return { lang, style: "line" } as DividerData;
    case "toc":
      return { lang, collapsed: true } as TocData;
    case "architecture":
      return { lang, intro: "", steps: [], showDiagram: true, components: [], embedded: [] } as ArchitectureData;
    case "api":
      return { lang, routes: [], collapsed: true } as ApiData;
    case "config":
      return { lang, vars: [], docs: [] } as ConfigData;
    case "author":
      return { lang, name: "", login: "", showAvatar: true, bio: "", links: [], style: "for-the-badge" } as AuthorData;
    case "footer":
      return { lang, gradient: "0:0d1117,100:414868", type: "waving", height: 100, starCta: true } as FooterData;
    case "custom":
      return { lang, title: "", content: "" } as CustomData;
  }
}

/** Belgenin dili: bloklardan ilk bulunan, yoksa Türkçe. */
export function detectBlocksLang(blocks: ReadmeBlock[]): ReadmeLang {
  for (const b of blocks) {
    const lang = (b.data as BlockCommon).lang;
    if (lang) return lang;
  }
  return "tr";
}
