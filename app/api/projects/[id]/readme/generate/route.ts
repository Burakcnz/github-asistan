import { NextResponse } from "next/server";
import fs from "fs";
import { db } from "@/lib/db";
import { getAppSetting, getGithubLogin, getGithubProfile, parseGithubRepoUrl, refreshGithubProfile } from "@/lib/shared";
import { normalizeRepoName, prettyTitle } from "@/lib/repo-name";
import { renderAllBlocks } from "@/lib/readme-renderer";
import { analyzeForReadme } from "@/lib/readme/analyze";
import { generateReadmeWithAi, listOllamaModels, pickModel, type AiReadmeContent } from "@/lib/readme/ai";
import { buildReadmeBlocks, normalizeTemplateId } from "@/lib/readme/build";
import { isReadmeDetail, runDetailedAnalysis, type DetailedResult, type ProgressEvent, type ReadmeDetail } from "@/lib/readme/detailed";
import { isReadmeLang, type ReadmeLang } from "@/lib/readme/i18n";
import { getSystemInfo, recommendModel } from "@/lib/ollama";
import type { ProjectType } from "@/lib/folder-scanner";

class GenerateError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function generate(id: string, body: Record<string, unknown>, onProgress: (e: ProgressEvent) => void) {
  const project = await db.project.findUnique({
    where: { id },
    include: { user: { select: { ollamaModel: true, githubToken: true } } },
  });
  if (!project) throw new GenerateError("Proje bulunamadı", 404);
  if (!fs.existsSync(project.localPath)) throw new GenerateError(`Proje klasörü bulunamadı: ${project.localPath}`, 404);

  const savedLang = await getAppSetting(project.userId, "readmeLanguage");
  const lang: ReadmeLang = isReadmeLang(body.lang) ? body.lang : isReadmeLang(savedLang) ? savedLang : "tr";
  const template =
    normalizeTemplateId(body.template) ?? normalizeTemplateId(await getAppSetting(project.userId, "readmeStyle")) ?? "modern";
  const savedDetail = await getAppSetting(project.userId, "readmeDetail");
  const detail: ReadmeDetail = isReadmeDetail(body.detail) ? body.detail : isReadmeDetail(savedDetail) ? savedDetail : "detailed";
  const useAi = body.useAi !== false;

  onProgress({ stage: "scan", message: "Proje dosyaları analiz ediliyor", current: 0, total: 1 });
  const facts = await analyzeForReadme(project.localPath, project.type as ProjectType, project.name);

  // Klon URL'i: bağlı GitHub reposu > kullanıcının seçtiği ad > git remote > klasör adından türetilen ad.
  const linked = parseGithubRepoUrl(project.githubUrl);
  const login = await getGithubLogin(project.userId);
  const repoOwner = linked?.owner ?? (project.repoName ? login : null) ?? facts.repo?.owner ?? login;
  const repoName = linked?.repo ?? project.repoName ?? facts.repo?.name ?? normalizeRepoName(project.name);
  const title = project.displayName || prettyTitle(project.name) || project.name;

  let profile = await getGithubProfile(project.userId);
  if (!profile && project.user.githubToken) profile = await refreshGithubProfile(project.userId, project.user.githubToken);

  const warnings: string[] = [];
  if (!linked && !project.repoName && facts.repo) {
    const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
    const a = norm(facts.repo.name);
    const b = norm(project.name);
    if (!a.includes(b.slice(0, 6)) && !b.includes(a.slice(0, 6))) {
      warnings.push(`Klasörün git remote'u (${facts.repo.owner}/${facts.repo.name}) proje adıyla uyuşmuyor; klon adresini kontrol edin`);
    }
  }

  let model: string | null = null;
  if (useAi) {
    const [installed, systemInfo] = await Promise.all([listOllamaModels(), getSystemInfo()]);
    model = pickModel(installed, project.user.ollamaModel, recommendModel(systemInfo));
    if (!model) warnings.push("Ollama çalışmıyor veya kurulu model yok; içerik yalnızca kod analiziyle oluşturuldu");
  }

  let ai: AiReadmeContent | null = null;
  let detailed: DetailedResult | null = null;
  if (detail === "short") {
    if (model) {
      onProgress({ stage: "synthesis", message: "README metni yazılıyor", current: 0, total: 1 });
      const result = await generateReadmeWithAi(model, facts, lang);
      if (result.ok) ai = result.content;
      else warnings.push(result.reason);
    }
  } else {
    detailed = await runDetailedAnalysis({
      root: project.localPath,
      projectId: project.id,
      userId: project.userId,
      projectName: title,
      model,
      lang,
      detail,
      existingReadme: facts.existingReadme,
      onProgress,
    });
    warnings.push(...detailed.warnings);
  }

  onProgress({ stage: "build", message: "README oluşturuluyor", current: 1, total: 1 });
  const blocks = buildReadmeBlocks(facts, ai, {
    lang,
    template,
    title,
    repoOwner,
    repoName,
    isOnGithub: project.isOnGithub || (!!facts.repo && facts.repo.name === repoName),
    profile,
    detailed,
  });
  const content = renderAllBlocks(blocks, lang);
  const usedAi = !!ai || !!(model && detailed?.content && (detailed.content.overview || Object.keys(detailed.groupSummaries).length));
  const tagline = detailed?.content?.tagline || ai?.tagline || "";
  const result = {
    content,
    blocks,
    source: usedAi ? "ai" : "analysis",
    model: usedAi ? model : null,
    lang,
    template,
    detail,
    warning: warnings.length > 0 ? warnings.join(" · ") : null,
  };

  if (body.dryRun === true) return { ...result, dryRun: true };

  const readme = await db.readme.upsert({
    where: { projectId: id },
    create: { projectId: id, content, blocks: JSON.stringify(blocks) },
    update: { content, blocks: JSON.stringify(blocks), version: { increment: 1 }, pushedToGithub: false },
  });
  await db.project.update({
    where: { id },
    data: { hasReadme: true, ...(tagline && !project.description ? { description: tagline } : {}) },
  });
  return { ...result, version: readme.version };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  // Akışlı mod: NDJSON ilerleme olayları + son sonuç.
  if (body.stream === true) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        try {
          const result = await generate(id, body, (e) => send({ type: "progress", ...e }));
          send({ type: "done", ...result });
        } catch (error) {
          console.error("Failed to generate README:", error);
          send({ type: "error", error: error instanceof GenerateError ? error.message : "README oluşturulamadı" });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" } });
  }

  try {
    return NextResponse.json(await generate(id, body, () => undefined));
  } catch (error) {
    if (error instanceof GenerateError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Failed to generate README:", error);
    return NextResponse.json({ error: "README oluşturulamadı" }, { status: 500 });
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const readme = await db.readme.findUnique({ where: { projectId: id } });
    return NextResponse.json(readme ? { content: readme.content, version: readme.version } : { content: null });
  } catch {
    return NextResponse.json({ error: "README okunamadı" }, { status: 500 });
  }
}
