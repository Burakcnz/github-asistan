import {
  ReadmeBlock,
  HeaderData,
  FeaturesData,
  TechStackData,
  TechIconsData,
  InstallationData,
  UsageData,
  StructureData,
  ContributingData,
  LicenseData,
  BadgesData,
  StatsData,
  StatsCardsData,
  ImageData,
  DividerData,
  CapsuleHeaderData,
  SocialLinksData,
  ProfileViewsData,
  SnakeData,
  CustomData,
  TocData,
  AuthorData,
  FooterData,
  ArchitectureData,
  ApiData,
  ConfigData,
  BlockCommon,
  detectBlocksLang,
} from "./readme-blocks";
import { getIconUrl, resolveIcon } from "./tech-icons";
import { socialBadgeUrl, socialLabel } from "./readme/social";
import { STRINGS, type ReadmeLang } from "./readme/i18n";
import {
  getBorderUrl,
  getStatsCardUrl,
  getTopLangsUrl,
  getTrophyUrl,
  getActivityUrl,
  getProfileViewsUrl,
  getSnakeUrl,
  getStreakUrl,
} from "./readme-urls";

type Ctx = { lang: ReadmeLang; blocks?: ReadmeBlock[] };

/** HTML etiketlerinin içine yazılan metinler için. */
function esc(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** shields.io statik rozet metni. */
function badgeText(str: string): string {
  return encodeURIComponent(str.replace(/-/g, "--").replace(/_/g, "__"));
}

function heading(data: { heading?: string }, fallback: string): string {
  const text = (data.heading ?? "").trim() || fallback;
  return `## ${text}`;
}

function renderCapsuleHeader(data: CapsuleHeaderData): string {
  const url = getBorderUrl({
    type: data.type,
    height: data.height,
    section: "header",
    color:
      data.colorMode === "gradient"
        ? { type: "gradient", gradient: data.gradient }
        : { type: "theme", theme: data.colorTheme },
    text: data.text || undefined,
    fontSize: data.fontSize || undefined,
    fontColor: data.fontColor || undefined,
    fontAlignY: data.text ? (data.desc ? 34 : 40) : undefined,
    desc: data.desc || undefined,
    descSize: data.desc ? 18 : undefined,
    descAlignY: data.desc ? 55 : undefined,
    animation: data.animation || undefined,
  });
  return `<img width="100%" src="${url}" alt="${esc(data.text || "")}" />`;
}

const DYNAMIC_BADGES: Record<string, { label: string; path: string }> = {
  stars: { label: "Stars", path: "github/stars" },
  forks: { label: "Forks", path: "github/forks" },
  issues: { label: "Issues", path: "github/issues" },
  "last-commit": { label: "Last commit", path: "github/last-commit" },
  "top-language": { label: "Top language", path: "github/languages/top" },
  "repo-size": { label: "Repo size", path: "github/repo-size" },
};

function renderHeader(data: HeaderData): string {
  const lines: string[] = ['<div align="center">', ""];
  if (data.title && !data.hideTitle) {
    lines.push(`# ${data.title}`, "");
  }
  if (data.tagline) {
    lines.push(`**${data.tagline.trim()}**`, "");
  }

  const style = data.badgeStyle ?? "flat";
  const repo = data.githubOwner && data.githubRepo ? `${data.githubOwner}/${data.githubRepo}` : "";
  const badges: string[] = [];
  const dynamic = new Set<string>(data.dynamicBadges ?? []);
  if (data.showStars) dynamic.add("stars");
  if (repo) {
    for (const key of Object.keys(DYNAMIC_BADGES)) {
      if (!dynamic.has(key)) continue;
      const b = DYNAMIC_BADGES[key];
      badges.push(`[![${b.label}](https://img.shields.io/${b.path}/${repo}?style=${style}&logo=github)](https://github.com/${repo})`);
    }
  }
  if (data.version) {
    badges.push(`![Version](https://img.shields.io/badge/version-${badgeText(data.version)}-blue?style=${style})`);
  }
  if (data.showLicense && data.license) {
    badges.push(`![License](https://img.shields.io/badge/license-${badgeText(data.license)}-green?style=${style})`);
  }
  if (data.showPRs) {
    badges.push(`![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=${style})`);
  }
  for (const badge of data.customBadges ?? []) {
    if (badge.url) badges.push(`![${badge.label}](${badge.url})`);
  }
  if (badges.length > 0) {
    lines.push(badges.join(" "), "");
  }
  lines.push("</div>");

  if (data.description?.trim()) {
    lines.push("", data.description.trim());
  }
  return lines.join("\n");
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

function renderFeatures(data: FeaturesData, ctx: Ctx): string {
  const items = data.items.filter((i) => i.title || i.description);
  const groups = (data.groups ?? []).filter((g) => g.title || g.items.length);
  if (items.length === 0 && groups.length === 0) return "";
  const lines = [heading(data, STRINGS[ctx.lang].headings.features), ""];
  for (const g of groups) {
    if (g.title) lines.push(`### ${g.emoji ? `${g.emoji} ` : ""}${g.title}`, "");
    for (const it of g.items.filter(Boolean)) lines.push(`- ${it}`);
    lines.push("");
  }
  for (const item of items) {
    const emoji = item.emoji ? `${item.emoji} ` : "";
    const title = item.title ? `**${item.title}**` : "";
    const sep = item.title && item.description ? " — " : "";
    lines.push(`- ${emoji}${title}${sep}${item.description}`);
  }
  return lines.join("\n");
}

function renderTechStack(data: TechStackData, ctx: Ctx): string {
  const items = data.items.filter((i) => i.name);
  if (items.length === 0) return "";
  const lines = [heading(data, STRINGS[ctx.lang].headings.techstack), ""];
  lines.push(items.map((item) => (item.badge ? `![${item.name}](${item.badge})` : `\`${item.name}\``)).join(" "));
  return lines.join("\n");
}

function skillIconId(icon: string): string | null {
  const url = resolveIcon(icon)?.providers["skill-icons"];
  return url ? new URL(url).searchParams.get("i") : null;
}

function renderTechIcons(data: TechIconsData): string {
  if (data.icons.length === 0) return "";
  // Hepsi skill-icons destekliyorsa tek görselde birleştir (daha az istek, eşit aralık).
  if (data.provider === "skill-icons") {
    const ids = data.icons.map(skillIconId);
    if (ids.length > 0 && ids.every(Boolean)) {
      const perline = Math.min(ids.length, 12);
      return `<p align="${data.align}">\n  <img src="https://skillicons.dev/icons?i=${ids.join(",")}&perline=${perline}" height="${data.height}" alt="${esc(data.icons.join(", "))}" />\n</p>`;
    }
  }
  // profile-readme-generator tekniği: ikonlar arasına genişlikli boş <img> ile aralık.
  const spacing = data.spacing ?? 8;
  const imgs = data.icons
    .map((icon) => {
      const cfg = resolveIcon(icon);
      const url = getIconUrl(icon, data.provider);
      return url ? `  <img src="${url}" height="${data.height}" alt="${esc(cfg?.name ?? icon)}" title="${esc(cfg?.name ?? icon)}" />` : "";
    })
    .filter(Boolean);
  if (imgs.length === 0) return "";
  const spacer = spacing > 0 ? `\n  <img width="${spacing}" />\n` : "\n";
  return `<p align="${data.align}">\n${imgs.join(spacer)}\n</p>`;
}

function renderSocialLinks(data: SocialLinksData): string {
  const items = data.links
    .map((link) => {
      const tag = `<img src="${socialBadgeUrl(link.platform, data.style)}" height="${data.height}" alt="${esc(socialLabel(link.platform))}" />`;
      return link.url ? `  <a href="${esc(link.url)}">${tag}</a>` : `  ${tag}`;
    })
    .filter(Boolean);
  if (items.length === 0) return "";
  return `<p align="${data.align}">\n${items.join("\n")}\n</p>`;
}

function renderProfileViews(data: ProfileViewsData): string {
  if (!data.username?.trim()) return "";
  return `<p align="${data.align}"><img src="${getProfileViewsUrl(data.username, data.style)}" alt="" /></p>`;
}

function renderSnake(data: SnakeData): string {
  if (!data.username?.trim()) return "";
  return `<img width="100%" src="${getSnakeUrl(data.username)}" alt="Snake animation" />`;
}

function renderInstallation(data: InstallationData, ctx: Ctx): string {
  const s = STRINGS[ctx.lang];
  const prereqs = (data.prerequisites ?? []).filter(Boolean);
  const steps = data.steps.filter((st) => st.command.trim() || st.label.trim());
  if (steps.length === 0 && prereqs.length === 0) return "";

  const lines = [heading(data, s.headings.installation), ""];
  if (prereqs.length > 0) {
    lines.push(`**${s.prerequisites}:** ${prereqs.join(", ")}`, "");
  }

  const notes = steps.filter((st) => !st.command.trim());
  const commands = steps.filter((st) => st.command.trim());
  for (const note of notes) lines.push(`- ${note.label}`);
  if (notes.length > 0) lines.push("");

  if (commands.length > 0) {
    lines.push("```bash");
    commands.forEach((st, i) => {
      if (st.label.trim()) lines.push(`# ${st.label.trim()}`);
      lines.push(st.command.trim());
      if (i < commands.length - 1) lines.push("");
    });
    lines.push("```");
  }
  return lines.join("\n").trimEnd();
}

function renderUsage(data: UsageData, ctx: Ctx): string {
  const s = STRINGS[ctx.lang];
  const parts: string[] = [];

  if (data.command?.trim()) {
    parts.push("```bash\n" + data.command.trim() + "\n```");
  }
  const notes: string[] = [];
  if (data.port?.trim()) notes.push(s.runsAt(`http://localhost:${data.port.trim()}`));
  if (data.launcher?.trim()) notes.push(s.orLauncher(data.launcher.trim()));
  if (notes.length > 0) parts.push(notes.join(" "));
  if (data.text?.trim()) parts.push(data.text.trim());
  for (const flow of data.flows ?? []) {
    const steps = flow.steps.filter(Boolean);
    if (!flow.title || steps.length === 0) continue;
    parts.push([`#### ${flow.title}`, "", ...steps.map((s, i) => `${i + 1}. ${s}`)].join("\n"));
  }

  const envVars = (data.envVars ?? []).filter((e) => e.key);
  if (envVars.length > 0) {
    const env: string[] = [`### ${s.envTitle}`, "", s.envIntro, "", "```env"];
    for (const e of envVars) env.push(`${e.key}=${e.value ?? ""}`);
    env.push("```");
    const described = envVars.filter((e) => e.description?.trim());
    if (described.length > 0) {
      env.push("", `| ${s.envVariable} | ${s.envDescription} |`, "| --- | --- |");
      for (const e of described) env.push(`| \`${e.key}\` | ${e.description.replace(/\|/g, "\\|")} |`);
    }
    parts.push(env.join("\n"));
  }

  if (parts.length === 0) return "";
  return [heading(data, s.headings.usage), "", parts.join("\n\n")].join("\n");
}

function renderStructure(data: StructureData, ctx: Ctx): string {
  if (!data.tree?.trim()) return "";
  return [heading(data, STRINGS[ctx.lang].headings.structure), "", "```text", data.tree.trimEnd(), "```"].join("\n");
}

function renderContributing(data: ContributingData, ctx: Ctx): string {
  const s = STRINGS[ctx.lang];
  const steps = data.steps.filter(Boolean);
  const lines = [heading(data, s.headings.contributing), ""];
  const intro = data.intro ?? s.contributingIntro;
  if (intro) lines.push(intro, "");
  steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
  return lines.join("\n").trimEnd();
}

function renderLicense(data: LicenseData, ctx: Ctx): string {
  const s = STRINGS[ctx.lang];
  const body = data.text?.trim() || (data.type ? s.licenseText(data.type) : "");
  if (!body) return "";
  const suffix = data.hasFile ? ` ${s.licenseFile}` : "";
  return [heading(data, s.headings.license), "", body + suffix].join("\n");
}

function renderBadges(data: BadgesData): string {
  const items = data.items.filter((b) => b.url);
  if (items.length === 0) return "";
  return ['<div align="center">', "", items.map((b) => `![${b.label}](${b.url})`).join(" "), "", "</div>"].join("\n");
}

function renderStats(data: StatsData, ctx: Ctx): string {
  if (!data.username?.trim()) return "";
  const lines = [heading(data, STRINGS[ctx.lang].headings.stats), "", '<p align="center">'];
  if (data.showStars || data.showCommits) lines.push(`  <img src="${getStatsCardUrl(data.username, data.theme)}" alt="" />`);
  if (data.showContributions) lines.push(`  <img src="${getStreakUrl(data.username, data.theme)}" alt="" />`);
  lines.push("</p>");
  return lines.join("\n");
}

function renderStatsCards(data: StatsCardsData, ctx: Ctx): string {
  if (!data.username?.trim()) return "";
  const imgs: string[] = [];
  if (data.showStats) imgs.push(`<img src="${getStatsCardUrl(data.username, data.theme)}" height="165" alt="" />`);
  if (data.showLanguages) imgs.push(`<img src="${getTopLangsUrl(data.username, data.theme)}" height="165" alt="" />`);
  if (data.showTrophy) imgs.push(`<img src="${getTrophyUrl(data.username, data.theme)}" alt="" />`);
  if (data.showActivity) imgs.push(`<img src="${getActivityUrl(data.username, data.theme)}" width="100%" alt="" />`);
  if (imgs.length === 0) return "";
  const joiner = data.direction === "column" ? "\n  <br />\n  " : "\n  ";
  return [heading(data, STRINGS[ctx.lang].headings.stats), "", `<p align="${data.align}">`, "  " + imgs.join(joiner), "</p>"].join("\n");
}

function renderImage(data: ImageData): string {
  if (!data.url?.trim()) return "";
  const size = data.height ? ` height="${data.height}"` : ` width="100%"`;
  const img = `<img src="${esc(data.url.trim())}"${size} alt="${esc(data.alt ?? "")}" />`;
  const title = data.heading?.trim() ? `## ${data.heading.trim()}\n\n` : "";
  return `${title}<p align="${data.align}">\n  ${img}\n</p>`;
}

function renderDivider(data: DividerData): string {
  switch (data.style) {
    case "stars":
      return '<p align="center">⭐ ⭐ ⭐</p>';
    case "blank":
      return "<br />";
    case "line":
    default:
      return "---";
  }
}

/** GitHub başlık bağlantısı (anchor) kuralı. */
export function githubSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

/** Bloğun README'de oluşturduğu "##" başlık metni (yoksa null). */
function sectionHeading(block: ReadmeBlock, ctx: Ctx): string | null {
  const h = STRINGS[ctx.lang].headings;
  const own = ((block.data as BlockCommon).heading ?? "").trim();
  const defaults: Partial<Record<ReadmeBlock["type"], string>> = {
    features: h.features,
    techstack: h.techstack,
    installation: h.installation,
    usage: h.usage,
    structure: h.structure,
    contributing: h.contributing,
    license: h.license,
    stats: h.stats,
    "stats-cards": h.stats,
    author: h.author,
    architecture: h.architecture,
    api: h.api,
    config: h.config,
  };
  if (block.type === "custom") return (block.data as CustomData).title?.trim() || null;
  if (block.type === "image") return own || null;
  const fallback = defaults[block.type];
  return fallback ? own || fallback : null;
}

function renderToc(data: TocData, ctx: Ctx, self: ReadmeBlock): string {
  const blocks = (ctx.blocks ?? []).filter((b) => b.enabled && b.order > self.order).sort((a, b) => a.order - b.order);
  const entries = blocks
    .filter((b) => b.type !== "toc" && renderBlock(b, ctx).trim())
    .map((b) => sectionHeading(b, ctx))
    .filter((t): t is string => !!t);
  if (entries.length < 2) return "";
  const title = (data.heading ?? "").trim() || STRINGS[ctx.lang].headings.toc;
  const list = entries.map((t) => `- [${t}](#${githubSlug(t)})`).join("\n");
  if (data.collapsed) {
    return `<details>\n<summary><b>${esc(title)}</b></summary>\n\n${list}\n\n</details>`;
  }
  return `## ${title}\n\n${list}`;
}

function renderAuthor(data: AuthorData, ctx: Ctx): string {
  const login = data.login.trim();
  if (!login && !data.name.trim()) return "";
  const lines = [heading(data, STRINGS[ctx.lang].headings.author), "", '<p align="center">'];
  const profile = login ? `https://github.com/${login}` : "";
  if (data.showAvatar && login) {
    lines.push(`  <a href="${profile}"><img src="https://github.com/${login}.png?size=120" width="110" alt="${esc(data.name || login)}" /></a>`);
    lines.push("  <br />");
  }
  const display = esc(data.name.trim() || login);
  lines.push(login ? `  <b>${display}</b> · <a href="${profile}">@${esc(login)}</a>` : `  <b>${display}</b>`);
  if (data.bio?.trim()) lines.push(`  <br />`, `  <sub>${esc(data.bio.trim())}</sub>`);
  lines.push("</p>");
  const links = data.links.filter((l) => l.url);
  if (links.length > 0) {
    lines.push("", '<p align="center">');
    for (const l of links) {
      const href = l.platform === "email" && !l.url.startsWith("mailto:") ? `mailto:${l.url}` : l.url;
      lines.push(`  <a href="${esc(href)}"><img src="${socialBadgeUrl(l.platform, data.style)}" alt="${esc(socialLabel(l.platform))}" /></a>`);
    }
    lines.push("</p>");
  }
  return lines.join("\n");
}

function renderFooter(data: FooterData, ctx: Ctx): string {
  const parts: string[] = [];
  if (data.starCta) {
    const cta = STRINGS[ctx.lang].starCta;
    parts.push(`<p align="center">${data.repoUrl ? `<a href="${esc(data.repoUrl)}">${esc(cta)}</a>` : esc(cta)}</p>`);
  }
  const url = getBorderUrl({
    type: data.type,
    height: data.height,
    section: "footer",
    color: { type: "gradient", gradient: data.gradient },
  });
  parts.push(`<img width="100%" src="${url}" alt="" />`);
  return parts.join("\n\n");
}

/** Mermaid düğüm metni için güvenli hale getirir. */
const mermaidLabel = (s: string) => s.replace(/["[\]{}()<>|#;]/g, " ").replace(/\s+/g, " ").trim();

function renderArchitecture(data: ArchitectureData, ctx: Ctx): string {
  const s = STRINGS[ctx.lang];
  const steps = data.steps.filter((st) => st.title);
  const comps = data.components.filter((c) => c.name && c.role);
  if (!data.intro?.trim() && steps.length === 0 && comps.length === 0 && data.embedded.length === 0) return "";
  const parts: string[] = [heading(data, s.headings.architecture)];
  if (data.intro?.trim()) parts.push(data.intro.trim());
  if (steps.length > 1 && data.showDiagram) {
    const nodes = steps.map((st, i) => `  S${i}["${mermaidLabel(st.title)}"]`);
    const edges = steps.slice(1).map((_, i) => `  S${i} --> S${i + 1}`);
    parts.push(["```mermaid", "flowchart LR", ...nodes, ...edges, "```"].join("\n"));
  }
  if (steps.some((st) => st.description)) {
    parts.push(steps.map((st, i) => `${i + 1}. **${st.title}**${st.description ? ` — ${st.description}` : ""}`).join("\n"));
  }
  if (comps.length > 0) {
    parts.push(
      [`| ${s.table.component} | ${s.table.role} |`, "| --- | --- |", ...comps.map((c) => `| \`${cell(c.name)}\` | ${cell(c.role)} |`)].join("\n")
    );
  }
  if (data.embedded.length > 0) parts.push(`> ${s.embeddedNote(data.embedded.map((e) => `\`${e}\``).join(", "))}`);
  return parts.join("\n\n");
}

function renderApi(data: ApiData, ctx: Ctx): string {
  const s = STRINGS[ctx.lang];
  const routes = data.routes.filter((r) => r.path);
  if (routes.length === 0) return "";
  const byGroup = new Map<string, typeof routes>();
  for (const r of routes) byGroup.set(r.group || "API", [...(byGroup.get(r.group || "API") ?? []), r]);
  const table = (list: typeof routes) =>
    [
      `| ${s.table.method} | ${s.table.path} | ${s.table.description} |`,
      "| --- | --- | --- |",
      ...list.map((r) => `| \`${r.method}\` | \`${cell(r.path)}\` | ${cell(r.description || "")} |`),
    ].join("\n");
  const parts: string[] = [heading(data, s.headings.api), s.apiCount(routes.length)];
  for (const [group, list] of byGroup) {
    if (data.collapsed) {
      parts.push(`<details>\n<summary><b>${esc(group)}</b> (${list.length})</summary>\n\n${table(list)}\n\n</details>`);
    } else {
      parts.push(`### ${group}\n\n${table(list)}`);
    }
  }
  return parts.join("\n\n");
}

