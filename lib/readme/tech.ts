// Bağımlılık adı → teknoloji bilgisi (rozet + ikon). İstemci/sunucu ortak.

export interface TechInfo {
  name: string;
  /** shields.io logo adı (simpleicons). */
  logo: string;
  color: string;
  /** lib/tech-icons.ts anahtarı (varsa). */
  icon?: string;
}

const T = (name: string, logo: string, color: string, icon?: string): TechInfo => ({ name, logo, color, icon });

export const TECH_BY_DEP: Record<string, TechInfo> = {
  // JS framework / kütüphaneler
  next: T("Next.js", "nextdotjs", "000000", "nextjs"),
  react: T("React", "react", "20232A", "react"),
  vue: T("Vue.js", "vuedotjs", "4FC08D", "vuejs"),
  nuxt: T("Nuxt", "nuxtdotjs", "00DC82", "nuxtjs"),
  svelte: T("Svelte", "svelte", "FF3E00", "svelte"),
  "@sveltejs/kit": T("SvelteKit", "svelte", "FF3E00", "svelte"),
  "@angular/core": T("Angular", "angular", "DD0031", "angularjs"),
  astro: T("Astro", "astro", "BC52EE"),
  "solid-js": T("Solid", "solid", "2C4F7C"),
  express: T("Express", "express", "000000", "express"),
  fastify: T("Fastify", "fastify", "000000"),
  koa: T("Koa", "koa", "33333D"),
  hono: T("Hono", "hono", "E36002"),
  "@nestjs/core": T("NestJS", "nestjs", "E0234E", "nestjs"),
  electron: T("Electron", "electron", "47848F", "electron"),
  "@tauri-apps/api": T("Tauri", "tauri", "24C8DB"),
  "react-native": T("React Native", "react", "20232A", "react"),
  expo: T("Expo", "expo", "000020"),
  three: T("Three.js", "threedotjs", "000000", "threejs"),
  phaser: T("Phaser", "phaser", "8A2BE2"),
  vite: T("Vite", "vite", "646CFF", "vite"),
  webpack: T("Webpack", "webpack", "8DD6F9", "webpack"),
  tailwindcss: T("Tailwind CSS", "tailwindcss", "06B6D4", "tailwindcss"),
  typescript: T("TypeScript", "typescript", "3178C6", "typescript"),
  prisma: T("Prisma", "prisma", "2D3748", "prisma"),
  "@prisma/client": T("Prisma", "prisma", "2D3748", "prisma"),
  "drizzle-orm": T("Drizzle", "drizzle", "C5F74F"),
  mongoose: T("MongoDB", "mongodb", "47A248", "mongodb"),
  mongodb: T("MongoDB", "mongodb", "47A248", "mongodb"),
  pg: T("PostgreSQL", "postgresql", "4169E1", "postgresql"),
  mysql2: T("MySQL", "mysql", "4479A1", "mysql"),
  "better-sqlite3": T("SQLite", "sqlite", "003B57", "sqlite"),
  sqlite3: T("SQLite", "sqlite", "003B57", "sqlite"),
  redis: T("Redis", "redis", "DC382D", "redis"),
  ioredis: T("Redis", "redis", "DC382D", "redis"),
  graphql: T("GraphQL", "graphql", "E10098", "graphql"),
  "socket.io": T("Socket.IO", "socketdotio", "010101"),
  firebase: T("Firebase", "firebase", "FFCA28", "firebase"),
  "@supabase/supabase-js": T("Supabase", "supabase", "3FCF8E"),
  stripe: T("Stripe", "stripe", "008CDD"),
  "discord.js": T("Discord.js", "discord", "5865F2"),
  telegraf: T("Telegraf", "telegram", "26A5E4"),
  "node-telegram-bot-api": T("Telegram Bot API", "telegram", "26A5E4"),
  openai: T("OpenAI", "openai", "412991"),
  "@anthropic-ai/sdk": T("Anthropic", "anthropic", "191919"),
  ollama: T("Ollama", "ollama", "000000"),
  langchain: T("LangChain", "langchain", "1C3C3C"),
  puppeteer: T("Puppeteer", "puppeteer", "40B5A4"),
  playwright: T("Playwright", "playwright", "2EAD33"),
  jest: T("Jest", "jest", "C21325", "jest"),
  vitest: T("Vitest", "vitest", "6E9F18"),
  "@octokit/rest": T("Octokit", "github", "181717", "github"),
  // Python
  fastapi: T("FastAPI", "fastapi", "009688", "fastapi"),
  flask: T("Flask", "flask", "000000", "flask"),
  django: T("Django", "django", "092E20", "django"),
  streamlit: T("Streamlit", "streamlit", "FF4B4B"),
  gradio: T("Gradio", "gradio", "F97316"),
  uvicorn: T("Uvicorn", "gunicorn", "499848"),
  torch: T("PyTorch", "pytorch", "EE4C2C", "pytorch"),
  tensorflow: T("TensorFlow", "tensorflow", "FF6F00", "tensorflow"),
  transformers: T("Transformers", "huggingface", "FFD21E"),
  numpy: T("NumPy", "numpy", "013243"),
  pandas: T("pandas", "pandas", "150458"),
  "scikit-learn": T("scikit-learn", "scikitlearn", "F7931E"),
  matplotlib: T("Matplotlib", "plotly", "11557C"),
  "opencv-python": T("OpenCV", "opencv", "5C3EE8"),
  pillow: T("Pillow", "python", "3776AB"),
  pygame: T("Pygame", "python", "3776AB"),
  pyqt5: T("PyQt", "qt", "41CD52"),
  pyqt6: T("PyQt", "qt", "41CD52"),
  pyside6: T("PySide", "qt", "41CD52"),
  customtkinter: T("CustomTkinter", "python", "3776AB"),
  selenium: T("Selenium", "selenium", "43B02A"),
  beautifulsoup4: T("Beautiful Soup", "python", "3776AB"),
  scrapy: T("Scrapy", "scrapy", "60A839"),
  requests: T("Requests", "python", "3776AB"),
  aiohttp: T("aiohttp", "aiohttp", "2C5BB4"),
  "discord.py": T("discord.py", "discord", "5865F2"),
  "python-telegram-bot": T("python-telegram-bot", "telegram", "26A5E4"),
  sqlalchemy: T("SQLAlchemy", "sqlalchemy", "D71F00"),
  pydantic: T("Pydantic", "pydantic", "E92063"),
  "yt-dlp": T("yt-dlp", "youtube", "FF0000"),
  // Diğer
  forge: T("Minecraft Forge", "curseforge", "F16436"),
  fabric: T("Fabric", "modrinth", "DBD0B4"),
  "com.unity.render-pipelines.universal": T("URP", "unity", "000000"),
};

