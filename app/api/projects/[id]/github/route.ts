import { NextResponse } from "next/server";
import fs from "fs";
import { db } from "@/lib/db";
import { createRepo, pushToRepo, checkRepoExists, validateToken, type GitHubRepo } from "@/lib/github";
import { collectProjectFiles } from "@/lib/project-files";
import { parseGithubRepoUrl, setGithubLogin } from "@/lib/shared";
import { normalizeRepoName, prettyTitle } from "@/lib/repo-name";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const allowExisting = body.allowExisting === true;

    const project = await db.project.findUnique({
      where: { id },
      include: { user: true, readme: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
    }
    if (!fs.existsSync(project.localPath)) {
      return NextResponse.json({ error: `Proje klasörü bulunamadı: ${project.localPath}` }, { status: 404 });
    }

    const token = project.user.githubToken;
    if (!token) {
      return NextResponse.json({ error: "GitHub token gerekli. Ayarlar'dan token girin." }, { status: 400 });
    }

    const githubUser = await validateToken(token);
    if (!githubUser) {
      return NextResponse.json(
        { error: "GitHub token geçersiz veya yetkisiz. Ayarlar'dan tokenı kontrol edin." },
        { status: 401 }
      );
    }
    await setGithubLogin(project.userId, githubUser.login);

    const repoName = project.repoName || normalizeRepoName(project.name);
    if (!repoName) {
      return NextResponse.json({ error: "Proje adı GitHub repo adı için uygun değil" }, { status: 400 });
    }

    // Dosyaları önce topla: sınır aşılırsa boşuna repo oluşturma.
    const collected = await collectProjectFiles(project.localPath);
    if (collected.error) {
      return NextResponse.json({ error: collected.error }, { status: 400 });
    }
    const files = collected.files;

    // Uygulamada üretilen README her zaman öncelikli.
    if (project.readme?.content) {
      for (let i = files.length - 1; i >= 0; i--) {
        if (files[i].path.toLowerCase() === "readme.md") files.splice(i, 1);
      }
      files.unshift({ path: "README.md", content: project.readme.content, encoding: "utf-8" });
    }

    if (files.length === 0) {
      return NextResponse.json({ error: "Proje klasöründe yüklenecek dosya bulunamadı" }, { status: 400 });
    }

    let repo: GitHubRepo | null = null;
    let isNewRepo = false;

    // Daha önce bağlandıysa repo hâlâ duruyor mu?
    const linked = parseGithubRepoUrl(project.githubUrl);
    if (project.isOnGithub && linked) {
      repo = await checkRepoExists(token, linked.owner, linked.repo);
    }

    if (!repo) {
      // Aynı adda (bu projeye bağlı olmayan) bir repo varsa, kullanıcı onaylamadan içine yükleme.
      const existing = await checkRepoExists(token, githubUser.login, repoName);
      if (existing && !allowExisting) {
        return NextResponse.json(
          {
            error: `GitHub hesabında "${existing.full_name}" adlı bir repo zaten var.`,
            repoExists: true,
            fullName: existing.full_name,
          },
          { status: 409 }
        );
      }
      if (existing) {
        repo = existing;
      } else {
        const result = await createRepo(
          token,
          repoName,
          project.description || `${project.displayName || prettyTitle(project.name)} - GitHub Asistan ile oluşturuldu`,
          false
        );
        if ("error" in result) {
          return NextResponse.json({ error: result.error }, { status: 502 });
        }
        repo = result;
        isNewRepo = true;
      }
    }

    const conflict = await db.project.findFirst({
      where: { githubRepoId: repo.id.toString(), NOT: { id } },
      select: { name: true, localPath: true },
    });
    if (conflict) {
      return NextResponse.json(
        { error: `"${repo.full_name}" reposu zaten başka bir projeye bağlı: ${conflict.localPath}` },
        { status: 409 }
      );
    }

    const owner = repo.full_name.split("/")[0];
    const commitMessage = isNewRepo
      ? "Initial commit - GitHub Asistan ile oluşturuldu"
      : "Güncelleme - GitHub Asistan ile güncellendi";

    const pushResult = await pushToRepo(
      token,
      owner,
      repo.name,
      files,
      commitMessage,
      repo.default_branch || "main"
    );

    if (!pushResult.success) {
      return NextResponse.json({ error: pushResult.error || "Dosyalar GitHub'a yüklenemedi" }, { status: 502 });
    }

    await db.project.update({
      where: { id },
      data: { isOnGithub: true, githubUrl: repo.html_url, githubRepoId: repo.id.toString(), repoName: repo.name },
    });

    if (project.readme) {
      await db.readme.update({ where: { projectId: id }, data: { pushedToGithub: true } });
    }

    return NextResponse.json({
      success: true,
      action: isNewRepo ? "created" : "updated",
      url: repo.html_url,
      fileCount: files.length,
      skipped: collected.skipped,
    });
  } catch (error) {
    console.error("GitHub connection error:", error);
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    return NextResponse.json({ error: `GitHub bağlantı hatası: ${message}` }, { status: 500 });
  }
}
