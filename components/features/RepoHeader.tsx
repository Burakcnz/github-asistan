"use client";

import { useEffect, useRef, useState } from "react";
import { ownerFromGithubUrl } from "@/lib/utils";
import { README_TEMPLATE_OPTIONS, type ReadmeTemplateId } from "@/lib/readme/build";

interface RepoHeaderProps {
  name: string;
  localPath: string;
  isOnGithub: boolean;
  githubUrl: string | null;
  pushing: boolean;
  onPush: () => void;
  /** Uygulamada üretilmiş README var mı (buton metni için). */
  hasReadme: boolean;
  generating: boolean;
  onGenerateReadme: (template?: ReadmeTemplateId) => void;
  repoName: string | null;
  displayName: string | null;
  onEditName: () => void;
}

export function RepoHeader({
  name,
  localPath,
  isOnGithub,
  githubUrl,
  pushing,
  onPush,
  hasReadme,
  generating,
  onGenerateReadme,
  repoName,
  displayName,
  onEditName,
}: RepoHeaderProps) {
  const owner = ownerFromGithubUrl(githubUrl);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);
  return (
    <div className="py-4 px-4 max-w-[1280px] mx-auto">
      <div className="flex items-center gap-3 text-[20px] min-w-0">
        {/* Repo icon */}
        <svg className="octicon octicon-repo" height="16" viewBox="0 0 16 16" width="16" fill="#8b949e">
          <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"></path>
        </svg>
        {/* Repo name */}
        <span className="text-[20px] font-normal text-[#f0f6fc] min-w-0 truncate">
          {owner && (
            <>
              <span className="text-[#58a6ff]">{owner}</span>
              <span className="text-[#8b949e] mx-1">/</span>
            </>
          )}
          <span className="text-[#58a6ff] font-semibold">{name}</span>
        </span>
        {/* Visibility badge */}
        {isOnGithub ? (
          <span className="px-2 py-0.5 text-[12px] font-medium border border-[#30363d] text-[#8b949e] rounded-full">
            GitHub
          </span>
        ) : (
          <span className="px-2 py-0.5 text-[12px] font-medium border border-[#30363d] text-[#8b949e] rounded-full">
            Yerel
          </span>
        )}
      </div>
      <p className="mt-1 text-[12px] text-[#8b949e] font-mono truncate" title={localPath}>{localPath}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#8b949e]">
        {repoName ? (
          <>
            <span>
              GitHub adı: <span className="font-mono text-[#c9d1d9]">{repoName}</span>
            </span>
            {displayName && (
              <span>
                Başlık: <span className="text-[#c9d1d9]">{displayName}</span>
              </span>
            )}
          </>
        ) : (
          <span>GitHub adı henüz seçilmedi</span>
        )}
        <button onClick={onEditName} className="text-[#58a6ff] hover:underline" aria-label="GitHub adını ve başlığı düzenle">
          ✏️ {repoName ? "Düzenle" : "Ad seç"}
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        {/* README üret */}
        <div className="relative flex" ref={menuRef}>
          <button
            onClick={() => onGenerateReadme()}
            disabled={generating}
            className="h-[28px] px-3 text-[12px] font-medium text-white bg-[#1f6feb] hover:bg-[#388bfd] rounded-l-md border border-[rgba(240,246,252,0.1)] flex items-center gap-1.5 disabled:opacity-60 transition-colors"
            title="Proje dosyalarını analiz edip README oluşturur"
          >
            {generating ? (
              <>
                <svg className="animate-spin h-[14px] w-[14px]" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                README oluşturuluyor... (1-2 dk)
              </>
            ) : (
              <>📝 {hasReadme ? "README'yi Yeniden Oluştur" : "README Oluştur"}</>
            )}
          </button>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            disabled={generating}
            className="h-[28px] px-2 text-[12px] text-white bg-[#1f6feb] hover:bg-[#388bfd] rounded-r-md border border-l-0 border-[rgba(240,246,252,0.1)] disabled:opacity-60 transition-colors"
            aria-label="README şablonu seç"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            ▾
          </button>
          {menuOpen && (
            <div role="menu" className="absolute top-full left-0 mt-1 w-[280px] bg-[#161b22] border border-[#30363d] rounded-md shadow-xl z-50 py-1">
              {README_TEMPLATE_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onGenerateReadme(t.id);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-[#21262d] transition-colors"
                >
                  <span className="block text-[13px] text-[#f0f6fc]">{t.label}</span>
                  <span className="block text-[11px] text-[#8b949e]">{t.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Push / Update to GitHub button */}
        <button
          onClick={onPush}
          disabled={pushing}
          className="h-[28px] px-3 text-[12px] font-medium text-white rounded-md border border-[rgba(240,246,252,0.1)] flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          style={{
            backgroundColor: isOnGithub ? "#1a7f37" : "#238636",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = isOnGithub ? "#2ea043" : "#2ea043";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isOnGithub ? "#1a7f37" : "#238636";
          }}
        >
          {pushing ? (
            <>
              <svg className="animate-spin h-[14px] w-[14px]" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Yükleniyor...
            </>
          ) : isOnGithub ? (
            <>
              <svg className="w-[14px] h-[14px] fill-current" viewBox="0 0 16 16">
                <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z" />
              </svg>
              GitHub&apos;a Güncelle
            </>
          ) : (
            <>
              <svg className="w-[14px] h-[14px] fill-current" viewBox="0 0 16 16">
                <path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14ZM7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.969a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.06l1.97 1.969Z" />
              </svg>
              GitHub&apos;a Yükle
            </>
          )}
        </button>

        {githubUrl && (
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-[28px] px-3 text-[12px] font-medium text-[#c9d1d9] bg-[#21262d] hover:bg-[#30363d] rounded-md border border-[#30363d] flex items-center gap-1.5 transition-colors"
          >
            <svg className="w-[16px] h-[16px] fill-[#8b949e]" viewBox="0 0 16 16">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
            </svg>
            GitHub
          </a>
        )}
      </div>
    </div>
  );
}
