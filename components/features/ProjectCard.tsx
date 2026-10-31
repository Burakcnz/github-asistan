"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatFileSize, formatRelativeDate, projectTypeColor, projectTypeLabel } from "@/lib/utils";

export type ProjectAction = "hide" | "show" | "github" | "readme";

export interface ProjectCardProps {
  id: string;
  name: string;
  /** Seçilmiş GitHub repo adı (klasör adından farklıysa gösterilir). */
  repoName?: string | null;
  type: string;
  category?: string;
  fileCount: number;
  totalSize: number;
  lastModified: string;
  hasGit: boolean;
  hasReadme: boolean;
  isOnGithub: boolean;
  githubUrl?: string | null;
  description?: string | null;
  isHidden?: boolean;
  /** Bu kartta şu an süren işlem (yoksa undefined). */
  busyAction?: ProjectAction;
  onAction: (id: string, action: ProjectAction) => void;
}

export function ProjectCard({
  id,
  name,
  repoName,
  type,
  category,
  fileCount,
  totalSize,
  lastModified,
  hasGit,
  hasReadme,
  isOnGithub,
  githubUrl,
  description,
  isHidden = false,
  busyAction,
  onAction,
}: ProjectCardProps) {
  const busy = !!busyAction;

  return (
    <div className="border border-[#30363d] rounded-md bg-[#0d1117] hover:border-[#8b949e] transition-colors flex flex-col">
      <div className="p-4 border-b border-[#30363d]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {category && (
              <p className="text-[11px] text-[#8b949e] truncate mb-0.5" title={category}>
                {category} /
              </p>
            )}
            <Link
              href={`/projects/${id}`}
              className="text-[#58a6ff] hover:underline font-semibold text-[16px] truncate block"
              title={name}
            >
              {name}
            </Link>
            {repoName && repoName !== name && (
              <p className="text-[11px] text-[#8b949e] font-mono truncate" title="GitHub repo adı">
                → {repoName}
              </p>
            )}
            {description && (
              <p className="text-[#8b949e] text-[12px] mt-1 line-clamp-2">{description}</p>
            )}
          </div>
          <Badge variant={hasReadme ? "success" : "default"}>
            {hasReadme ? "README ✓" : "README yok"}
          </Badge>
        </div>
      </div>

      <div className="p-4 space-y-3 flex-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#8b949e]">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: projectTypeColor(type) }} />
            {projectTypeLabel(type)}
          </span>
          <span>{fileCount.toLocaleString("tr-TR")} dosya</span>
          <span>{formatFileSize(totalSize)}</span>
        </div>

        {(hasGit || isOnGithub) && (
          <div className="flex flex-wrap gap-2">
            {hasGit && <Badge variant="info">Git</Badge>}
            {isOnGithub &&
              (githubUrl ? (
                <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                  <Badge variant="success">GitHub ↗</Badge>
                </a>
              ) : (
                <Badge variant="success">GitHub</Badge>
              ))}
          </div>
        )}

        <div className="text-[12px] text-[#8b949e]">Güncellendi: {formatRelativeDate(lastModified)}</div>
      </div>

      <div className="p-4 border-t border-[#30363d] flex flex-wrap gap-2">
        {isHidden ? (
          <Button variant="secondary" size="sm" onClick={() => onAction(id, "show")} disabled={busy}>
            {busyAction === "show" ? "Gösteriliyor..." : "Göster"}
          </Button>
        ) : (
          <>
            <Button variant="secondary" size="sm" onClick={() => onAction(id, "hide")} disabled={busy}>
              {busyAction === "hide" ? "Gizleniyor..." : "Gizle"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onAction(id, "github")} disabled={busy}>
              {busyAction === "github" ? "Yükleniyor..." : isOnGithub ? "GitHub'ı Güncelle" : "GitHub'a Yükle"}
            </Button>
            <Button variant="primary" size="sm" onClick={() => onAction(id, "readme")} disabled={busy}>
              {busyAction === "readme" ? "Oluşturuluyor..." : hasReadme ? "README Yenile" : "README Oluştur"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
