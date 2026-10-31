"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import type { ProjectAction } from "@/components/features/ProjectCard";
import { pushProjectToGithub, useRepoNameGate } from "@/components/features/RepoNameGate";

export interface ProjectSummary {
  id: string;
  name: string;
  localPath: string;
  type: string;
  isHidden: boolean;
  isOnGithub: boolean;
  githubUrl: string | null;
  fileCount: number;
  totalSize: number;
  lastModified: string;
  hasGit: boolean;
  hasReadme: boolean;
  description: string | null;
  repoName: string | null;
  displayName: string | null;
}

interface ProjectsResponse {
  projects: ProjectSummary[];
  workspacePath: string | null;
  needsWorkspace?: boolean;
}

const AUTO_REFRESH_MS = 5 * 60 * 1000;

export function useProjects() {
  const router = useRouter();
  const toast = useToast();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, ProjectAction>>({});
  const { ensureRepoName, repoNameDialog } = useRepoNameGate();
  const busyRef = useRef(busy);
  busyRef.current = busy;

  const load = useCallback(
    async (force = false) => {
      if (force) setRefreshing(true);
      try {
        const data = await apiFetch<ProjectsResponse>(`/api/projects${force ? "?forceRefresh=true" : ""}`);
        if (data.needsWorkspace) {
          router.push("/settings?setup=1");
          return;
        }
        setProjects(data.projects);
        setWorkspacePath(data.workspacePath);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Projeler yüklenemedi");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  const runAction = useCallback(
    async (id: string, action: ProjectAction) => {
      if (busyRef.current[id]) return;
      const project = projects.find((p) => p.id === id);
      if (!project) return;

      if (action === "github") {
        const msg = project.isOnGithub
          ? `"${project.name}" GitHub reposu yerel dosyalarla güncellenecek. Devam edilsin mi?`
          : `"${project.name}" GitHub'a HERKESE AÇIK bir repo olarak yüklenecek. Devam edilsin mi?`;
        if (!window.confirm(msg)) return;
      }
      if (action === "readme" && project.hasReadme) {
        if (!window.confirm(`"${project.name}" için mevcut README yeniden oluşturulacak (düzenlemeleriniz kaybolur). Devam edilsin mi?`)) return;
      }
      if ((action === "readme" || action === "github") && !(await ensureRepoName(id))) return;

      setBusy((prev) => ({ ...prev, [id]: action }));
      try {
        if (action === "hide" || action === "show") {
          await apiFetch(`/api/projects/${id}/${action}`, { method: "PATCH" });
          setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, isHidden: action === "hide" } : p)));
          toast("success", action === "hide" ? `"${project.name}" gizlendi` : `"${project.name}" tekrar gösteriliyor`);
        } else if (action === "github") {
          const res = await pushProjectToGithub(id);
          if (!res) return;
          setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, isOnGithub: true, githubUrl: res.url } : p)));
          toast(
            "success",
            `${res.action === "created" ? "Repo oluşturuldu" : "Repo güncellendi"} (${res.fileCount} dosya)`,
            res.url
          );
        } else if (action === "readme") {
          toast("info", `"${project.name}" için README oluşturuluyor. AI ile 1-2 dk sürebilir...`);
          const res = await apiFetch<{ source: string; warning: string | null }>(`/api/projects/${id}/readme/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, hasReadme: true } : p)));
          toast("success", res.source === "ai" ? "README yapay zekâ ile oluşturuldu" : "README proje analiziyle oluşturuldu");
          if (res.warning) toast("info", res.warning);
          router.push(`/projects/${id}?tab=readme`);
        }
      } catch (err) {
        toast("error", err instanceof Error ? err.message : "İşlem başarısız");
      } finally {
        setBusy((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [projects, router, toast, ensureRepoName]
  );

  return { projects, workspacePath, loading, refreshing, error, busy, reload: load, runAction, repoNameDialog };
}
