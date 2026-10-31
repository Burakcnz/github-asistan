"use client";

import { useEffect, useRef, useState } from "react";
import { README_TEMPLATE_OPTIONS, type ReadmeTemplateId } from "@/lib/readme/build";

interface ReadmeToolbarProps {
  onGenerate: (template: ReadmeTemplateId) => void;
  onProfileTemplate: () => void;
  onImport?: () => void;
  onReset: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onWriteToDisk: () => void;
  generating: boolean;
  saving: boolean;
  copying: boolean;
  writing: boolean;
}

const btn =
  "h-[30px] px-3 text-[12px] font-medium text-[#c9d1d9] bg-[#21262d] hover:bg-[#30363d] rounded-md border border-[#30363d] disabled:opacity-50 transition-colors whitespace-nowrap";

export function ReadmeToolbar({
  onGenerate,
  onProfileTemplate,
  onImport,
  onReset,
  onCopy,
  onDownload,
  onWriteToDisk,
  generating,
  saving,
  copying,
  writing,
}: ReadmeToolbarProps) {
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
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          disabled={generating}
          className={btn}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          {generating ? "⏳ Oluşturuluyor..." : "✨ Projeden Oluştur ▾"}
        </button>
        {menuOpen && (
          <div role="menu" className="absolute top-full left-0 mt-1 w-[280px] bg-[#161b22] border border-[#30363d] rounded-md shadow-xl z-50 py-1">
            {README_TEMPLATE_OPTIONS.map((t) => (
              <button
                key={t.id}
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onGenerate(t.id);
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#21262d] transition-colors"
              >
                <span className="block text-[13px] text-[#f0f6fc]">{t.label}</span>
                <span className="block text-[11px] text-[#8b949e]">{t.description}</span>
              </button>
            ))}
            <div className="border-t border-[#30363d] my-1" />
            {onImport && (
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onImport();
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#21262d] transition-colors"
              >
                <span className="block text-[13px] text-[#f0f6fc]">Diskteki README.md&apos;yi içe aktar</span>
                <span className="block text-[11px] text-[#8b949e]">Mevcut dosyayı düzenlenebilir bölüm olarak aç</span>
              </button>
            )}
            <button
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onProfileTemplate();
              }}
              className="w-full text-left px-3 py-2 hover:bg-[#21262d] transition-colors"
            >
              <span className="block text-[13px] text-[#f0f6fc]">Boş profil şablonu</span>
              <span className="block text-[11px] text-[#8b949e]">GitHub profil README&apos;si için iskelet</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex-1" />

      <span className="text-[11px] text-[#8b949e] min-w-[90px] text-right" aria-live="polite">
        {saving ? "Kaydediliyor..." : "Otomatik kaydediliyor"}
      </span>
      <button onClick={onReset} className={btn} title="Tüm blokları sil">
        ↺ Temizle
      </button>
      <button onClick={onCopy} disabled={copying} className={btn}>
        {copying ? "✓ Kopyalandı" : "📋 Kopyala"}
      </button>
      <button onClick={onDownload} className={btn}>
        ⬇ İndir
      </button>
      <button
        onClick={onWriteToDisk}
        disabled={writing}
        className="h-[30px] px-3 text-[12px] font-medium text-white bg-[#238636] hover:bg-[#2ea043] rounded-md border border-[rgba(240,246,252,0.1)] disabled:opacity-50 transition-colors whitespace-nowrap"
        title="README.md dosyasını proje klasörüne yaz"
      >
        {writing ? "Yazılıyor..." : "💾 Klasöre Kaydet"}
      </button>
    </div>
  );
}
