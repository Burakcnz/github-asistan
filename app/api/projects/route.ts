import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { scanFolder } from "@/lib/folder-scanner";
import { checkRepoExists } from "@/lib/github";
import { ensureUser, parseGithubRepoUrl } from "@/lib/shared";

// Aynı anda gelen istekler tek bir DB senkronizasyonunu paylaşır (unique constraint yarışını önler).
let syncInflight: Promise<void> | null = null;

function isInside(child: string, root: string) {
  const rel = path.relative(path.resolve(root), path.resolve(child));
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

async function syncProjects(userId: string, workspacePath: string, forceRefresh: boolean) {
  const scanned = await scanFolder(workspacePath, forceRefresh);
  const existing = await db.project.findMany({
    where: { userId },
    include: { readme: { select: { id: true } } },
  });
  const byPath = new Map(existing.map((p) => [p.localPath, p]));
  const scannedPaths = new Set(scanned.map((p) => p.path));

  const ops = [];
  for (const s of scanned) {
    const current = byPath.get(s.path);
    const data = {
      name: s.name,
      type: s.type,
      fileCount: s.fileCount,
      totalSize: s.totalSize,
      lastModified: s.lastModified,
      hasGit: s.hasGit,
      hasReadme: s.hasReadme || !!current?.readme,
    };
    if (current) {
      ops.push(db.project.update({ where: { id: current.id }, data }));
    } else {
      ops.push(db.project.create({ data: { ...data, localPath: s.path, userId } }));
    }
  }

  // Taramada bulunmayan projeleri kaldır. Kaydedilmiş README'si olan ve klasörü hâlâ
  // çalışma alanında duran projeler korunur (yazılan README kaybolmasın).
  for (const p of existing) {
    if (scannedPaths.has(p.localPath)) continue;
    const keep = !!p.readme && isInside(p.localPath, workspacePath) && fs.existsSync(p.localPath);
    if (!keep) ops.push(db.project.delete({ where: { id: p.id } }));
  }

  if (ops.length > 0) await db.$transaction(ops);
}

async function verifyGithubRepos(userId: string, token: string) {
  const githubProjects = await db.project.findMany({
    where: { userId, isOnGithub: true, githubUrl: { not: null } },
  });
  await Promise.all(
    githubProjects.map(async (p) => {
      const parsed = parseGithubRepoUrl(p.githubUrl);
      if (!parsed) return;
      try {
        const exists = await checkRepoExists(token, parsed.owner, parsed.repo);
        if (!exists) {
          await db.project.update({
            where: { id: p.id },
            data: { isOnGithub: false, githubUrl: null, githubRepoId: null },
          });
        }
      } catch {
        // Ağ hatası: durumu değiştirme
      }
    })
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hidden = searchParams.get("hidden");
    const forceRefresh = searchParams.get("forceRefresh") === "true";
    const user = await ensureUser();

    if (!user.workspacePath) {
      return NextResponse.json({ projects: [], needsWorkspace: true, workspacePath: null });
    }

    if (!fs.existsSync(user.workspacePath)) {
      return NextResponse.json(
        { error: `Çalışma alanı bulunamadı: ${user.workspacePath}. Ayarlar'dan güncelleyin.`, needsWorkspace: true },
        { status: 400 }
      );
    }

    if (!syncInflight || forceRefresh) {
      const run: Promise<void> = syncProjects(user.id, user.workspacePath, forceRefresh).finally(() => {
        if (syncInflight === run) syncInflight = null;
      });
      syncInflight = run;
    }
    await syncInflight;

    if (forceRefresh && user.githubToken) {
      await verifyGithubRepos(user.id, user.githubToken);
    }

    const projects = await db.project.findMany({
      where: {
        userId: user.id,
        ...(hidden === "true" ? { isHidden: true } : hidden === "false" ? { isHidden: false } : {}),
      },
      orderBy: { lastModified: "desc" },
      include: { readme: { select: { id: true } } },
    });

    return NextResponse.json({
      workspacePath: user.workspacePath,
      projects: projects.map(({ readme, ...p }) => ({ ...p, hasReadme: p.hasReadme || !!readme })),
    });
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json({ error: "Projeler yüklenemedi" }, { status: 500 });
  }
}