export const LANGUAGE_TECH: Record<string, TechInfo> = {
  nodejs: T("Node.js", "nodedotjs", "339933", "nodejs"),
  javascript: T("JavaScript", "javascript", "F7DF1E", "javascript"),
  python: T("Python", "python", "3776AB", "python"),
  dotnet: T(".NET", "dotnet", "512BD4", "csharp"),
  csharp: T("C#", "dotnet", "512BD4", "csharp"),
  rust: T("Rust", "rust", "000000", "rust"),
  go: T("Go", "go", "00ADD8", "go"),
  java: T("Java", "openjdk", "ED8B00", "java"),
  unity: T("Unity", "unity", "000000", "unity"),
  web: T("HTML5", "html5", "E34F26", "html"),
  docker: T("Docker", "docker", "2496ED", "docker"),
};

export function badgeUrl(t: TechInfo, style: string = "for-the-badge"): string {
  const label = encodeURIComponent(t.name.replace(/-/g, "--").replace(/_/g, "__"));
  const logoColor = ["F7DF1E", "FFCA28", "FFD21E", "C5F74F", "8DD6F9"].includes(t.color) ? "black" : "white";
  return `https://img.shields.io/badge/${label}-${t.color}?style=${style}&logo=${t.logo}&logoColor=${logoColor}`;
}
