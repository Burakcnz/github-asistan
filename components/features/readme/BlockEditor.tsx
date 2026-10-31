"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/utils";
import { ReadmeBlock, BlockType, BlockData, createBlock, BLOCK_META, detectBlocksLang } from "@/lib/readme-blocks";
import { renderAllBlocks } from "@/lib/readme-renderer";
import { getProfileTemplateBlocks } from "@/lib/readme-templates";
import { importMarkdownBlocks, type ReadmeTemplateId } from "@/lib/readme/build";
import { BlockForms } from "./BlockForms";
import { BlockListItem } from "./BlockListItem";
import { ReadmePreview } from "./ReadmePreview";
import { ReadmeToolbar } from "./ReadmeToolbar";

interface BlockEditorProps {
  projectId: string;
  projectName: string;
  /** Diskteki README.md (uygulamada README yoksa içe aktarma için). */
  localReadme?: string | null;
  /** Her başarılı kayıttan sonra güncel markdown ve sürüm ile çağrılır. */
  onSaved?: (content: string, version: number) => void;
  /** README klasöre yazıldıktan sonra çağrılır. */
  onWritten?: () => void;
  /** Üretimden önce çağrılır (ör. repo adı kontrolü); false dönerse iptal. */
  beforeGenerate?: () => Promise<boolean>;
}

const ADDABLE_TYPES: BlockType[] = [
  "capsule-header",
  "header",
  "toc",
  "features",
  "techstack",
  "tech-icons",
  "installation",
  "usage",
  "structure",
  "image",
  "contributing",
  "license",
  "badges",
  "author",
  "footer",
  "social-links",
  "stats-cards",
  "stats",
  "profile-views",
  "snake",
  "divider",
];

