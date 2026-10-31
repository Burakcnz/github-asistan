"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/utils";
import { README_LANGS, type ReadmeLang } from "@/lib/readme/i18n";
import { README_TEMPLATE_OPTIONS, type ReadmeTemplateId } from "@/lib/readme/build";

interface GithubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

interface SettingsData {
  readmeLanguage: ReadmeLang;
  readmeStyle: ReadmeTemplateId;
  hasGithubToken: boolean;
  ollamaModel: string;
  workspacePath: string | null;
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="border border-[#30363d] rounded-md bg-[#161b22] p-6">
      <h2 className="text-[16px] font-semibold text-[#f0f6fc] mb-1">{title}</h2>
      <p className="text-[#8b949e] text-[14px] mb-4">{description}</p>
      {children}
    </section>
  );
}

export default function Settings() {
  const router = useRouter();
  const toast = useToast();
  const [isSetup, setIsSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  const [workspacePath, setWorkspacePath] = useState("");
  const [savedWorkspace, setSavedWorkspace] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [savingWorkspace, setSavingWorkspace] = useState(false);

  const [githubUser, setGithubUser] = useState<GithubUser | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [tokenProblem, setTokenProblem] = useState<string | null>(null);
  const [editingToken, setEditingToken] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [savingToken, setSavingToken] = useState(false);

  const [models, setModels] = useState<string[]>([]);
  const [ollamaRunning, setOllamaRunning] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [readmeLang, setReadmeLang] = useState<ReadmeLang>("tr");
  const [readmeStyle, setReadmeStyle] = useState<ReadmeTemplateId>("modern");

  useEffect(() => {
    setIsSetup(new URLSearchParams(window.location.search).has("setup"));

    (async () => {
      try {
        const settings = await apiFetch<SettingsData>("/api/settings");
        setWorkspacePath(settings.workspacePath ?? "");
        setSavedWorkspace(settings.workspacePath);
        setSelectedModel(settings.ollamaModel);
        setReadmeLang(settings.readmeLanguage ?? "tr");
        setReadmeStyle(settings.readmeStyle ?? "modern");
        setHasToken(settings.hasGithubToken);

        const tasks: Promise<unknown>[] = [
          apiFetch<{ running: boolean; models: string[] }>("/api/ollama/status")
            .then((s) => {
              setOllamaRunning(s.running);
              setModels(s.models);
            })
            .catch(() => undefined),
        ];
        if (settings.hasGithubToken) {
          tasks.push(
            apiFetch<GithubUser>("/api/github/validate")
              .then(setGithubUser)
              .catch((err) => setTokenProblem(err instanceof Error ? err.message : "Token doğrulanamadı"))
          );
        }
        await Promise.all(tasks);
      } catch (err) {
        toast("error", err instanceof Error ? err.message : "Ayarlar yüklenemedi");
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const handleSaveWorkspace = async () => {
    setSavingWorkspace(true);
    setWorkspaceError(null);
    try {
      const res = await apiFetch<{ workspacePath: string }>("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspacePath }),
      });
      setWorkspacePath(res.workspacePath);
      setSavedWorkspace(res.workspacePath);
      toast("success", "Çalışma alanı kaydedildi");
      if (isSetup) router.push("/");
    } catch (err) {
      setWorkspaceError(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setSavingWorkspace(false);
    }
  };

  const handleSaveToken = async () => {
    setSavingToken(true);
    setTokenError(null);
    try {
      const res = await apiFetch<{ user: GithubUser }>("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "githubToken", value: tokenInput }),
      });
      setGithubUser(res.user);
      setHasToken(true);
      setTokenProblem(null);
      setEditingToken(false);
      setTokenInput("");
      toast("success", `GitHub bağlandı: @${res.user.login}`);
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : "Token kaydedilemedi");
    } finally {
      setSavingToken(false);
    }
  };

  const handleRemoveToken = async () => {
    if (!window.confirm("GitHub token kaldırılsın mı?")) return;
    try {
      await apiFetch("/api/settings?key=githubToken", { method: "DELETE" });
      setGithubUser(null);
      setHasToken(false);
      setTokenProblem(null);
      toast("info", "GitHub token kaldırıldı");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Token kaldırılamadı");
    }
  };

  const handleStyleChange = async (style: ReadmeTemplateId) => {
    const previous = readmeStyle;
    setReadmeStyle(style);
    try {
      await apiFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "readmeStyle", value: style }),
      });
      toast("success", `Varsayılan README görünümü: ${README_TEMPLATE_OPTIONS.find((t) => t.id === style)?.label}`);
    } catch (err) {
      setReadmeStyle(previous);
      toast("error", err instanceof Error ? err.message : "Görünüm kaydedilemedi");
    }
  };

  const handleLangChange = async (lang: ReadmeLang) => {
    const previous = readmeLang;
    setReadmeLang(lang);
    try {
      await apiFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "readmeLanguage", value: lang }),
      });
      toast("success", `README dili: ${README_LANGS.find((l) => l.value === lang)?.label}`);
    } catch (err) {
      setReadmeLang(previous);
      toast("error", err instanceof Error ? err.message : "Dil kaydedilemedi");
    }
  };

  const handleModelChange = async (model: string) => {
    const previous = selectedModel;
    setSelectedModel(model);
    try {
      await apiFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "ollamaModel", value: model }),
      });
      toast("success", `README modeli: ${model}`);
    } catch (err) {
      setSelectedModel(previous);
      toast("error", err instanceof Error ? err.message : "Model kaydedilemedi");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-[#8b949e] flex items-center gap-2">
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Yükleniyor...
        </div>
      </div>
    );
  }

  const showTokenForm = !hasToken || editingToken || !!tokenProblem?.includes("geçersiz");
  const modelOptions = models.includes(selectedModel) || !selectedModel ? models : [selectedModel, ...models];

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-semibold text-[#f0f6fc] mb-2">Ayarlar</h1>
            <p className="text-[#8b949e] text-[14px]">Çalışma alanını ve entegrasyonları yapılandır.</p>
          </div>
          <Button href="/" variant="secondary" size="sm">← Dashboard</Button>
        </div>

        {isSetup && !savedWorkspace && (
          <div className="mb-6 p-4 border border-[#388bfd66] bg-[#388bfd18] rounded-md text-[14px] text-[#58a6ff]">
            Başlamak için projelerinin bulunduğu ana klasörü seç.
          </div>
        )}

        <div className="space-y-6">
          <Section
            title="Çalışma Alanı"
            description="Projelerinin bulunduğu ana klasör. Alt klasörler (ör. kategori klasörleri) 3 seviyeye kadar taranır."
          >
            <form
              className="flex flex-col sm:flex-row gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveWorkspace();
              }}
            >
              <div className="flex-1">
                <Input
                  placeholder="C:\Projeler"
                  value={workspacePath}
                  onChange={(e) => {
                    setWorkspacePath(e.target.value);
                    setWorkspaceError(null);
                  }}
                  error={workspaceError ?? undefined}
                  aria-label="Çalışma alanı klasörü"
                  className="font-mono"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="sm:self-start sm:h-[38px]"
                disabled={savingWorkspace || !workspacePath.trim() || workspacePath.trim() === savedWorkspace}
              >
                {savingWorkspace ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </form>
          </Section>

          <Section title="GitHub" description="Projeleri GitHub'a yüklemek için Personal Access Token gerekir.">
            {githubUser && !editingToken && (
              <div className="mb-4 p-4 bg-[#23863626] border border-[#23863644] rounded-md flex flex-wrap items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={githubUser.avatar_url} alt="" className="w-12 h-12 rounded-full" />
                <div className="flex-1 min-w-0">
                  <p className="text-[#f0f6fc] font-medium truncate">{githubUser.name || githubUser.login}</p>
                  <p className="text-[#8b949e] text-[12px]">@{githubUser.login}</p>
                </div>
                <Badge variant="success">Bağlı</Badge>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button variant="secondary" size="sm" onClick={() => setEditingToken(true)}>Değiştir</Button>
                  <Button variant="danger" size="sm" onClick={handleRemoveToken}>Kaldır</Button>
                </div>
              </div>
            )}

            {tokenProblem && !editingToken && (
              <div className="mb-4 p-3 border border-[#da363366] bg-[#da363318] rounded-md flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] text-[#ff7b72]">
                  {tokenProblem.includes("geçersiz") ? "Kayıtlı token geçersiz veya süresi dolmuş. Yeni bir token gir." : tokenProblem}
                </p>
                <Button variant="danger" size="sm" onClick={handleRemoveToken}>Kaldır</Button>
              </div>
            )}

            {showTokenForm && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveToken();
                }}
              >
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <Input
                      type="password"
                      placeholder="ghp_... veya github_pat_..."
                      value={tokenInput}
                      onChange={(e) => {
                        setTokenInput(e.target.value);
                        setTokenError(null);
                      }}
                      error={tokenError ?? undefined}
                      autoComplete="off"
                      aria-label="GitHub token"
                    />
                  </div>
                  <div className="flex gap-2 sm:self-start">
                    <Button type="submit" variant="primary" size="sm" className="sm:h-[38px]" disabled={savingToken || !tokenInput.trim()}>
                      {savingToken ? "Doğrulanıyor..." : "Doğrula ve Kaydet"}
                    </Button>
                    {editingToken && (
                      <Button variant="secondary" size="sm" className="sm:h-[38px]" onClick={() => setEditingToken(false)}>
                        Vazgeç
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-[12px] text-[#8b949e]">
                  Token oluştur:{" "}
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo&description=GitHub%20Asistan"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#58a6ff] hover:underline"
                  >
                    GitHub Ayarları ↗
                  </a>{" "}
                  — gerekli izin: <code className="text-[#c9d1d9]">repo</code>
                </p>
              </form>
            )}
          </Section>

          <Section title="README Dili" description="Oluşturulan README'lerin yazılacağı dil (başlıklar ve AI metinleri).">
            <div className="flex gap-2" role="radiogroup" aria-label="README dili">
              {README_LANGS.map((l) => (
                <button
                  key={l.value}
                  role="radio"
                  aria-checked={readmeLang === l.value}
                  onClick={() => handleLangChange(l.value)}
                  className={`px-4 h-[34px] text-[13px] rounded-md border transition-colors ${
                    readmeLang === l.value
                      ? "bg-[#388bfd26] border-[#388bfd] text-[#58a6ff]"
                      : "border-[#30363d] text-[#8b949e] hover:text-[#c9d1d9]"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="README Görünümü" description="Yeni oluşturulan README'lerin varsayılan tasarımı. Editörde her proje için ayrıca seçilebilir.">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="README görünümü">
              {README_TEMPLATE_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  role="radio"
                  aria-checked={readmeStyle === t.id}
                  onClick={() => handleStyleChange(t.id)}
                  className={`text-left p-3 rounded-md border transition-colors ${
                    readmeStyle === t.id ? "bg-[#388bfd1a] border-[#388bfd]" : "border-[#30363d] hover:border-[#8b949e]"
                  }`}
                >
                  <span className={`block text-[13px] font-semibold ${readmeStyle === t.id ? "text-[#58a6ff]" : "text-[#f0f6fc]"}`}>{t.label}</span>
                  <span className="block text-[11px] text-[#8b949e] mt-1">{t.description}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="README Modeli" description="README üretiminde kullanılacak Ollama modeli.">
            {!ollamaRunning ? (
              <p className="text-[13px] text-[#d29922]">
                Ollama çalışmıyor. Dashboard&apos;daki AI Modeli panelinden başlatabilirsin.
              </p>
            ) : modelOptions.length === 0 ? (
              <p className="text-[13px] text-[#d29922]">Kurulu model yok. Dashboard&apos;dan önerilen modeli indirebilirsin.</p>
            ) : (
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="w-full sm:w-auto min-w-[260px] bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-[14px] text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
                aria-label="README modeli"
              >
                {modelOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                    {!models.includes(m) ? " (kurulu değil)" : ""}
                  </option>
                ))}
              </select>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
