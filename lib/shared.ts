import { db } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/env";
import { fetchGithubProfile, type GitHubProfile } from "@/lib/github";
import fs from "fs";
import path from "path";

export interface ProjectInfo {
  name: string;
  path: string;
  type: string;
  hasGit: boolean;
  hasReadme: boolean;
  fileCount: number;
  totalSize: number;
  lastModified: Date;
  dependencies: string[];
  devDependencies: string[];
  frameworks: string[];
  envVars: string[];
  mainFile: string | null;
}

export async function ensureUser() {
  let user = await db.user.findUnique({ where: { githubId: DEFAULT_USER_ID } });
  if (!user) {
    user = await db.user.create({
      data: {
        githubId: DEFAULT_USER_ID,
        name: "Local User",
      },
    });
  }
  return user;
}

export async function getAppSetting(userId: string, key: string): Promise<string | null> {
  const row = await db.appSettings.findUnique({ where: { userId_key: { userId, key } } });
  return row?.value ?? null;
}

export async function setAppSetting(userId: string, key: string, value: string) {
  await db.appSettings.upsert({
    where: { userId_key: { userId, key } },
    create: { userId, key, value },
    update: { value },
  });
}

export const setGithubLogin = (userId: string, login: string) => setAppSetting(userId, "githubLogin", login);

/** Profili GitHub'dan çekip saklar; hata olursa sessizce geçer. */
export async function refreshGithubProfile(userId: string, token: string): Promise<GitHubProfile | null> {
  try {
    const profile = await fetchGithubProfile(token);
    await setAppSetting(userId, "githubProfile", JSON.stringify(profile));
    return profile;
  } catch {
    return null;
  }
}

export async function getGithubProfile(userId: string): Promise<GitHubProfile | null> {
  const raw = await getAppSetting(userId, "githubProfile");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GitHubProfile;
  } catch {
    return null;
  }
}
export const getGithubLogin = (userId: string) => getAppSetting(userId, "githubLogin");

export function parseGithubRepoUrl(url: string | null): { owner: string; repo: string } | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const [owner, repo] = parsed.pathname.split("/").filter(Boolean);
    if (!owner || !repo) return null;
    return { owner, repo };
  } catch {
    return null;
  }
}

export function getRunCommand(type: string): string {
  const commands: Record<string, string> = {
    nodejs: "npm run dev",
    python: "python main.py",
    dotnet: "dotnet run",
    rust: "cargo run",
    go: "go run .",
  };
  return commands[type] || "# Çalıştırma komutu bulunamadı";
}

export function inferProjectPurpose(
  name: string,
  dependencies: string[],
  frameworks: string[],
  envVars: string[],
  type: string
): string {
  const depSet = new Set([...dependencies, ...frameworks].map(d => d.toLowerCase()));

  if (depSet.has("discord.js") || depSet.has("discord.py") || depSet.has("eris") || depSet.has("discordgo")) {
    return "discord-bot";
  }
  if (depSet.has("telegraf") || depSet.has("node-telegram-bot-api") || depSet.has("python-telegram-bot") || depSet.has("telebot")) {
    return "telegram-bot";
  }
  if (depSet.has("express") || depSet.has("fastify") || depSet.has("koa") || depSet.has("hapi")) {
    return "api-server";
  }
  if (depSet.has("next") || name.includes("next") || frameworks.includes("Next.js")) {
    return "web-app";
  }
  if (depSet.has("react") || depSet.has("vue") || depSet.has("svelte") || depSet.has("angular")) {
    return "frontend";
  }
  if (depSet.has("discord") || depSet.has("discord.js")) {
    return "discord-bot";
  }
  if (depSet.has("axios") || depSet.has("node-fetch") || depSet.has("got")) {
    return "api-client";
  }
  if (depSet.has("three") || depSet.has("babylonjs") || depSet.has("p5")) {
    return "graphics";
  }
  if (depSet.has("electron") || depSet.has("tauri") || depSet.has("nw.js")) {
    return "desktop-app";
  }
  if (depSet.has("typeorm") || depSet.has("prisma") || depSet.has("sequelize") || depSet.has("mongoose") || depSet.has("knex")) {
    return "database-app";
  }
  if (type === "python") {
    if (depSet.has("flask") || depSet.has("django") || depSet.has("fastapi")) return "api-server";
    if (depSet.has("pandas") || depSet.has("numpy") || depSet.has("matplotlib")) return "data-science";
    if (depSet.has("pygame") || depSet.has("pyglet")) return "game";
    if (depSet.has("opencv-python") || depSet.has("pillow")) return "image-processing";
    if (depSet.has("beautifulsoup4") || depSet.has("scrapy") || depSet.has("selenium")) return "web-scraper";
    if (depSet.has("discord.py")) return "discord-bot";
    if (depSet.has("telebot") || depSet.has("python-telegram-bot")) return "telegram-bot";
  }
  if (type === "dotnet") {
    if (depSet.has("microsoft.aspnetcore")) return "api-server";
    if (depSet.has("microsoft.entityframeworkcore")) return "database-app";
  }
  if (type === "rust") return "cli-tool";
  if (type === "go") return "cli-tool";

  return "general";
}

export async function getProjectInfo(projectId: string): Promise<ProjectInfo | null> {
  try {
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) return null;

    const dependencies: string[] = [];
    const devDependencies: string[] = [];
    const frameworks: string[] = [];
    const envVars: string[] = [];

    const pkgPath = path.join(project.localPath, "package.json");
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      dependencies.push(...Object.keys(pkg.dependencies || {}));
      devDependencies.push(...Object.keys(pkg.devDependencies || {}));

      const allDeps = [...dependencies, ...devDependencies];
      if (allDeps.includes("next") || allDeps.includes("next/dist/server")) frameworks.push("Next.js");
      if (allDeps.includes("react") || allDeps.includes("react-dom")) frameworks.push("React");
      if (allDeps.includes("vue") || allDeps.includes("nuxt")) frameworks.push("Vue.js");
      if (allDeps.includes("express")) frameworks.push("Express.js");
      if (allDeps.includes("fastify")) frameworks.push("Fastify");
      if (allDeps.includes("typeorm")) frameworks.push("TypeORM");
      if (allDeps.includes("prisma")) frameworks.push("Prisma");
      if (allDeps.includes("discord.js")) frameworks.push("Discord.js");
      if (allDeps.includes("telegraf")) frameworks.push("Telegraf");
    } catch {}

    const envPath = path.join(project.localPath, ".env");
    try {
      const envContent = fs.readFileSync(envPath, "utf-8");
      const vars = envContent.split("\n")
        .map(l => l.trim())
        .filter(l => l && !l.startsWith("#"))
        .map(l => l.split("=")[0].trim());
      envVars.push(...vars);
    } catch {}

    let mainFile: string | null = null;
    const searchFiles = ["index.ts", "index.js", "main.ts", "main.py", "app.ts", "app.js", "Program.cs", "main.go", "main.rs"];
    for (const file of searchFiles) {
      if (fs.existsSync(path.join(project.localPath, file))) {
        mainFile = file;
        break;
      }
    }

    return {
      name: project.name,
      path: project.localPath,
      type: project.type,
      hasGit: project.hasGit,
      hasReadme: project.hasReadme,
      fileCount: project.fileCount,
      totalSize: project.totalSize,
      lastModified: project.lastModified,
      dependencies,
      devDependencies,
      frameworks,
      envVars,
      mainFile,
    };
  } catch {
    return null;
  }
}