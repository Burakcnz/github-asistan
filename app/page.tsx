"use client";

import { useMemo, useState } from "react";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProjectCard } from "@/components/features/ProjectCard";
import { OllamaStatus } from "@/components/features/OllamaStatus";
import { useProjects, type ProjectSummary } from "@/components/features/useProjects";
import { projectCategory, projectTypeLabel } from "@/lib/utils";

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="border border-[#30363d] rounded-md bg-[#161b22] p-4">
          <div className="animate-pulse">
            <div className="h-4 bg-[#30363d] rounded w-1/3 mb-4" />
            <div className="h-3 bg-[#30363d] rounded w-1/2 mb-2" />
            <div className="h-3 bg-[#30363d] rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-[12px] font-medium rounded-md border transition-colors ${
        active
          ? "bg-[#388bfd26] border-[#388bfd] text-[#58a6ff]"
          : "border-[#30363d] text-[#8b949e] hover:text-[#c9d1d9] hover:border-[#8b949e]"
      }`}
    >
      {children}
    </button>
  );
}

export default function Dashboard() {
  const { projects, workspacePath, loading, refreshing, error, busy, reload, runAction, repoNameDialog } = useProjects();
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showHidden, setShowHidden] = useState(false);

  const withCategory = useMemo(
    () =>
      projects.map((p) => {
        const category = projectCategory(p.localPath, workspacePath);
        return { ...p, category, topCategory: category.split(" / ")[0] };
      }),
    [projects, workspacePath]
  );
  const active = withCategory.filter((p) => !p.isHidden);
  const hidden = withCategory.filter((p) => p.isHidden);

  const typeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of active) counts.set(p.type, (counts.get(p.type) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [active]);

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of active) counts.set(p.topCategory, (counts.get(p.topCategory) || 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], "tr"));
  }, [active]);

  const query = searchQuery.trim().toLocaleLowerCase("tr");
  const filtered = active.filter((p) => {
    if (typeFilter !== "all" && p.type !== typeFilter) return false;
    if (categoryFilter !== "all" && p.topCategory !== categoryFilter) return false;
    if (query && !p.name.toLocaleLowerCase("tr").includes(query) && !p.localPath.toLocaleLowerCase("tr").includes(query)) {
      return false;
    }
    return true;
  });

  const stats = [
    { label: "Toplam Proje", value: active.length, icon: "📦", bg: "bg-[#388bfd26]" },
    { label: "README Var", value: active.filter((p) => p.hasReadme).length, icon: "📝", bg: "bg-[#3fb95026]" },
    { label: "GitHub'da", value: active.filter((p) => p.isOnGithub).length, icon: "🐙", bg: "bg-[#a371f726]" },
    { label: "README Eksik", value: active.filter((p) => !p.hasReadme).length, icon: "⚠️", bg: "bg-[#d2992226]" },
  ];

  const renderCard = (p: ProjectSummary & { category: string }) => (
    <ProjectCard
      key={p.id}
      id={p.id}
      name={p.name}
      repoName={p.repoName}
      type={p.type}
      category={p.category}
      fileCount={p.fileCount}
      totalSize={p.totalSize}
      lastModified={p.lastModified}
      hasGit={p.hasGit}
      hasReadme={p.hasReadme}
      isOnGithub={p.isOnGithub}
      githubUrl={p.githubUrl}
      description={p.description}
      isHidden={p.isHidden}
      busyAction={busy[p.id]}
      onAction={runAction}
    />
  );

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {repoNameDialog}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-[24px] font-semibold text-[#f0f6fc] mb-2">Dashboard</h1>
          <p className="text-[#8b949e] text-[14px]">Projelerini yönet, README oluştur ve GitHub&apos;a yükle.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats.map((s) => (
            <div key={s.label} className="border border-[#30363d] rounded-md bg-[#161b22] p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-md ${s.bg} flex items-center justify-center shrink-0`}>
                  <span className="text-[20px]">{s.icon}</span>
                </div>
                <div>
                  <p className="text-[24px] font-semibold text-[#f0f6fc]">{loading ? "–" : s.value}</p>
                  <p className="text-[12px] text-[#8b949e]">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {workspacePath && (
          <div className="border border-[#30363d] rounded-md bg-[#161b22] p-4 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <svg className="w-5 h-5 text-[#8b949e] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span className="text-[14px] text-[#c9d1d9] font-mono truncate">{workspacePath}</span>
              </div>
              <div className="flex gap-2">
                <Button href="/settings" variant="secondary" size="sm">Ayarlar</Button>
                <Button variant="secondary" size="sm" onClick={() => reload(true)} disabled={refreshing}>
                  {refreshing ? "Taranıyor..." : "Yeniden Tara"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 border border-[#da363366] bg-[#da363318] rounded-md flex flex-wrap items-center justify-between gap-3">
            <p className="text-[14px] text-[#ff7b72]">⚠️ {error}</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => reload(true)}>Tekrar Dene</Button>
              <Button href="/settings" variant="secondary" size="sm">Ayarlar</Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 min-w-0">
            <div className="mb-6 space-y-3">
              <Input
                placeholder="Proje ara (ad veya klasör yolu)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Proje ara"
              />

              {categoryOptions.length > 1 && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-[12px] text-[#8b949e] w-14">Klasör</span>
                  <FilterChip active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>Tümü</FilterChip>
                  {categoryOptions.map(([cat, count]) => (
                    <FilterChip key={cat || "_root"} active={categoryFilter === cat} onClick={() => setCategoryFilter(cat)}>
                      {cat || "Kök"} ({count})
                    </FilterChip>
                  ))}
                </div>
              )}

              {typeOptions.length > 1 && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-[12px] text-[#8b949e] w-14">Tür</span>
                  <FilterChip active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>Tümü</FilterChip>
                  {typeOptions.map(([type, count]) => (
                    <FilterChip key={type} active={typeFilter === type} onClick={() => setTypeFilter(type)}>
                      {projectTypeLabel(type)} ({count})
                    </FilterChip>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-8">
              <h2 className="text-[16px] font-semibold text-[#f0f6fc] mb-4">
                Aktif Projeler ({filtered.length}
                {filtered.length !== active.length ? ` / ${active.length}` : ""})
              </h2>
              {loading ? (
                <SkeletonGrid />
              ) : filtered.length === 0 ? (
                <div className="border border-dashed border-[#30363d] rounded-md p-10 text-center">
                  <p className="text-[#f0f6fc] text-[16px] mb-2">
                    {active.length === 0 ? "Bu çalışma alanında proje bulunamadı" : "Filtreyle eşleşen proje yok"}
                  </p>
                  <p className="text-[#8b949e] text-[14px]">
                    {active.length === 0
                      ? "Ayarlar'dan projelerinin bulunduğu klasörü seç veya yeniden tara."
                      : "Arama veya filtreleri değiştirmeyi dene."}
                  </p>
                </div>
              ) : (
                <ErrorBoundary>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{filtered.map(renderCard)}</div>
                </ErrorBoundary>
              )}
            </div>

            {hidden.length > 0 && (
              <>
                <div className="mb-4">
                  <button
                    onClick={() => setShowHidden(!showHidden)}
                    className="text-[14px] text-[#58a6ff] hover:underline flex items-center gap-2"
                    aria-expanded={showHidden}
                  >
                    <svg
                      className={`w-4 h-4 transition-transform ${showHidden ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    Gizli Projeler ({hidden.length})
                  </button>
                </div>
                {showHidden && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{hidden.map(renderCard)}</div>}
              </>
            )}
          </div>

          <div className="lg:col-span-1">
            <ErrorBoundary>
              <OllamaStatus />
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}
