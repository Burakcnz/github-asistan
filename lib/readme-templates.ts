import { createBlock, type ReadmeBlock } from "./readme-blocks";
import type { ReadmeLang } from "./readme/i18n";

/**
 * GitHub profil README'si için boş iskelet. Proje README şablonları ("Detaylı", "Sade")
 * proje analizinden üretilir (bkz. lib/readme/build.ts).
 */
export function getProfileTemplateBlocks(lang: ReadmeLang, username = ""): ReadmeBlock[] {
  const about =
    lang === "tr"
      ? "- 🔭 Şu an üzerinde çalıştığım proje: ...\n- 🌱 Öğrendiğim konular: ...\n- 💬 Bana şunları sorabilirsiniz: ...\n- 📫 Bana ulaşın: ..."
      : "- 🔭 I'm currently working on ...\n- 🌱 I'm currently learning ...\n- 💬 Ask me about ...\n- 📫 How to reach me: ...";
  return [
    createBlock("capsule-header", 0, { text: username, fontSize: 50 }, lang),
    createBlock("custom", 1, { title: lang === "tr" ? "👋 Merhaba!" : "👋 Hi there!", content: about }, lang),
    createBlock("tech-icons", 2, { icons: [] }, lang),
    createBlock("stats-cards", 3, { username }, lang),
  ];
}
