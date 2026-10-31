"use client";

import { useState, type ReactNode } from "react";
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
  BlockData,
  BlockCommon,
  TocData,
  AuthorData,
  FooterData,
  DynamicBadge,
} from "@/lib/readme-blocks";
import { STRINGS } from "@/lib/readme/i18n";
import { ICON_PROVIDERS, resolveIcon, searchIcons } from "@/lib/tech-icons";
import { SOCIAL_PLATFORMS, socialLabel, type BadgeStyle } from "@/lib/readme/social";

interface BlockFormsProps {
  block: ReadmeBlock;
  onChange: (data: BlockData) => void;
}

type FormProps<T> = { data: T; onChange: (d: T) => void };

const inputCls =
  "w-full h-[32px] px-3 text-[13px] text-[#c9d1d9] bg-[#0d1117] border border-[#30363d] rounded-md focus:border-[#58a6ff] focus:outline-none transition-colors";
const rowInputCls =
  "h-[32px] px-2 text-[13px] text-[#c9d1d9] bg-[#161b22] border border-[#30363d] rounded-md focus:border-[#58a6ff] focus:outline-none min-w-0";
const addBtnCls =
  "h-[30px] px-3 text-[12px] text-[#58a6ff] hover:bg-[#58a6ff22] border border-dashed border-[#30363d] rounded-md transition-colors";
const removeBtnCls = "h-[32px] w-[28px] shrink-0 text-[#f85149] hover:bg-[#f8514922] rounded-md transition-colors text-[14px]";

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block mb-3">
      <span className="block text-[12px] text-[#8b949e] mb-1 font-medium">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-[#6e7681] mt-1">{hint}</span>}
    </label>
  );
}

