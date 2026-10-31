"use client";

import { Button } from "@/components/ui/Button";
import { ProjectCard } from "@/components/features/ProjectCard";
import { useProjects } from "@/components/features/useProjects";
import { projectCategory } from "@/lib/utils";

export default function HiddenProjects() {
  const { projects, workspacePath, loading, error, busy, reload, runAction, repoNameDialog } = useProjects();
  const hidden = projects.filter((p) => p.isHidden);

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {repoNameDialog}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-semibold text-[#f0f6fc] mb-2">Gizli Projeler</h1>
            <p className="text-[#8b949e] text-[14px]">Dashboard&apos;da gösterilmeyen projeler.</p>
          </div>
          <Button href="/" variant="secondary" size="sm">← Dashboard</Button>
        </div>

        {error && (
          <div className="mb-6 p-4 border border-[#da363366] bg-[#da363318] rounded-md flex items-center justify-between gap-3">
            <p className="text-[14px] text-[#ff7b72]">⚠️ {error}</p>
            <Button variant="secondary" size="sm" onClick={() => reload(true)}>Tekrar Dene</Button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-[#30363d] rounded-md bg-[#161b22] p-4">
                <div className="animate-pulse">
                  <div className="h-4 bg-[#30363d] rounded w-1/3 mb-4" />
                  <div className="h-3 bg-[#30363d] rounded w-1/2 mb-2" />
                  <div className="h-3 bg-[#30363d] rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : hidden.length === 0 ? (
          <div className="border border-[#30363d] rounded-md bg-[#161b22] p-12 text-center">
            <p className="text-[#f0f6fc] text-[16px] mb-2">Gizli proje yok</p>
            <p className="text-[#8b949e] text-[14px]">Tüm projelerin Dashboard&apos;da görünüyor.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hidden.map((p) => (
              <ProjectCard
                key={p.id}
                id={p.id}
                name={p.name}
                type={p.type}
                category={projectCategory(p.localPath, workspacePath)}
                fileCount={p.fileCount}
                totalSize={p.totalSize}
                lastModified={p.lastModified}
                hasGit={p.hasGit}
                hasReadme={p.hasReadme}
                isOnGithub={p.isOnGithub}
                githubUrl={p.githubUrl}
                description={p.description}
                isHidden
                busyAction={busy[p.id]}
                onAction={runAction}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
