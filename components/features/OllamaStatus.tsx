"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/utils";

interface OllamaStatusData {
  installed: boolean;
  path: string | null;
  running: boolean;
  models: string[];
  recommendedModel: string;
  selectedModel?: string;
  systemInfo?: { ram: number; vram: number; cpu: string };
}

export function OllamaStatus() {
  const toast = useToast();
  const [status, setStatus] = useState<OllamaStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState("");
  const [open, setOpen] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      setStatus(await apiFetch<OllamaStatusData>("/api/ollama/status"));
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleStart = async () => {
    setStarting(true);
    try {
      await apiFetch("/api/ollama/start", { method: "POST" });
      toast("success", "Ollama başlatıldı");
      await fetchStatus();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Ollama başlatılamadı");
    } finally {
      setStarting(false);
    }
  };

  const handleDownload = async () => {
    if (!status?.recommendedModel) return;
    setDownloading(true);
    setProgress("İndirme başlatılıyor...");

    try {
      const response = await fetch("/api/ollama/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: status.recommendedModel }),
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "İndirme başlatılamadı");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let failed: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.error) failed = msg.error;
            else if (msg.total && msg.completed) {
              setProgress(`${msg.status ?? "İndiriliyor"} — %${Math.round((msg.completed / msg.total) * 100)}`);
            } else if (msg.status) setProgress(msg.status);
          } catch {
            // eksik satır
          }
        }
      }

      if (failed) throw new Error(failed);
      toast("success", `${status.recommendedModel} indirildi`);
      await fetchStatus();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Model indirilemedi");
    } finally {
      setDownloading(false);
      setProgress("");
    }
  };

  if (loading) {
    return (
      <div className="border border-[#30363d] rounded-md bg-[#161b22] p-4">
        <div className="animate-pulse">
          <div className="h-3 bg-[#30363d] rounded w-1/3 mb-4" />
          <div className="h-3 bg-[#30363d] rounded w-1/2" />
        </div>
      </div>
    );
  }

  const running = !!status?.running;
  const hasRecommended = !!status?.models.some((m) => m === status.recommendedModel || m.startsWith(`${status.recommendedModel}:`));

  return (
    <div className="border border-[#30363d] rounded-md bg-[#161b22] p-4">
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${running ? "bg-[#3fb950]" : "bg-[#f85149]"}`} />
          <h3 className="text-[14px] font-semibold text-[#f0f6fc]">AI Modeli (Ollama)</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[#8b949e]">{running ? "Çalışıyor" : "Kapalı"}</span>
          <svg
            className={`w-4 h-4 text-[#8b949e] transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {!running && !open && (
        <p className="mt-2 text-[12px] text-[#8b949e]">
          Ollama kapalıyken README şablonla oluşturulur.
        </p>
      )}

      {open && (
        <div className="mt-4 space-y-3">
          {!status ? (
            <p className="text-[12px] text-[#ff7b72]">Durum alınamadı.</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-[#8b949e]">Kurulum</span>
                <span className="text-[12px] text-[#c9d1d9]">{status.installed ? "Kurulu" : "Bulunamadı"}</span>
              </div>

              {status.systemInfo && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-[#8b949e]">Sistem</span>
                  <span className="text-[12px] text-[#c9d1d9]">
                    {status.systemInfo.ram} GB RAM{status.systemInfo.vram ? ` · ${status.systemInfo.vram} GB VRAM` : ""}
                  </span>
                </div>
              )}

              {running && (
                <div>
                  <span className="text-[12px] text-[#8b949e]">Modeller</span>
                  <div className="flex gap-1 flex-wrap mt-1">
                    {status.models.length === 0 ? (
                      <span className="text-[12px] text-[#d29922]">Hiç model yok</span>
                    ) : (
                      status.models.map((model) => (
                        <Badge key={model} variant={model === status.selectedModel ? "success" : "info"}>
                          {model}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              )}

              {running && !hasRecommended && (
                <div className="p-2 bg-[#388bfd26] border border-[#388bfd44] rounded-md">
                  <p className="text-[12px] text-[#58a6ff] mb-2">
                    Önerilen: <strong>{status.recommendedModel}</strong>
                  </p>
                  <Button variant="primary" size="sm" onClick={handleDownload} disabled={downloading} className="w-full">
                    {downloading ? "İndiriliyor..." : "Modeli İndir"}
                  </Button>
                  {downloading && progress && (
                    <p className="mt-2 text-[11px] text-[#8b949e] font-mono break-words">{progress}</p>
                  )}
                </div>
              )}

              {!status.installed && (
                <a
                  href="https://ollama.com/download"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-[12px] text-[#58a6ff] hover:underline"
                >
                  Ollama&apos;yı indir ↗
                </a>
              )}

              <div className="flex gap-2">
                {!running && status.installed && (
                  <Button variant="primary" size="sm" onClick={handleStart} disabled={starting} className="flex-1">
                    {starting ? "Başlatılıyor..." : "Başlat"}
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={fetchStatus} className="flex-1">
                  Yenile
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