export function BlockEditor({ projectId, projectName, localReadme, onSaved, onWritten, beforeGenerate }: BlockEditorProps) {
  const toast = useToast();
  const [blocks, setBlocks] = useState<ReadmeBlock[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [writing, setWriting] = useState(false);
  const [copying, setCopying] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [loading, setLoading] = useState(true);

  const selectedBlock = blocks.find((b) => b.id === selectedId) || null;
  const lang = detectBlocksLang(blocks);
  const markdown = renderAllBlocks(blocks);

  const loadBlocks = useCallback(async () => {
    try {
      const data = await apiFetch<{ blocks: ReadmeBlock[] }>(`/api/projects/${projectId}/readme/blocks`);
      setBlocks(Array.isArray(data.blocks) ? data.blocks : []);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "README blokları yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    loadBlocks();
  }, [loadBlocks]);

  // Kayıtlar sırayla yapılır; metin düzenlemeleri 700 ms gecikmeyle birleştirilir.
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const pendingBlocks = useRef<ReadmeBlock[] | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  const persist = useCallback(
    (newBlocks: ReadmeBlock[]) => {
      saveChain.current = saveChain.current.then(async () => {
        setSaving(true);
        try {
          const data = await apiFetch<{ content: string; version: number }>(`/api/projects/${projectId}/readme/blocks`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ blocks: newBlocks }),
          });
          onSavedRef.current?.(data.content, data.version);
        } catch (err) {
          toast("error", err instanceof Error ? err.message : "README kaydedilemedi");
        } finally {
          setSaving(false);
        }
      });
    },
    [projectId, toast]
  );

  const flushSave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (pendingBlocks.current) {
      const next = pendingBlocks.current;
      pendingBlocks.current = null;
      persist(next);
    }
  }, [persist]);

  const saveBlocks = (newBlocks: ReadmeBlock[], debounce = false) => {
    pendingBlocks.current = newBlocks;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (debounce) {
      saveTimer.current = setTimeout(flushSave, 700);
    } else {
      flushSave();
    }
  };

  // Sekme değişince bekleyen düzenlemeyi kaybetme.
  useEffect(() => flushSave, [flushSave]);

  const replaceAll = (newBlocks: ReadmeBlock[]) => {
    setBlocks(newBlocks);
    setSelectedId(null);
    saveBlocks(newBlocks);
  };

  const addBlock = (type: BlockType) => {
    const newBlock = createBlock(type, blocks.length, undefined, lang);
    const newBlocks = [...blocks, newBlock];
    setBlocks(newBlocks);
    setSelectedId(newBlock.id);
    setShowAddMenu(false);
    saveBlocks(newBlocks);
  };

  const updateBlock = (id: string, data: BlockData) => {
    const newBlocks = blocks.map((b) => (b.id === id ? { ...b, data } : b));
    setBlocks(newBlocks);
    saveBlocks(newBlocks, true);
  };

  const toggleBlock = (id: string) => {
    const newBlocks = blocks.map((b) => (b.id === id ? { ...b, enabled: !b.enabled } : b));
    setBlocks(newBlocks);
    saveBlocks(newBlocks);
  };

  const deleteBlock = (id: string) => {
    const newBlocks = blocks.filter((b) => b.id !== id).map((b, i) => ({ ...b, order: i }));
    setBlocks(newBlocks);
    if (selectedId === id) setSelectedId(null);
    saveBlocks(newBlocks);
  };

  const moveBlock = (id: string, direction: "up" | "down") => {
    const sorted = [...blocks].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((b) => b.id === id);
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (idx === -1 || newIdx < 0 || newIdx >= sorted.length) return;
    [sorted[idx], sorted[newIdx]] = [sorted[newIdx], sorted[idx]];
    const newBlocks = sorted.map((b, i) => ({ ...b, order: i }));
    setBlocks(newBlocks);
    saveBlocks(newBlocks);
  };

  const confirmReplace = () =>
    blocks.length === 0 || window.confirm("Mevcut bloklar değiştirilecek (düzenlemeleriniz kaybolur). Devam edilsin mi?");

  const handleGenerate = async (template?: ReadmeTemplateId) => {
    if (!confirmReplace()) return;
    if (beforeGenerate && !(await beforeGenerate())) return;
    flushSave();
    setGenerating(true);
    try {
      await saveChain.current;
      const data = await apiFetch<{ content: string; blocks: ReadmeBlock[]; version: number; source: string; warning: string | null }>(
        `/api/projects/${projectId}/readme/generate`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template }) }
      );
      setBlocks(data.blocks || []);
      setSelectedId(null);
      onSavedRef.current?.(data.content, data.version);
      toast("success", data.source === "ai" ? "README yapay zekâ ile oluşturuldu" : "README proje analiziyle oluşturuldu");
      if (data.warning) toast("info", data.warning);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "README oluşturulamadı");
    } finally {
      setGenerating(false);
    }
  };

  const handleImport = () => {
    if (!localReadme || !confirmReplace()) return;
    replaceAll(importMarkdownBlocks(localReadme, lang));
    toast("success", "Diskteki README.md içe aktarıldı");
  };

  const handleProfileTemplate = () => {
    if (!confirmReplace()) return;
    replaceAll(getProfileTemplateBlocks(lang));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    } catch {
      toast("error", "Panoya kopyalanamadı");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "README.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const handleWriteToDisk = async () => {
    if (!markdown.trim()) {
      toast("error", "README boş");
      return;
    }
    if (!window.confirm(`README.md "${projectName}" klasörüne yazılacak. Var olan dosya README.md.bak olarak yedeklenir. Devam edilsin mi?`)) {
      return;
    }
    flushSave();
    setWriting(true);
    try {
      await saveChain.current;
      const res = await apiFetch<{ path: string; backup: string | null; unchanged?: boolean }>(
        `/api/projects/${projectId}/readme/write`,
        { method: "POST" }
      );
      toast(
        "success",
        res.unchanged ? "Klasördeki README.md zaten güncel" : `Kaydedildi: ${res.path}${res.backup ? " (eski dosya yedeklendi)" : ""}`
      );
      onWritten?.();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "README klasöre yazılamadı");
    } finally {
      setWriting(false);
    }
  };

  const handleReset = () => {
    if (!window.confirm("Tüm bloklar silinecek. Emin misin?")) return;
    replaceAll([]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px] text-[#8b949e]">
        <div className="flex items-center gap-2">
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Bloklar yükleniyor...
        </div>
      </div>
    );
  }

  const sortedBlocks = [...blocks].sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col h-full border border-[#30363d] rounded-md overflow-hidden bg-[#0d1117]">
      <div className="border-b border-[#30363d] bg-[#161b22] px-4 py-2">
        <ReadmeToolbar
          onGenerate={handleGenerate}
          onProfileTemplate={handleProfileTemplate}
          onImport={localReadme ? handleImport : undefined}
          onReset={handleReset}
          onCopy={handleCopy}
          onDownload={handleDownload}
          onWriteToDisk={handleWriteToDisk}
          generating={generating}
          saving={saving}
          copying={copying}
          writing={writing}
        />
      </div>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        <div className="w-full lg:w-[420px] lg:border-r border-[#30363d] flex flex-col overflow-hidden max-h-[60vh] lg:max-h-none">
          <div className="flex-1 overflow-auto p-3 space-y-1 min-h-[120px]">
            {sortedBlocks.length === 0 ? (
              <div className="text-center py-8 px-4 text-[#8b949e]">
                <div className="text-[32px] mb-2">📄</div>
                <p className="text-[13px] mb-4">Henüz README yok. Nasıl başlamak istersin?</p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleGenerate()}
                    disabled={generating}
                    className="h-[34px] px-4 text-[12px] font-medium text-white bg-[#238636] hover:bg-[#2ea043] rounded-md disabled:opacity-50"
                  >
                    {generating ? "Oluşturuluyor... (AI ile 1-2 dk sürebilir)" : "✨ Projeden oluştur"}
                  </button>
                  {localReadme && (
                    <button
                      onClick={handleImport}
                      className="h-[34px] px-4 text-[12px] font-medium text-[#c9d1d9] bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md"
                    >
                      📥 Diskteki README.md&apos;yi içe aktar
                    </button>
                  )}
                  <button
                    onClick={() => setShowAddMenu(true)}
                    className="h-[34px] px-4 text-[12px] font-medium text-[#58a6ff] bg-[#58a6ff11] hover:bg-[#58a6ff22] border border-dashed border-[#30363d] rounded-md"
                  >
                    + Boş başla (blok ekle)
                  </button>
                </div>
              </div>
            ) : (
              sortedBlocks.map((block, i) => (
                <BlockListItem
                  key={block.id}
                  block={block}
                  isSelected={selectedId === block.id}
                  isFirst={i === 0}
                  isLast={i === sortedBlocks.length - 1}
                  onSelect={() => setSelectedId(selectedId === block.id ? null : block.id)}
                  onToggle={() => toggleBlock(block.id)}
                  onDelete={() => deleteBlock(block.id)}
                  onMoveUp={() => moveBlock(block.id, "up")}
                  onMoveDown={() => moveBlock(block.id, "down")}
                />
              ))
            )}
          </div>

          <div className="border-t border-[#30363d] p-3 relative">
            {showAddMenu && (
              <div className="absolute bottom-full left-3 right-3 mb-1 bg-[#161b22] border border-[#30363d] rounded-md shadow-xl z-50 max-h-[320px] overflow-auto">
                {ADDABLE_TYPES.filter((t) => t === "divider" || t === "image" || !blocks.some((b) => b.type === t)).map((t) => (
                  <button
                    key={t}
                    onClick={() => addBlock(t)}
                    className="w-full text-left px-3 py-2 hover:bg-[#21262d] flex items-center gap-2 transition-colors"
                  >
                    <span>{BLOCK_META[t].icon}</span>
                    <span className="text-[13px] text-[#c9d1d9]">{BLOCK_META[t].label}</span>
                    <span className="ml-auto text-[11px] text-[#6e7681] truncate">{BLOCK_META[t].description}</span>
                  </button>
                ))}
                <button
                  onClick={() => addBlock("custom")}
                  className="w-full text-left px-3 py-2 text-[13px] text-[#58a6ff] hover:bg-[#21262d] flex items-center gap-2 transition-colors border-t border-[#30363d]"
                >
                  <span>📝</span>
                  <span>Özel Bölüm (markdown)</span>
                </button>
              </div>
            )}
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="w-full h-[32px] text-[12px] font-medium text-[#58a6ff] bg-[#58a6ff11] hover:bg-[#58a6ff22] border border-dashed border-[#30363d] rounded-md transition-colors"
              aria-expanded={showAddMenu}
            >
              + Blok Ekle
            </button>
          </div>

          {selectedBlock && (
            <div className="border-t border-[#30363d] p-3 max-h-[45vh] overflow-auto bg-[#0d1117]">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-[13px] font-semibold text-[#f0f6fc] flex items-center gap-1.5">
                  <span>{BLOCK_META[selectedBlock.type].icon}</span>
                  {BLOCK_META[selectedBlock.type].label}
                </h3>
                <span className="text-[11px] text-[#8b949e] truncate">{BLOCK_META[selectedBlock.type].description}</span>
              </div>
              <BlockForms block={selectedBlock} onChange={(data) => updateBlock(selectedBlock.id, data)} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 bg-[#0d1117] min-h-[300px]">
          <ReadmePreview markdown={markdown} />
        </div>
      </div>
    </div>
  );
}
