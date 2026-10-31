"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { ReadmeViewer } from "@/components/features/ReadmeViewer";
import { RepoHeader } from "@/components/features/RepoHeader";
import { FileTree } from "@/components/features/FileTree";
import { RepoSidebar } from "@/components/features/RepoSidebar";
import { BlockEditor } from "@/components/features/readme/BlockEditor";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, formatRelativeDate } from "@/lib/utils";
import type { ReadmeTemplateId } from "@/lib/readme/build";
import { pushProjectToGithub, useRepoNameGate } from "@/components/features/RepoNameGate";

interface FileEntry {
  name: string;
  lastModified: string;
  size?: number;
  language?: string;
}

interface Project {
  id: string;
  name: string;
  type: string;
  localPath: string;
  exists: boolean;
  fileCount: number;
  totalSize: number;
  lastModified: string;
  hasGit: boolean;
  hasReadme: boolean;
  isOnGithub: boolean;
  githubUrl: string | null;
  repoName: string | null;
  displayName: string | null;
  description: string | null;
  folders: FileEntry[];
  files: FileEntry[];
}

interface ReadmeData {
  content: string | null;
  version: number;
  /** "local": diskteki README.md, "app": uygulamada üretilen */
  source?: "app" | "local";
}

interface CommitInfo {
  message: string;
  date: string;
  author: string;
}

