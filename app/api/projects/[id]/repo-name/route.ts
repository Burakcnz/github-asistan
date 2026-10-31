import { NextResponse } from "next/server";
import fs from "fs";
import { db } from "@/lib/db";
import { assessRepoName, isValidRepoName, normalizeRepoName, prettyTitle } from "@/lib/repo-name";
import { analyzeForReadme } from "@/lib/readme/analyze";
import { listOllamaModels, pickModel, suggestRepoNames } from "@/lib/readme/ai";
import { checkRepoExists } from "@/lib/github";
import { getGithubLogin, parseGithubRepoUrl } from "@/lib/shared";
import { getSystemInfo, recommendModel } from "@/lib/ollama";
import type { ProjectType } from "@/lib/folder-scanner";

interface Suggestion {
  repoName: string;
  title: string;
  source: string;
}

/**
 * GET              → değerlendirme + kurala dayalı öneriler
 * GET ?ai=1        → ek olarak Ollama önerileri
 * GET ?check=<ad>  → GitHub hesabında bu adda repo var mı
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const project = await db.project.findUnique({
      where: { id },
      include: { user: { select: { githubToken: true, ollamaModel: true } } },
    });
    if (!project) return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });

    const check = searchParams.get("check");
    if (check !== null) {
      const token = project.user.githubToken;
      const login = await getGithubLogin(project.userId);
      if (!token || !login || !isValidRepoName(check)) return NextResponse.json({ exists: null });
      const linked = parseGithubRepoUrl(project.githubUrl);
      if (linked && linked.repo.toLowerCase() === check.toLowerCase()) return NextResponse.json({ exists: false, linked: true });
      try {
        const repo = await checkRepoExists(token, login, check);
        return NextResponse.json({ exists: !!repo, fullName: repo?.full_name ?? null });
      } catch {
        return NextResponse.json({ exists: null });
      }
    }

    const assessment = assessRepoName(project.name);
    const suggestions: Suggestion[] = [];
    const add = (repoName: string, title: string, source: string) => {
      if (!repoName || !isValidRepoName(repoName)) return;
      if (suggestions.some((s) => s.repoName.toLowerCase() === repoName.toLowerCase())) return;
      suggestions.push({ repoName, title: title || repoName, source });
    };

    add(assessment.repoName, assessment.title, "Klasör adı");

    if (fs.existsSync(project.localPath)) {
      const facts = await analyzeForReadme(project.localPath, project.type as ProjectType, project.name);
      if (facts.packageName) add(normalizeRepoName(facts.packageName), prettyTitle(facts.packageName), "Paket adı");
      if (facts.readmeTitle && facts.readmeTitle.length <= 50) add(normalizeRepoName(facts.readmeTitle), facts.readmeTitle, "README başlığı");
      if (facts.repo) add(facts.repo.name, prettyTitle(facts.repo.name), "Git remote");

      if (searchParams.get("ai") === "1") {
        const [installed, systemInfo] = await Promise.all([listOllamaModels(), getSystemInfo()]);
        const model = pickModel(installed, project.user.ollamaModel, recommendModel(systemInfo));
        if (!model) {
          return NextResponse.json({ error: "Ollama çalışmıyor veya kurulu model yok" }, { status: 503 });
        }
        for (const s of await suggestRepoNames(model, facts, project.name)) add(s.repoName, s.title || prettyTitle(s.repoName), "AI");
      }
    }

    return NextResponse.json({
      current: { repoName: project.repoName, displayName: project.displayName },
      folderName: project.name,
      isOnGithub: project.isOnGithub,
      linkedRepo: parseGithubRepoUrl(project.githubUrl)?.repo ?? null,
      assessment,
      suggestions,
    });
  } catch (error) {
    console.error("repo-name GET failed:", error);
    return NextResponse.json({ error: "Ad önerileri alınamadı" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const repoName = typeof body.repoName === "string" ? body.repoName.trim() : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 80) : "";

    if (!isValidRepoName(repoName)) {
      return NextResponse.json(
        { error: "Geçersiz repo adı. Yalnızca harf, rakam, nokta, tire ve alt çizgi kullanılabilir (en fazla 100 karakter)." },
        { status: 400 }
      );
    }

    const project = await db.project.findUnique({ where: { id } });
    if (!project) return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });

    const linked = parseGithubRepoUrl(project.githubUrl);
    if (project.isOnGithub && linked && linked.repo.toLowerCase() !== repoName.toLowerCase()) {
      return NextResponse.json(
        { error: `Proje zaten GitHub'da "${linked.repo}" adıyla bağlı. Adı değiştirmek için repoyu GitHub'da yeniden adlandırın.` },
        { status: 409 }
      );
    }

    const updated = await db.project.update({
      where: { id },
      data: { repoName, displayName: displayName || null },
      select: { repoName: true, displayName: true },
    });
    return NextResponse.json({ success: true, ...updated });
  } catch (error) {
    console.error("repo-name PUT failed:", error);
    return NextResponse.json({ error: "Ad kaydedilemedi" }, { status: 500 });
  }
}