function renderConfig(data: ConfigData, ctx: Ctx): string {
  const s = STRINGS[ctx.lang];
  const vars = data.vars.filter((v) => v.key);
  const docs = data.docs.filter((d) => d.path);
  if (vars.length === 0 && docs.length === 0) return "";
  const parts: string[] = [heading(data, s.headings.config)];
  if (vars.length > 0) {
    parts.push(s.configIntro);
    parts.push(
      [
        `| ${s.table.variable} | ${s.table.defaultValue} | ${s.table.description} |`,
        "| --- | --- | --- |",
        ...vars.map((v) => `| \`${v.key}\` | ${v.defaultValue ? `\`${cell(v.defaultValue)}\`` : "—"} | ${cell(v.description || "")} |`),
      ].join("\n")
    );
  }
  if (docs.length > 0) {
    parts.push(`### ${s.headings.docs}\n\n${s.docsIntro}\n\n${docs.map((d) => `- [${d.title}](${encodeURI(d.path)})`).join("\n")}`);
  }
  return parts.join("\n\n");
}

function renderCustom(data: CustomData): string {
  const content = data.content?.trim() ?? "";
  const title = data.title?.trim();
  if (!title && !content) return "";
  return [title ? `## ${title}` : "", content].filter(Boolean).join("\n\n");
}

export function renderBlock(block: ReadmeBlock, ctx: Ctx = { lang: "tr" }): string {
  switch (block.type) {
    case "capsule-header":
      return renderCapsuleHeader(block.data as CapsuleHeaderData);
    case "header":
      return renderHeader(block.data as HeaderData);
    case "features":
      return renderFeatures(block.data as FeaturesData, ctx);
    case "techstack":
      return renderTechStack(block.data as TechStackData, ctx);
    case "tech-icons":
      return renderTechIcons(block.data as TechIconsData);
    case "social-links":
      return renderSocialLinks(block.data as SocialLinksData);
    case "profile-views":
      return renderProfileViews(block.data as ProfileViewsData);
    case "snake":
      return renderSnake(block.data as SnakeData);
    case "installation":
      return renderInstallation(block.data as InstallationData, ctx);
    case "usage":
      return renderUsage(block.data as UsageData, ctx);
    case "structure":
      return renderStructure(block.data as StructureData, ctx);
    case "contributing":
      return renderContributing(block.data as ContributingData, ctx);
    case "license":
      return renderLicense(block.data as LicenseData, ctx);
    case "badges":
      return renderBadges(block.data as BadgesData);
    case "stats":
      return renderStats(block.data as StatsData, ctx);
    case "stats-cards":
      return renderStatsCards(block.data as StatsCardsData, ctx);
    case "image":
      return renderImage(block.data as ImageData);
    case "divider":
      return renderDivider(block.data as DividerData);
    case "toc":
      return renderToc(block.data as TocData, ctx, block);
    case "architecture":
      return renderArchitecture(block.data as ArchitectureData, ctx);
    case "api":
      return renderApi(block.data as ApiData, ctx);
    case "config":
      return renderConfig(block.data as ConfigData, ctx);
    case "author":
      return renderAuthor(block.data as AuthorData, ctx);
    case "footer":
      return renderFooter(block.data as FooterData, ctx);
    case "custom":
      return renderCustom(block.data as CustomData);
    default:
      return "";
  }
}

export function renderAllBlocks(blocks: ReadmeBlock[], lang?: ReadmeLang): string {
  const ctx: Ctx = { lang: lang ?? detectBlocksLang(blocks), blocks };
  const body = blocks
    .filter((b) => b.enabled)
    .sort((a, b) => a.order - b.order)
    .map((b) => {
      try {
        return renderBlock(b, ctx);
      } catch {
        return "";
      }
    })
    .filter((s) => s.trim().length > 0)
    .join("\n\n");
  return body ? body + "\n" : "";
}
