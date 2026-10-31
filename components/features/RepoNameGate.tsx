"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, type ApiError } from "@/lib/utils";
import { isValidRepoName, type NameAssessment } from "@/lib/repo-name";

interface Suggestion {
  repoName: string;
  title: string;
  source: string;
}

interface RepoNameInfo {
  current: { repoName: string | null; displayName: string | null };
  folderName: string;
  isOnGithub: boolean;
  linkedRepo: string | null;
  assessment: NameAssessment;
  suggestions: Suggestion[];
}

const QUALITY_LABEL: Record<NameAssessment["quality"], { text: string; cls: string }> = {
  good: { text: "Ad iyi", cls: "text-[#3fb950] border-[#23863666] bg-[#23863618]" },
  ok: { text: "Küçük düzeltme yapıldı", cls: "text-[#58a6ff] border-[#388bfd66] bg-[#388bfd18]" },
  bad: { text: "Ad uygun değil", cls: "text-[#d29922] border-[#9e6a0366] bg-[#9e6a0318]" },
};

function RepoNameDialog({
  projectId,
  info,
  mode,
  onDone,
}: {
  projectId: string;
  info: RepoNameInfo;
  mode: "gate" | "edit";
  onDone: (saved: boolean) => void;
}) {
  const toast = useToast();
  const [suggestions, setSuggestions] = useState(info.suggestions);
  const [repoName, setRepoName] = useState(info.linkedRepo ?? info.current.repoName ?? info.assessment.repoName);
  const [title, setTitle] = useState(info.current.displayName ?? info.assessment.title);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exists, setExists] = useState<boolean | null>(null);
  const locked = !!(info.isOnGithub && info.linkedRepo);
  const valid = isValidRepoName(repoName);

  // GitHub'da aynı adda repo var mı? (yazmayı bitirince)
  useEffect(() => {
    if (!valid || locked) {
      setExists(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch<{ exists: boolean | null }>(`/api/projects/${projectId}/repo-name?check=${encodeURIComponent(repoName)}`);
        setExists(res.exists);
      } catch {
        setExists(null);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [repoName, valid, locked, projectId]);

  const askAi = async () => {
    setAiLoading(true);
    try {
      const res = await apiFetch<RepoNameInfo>(`/api/projects/${projectId}/repo-name?ai=1`);
      setSuggestions(res.suggestions);
      if (!res.suggestions.some((s) => s.source === "AI")) toast("info", "AI yeni bir öneri üretemedi");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "AI önerisi alınamadı");
    } finally {
      setAiLoading(false);
    }
  };

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await apiFetch(`/api/projects/${projectId}/repo-name`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoName, displayName: title }),
      });
      toast("success", `GitHub adı: ${repoName}${title ? ` · Başlık: ${title}` : ""}`);
      onDone(true);
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Ad kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const q = QUALITY_LABEL[info.assessment.quality];

  return (
    <Modal
      isOpen
      onClose={() => onDone(false)}
      title={mode === "gate" ? "GitHub için bir ad seçelim" : "GitHub adı ve başlık"}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={() => onDone(false)}>
            Vazgeç
          </Button>
          <Button variant="primary" size="sm" onClick={save} disabled={!valid || saving}>
            {saving ? "Kaydediliyor..." : mode === "gate" ? "Kaydet ve devam et" : "Kaydet"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-[13px] text-[#c9d1d9]">
          Klasör adı: <span className="font-mono text-[#f0f6fc]">{info.folderName}</span>{" "}
          <span className={`ml-1 inline-block px-2 py-0.5 text-[11px] rounded-full border ${q.cls}`}>{q.text}</span>
          {info.assessment.reasons.length > 0 && (
            <ul className="mt-1 text-[12px] text-[#8b949e] list-disc pl-5">
              {info.assessment.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-[11px] text-[#6e7681]">Diskteki klasör adı değişmez; yalnızca GitHub ve README&apos;de kullanılır.</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] text-[#8b949e] font-medium">Öneriler</span>
            <button
              onClick={askAi}
              disabled={aiLoading || locked}
              className="text-[12px] text-[#58a6ff] hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {aiLoading ? "AI düşünüyor..." : "✨ AI ile öner"}
            </button>
          </div>
          <div className="space-y-1" role="radiogroup" aria-label="Ad önerileri">
            {suggestions.map((s) => {
              const selected = s.repoName === repoName;
              return (
                <button
                  key={s.repoName}
                  role="radio"
                  aria-checked={selected}
                  disabled={locked}
                  onClick={() => {
                    setRepoName(s.repoName);
                    setTitle(s.title);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md border flex items-center gap-3 transition-colors disabled:opacity-60 ${
                    selected ? "border-[#388bfd] bg-[#388bfd14]" : "border-[#30363d] hover:border-[#8b949e]"
                  }`}
                >
                  <span className="font-mono text-[13px] text-[#f0f6fc] truncate">{s.repoName}</span>
                  <span className="text-[12px] text-[#8b949e] truncate flex-1">{s.title}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-[#30363d] text-[#8b949e] shrink-0">{s.source}</span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className="block text-[12px] text-[#8b949e] mb-1 font-medium">GitHub repo adı</span>
          <input
            value={repoName}
            onChange={(e) => setRepoName(e.target.value.replace(/\s+/g, "-"))}
            disabled={locked}
            className={`w-full h-[34px] px-3 text-[13px] font-mono text-[#c9d1d9] bg-[#0d1117] border rounded-md focus:outline-none disabled:opacity-60 ${
              valid ? "border-[#30363d] focus:border-[#58a6ff]" : "border-[#f85149]"
            }`}
          />
          {!valid && <span className="block text-[11px] text-[#f85149] mt-1">Yalnızca harf, rakam, nokta, tire ve alt çizgi.</span>}
          {locked && <span className="block text-[11px] text-[#8b949e] mt-1">Proje GitHub&apos;a bağlı; repo adı GitHub&apos;dan değiştirilebilir.</span>}
          {valid && !locked && exists === true && (
            <span className="block text-[11px] text-[#d29922] mt-1">⚠️ GitHub hesabında bu adda bir repo var. Yüklerken içine eklemek için onay istenir.</span>
          )}
          {valid && !locked && exists === false && <span className="block text-[11px] text-[#3fb950] mt-1">✓ Bu ad müsait</span>}
        </label>

        <label className="block">
          <span className="block text-[12px] text-[#8b949e] mb-1 font-medium">README başlığı</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-[34px] px-3 text-[13px] text-[#c9d1d9] bg-[#0d1117] border border-[#30363d] rounded-md focus:outline-none focus:border-[#58a6ff]"
          />
        </label>
      </div>
    </Modal>
  );
}

type PendingDialog = { projectId: string; info: RepoNameInfo; mode: "gate" | "edit"; resolve: (saved: boolean) => void };

/**
 * README üretme / GitHub'a yükleme öncesi repo adını garanti eder:
 * - ad seçilmişse veya repo bağlıysa: devam
 * - ad iyi/ok ise: hafif düzeltilmiş adı sessizce kaydedip devam
 * - ad kötüyse: kullanıcıya sorar (iptal → false)
 */
export function useRepoNameGate() {
  const toast = useToast();
  const [pending, setPending] = useState<PendingDialog | null>(null);

  const load = (projectId: string) => apiFetch<RepoNameInfo>(`/api/projects/${projectId}/repo-name`);

  const ensureRepoName = useCallback(
    async (projectId: string): Promise<boolean> => {
      let info: RepoNameInfo;
      try {
        info = await load(projectId);
      } catch {
        return true; // ad servisi hata verirse asıl işlemi engelleme
      }
      if (info.current.repoName || info.linkedRepo) return true;

      if (info.assessment.quality !== "bad") {
        try {
          await apiFetch(`/api/projects/${projectId}/repo-name`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ repoName: info.assessment.repoName, displayName: info.assessment.title }),
          });
          if (info.assessment.quality === "ok") {
            toast("info", `GitHub adı: ${info.assessment.repoName} · Başlık: ${info.assessment.title} (başlıktaki ✏️ ile değiştirebilirsin)`);
          }
        } catch (err) {
          if ((err as ApiError).status !== 409) toast("error", err instanceof Error ? err.message : "Ad kaydedilemedi");
        }
        return true;
      }

      return new Promise<boolean>((resolve) => setPending({ projectId, info, mode: "gate", resolve }));
    },
    [toast]
  );

  const openRepoNameEditor = useCallback(
    async (projectId: string): Promise<boolean> => {
      try {
        const info = await load(projectId);
        return await new Promise<boolean>((resolve) => setPending({ projectId, info, mode: "edit", resolve }));
      } catch (err) {
        toast("error", err instanceof Error ? err.message : "Ad bilgisi alınamadı");
        return false;
      }
    },
    [toast]
  );

  const repoNameDialog = pending ? (
    <RepoNameDialog
      key={pending.projectId + pending.mode}
      projectId={pending.projectId}
      info={pending.info}
      mode={pending.mode}
      onDone={(saved) => {
        pending.resolve(saved);
        setPending(null);
      }}
    />
  ) : null;

  return { ensureRepoName, openRepoNameEditor, repoNameDialog };
}

/** GitHub'a yükler; aynı adlı bağlı olmayan repo varsa onay sorup tekrar dener. Vazgeçilirse null döner. */
export async function pushProjectToGithub(projectId: string) {
  type PushResult = { url: string; action: string; fileCount: number };
  const post = (allowExisting: boolean) =>
    apiFetch<PushResult>(`/api/projects/${projectId}/github`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowExisting }),
    });
  try {
    return await post(false);
  } catch (err) {
    const e = err as ApiError;
    const data = e.data as { repoExists?: boolean; fullName?: string } | undefined;
    if (e.status === 409 && data?.repoExists) {
      const ok = window.confirm(
        `GitHub hesabında "${data.fullName}" adlı bir repo zaten var.\n\nProje dosyaları bu repoya yüklensin mi? (Aynı adlı dosyalar güncellenir.)\n\nFarklı bir ad için Vazgeç'e basıp başlıktaki ✏️ ile adı değiştirebilirsin.`
      );
      if (!ok) return null;
      return await post(true);
    }
    throw err;
  }
}