type Tab = "code" | "readme" | "edit";

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();
  const { ensureRepoName, openRepoNameEditor, repoNameDialog } = useRepoNameGate();

  const [project, setProject] = useState<Project | null>(null);
  const [readme, setReadme] = useState<ReadmeData | null>(null);
  const [commitHistory, setCommitHistory] = useState<CommitInfo[]>([]);
  const [languagePercentages, setLanguagePercentages] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("code");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [localReadme, setLocalReadme] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "readme" || tab === "edit" || tab === "code") setActiveTab(tab);
  }, []);

  const fetchProject = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await apiFetch<{
        project: Project;
        readme: ReadmeData | null;
        commitHistory: CommitInfo[];
        localReadme: string | null;
        languagePercentages: Record<string, number>;
      }>(`/api/projects/${id}`);
      setProject(data.project);
      setReadme(data.readme);
      setCommitHistory(data.commitHistory || []);
      setLocalReadme(data.localReadme ?? null);
      setLanguagePercentages(data.languagePercentages || {});
      setLoadError(null);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : "Proje yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject(true);
  }, [fetchProject]);

  const handleGenerateReadme = async (template?: ReadmeTemplateId) => {
    if (!project) return;
    if (readme?.source === "app" && !window.confirm("Mevcut README yeniden oluşturulacak (düzenlemeleriniz kaybolur). Devam edilsin mi?")) {
      return;
    }
    if (!(await ensureRepoName(id))) return;
    void fetchProject();

    try {
      setGenerating(true);
      const data = await apiFetch<{ content: string; source: string; version: number; warning: string | null }>(
        `/api/projects/${id}/readme/generate`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template }) }
      );
      setReadme({ content: data.content, version: data.version, source: "app" });
      setEditorKey((k) => k + 1);
      setActiveTab("readme");
      toast("success", data.source === "ai" ? "README yapay zekâ ile oluşturuldu" : "README proje analiziyle oluşturuldu");
      if (data.warning) toast("info", data.warning);
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "README oluşturulamadı");
    } finally {
      setGenerating(false);
    }
  };

  const handleWriteToDisk = async () => {
    if (!project || readme?.source !== "app") return;
    if (!window.confirm(`README.md "${project.name}" klasörüne yazılacak. Var olan dosya README.md.bak olarak yedeklenir. Devam edilsin mi?`)) {
      return;
    }
    try {
      setWriting(true);
      const res = await apiFetch<{ path: string; backup: string | null; unchanged?: boolean }>(`/api/projects/${id}/readme/write`, {
        method: "POST",
      });
      toast("success", res.unchanged ? "Klasördeki README.md zaten güncel" : `Kaydedildi: ${res.path}${res.backup ? " (eski dosya yedeklendi)" : ""}`);
      await fetchProject();
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "README klasöre yazılamadı");
    } finally {
      setWriting(false);
    }
  };

  const handlePushToGithub = async () => {
    if (!project) return;
    const msg = project.isOnGithub
      ? `"${project.name}" GitHub reposu yerel dosyalarla güncellenecek. Devam edilsin mi?`
      : `"${project.name}" GitHub'a HERKESE AÇIK bir repo olarak yüklenecek. Devam edilsin mi?`;
    if (!window.confirm(msg)) return;
    if (!(await ensureRepoName(id))) return;
    void fetchProject();

    try {
      setPushing(true);
      const data = await pushProjectToGithub(id);
      if (!data) return;
      await fetchProject();
      toast("success", `${data.action === "created" ? "Repo oluşturuldu" : "Repo güncellendi"} (${data.fileCount} dosya)`, data.url);
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "GitHub'a yüklenemedi");
    } finally {
      setPushing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-[#8b949e] flex items-center gap-2">
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          Yükleniyor...
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#f85149] text-lg mb-4">⚠️ {loadError || "Proje bulunamadı"}</p>
          <a href="/" className="inline-block px-4 py-2 bg-[#21262d] text-[#c9d1d9] rounded-md border border-[#30363d] hover:bg-[#30363d] transition-colors">Dashboard&apos;a Dön</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Repo Header */}
      <RepoHeader
        name={project.name}
        localPath={project.localPath}
        isOnGithub={project.isOnGithub}
        githubUrl={project.githubUrl}
        pushing={pushing}
        onPush={handlePushToGithub}
        hasReadme={readme?.source === "app"}
        generating={generating}
        onGenerateReadme={handleGenerateReadme}
        repoName={project.repoName}
        displayName={project.displayName}
        onEditName={async () => {
          if (await openRepoNameEditor(id)) await fetchProject();
        }}
      />
      {repoNameDialog}

      {!project.exists && (
        <div className="max-w-[1280px] mx-auto px-4 mb-4">
          <div className="p-3 border border-[#9e6a0366] bg-[#9e6a0318] rounded-md text-[13px] text-[#d29922]">
            Proje klasörü diskte bulunamadı: <span className="font-mono">{project.localPath}</span>
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <div className="border-b border-[#30363d] bg-[#0d1117]">
        <div className="max-w-[1280px] mx-auto px-4">
          <nav className="flex gap-0 -mb-[1px]">
            <button
              onClick={() => setActiveTab("code")}
              className={`px-4 py-3 text-[14px] border-b-[3px] font-medium transition-colors flex items-center gap-2 ${
                activeTab === "code"
                  ? "border-[#f78166] text-[#f0f6fc]"
                  : "border-transparent text-[#8b949e] hover:text-[#c9d1d9] hover:border-[#d1d9e033]"
              }`}
            >
              <svg height="16" viewBox="0 0 16 16" width="16" fill="currentColor">
                <path d="M2 2.5C2 1.672 2.672 1 3.5 1h4.25a.75.75 0 0 1 0 1.5H3.5a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V7.75a.75.75 0 0 1 1.5 0v5.75A1.75 1.75 0 0 1 13.25 15H3.5A1.75 1.75 0 0 1 1.75 13.25Z"></path>
                <path d="M7.25 7.417v5.833a.75.75 0 1 1-1.5 0V5.87L2.78 7.55a.75.75 0 0 1-1.06-1.06l4.5-4.5a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1-1.06 1.06L7.25 7.417Z"></path>
              </svg>
              Code
            </button>
            <button
              onClick={() => setActiveTab("readme")}
              className={`px-4 py-3 text-[14px] border-b-[3px] font-medium transition-colors flex items-center gap-2 ${
                activeTab === "readme"
                  ? "border-[#f78166] text-[#f0f6fc]"
                  : "border-transparent text-[#8b949e] hover:text-[#c9d1d9] hover:border-[#d1d9e033]"
              }`}
            >
              <svg height="16" viewBox="0 0 16 16" width="16" fill="currentColor">
                <path d="M0 1.75A.75.75 0 0 1 .75 1h4.253c1.227 0 2.317.59 3 1.501A3.743 3.743 0 0 1 11.006 1h4.245a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-4.507a2.25 2.25 0 0 0-1.591.659l-.622.621a.75.75 0 0 1-1.06 0l-.622-.621A2.25 2.25 0 0 0 5.258 13H.75a.75.75 0 0 1-.75-.75Zm7.251 10.324.004-5.073-.002-2.253A2.25 2.25 0 0 0 5.003 2.5H1.5v9h3.757a3.75 3.75 0 0 1 1.994.574ZM8.755 4.75l-.004 7.322a3.752 3.752 0 0 1 1.992-.572H14.5v-9h-3.495a2.25 2.25 0 0 0-2.25 2.25Z"></path>
              </svg>
              README
            </button>
            <button
              onClick={() => setActiveTab("edit")}
              className={`px-4 py-3 text-[14px] border-b-[3px] font-medium transition-colors flex items-center gap-2 ${
                activeTab === "edit"
                  ? "border-[#f78166] text-[#f0f6fc]"
                  : "border-transparent text-[#8b949e] hover:text-[#c9d1d9] hover:border-[#d1d9e033]"
              }`}
            >
              <svg height="16" viewBox="0 0 16 16" width="16" fill="currentColor">
                <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064Zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354Z"></path>
              </svg>
              Edit README
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-[1280px] mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Main Content */}
          <div className="flex-1 min-w-0">
            {activeTab === "code" ? (
              <ErrorBoundary>
                {/* Branch Selector + Code Button Bar */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-[28px] px-3 text-[12px] font-medium text-[#c9d1d9] bg-[#21262d] rounded-md border border-[#30363d] flex items-center gap-1.5">
                    <svg height="16" viewBox="0 0 16 16" width="16" fill="#8b949e">
                      <path d="M9.5 3.25a2.25 2.25 0 1 1-3 2.122V6A2.5 2.5 0 0 0 9 8.5V5.372a2.25 2.25 0 0 1 0-2.122ZM4 8.25a.75.75 0 0 0-.75.75v4.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75V9a.75.75 0 0 0-1.5 0v3.75h-7.5V9a.75.75 0 0 0-.75-.75Z"></path>
                    </svg>
                    <span className="font-semibold">main</span>
                  </div>
                  <div className="flex items-center gap-1 text-[12px] text-[#8b949e]">
                    <svg height="16" viewBox="0 0 16 16" width="16" fill="#8b949e">
                      <path d="M1.643 3.143.427 1.927A.25.25 0 0 0 0 2.104v5.792a.25.25 0 0 0 .427.177L1.643 4.857A.25.25 0 0 0 1.643 4.5zM4 12.5a.25.25 0 0 0-.25-.25h-3.5a.25.25 0 0 0 0 .5h3.5a.25.25 0 0 0 .25-.25zM8 12.5a.25.25 0 0 0-.25-.25h-3.5a.25.25 0 0 0 0 .5h3.5a.25.25 0 0 0 .25-.25z"></path>
                    </svg>
                    <span>{project.fileCount} dosya</span>
                  </div>
                </div>

                {/* File Tree */}
                <FileTree
                  folders={project.folders}
                  files={project.files}
                  projectName={project.name}
                />

                {commitHistory.length > 0 && (
                  <div className="mt-6 border border-[#30363d] rounded-md overflow-hidden">
                    <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-2 text-[14px] font-semibold text-[#f0f6fc]">
                      Son Commitler
                    </div>
                    <ul className="divide-y divide-[#21262d]">
                      {commitHistory.slice(0, 10).map((c, i) => (
                        <li key={i} className="px-4 py-2 flex items-center gap-3 text-[13px]">
                          <span className="flex-1 min-w-0 truncate text-[#c9d1d9]" title={c.message}>{c.message}</span>
                          <span className="text-[#8b949e] shrink-0 hidden sm:inline">{c.author}</span>
                          <span className="text-[#8b949e] shrink-0">{formatRelativeDate(c.date)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* README below file tree (only if has readme) */}
                {readme?.content && (
                  <div className="mt-6 border border-[#30363d] rounded-md overflow-hidden">
                    <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-2 flex items-center gap-2">
                      <svg height="16" viewBox="0 0 16 16" width="16" fill="#8b949e">
                        <path d="M0 1.75A.75.75 0 0 1 .75 1h4.253c1.227 0 2.317.59 3 1.501A3.743 3.743 0 0 1 11.006 1h4.245a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-4.507a2.25 2.25 0 0 0-1.591.659l-.622.621a.75.75 0 0 1-1.06 0l-.622-.621A2.25 2.25 0 0 0 5.258 13H.75a.75.75 0 0 1-.75-.75Zm7.251 10.324.004-5.073-.002-2.253A2.25 2.25 0 0 0 5.003 2.5H1.5v9h3.757a3.75 3.75 0 0 1 1.994.574ZM8.755 4.75l-.004 7.322a3.752 3.752 0 0 1 1.992-.572H14.5v-9h-3.495a2.25 2.25 0 0 0-2.25 2.25Z"></path>
                      </svg>
                      <span className="text-[14px] text-[#f0f6fc] font-semibold">README.md</span>
                      {readme.source === "local" ? (
                        <span className="text-[12px] text-[#8b949e]">diskteki dosya</span>
                      ) : readme.version > 1 ? (
                        <span className="text-[12px] text-[#8b949e]">v{readme.version}</span>
                      ) : null}
                    </div>
                    <article className="markdown-body p-4">
                      <ReadmeViewer content={readme.content} />
                    </article>
                  </div>
                )}
              </ErrorBoundary>
            ) : activeTab === "edit" ? (
              /* Edit README Tab */
              <div className="h-[calc(100vh-180px)]">
                <BlockEditor
                  key={editorKey}
                  projectId={id}
                  projectName={project.name}
                  localReadme={localReadme}
                  onSaved={(content, version) => setReadme({ content, version, source: "app" })}
                  onWritten={() => fetchProject()}
                  beforeGenerate={async () => {
                    const ok = await ensureRepoName(id);
                    if (ok) void fetchProject();
                    return ok;
                  }}
                />
              </div>
            ) : (
              /* README Tab */
              <>
                {readme?.content ? (
                  <div className="border border-[#30363d] rounded-md overflow-hidden">
                    <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-2 flex items-center gap-2">
                      <svg height="16" viewBox="0 0 16 16" width="16" fill="#8b949e">
                        <path d="M0 1.75A.75.75 0 0 1 .75 1h4.253c1.227 0 2.317.59 3 1.501A3.743 3.743 0 0 1 11.006 1h4.245a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-4.507a2.25 2.25 0 0 0-1.591.659l-.622.621a.75.75 0 0 1-1.06 0l-.622-.621A2.25 2.25 0 0 0 5.258 13H.75a.75.75 0 0 1-.75-.75Zm7.251 10.324.004-5.073-.002-2.253A2.25 2.25 0 0 0 5.003 2.5H1.5v9h3.757a3.75 3.75 0 0 1 1.994.574ZM8.755 4.75l-.004 7.322a3.752 3.752 0 0 1 1.992-.572H14.5v-9h-3.495a2.25 2.25 0 0 0-2.25 2.25Z"></path>
                      </svg>
                      <span className="text-[14px] text-[#f0f6fc] font-semibold">README.md</span>
                      {readme.source === "local" ? (
                        <span className="text-[12px] text-[#8b949e]">diskteki dosya</span>
                      ) : readme.version > 1 ? (
                        <span className="text-[12px] text-[#8b949e]">v{readme.version}</span>
                      ) : null}
                      <div className="ml-auto flex gap-2">
                        <button
                          onClick={() => handleGenerateReadme()}
                          disabled={generating}
                          className="h-[24px] px-2 text-[12px] text-[#c9d1d9] bg-[#21262d] hover:bg-[#30363d] rounded border border-[#30363d] disabled:opacity-50 transition-colors"
                        >
                          {generating ? "Oluşturuluyor... (1-2 dk)" : readme.source === "local" ? "Uygulamada Oluştur" : "Yeniden Oluştur"}
                        </button>
                        {readme.source === "app" && (
                          <button
                            onClick={handleWriteToDisk}
                            disabled={writing}
                            className="h-[24px] px-2 text-[12px] text-white bg-[#238636] hover:bg-[#2ea043] rounded border border-[rgba(240,246,252,0.1)] disabled:opacity-50 transition-colors"
                            title="README.md dosyasını proje klasörüne yaz"
                          >
                            {writing ? "Yazılıyor..." : "💾 Klasöre Kaydet"}
                          </button>
                        )}
                      </div>
                    </div>
                    <article className="markdown-body p-4">
                      <ReadmeViewer content={readme.content} />
                    </article>
                  </div>
                ) : (
                  <div className="border border-dashed border-[#30363d] rounded-md p-12 text-center">
                    <div className="text-[48px] mb-4">📄</div>
                    <h3 className="text-[20px] font-semibold text-[#f0f6fc] mb-2">
                      README henüz oluşturulmadı
                    </h3>
                    <p className="text-[14px] text-[#8b949e] mb-6 max-w-[480px] mx-auto">
                      Proje dosyaları analiz edilip README oluşturulur. Ollama çalışıyorsa özellikler ve
                      açıklama yapay zekâ ile yazılır (1-2 dk sürebilir).
                    </p>
                    <button
                      onClick={() => handleGenerateReadme()}
                      disabled={generating}
                      className="h-[36px] px-4 text-[14px] font-medium text-white bg-[#238636] hover:bg-[#2ea043] rounded-md border border-[rgba(240,246,252,0.1)] disabled:opacity-50 inline-flex items-center gap-2 transition-colors"
                    >
                      {generating ? (
                        <>
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                          Oluşturuluyor...
                        </>
                      ) : (
                        <>📝 README Oluştur</>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right: Sidebar */}
          <div className="w-full lg:w-[296px] lg:shrink-0">
            <RepoSidebar
              description={project.description}
              type={project.type}
              languagePercentages={languagePercentages}
              lastModified={project.lastModified}
              hasGit={project.hasGit}
              hasReadme={!!readme?.content}
            />
          </div>
        </div>
      </div>

    </div>
  );
}
