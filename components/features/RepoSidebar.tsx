"use client";

import { formatRelativeDate, projectTypeLabel } from "@/lib/utils";

interface RepoSidebarProps {
  description: string | null;
  type: string;
  languagePercentages: Record<string, number>;
  lastModified: string;
  hasGit: boolean;
  hasReadme: boolean;
}

const LANG_COLORS: Record<string, string> = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Python: "#3572A5",
  Rust: "#dea584",
  Go: "#00ADD8",
  "C#": "#178600",
  HTML: "#e34c26",
  CSS: "#563d7c",
  JSON: "#a8b9cc",
  Markdown: "#083fa1",
  YAML: "#cb171e",
  Shell: "#89e051",
  Batch: "#c1f12e",
  Config: "#6e7681",
  Other: "#8b949e",
};

export function RepoSidebar({
  description,
  type,
  languagePercentages,
  lastModified,
  hasGit,
  hasReadme,
}: RepoSidebarProps) {
  const sortedLangs = Object.entries(languagePercentages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const langBarGradient = sortedLangs
    .map(([lang, pct]) => `${LANG_COLORS[lang] || "#8b949e"} ${pct}%`)
    .join(", ");

  return (
    <div className="w-full lg:w-[296px] shrink-0">
      {/* About */}
      <div className="pb-4 border-b border-[#30363d]">
        <h2 className="text-[14px] font-semibold text-[#f0f6fc] mb-2">Hakkında</h2>
        {description ? (
          <p className="text-[14px] text-[#c9d1d9] leading-relaxed mb-3">{description}</p>
        ) : (
          <p className="text-[14px] text-[#484f58] italic mb-3">Açıklama yok.</p>
        )}

        {/* Topics */}
        <div className="flex flex-wrap gap-1 mb-3">
          <span className="px-2 py-0.5 text-[12px] font-medium bg-[#388bfd26] text-[#58a6ff] border border-[#388bfd44] rounded-full">{projectTypeLabel(type)}</span>
          {hasGit && <span className="px-2 py-0.5 text-[12px] font-medium bg-[#23863626] text-[#3fb950] border border-[#23863644] rounded-full">git</span>}
          {hasReadme && <span className="px-2 py-0.5 text-[12px] font-medium bg-[#a371f726] text-[#a371f7] border border-[#a371f744] rounded-full">readme</span>}
        </div>

        <div className="text-[14px] text-[#8b949e] flex items-center gap-1.5">
          <svg height="16" viewBox="0 0 16 16" width="16" fill="#8b949e">
            <path d="M2 5.25a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 2 5.25Zm0 6a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 2 11.25ZM4 4a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 4 4Z"></path>
          </svg>
          <span>{formatRelativeDate(lastModified)}</span>
        </div>
      </div>

      {/* Languages */}
      {sortedLangs.length > 0 && (
        <div className="py-4 border-b border-[#30363d]">
          <h2 className="text-[14px] font-semibold text-[#f0f6fc] mb-2">Diller</h2>
          {/* Language bar */}
          <div className="h-[8px] rounded-full overflow-hidden flex bg-[#161b22] border border-[#30363d] mb-2">
            {sortedLangs.map(([lang, pct]) => (
              <div
                key={lang}
                style={{
                  width: `${pct}%`,
                  backgroundColor: LANG_COLORS[lang] || "#8b949e",
                }}
                title={`${lang} ${pct}%`}
              />
            ))}
          </div>
          {/* Language list */}
          <div className="space-y-1">
            {sortedLangs.map(([lang, pct]) => (
              <div key={lang} className="flex items-center gap-2 text-[12px]">
                <span
                  className="w-[10px] h-[10px] rounded-full"
                  style={{ backgroundColor: LANG_COLORS[lang] || "#8b949e" }}
                />
                <span className="text-[#c9d1d9]">{lang}</span>
                <span className="text-[#8b949e] ml-auto">{pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
