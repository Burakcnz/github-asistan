"use client";

import { ReadmeBlock, BLOCK_META, type BlockCommon, type CustomData, type HeaderData } from "@/lib/readme-blocks";

interface BlockListItemProps {
  block: ReadmeBlock;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

/** Listede bloğun yanında gösterilecek kısa ipucu (başlık metni vb.). */
function blockHint(block: ReadmeBlock): string {
  if (block.type === "header") return (block.data as HeaderData).title;
  if (block.type === "custom") return (block.data as CustomData).title || (block.data as CustomData).content.slice(0, 40);
  return (block.data as BlockCommon).heading ?? "";
}

const iconBtn =
  "w-[24px] h-[24px] flex items-center justify-center rounded transition-colors text-[12px] disabled:opacity-30 disabled:pointer-events-none";

export function BlockListItem({
  block,
  isSelected,
  isFirst,
  isLast,
  onSelect,
  onToggle,
  onDelete,
  onMoveUp,
  onMoveDown,
}: BlockListItemProps) {
  const meta = BLOCK_META[block.type];
  const hint = blockHint(block);

  return (
    <div
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-md transition-all ${
        isSelected ? "bg-[#1f6feb22] border border-[#1f6feb]" : "border border-transparent hover:bg-[#21262d] hover:border-[#30363d]"
      }`}
    >
      <button
        onClick={onSelect}
        className="flex-1 min-w-0 flex items-center gap-2 text-left py-0.5"
        aria-expanded={isSelected}
        aria-label={`${meta.label} bloğunu düzenle${block.enabled ? "" : " (gizli)"}`}
      >
        <span className="text-[14px]">{meta.icon}</span>
        <span className={`text-[13px] font-medium shrink-0 ${block.enabled ? "text-[#c9d1d9]" : "text-[#484f58] line-through"}`}>
          {meta.label}
        </span>
        {hint && <span className="text-[11px] text-[#6e7681] truncate">{hint}</span>}
      </button>
      <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button onClick={onMoveUp} disabled={isFirst} className={`${iconBtn} text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#30363d]`} aria-label="Yukarı taşı">
          ↑
        </button>
        <button onClick={onMoveDown} disabled={isLast} className={`${iconBtn} text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#30363d]`} aria-label="Aşağı taşı">
          ↓
        </button>
        <button
          onClick={onToggle}
          className={`${iconBtn} ${block.enabled ? "text-[#3fb950] hover:bg-[#3fb95022]" : "text-[#8b949e] hover:bg-[#30363d]"}`}
          aria-label={block.enabled ? "README'de gizle" : "README'de göster"}
          title={block.enabled ? "Gizle" : "Göster"}
        >
          {block.enabled ? "●" : "○"}
        </button>
        <button onClick={onDelete} className={`${iconBtn} text-[#8b949e] hover:text-[#f85149] hover:bg-[#f8514922]`} aria-label="Bloğu sil">
          ✕
        </button>
      </div>
    </div>
  );
}
