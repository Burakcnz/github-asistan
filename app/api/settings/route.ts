import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureUser, getAppSetting, refreshGithubProfile, setAppSetting, setGithubLogin } from "@/lib/shared";
import { isReadmeLang } from "@/lib/readme/i18n";
import { isTemplateId, normalizeTemplateId } from "@/lib/readme/build";
import { validateToken } from "@/lib/github";

export async function GET() {
  try {
    const user = await ensureUser();

    const readmeLanguage = await getAppSetting(user.id, "readmeLanguage");
    const readmeStyle = normalizeTemplateId(await getAppSetting(user.id, "readmeStyle")) ?? "modern";
    return NextResponse.json({
      hasGithubToken: !!user.githubToken,
      ollamaModel: user.ollamaModel,
      workspacePath: user.workspacePath,
      readmeLanguage: isReadmeLang(readmeLanguage) ? readmeLanguage : "tr",
      readmeStyle,
    });
  } catch {
    return NextResponse.json({ error: "Ayarlar okunamadı" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const key = body.key as string | undefined;
    const value = typeof body.value === "string" ? body.value.trim() : "";
    const user = await ensureUser();

    if (key === "githubToken") {
      if (!value) {
        return NextResponse.json({ error: "Token boş olamaz" }, { status: 400 });
      }
      const githubUser = await validateToken(value);
      if (!githubUser) {
        return NextResponse.json({ error: "Token geçersiz veya yetkisiz" }, { status: 400 });
      }
      await db.user.update({
        where: { id: user.id },
        data: { githubToken: value, name: githubUser.name || githubUser.login, avatarUrl: githubUser.avatar_url },
      });
      await setGithubLogin(user.id, githubUser.login);
      await refreshGithubProfile(user.id, value);
      return NextResponse.json({ success: true, user: githubUser });
    }

    if (key === "ollamaModel") {
      if (!value) {
        return NextResponse.json({ error: "Model adı boş olamaz" }, { status: 400 });
      }
      await db.user.update({ where: { id: user.id }, data: { ollamaModel: value } });
      return NextResponse.json({ success: true });
    }

    if (key === "readmeStyle") {
      if (!isTemplateId(value)) {
        return NextResponse.json({ error: "Geçersiz görünüm" }, { status: 400 });
      }
      await setAppSetting(user.id, "readmeStyle", value);
      return NextResponse.json({ success: true });
    }

    if (key === "readmeLanguage") {
      if (!isReadmeLang(value)) {
        return NextResponse.json({ error: "Geçersiz dil" }, { status: 400 });
      }
      await setAppSetting(user.id, "readmeLanguage", value);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Bilinmeyen ayar" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ayar kaydedilemedi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("key") !== "githubToken") {
      return NextResponse.json({ error: "Bilinmeyen ayar" }, { status: 400 });
    }
    const user = await ensureUser();
    await db.user.update({ where: { id: user.id }, data: { githubToken: null } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Token kaldırılamadı" }, { status: 500 });
  }
}