function Input({ label, value, onChange, placeholder, hint, mono }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; mono?: boolean }) {
  return (
    <Field label={label} hint={hint}>
      <input type="text" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inputCls} ${mono ? "font-mono" : ""}`} />
    </Field>
  );
}

function Textarea({ label, value, onChange, placeholder, rows = 3, mono, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; mono?: boolean; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`w-full px-3 py-2 text-[13px] text-[#c9d1d9] bg-[#0d1117] border border-[#30363d] rounded-md focus:border-[#58a6ff] focus:outline-none resize-y transition-colors ${mono ? "font-mono" : ""}`}
      />
    </Field>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 mb-2 cursor-pointer group">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" role="switch" />
      <span className={`w-8 h-4 rounded-full transition-colors relative peer-focus-visible:ring-2 peer-focus-visible:ring-[#58a6ff] ${checked ? "bg-[#238636]" : "bg-[#30363d]"}`}>
        <span className={`absolute top-0.5 w-3 h-3 rounded-full transition-transform bg-white ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </span>
      <span className="text-[13px] text-[#c9d1d9] group-hover:text-[#f0f6fc]">{label}</span>
    </label>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="mb-3">
      <span className="block text-[12px] text-[#8b949e] mb-1 font-medium">{label}</span>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`px-3 h-[28px] text-[12px] rounded-md border transition-colors ${value === o.value ? "bg-[#58a6ff22] border-[#58a6ff] text-[#58a6ff]" : "border-[#30363d] text-[#8b949e] hover:text-[#c9d1d9]"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const ALIGN_OPTIONS = [
  { value: "left" as const, label: "Sol" },
  { value: "center" as const, label: "Orta" },
  { value: "right" as const, label: "Sağ" },
];

/** Dizi düzenleyici yardımcıları. */
function listOps<T>(items: T[], set: (items: T[]) => void) {
  return {
    add: (item: T) => set([...items, item]),
    remove: (i: number) => set(items.filter((_, idx) => idx !== i)),
    update: (i: number, patch: Partial<T>) => set(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it))),
  };
}

/** Bölüm başlığı alanı (boş bırakılırsa dile göre varsayılan kullanılır). */
function HeadingInput<T extends BlockCommon>({ data, onChange, fallback }: FormProps<T> & { fallback: string }) {
  return <Input label="Bölüm başlığı" value={data.heading ?? ""} onChange={(v) => onChange({ ...data, heading: v })} placeholder={fallback} hint="Boş bırakılırsa varsayılan başlık kullanılır" />;
}

export function BlockForms({ block, onChange }: BlockFormsProps) {
  const lang = (block.data as BlockCommon).lang ?? "tr";
  const h = STRINGS[lang].headings;
  // Her form kendi veri tipini alır; burada blok tipine göre eşleştiriliyor.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props = { onChange: onChange as (d: any) => void };
  switch (block.type) {
    case "header":
      return <HeaderForm data={block.data as HeaderData} {...props} />;
    case "features":
      return <FeaturesForm data={block.data as FeaturesData} fallback={h.features} {...props} />;
    case "techstack":
      return <TechStackForm data={block.data as TechStackData} fallback={h.techstack} {...props} />;
    case "tech-icons":
      return <TechIconsForm data={block.data as TechIconsData} {...props} />;
    case "installation":
      return <InstallationForm data={block.data as InstallationData} fallback={h.installation} {...props} />;
    case "usage":
      return <UsageForm data={block.data as UsageData} fallback={h.usage} {...props} />;
    case "structure":
      return <StructureForm data={block.data as StructureData} fallback={h.structure} {...props} />;
    case "contributing":
      return <ContributingForm data={block.data as ContributingData} fallback={h.contributing} {...props} />;
    case "license":
      return <LicenseForm data={block.data as LicenseData} fallback={h.license} {...props} />;
    case "badges":
      return <BadgesForm data={block.data as BadgesData} {...props} />;
    case "stats":
      return <StatsForm data={block.data as StatsData} fallback={h.stats} {...props} />;
    case "stats-cards":
      return <StatsCardsForm data={block.data as StatsCardsData} fallback={h.stats} {...props} />;
    case "image":
      return <ImageForm data={block.data as ImageData} {...props} />;
    case "divider":
      return <DividerForm data={block.data as DividerData} {...props} />;
    case "capsule-header":
      return <CapsuleForm data={block.data as CapsuleHeaderData} {...props} />;
    case "social-links":
      return <SocialLinksForm data={block.data as SocialLinksData} {...props} />;
    case "profile-views":
      return <ProfileViewsForm data={block.data as ProfileViewsData} {...props} />;
    case "snake":
      return <SnakeForm data={block.data as SnakeData} {...props} />;
    case "toc":
      return <TocForm data={block.data as TocData} fallback={h.toc} {...props} />;
    case "author":
      return <AuthorForm data={block.data as AuthorData} fallback={h.author} {...props} />;
    case "footer":
      return <FooterForm data={block.data as FooterData} {...props} />;
    case "custom":
      return <CustomForm data={block.data as CustomData} {...props} />;
    default:
      return <p className="text-[#8b949e] text-sm">Bu blok için form yok.</p>;
  }
}

function HeaderForm({ data, onChange }: FormProps<HeaderData>) {
  const badges = listOps(data.customBadges ?? [], (customBadges) => onChange({ ...data, customBadges }));
  return (
    <div>
      <Input label="Proje adı" value={data.title} onChange={(v) => onChange({ ...data, title: v })} placeholder="Proje adı" />
      <Input label="Kısa açıklama (slogan)" value={data.tagline} onChange={(v) => onChange({ ...data, tagline: v })} placeholder="Projenin ne yaptığını tek cümlede anlatın" />
      <Textarea label="Tanıtım paragrafı" value={data.description ?? ""} onChange={(v) => onChange({ ...data, description: v })} rows={3} placeholder="Proje hangi sorunu çözüyor, kimin için?" />
      <div className="grid grid-cols-2 gap-2">
        <Input label="GitHub kullanıcı" value={data.githubOwner ?? ""} onChange={(v) => onChange({ ...data, githubOwner: v })} placeholder="kullanici" />
        <Input label="Repo adı" value={data.githubRepo ?? ""} onChange={(v) => onChange({ ...data, githubRepo: v })} placeholder="repo" />
      </div>
      <Toggle label="Başlığı gizle (dalga başlık adı gösteriyorsa)" checked={!!data.hideTitle} onChange={(v) => onChange({ ...data, hideTitle: v })} />
      <Segmented label="Rozet stili" value={data.badgeStyle ?? "flat"} options={BADGE_STYLES} onChange={(v) => onChange({ ...data, badgeStyle: v })} />
      <span className="block text-[12px] text-[#8b949e] mb-1 font-medium">Canlı GitHub rozetleri (repo GitHub&apos;dayken)</span>
      <div className="flex flex-wrap gap-1 mb-3">
        {DYNAMIC_OPTIONS.map((o) => {
          const on = (data.dynamicBadges ?? []).includes(o.value);
          return (
            <button
              key={o.value}
              aria-pressed={on}
              onClick={() =>
                onChange({ ...data, dynamicBadges: on ? (data.dynamicBadges ?? []).filter((d) => d !== o.value) : [...(data.dynamicBadges ?? []), o.value] })
              }
              className={`px-2 h-[26px] text-[11px] rounded-md border transition-colors ${on ? "bg-[#238636] border-[#238636] text-white" : "border-[#30363d] text-[#8b949e] hover:text-[#c9d1d9]"}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <Input label="Sürüm rozeti" value={data.version ?? ""} onChange={(v) => onChange({ ...data, version: v })} placeholder="1.0.0 (boşsa gösterilmez)" />
      <Toggle label="Lisans rozeti" checked={data.showLicense} onChange={(v) => onChange({ ...data, showLicense: v })} />
      {data.showLicense && <Input label="Lisans" value={data.license ?? ""} onChange={(v) => onChange({ ...data, license: v })} placeholder="MIT" />}
      <Toggle label="“PRs welcome” rozeti" checked={data.showPRs} onChange={(v) => onChange({ ...data, showPRs: v })} />
      <span className="block text-[12px] text-[#8b949e] mb-1 mt-2 font-medium">Ek rozetler</span>
      {(data.customBadges ?? []).map((b, i) => (
        <div key={i} className="flex gap-2 mb-2">
          <input className={`${rowInputCls} w-[30%]`} value={b.label} onChange={(e) => badges.update(i, { label: e.target.value })} placeholder="Etiket" aria-label="Rozet etiketi" />
          <input className={`${rowInputCls} flex-1`} value={b.url} onChange={(e) => badges.update(i, { url: e.target.value })} placeholder="https://img.shields.io/..." aria-label="Rozet URL" />
          <button onClick={() => badges.remove(i)} className={removeBtnCls} aria-label="Rozeti sil">×</button>
        </div>
      ))}
      <button onClick={() => badges.add({ label: "", url: "", color: "" })} className={addBtnCls}>+ Rozet ekle</button>
    </div>
  );
}

function FeaturesForm({ data, onChange, fallback }: FormProps<FeaturesData> & { fallback: string }) {
  const ops = listOps(data.items, (items) => onChange({ ...data, items }));
  return (
    <div>
      <HeadingInput data={data} onChange={onChange} fallback={fallback} />
      {data.items.map((item, i) => (
        <div key={i} className="mb-2 p-2 bg-[#0d1117] border border-[#30363d] rounded-md space-y-2">
          <div className="flex gap-2">
            <input value={item.emoji} onChange={(e) => ops.update(i, { emoji: e.target.value })} className={`${rowInputCls} w-[46px] text-center text-[16px]`} placeholder="🚀" aria-label="Emoji" />
            <input value={item.title} onChange={(e) => ops.update(i, { title: e.target.value })} className={`${rowInputCls} flex-1`} placeholder="Özellik adı" aria-label="Özellik adı" />
            <button onClick={() => ops.remove(i)} className={removeBtnCls} aria-label="Özelliği sil">×</button>
          </div>
          <input value={item.description} onChange={(e) => ops.update(i, { description: e.target.value })} className={`${rowInputCls} w-full`} placeholder="Ne işe yarar?" aria-label="Özellik açıklaması" />
        </div>
      ))}
      <button onClick={() => ops.add({ emoji: "✨", title: "", description: "" })} className={addBtnCls}>+ Özellik ekle</button>
    </div>
  );
}

function TechStackForm({ data, onChange, fallback }: FormProps<TechStackData> & { fallback: string }) {
  const ops = listOps(data.items, (items) => onChange({ ...data, items }));
  return (
    <div>
      <HeadingInput data={data} onChange={onChange} fallback={fallback} />
      {data.items.map((item, i) => (
        <div key={i} className="flex gap-2 mb-2">
          <input value={item.name} onChange={(e) => ops.update(i, { name: e.target.value })} className={`${rowInputCls} w-[35%]`} placeholder="Teknoloji" aria-label="Teknoloji adı" />
          <input value={item.badge} onChange={(e) => ops.update(i, { badge: e.target.value })} className={`${rowInputCls} flex-1`} placeholder="Rozet URL (opsiyonel)" aria-label="Rozet URL" />
          <button onClick={() => ops.remove(i)} className={removeBtnCls} aria-label="Teknolojiyi sil">×</button>
        </div>
      ))}
      <button onClick={() => ops.add({ name: "", description: "", badge: "" })} className={addBtnCls}>+ Teknoloji ekle</button>
    </div>
  );
}

function InstallationForm({ data, onChange, fallback }: FormProps<InstallationData> & { fallback: string }) {
  const ops = listOps(data.steps, (steps) => onChange({ ...data, steps }));
  return (
    <div>
      <HeadingInput data={data} onChange={onChange} fallback={fallback} />
      <Input
        label="Gereksinimler"
        value={(data.prerequisites ?? []).join(", ")}
        onChange={(v) => onChange({ ...data, prerequisites: v.split(",").map((s) => s.trim()).filter(Boolean) })}
        placeholder="Node.js 18+, Python 3.10+"
        hint="Virgülle ayırın"
      />
      <span className="block text-[12px] text-[#8b949e] mb-1 font-medium">Adımlar</span>
      {data.steps.map((step, i) => (
        <div key={i} className="mb-2 p-2 bg-[#0d1117] border border-[#30363d] rounded-md space-y-2">
          <div className="flex gap-2 items-center">
            <span className="text-[12px] text-[#8b949e] w-[18px] text-center font-mono">{i + 1}</span>
            <input value={step.label} onChange={(e) => ops.update(i, { label: e.target.value })} className={`${rowInputCls} flex-1`} placeholder="Açıklama (ör. Bağımlılıkları yükleyin)" aria-label="Adım açıklaması" />
            <button onClick={() => ops.remove(i)} className={removeBtnCls} aria-label="Adımı sil">×</button>
          </div>
          <textarea
            value={step.command}
            onChange={(e) => ops.update(i, { command: e.target.value })}
            rows={Math.max(1, step.command.split("\n").length)}
            className="w-full px-2 py-1.5 text-[12px] text-[#c9d1d9] bg-[#161b22] border border-[#30363d] rounded-md focus:border-[#58a6ff] focus:outline-none font-mono resize-y"
            placeholder="npm install (boş bırakılırsa madde olarak gösterilir)"
            aria-label="Komut"
          />
        </div>
      ))}
      <button onClick={() => ops.add({ label: "", command: "" })} className={addBtnCls}>+ Adım ekle</button>
    </div>
  );
}

function UsageForm({ data, onChange, fallback }: FormProps<UsageData> & { fallback: string }) {
  const env = listOps(data.envVars ?? [], (envVars) => onChange({ ...data, envVars }));
  return (
    <div>
      <HeadingInput data={data} onChange={onChange} fallback={fallback} />
      <Input label="Çalıştırma komutu" value={data.command ?? ""} onChange={(v) => onChange({ ...data, command: v })} placeholder="npm run dev" mono />
      <div className="grid grid-cols-2 gap-2">
        <Input label="Port" value={data.port ?? ""} onChange={(v) => onChange({ ...data, port: v.replace(/\D/g, "") })} placeholder="Web uygulaması değilse boş" />
        <Input label="Başlatıcı dosya" value={data.launcher ?? ""} onChange={(v) => onChange({ ...data, launcher: v })} placeholder="baslat.bat" />
      </div>
      <Textarea label="Kullanım açıklaması (markdown)" value={data.text} onChange={(v) => onChange({ ...data, text: v })} rows={4} placeholder={"1. Uygulamayı açın\n2. ..."} />
      <span className="block text-[12px] text-[#8b949e] mb-1 font-medium">Ortam değişkenleri</span>
      {(data.envVars ?? []).map((e, i) => (
        <div key={i} className="flex gap-2 mb-2">
          <input value={e.key} onChange={(ev) => env.update(i, { key: ev.target.value })} className={`${rowInputCls} w-[30%] font-mono`} placeholder="API_KEY" aria-label="Değişken adı" />
          <input value={e.value} onChange={(ev) => env.update(i, { value: ev.target.value })} className={`${rowInputCls} w-[25%] font-mono`} placeholder="örnek değer" aria-label="Örnek değer" />
          <input value={e.description} onChange={(ev) => env.update(i, { description: ev.target.value })} className={`${rowInputCls} flex-1`} placeholder="Açıklama" aria-label="Açıklama" />
          <button onClick={() => env.remove(i)} className={removeBtnCls} aria-label="Değişkeni sil">×</button>
        </div>
      ))}
      <p className="text-[11px] text-[#d29922] mb-2">Gerçek anahtar/şifre yazmayın; README herkese açık olabilir.</p>
      <button onClick={() => env.add({ key: "", value: "", description: "" })} className={addBtnCls}>+ Değişken ekle</button>
    </div>
  );
}

function StructureForm({ data, onChange, fallback }: FormProps<StructureData> & { fallback: string }) {
  return (
    <div>
      <HeadingInput data={data} onChange={onChange} fallback={fallback} />
      <Textarea label="Klasör ağacı" value={data.tree} onChange={(v) => onChange({ ...data, tree: v })} placeholder={"├── src/\n├── public/\n└── README.md"} rows={10} mono />
    </div>
  );
}

function ContributingForm({ data, onChange, fallback }: FormProps<ContributingData> & { fallback: string }) {
  return (
    <div>
      <HeadingInput data={data} onChange={onChange} fallback={fallback} />
      <Input label="Giriş metni" value={data.intro ?? ""} onChange={(v) => onChange({ ...data, intro: v })} />
      <Textarea
        label="Adımlar"
        value={data.steps.join("\n")}
        onChange={(v) => onChange({ ...data, steps: v.split("\n") })}
        rows={6}
        hint="Her satır bir adım"
      />
    </div>
  );
}

function LicenseForm({ data, onChange, fallback }: FormProps<LicenseData> & { fallback: string }) {
  return (
    <div>
      <HeadingInput data={data} onChange={onChange} fallback={fallback} />
      <Input label="Lisans türü" value={data.type} onChange={(v) => onChange({ ...data, type: v })} placeholder="MIT" />
      <Input label="Özel metin (opsiyonel)" value={data.text} onChange={(v) => onChange({ ...data, text: v })} placeholder="Boşsa lisans türünden otomatik yazılır" />
      <Toggle label="LICENSE dosyasına bağlantı ver" checked={!!data.hasFile} onChange={(v) => onChange({ ...data, hasFile: v })} />
    </div>
  );
}

function BadgesForm({ data, onChange }: FormProps<BadgesData>) {
  const ops = listOps(data.items, (items) => onChange({ ...data, items }));
  return (
    <div>
      {data.items.map((item, i) => (
        <div key={i} className="flex gap-2 mb-2">
          <input value={item.label} onChange={(e) => ops.update(i, { label: e.target.value })} className={`${rowInputCls} w-[30%]`} placeholder="Etiket" aria-label="Rozet etiketi" />
          <input value={item.url} onChange={(e) => ops.update(i, { url: e.target.value })} className={`${rowInputCls} flex-1`} placeholder="https://img.shields.io/badge/..." aria-label="Rozet URL" />
          <button onClick={() => ops.remove(i)} className={removeBtnCls} aria-label="Rozeti sil">×</button>
        </div>
      ))}
      <button onClick={() => ops.add({ label: "", url: "", color: "" })} className={addBtnCls}>+ Rozet ekle</button>
    </div>
  );
}

const THEMES = ["tokyonight", "dracula", "radical", "github_dark", "onedark", "default"];

function StatsForm({ data, onChange, fallback }: FormProps<StatsData> & { fallback: string }) {
  return (
    <div>
      <HeadingInput data={data} onChange={onChange} fallback={fallback} />
      <Input label="GitHub kullanıcı adı" value={data.username} onChange={(v) => onChange({ ...data, username: v })} placeholder="octocat" />
      <Field label="Tema">
        <select value={data.theme} onChange={(e) => onChange({ ...data, theme: e.target.value })} className={inputCls}>
          {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Toggle label="İstatistik kartı" checked={data.showStars || data.showCommits} onChange={(v) => onChange({ ...data, showStars: v, showCommits: v })} />
      <Toggle label="Seri (streak) kartı" checked={data.showContributions} onChange={(v) => onChange({ ...data, showContributions: v })} />
    </div>
  );
}

function StatsCardsForm({ data, onChange, fallback }: FormProps<StatsCardsData> & { fallback: string }) {
  return (
    <div>
      <HeadingInput data={data} onChange={onChange} fallback={fallback} />
      <Input label="GitHub kullanıcı adı" value={data.username} onChange={(v) => onChange({ ...data, username: v })} placeholder="octocat" />
      <Field label="Tema">
        <select value={data.theme} onChange={(e) => onChange({ ...data, theme: e.target.value })} className={inputCls}>
          {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Toggle label="İstatistikler" checked={data.showStats} onChange={(v) => onChange({ ...data, showStats: v })} />
      <Toggle label="En çok kullanılan diller" checked={data.showLanguages} onChange={(v) => onChange({ ...data, showLanguages: v })} />
      <Toggle label="Kupalar" checked={data.showTrophy} onChange={(v) => onChange({ ...data, showTrophy: v })} />
      <Toggle label="Aktivite grafiği" checked={data.showActivity} onChange={(v) => onChange({ ...data, showActivity: v })} />
      <Segmented label="Yerleşim" value={data.direction} options={[{ value: "row", label: "Yan yana" }, { value: "column", label: "Alt alta" }]} onChange={(v) => onChange({ ...data, direction: v })} />
      <Segmented label="Hizalama" value={data.align} options={ALIGN_OPTIONS} onChange={(v) => onChange({ ...data, align: v })} />
    </div>
  );
}

function TechIconsForm({ data, onChange }: FormProps<TechIconsData>) {
  const [query, setQuery] = useState("");
  const toggleIcon = (icon: string) => {
    const icons = data.icons.includes(icon) ? data.icons.filter((i) => i !== icon) : [...data.icons, icon];
    onChange({ ...data, icons });
  };
  const results = searchIcons(query, 48);
  return (
    <div>
      <Segmented label="İkon seti" value={data.provider} options={ICON_PROVIDERS} onChange={(v) => onChange({ ...data, provider: v })} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Yükseklik (px)">
          <input type="number" min={16} max={120} value={data.height} onChange={(e) => onChange({ ...data, height: Number(e.target.value) || 40 })} className={inputCls} />
        </Field>
        <Field label="Aralık (px)">
          <input type="number" min={0} max={60} value={data.spacing ?? 8} onChange={(e) => onChange({ ...data, spacing: Math.max(0, Number(e.target.value) || 0) })} className={inputCls} />
        </Field>
      </div>
      <Segmented label="Hizalama" value={data.align} options={ALIGN_OPTIONS} onChange={(v) => onChange({ ...data, align: v })} />
      <span className="block text-[12px] text-[#8b949e] mb-1 font-medium">Seçili ({data.icons.length}) — sırayı değiştirmek için kaldırıp yeniden ekleyin</span>
      <div className="flex flex-wrap gap-1 mb-2">
        {data.icons.map((icon) => (
          <button key={icon} onClick={() => toggleIcon(icon)} className="px-2 h-[26px] text-[11px] rounded-md bg-[#238636] text-white" aria-label={`${icon} kaldır`}>
            {resolveIcon(icon)?.name ?? icon} ✕
          </button>
        ))}
      </div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Teknoloji ara (ör. react, python, unity)…" className={`${inputCls} mb-2`} aria-label="Teknoloji ara" />
      <div className="flex flex-wrap gap-1 max-h-[160px] overflow-auto p-2 bg-[#0d1117] border border-[#30363d] rounded-md">
        {results.map((icon) => (
          <button
            key={icon.key}
            onClick={() => toggleIcon(icon.key)}
            aria-pressed={data.icons.includes(icon.key)}
            className={`px-2 py-1 text-[11px] rounded-md border transition-colors ${data.icons.includes(icon.key) ? "bg-[#238636] border-[#238636] text-white" : "border-[#30363d] text-[#8b949e] hover:text-[#c9d1d9]"}`}
          >
            {icon.name}
          </button>
        ))}
        {results.length === 0 && <span className="text-[12px] text-[#6e7681]">Sonuç yok</span>}
      </div>
    </div>
  );
}

const BADGE_STYLES: { value: BadgeStyle; label: string }[] = [
  { value: "for-the-badge", label: "Büyük" },
  { value: "flat-square", label: "Köşeli" },
  { value: "flat", label: "Düz" },
];

const DYNAMIC_OPTIONS: { value: DynamicBadge; label: string }[] = [
  { value: "stars", label: "Yıldız" },
  { value: "forks", label: "Fork" },
  { value: "issues", label: "Issue" },
  { value: "last-commit", label: "Son commit" },
  { value: "top-language", label: "Ana dil" },
  { value: "repo-size", label: "Boyut" },
];

function TocForm({ data, onChange, fallback }: FormProps<TocData> & { fallback: string }) {
  return (
    <div>
      <HeadingInput data={data} onChange={onChange} fallback={fallback} />
      <Toggle label="Açılır liste olarak göster" checked={data.collapsed} onChange={(v) => onChange({ ...data, collapsed: v })} />
      <p className="text-[11px] text-[#6e7681]">Altındaki bölüm başlıklarından otomatik oluşur.</p>
    </div>
  );
}

function AuthorForm({ data, onChange, fallback }: FormProps<AuthorData> & { fallback: string }) {
  const ops = listOps(data.links, (links) => onChange({ ...data, links }));
  return (
    <div>
      <HeadingInput data={data} onChange={onChange} fallback={fallback} />
      <div className="grid grid-cols-2 gap-2">
        <Input label="Ad" value={data.name} onChange={(v) => onChange({ ...data, name: v })} />
        <Input label="GitHub kullanıcı adı" value={data.login} onChange={(v) => onChange({ ...data, login: v })} />
      </div>
      <Input label="Kısa bio" value={data.bio ?? ""} onChange={(v) => onChange({ ...data, bio: v })} />
      <Toggle label="Avatarı göster" checked={data.showAvatar} onChange={(v) => onChange({ ...data, showAvatar: v })} />
      <Segmented label="Rozet stili" value={data.style} options={BADGE_STYLES} onChange={(v) => onChange({ ...data, style: v })} />
      <span className="block text-[12px] text-[#8b949e] mb-1 font-medium">Bağlantılar</span>
      {data.links.map((link, i) => (
        <div key={i} className="flex gap-2 mb-2">
          <select value={link.platform} onChange={(e) => ops.update(i, { platform: e.target.value })} className={`${rowInputCls} w-[36%]`} aria-label="Platform">
            {SOCIAL_PLATFORMS.map((p) => <option key={p} value={p}>{socialLabel(p)}</option>)}
          </select>
          <input value={link.url} onChange={(e) => ops.update(i, { url: e.target.value })} className={`${rowInputCls} flex-1`} placeholder="https://… veya e-posta" aria-label="Bağlantı" />
          <button onClick={() => ops.remove(i)} className={removeBtnCls} aria-label="Bağlantıyı sil">×</button>
        </div>
      ))}
      <button onClick={() => ops.add({ platform: "linkedin", url: "" })} className={addBtnCls}>+ Bağlantı ekle</button>
    </div>
  );
}

function FooterForm({ data, onChange }: FormProps<FooterData>) {
  return (
    <div>
      <Input label="Renk geçişi" value={data.gradient} onChange={(v) => onChange({ ...data, gradient: v })} placeholder="0:0d1117,100:414868" mono />
      <Input label="Yükseklik" value={String(data.height)} onChange={(v) => onChange({ ...data, height: Number(v.replace(/\D/g, "")) || 100 })} />
      <Toggle label="“Beğendiyseniz yıldız verin” satırı" checked={data.starCta} onChange={(v) => onChange({ ...data, starCta: v })} />
      {data.starCta && <Input label="Repo adresi (bağlantı için)" value={data.repoUrl ?? ""} onChange={(v) => onChange({ ...data, repoUrl: v })} placeholder="https://github.com/kullanici/repo" />}
    </div>
  );
}

function ImageForm({ data, onChange }: FormProps<ImageData>) {
  return (
    <div>
      <Input label="Bölüm başlığı (opsiyonel)" value={data.heading ?? ""} onChange={(v) => onChange({ ...data, heading: v })} placeholder="🖼️ Ekran Görüntüleri" />
      <Input label="Görsel adresi" value={data.url} onChange={(v) => onChange({ ...data, url: v })} placeholder="docs/ekran.png veya https://..." hint="Repodaki göreli yol (ör. screenshots/ana.png) GitHub'da çalışır" />
      <Input label="Alternatif metin" value={data.alt ?? ""} onChange={(v) => onChange({ ...data, alt: v })} placeholder="Ana ekran" />
      <Input label="Yükseklik (px, 0 = tam genişlik)" value={String(data.height ?? 0)} onChange={(v) => onChange({ ...data, height: Number(v.replace(/\D/g, "")) || 0 })} />
      <Segmented label="Hizalama" value={data.align} options={ALIGN_OPTIONS} onChange={(v) => onChange({ ...data, align: v })} />
    </div>
  );
}

function DividerForm({ data, onChange }: FormProps<DividerData>) {
  return (
    <Segmented
      label="Stil"
      value={data.style}
      options={[
        { value: "line", label: "Çizgi" },
        { value: "stars", label: "Yıldızlar" },
        { value: "blank", label: "Boşluk" },
      ]}
      onChange={(v) => onChange({ ...data, style: v })}
    />
  );
}

function CapsuleForm({ data, onChange }: FormProps<CapsuleHeaderData>) {
  return (
    <div>
      <Input label="Yazı" value={data.text} onChange={(v) => onChange({ ...data, text: v })} placeholder="Proje adı" />
      <Input label="Alt yazı" value={data.desc ?? ""} onChange={(v) => onChange({ ...data, desc: v })} placeholder="Kısa slogan (opsiyonel)" />
      <Segmented
        label="Animasyon"
        value={data.animation ?? ""}
        options={[
          { value: "" as const, label: "Yok" },
          { value: "fadeIn" as const, label: "Belirme" },
          { value: "twinkling" as const, label: "Parıltı" },
          { value: "scaleIn" as const, label: "Büyüme" },
        ]}
        onChange={(v) => onChange({ ...data, animation: v })}
      />
      <Segmented
        label="Şekil"
        value={data.type}
        options={[
          { value: "waving" as const, label: "Dalga" },
          { value: "rounded" as const, label: "Yuvarlak" },
          { value: "cylinder" as const, label: "Silindir" },
          { value: "egg" as const, label: "Yumurta" },
          { value: "cut" as const, label: "Kesik" },
        ]}
        onChange={(v) => onChange({ ...data, type: v })}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input label="Yükseklik" value={String(data.height)} onChange={(v) => onChange({ ...data, height: Number(v.replace(/\D/g, "")) || 120 })} />
        <Input label="Yazı boyutu" value={String(data.fontSize)} onChange={(v) => onChange({ ...data, fontSize: Number(v.replace(/\D/g, "")) || 50 })} />
      </div>
      <Input label="Renk geçişi" value={data.gradient} onChange={(v) => onChange({ ...data, gradient: v, colorMode: "gradient" })} placeholder="0:0d1117,100:414868" mono />
    </div>
  );
}

function SocialLinksForm({ data, onChange }: FormProps<SocialLinksData>) {
  const ops = listOps(data.links, (links) => onChange({ ...data, links }));
  return (
    <div>
      {data.links.map((link, i) => (
        <div key={i} className="flex gap-2 mb-2">
          <select value={link.platform} onChange={(e) => ops.update(i, { platform: e.target.value })} className={`${rowInputCls} w-[34%]`} aria-label="Platform">
            {SOCIAL_PLATFORMS.map((p) => <option key={p} value={p}>{socialLabel(p)}</option>)}
          </select>
          <input value={link.url} onChange={(e) => ops.update(i, { url: e.target.value })} className={`${rowInputCls} flex-1`} placeholder="https://..." aria-label="Bağlantı" />
          <button onClick={() => ops.remove(i)} className={removeBtnCls} aria-label="Bağlantıyı sil">×</button>
        </div>
      ))}
      <button onClick={() => ops.add({ platform: "github", url: "" })} className={addBtnCls}>+ Bağlantı ekle</button>
      <div className="mt-3">
        <Segmented label="Hizalama" value={data.align} options={ALIGN_OPTIONS} onChange={(v) => onChange({ ...data, align: v })} />
      </div>
    </div>
  );
}

function ProfileViewsForm({ data, onChange }: FormProps<ProfileViewsData>) {
  return (
    <div>
      <Input label="GitHub kullanıcı adı" value={data.username ?? ""} onChange={(v) => onChange({ ...data, username: v })} placeholder="octocat" />
      <Segmented label="Hizalama" value={data.align} options={ALIGN_OPTIONS} onChange={(v) => onChange({ ...data, align: v })} />
    </div>
  );
}

function SnakeForm({ data, onChange }: FormProps<SnakeData>) {
  return (
    <Input
      label="GitHub kullanıcı adı"
      value={data.username}
      onChange={(v) => onChange({ ...data, username: v })}
      placeholder="octocat"
      hint="Profil reposunda yılan animasyonu üreten GitHub Action kurulu olmalı"
    />
  );
}

function CustomForm({ data, onChange }: FormProps<CustomData>) {
  return (
    <div>
      <Input label="Bölüm başlığı" value={data.title} onChange={(v) => onChange({ ...data, title: v })} placeholder="Başlıksız bırakılabilir" />
      <Textarea label="İçerik (markdown)" value={data.content} onChange={(v) => onChange({ ...data, content: v })} placeholder="Markdown yazın..." rows={12} mono />
    </div>
  );
}
