// README içeriği için dil metinleri. İstemci ve sunucuda kullanılır (fs yok).

export type ReadmeLang = "tr" | "en";

export const README_LANGS: { value: ReadmeLang; label: string }[] = [
  { value: "tr", label: "Türkçe" },
  { value: "en", label: "English" },
];

export function isReadmeLang(value: unknown): value is ReadmeLang {
  return value === "tr" || value === "en";
}

interface Strings {
  headings: {
    features: string;
    techstack: string;
    installation: string;
    usage: string;
    structure: string;
    contributing: string;
    license: string;
    stats: string;
    screenshots: string;
    toc: string;
    author: string;
    architecture: string;
    api: string;
    config: string;
    docs: string;
  };
  table: {
    component: string;
    role: string;
    method: string;
    path: string;
    description: string;
    variable: string;
    defaultValue: string;
  };
  embeddedNote: (list: string) => string;
  apiCount: (n: number) => string;
  configIntro: string;
  docsIntro: string;
  starCta: string;
  prerequisites: string;
  envTitle: string;
  envIntro: string;
  envVariable: string;
  envDescription: string;
  runsAt: (url: string) => string;
  orLauncher: (file: string) => string;
  unityUsage: string;
  webUsage: string;
  contributingIntro: string;
  contributingSteps: string[];
  licenseText: (license: string) => string;
  licenseFile: string;
  steps: {
    clone: string;
    install: string;
    venv: string;
    activate: string;
    build: string;
    db: string;
    env: string;
  };
}

export const STRINGS: Record<ReadmeLang, Strings> = {
  tr: {
    headings: {
      features: "✨ Özellikler",
      techstack: "🛠️ Teknolojiler",
      installation: "📦 Kurulum",
      usage: "🚀 Kullanım",
      structure: "📁 Proje Yapısı",
      contributing: "🤝 Katkıda Bulunma",
      license: "📄 Lisans",
      stats: "📊 İstatistikler",
      screenshots: "🖼️ Ekran Görüntüleri",
      toc: "📋 İçindekiler",
      author: "👤 Geliştirici",
      architecture: "⚙️ Nasıl Çalışır",
      api: "🔌 API Referansı",
      config: "🔧 Yapılandırma",
      docs: "📚 Dokümantasyon",
    },
    table: { component: "Bileşen", role: "Görev", method: "Yöntem", path: "Yol", description: "Açıklama", variable: "Değişken", defaultValue: "Varsayılan" },
    embeddedNote: (list) => `Gömülü bileşenler: ${list} (üçüncü taraf, kendi kurulum adımları vardır).`,
    apiCount: (n) => `Toplam **${n}** uç nokta.`,
    configIntro: "Ayarlar ortam değişkenleriyle yapılır (`.env` dosyası veya sistem ortamı):",
    docsIntro: "Projedeki ayrıntılı rehberler:",
    starCta: "⭐ Projeyi beğendiyseniz yıldız vermeyi unutmayın!",
    prerequisites: "Gereksinimler",
    envTitle: "⚙️ Ortam Değişkenleri",
    envIntro: "`.env.example` dosyasını `.env` olarak kopyalayıp değerleri doldurun:",
    envVariable: "Değişken",
    envDescription: "Açıklama",
    runsAt: (url) => `Uygulama varsayılan olarak <${url}> adresinde açılır.`,
    orLauncher: (file) => `Windows'ta \`${file}\` dosyasına çift tıklayarak da başlatabilirsiniz.`,
    unityUsage: "Unity Hub'da **Add → Add project from disk** ile proje klasörünü açın, ardından ana sahneyi açıp **Play**'e basın.",
    webUsage: "`index.html` dosyasını tarayıcıda açın veya bir statik sunucu ile yayınlayın (ör. `npx serve .`).",
    contributingIntro: "Katkılarınızı bekliyoruz! Şu adımları izleyin:",
    contributingSteps: [
      "Repoyu fork'layın",
      "Yeni bir dal oluşturun (`git checkout -b ozellik/yeni-ozellik`)",
      "Değişikliklerinizi commit'leyin (`git commit -m 'Yeni özellik ekle'`)",
      "Dalınızı push'layın (`git push origin ozellik/yeni-ozellik`)",
      "Bir Pull Request açın",
    ],
    licenseText: (license) => `Bu proje **${license}** lisansı ile lisanslanmıştır.`,
    licenseFile: "Ayrıntılar için [LICENSE](LICENSE) dosyasına bakın.",
    steps: {
      clone: "Repoyu klonlayın",
      install: "Bağımlılıkları yükleyin",
      venv: "Sanal ortam oluşturun",
      activate: "Sanal ortamı etkinleştirin (macOS/Linux: source .venv/bin/activate)",
      build: "Derleyin",
      db: "Veritabanını hazırlayın",
      env: "Ortam değişkenlerini ayarlayın",
    },
  },
  en: {
    headings: {
      features: "✨ Features",
      techstack: "🛠️ Tech Stack",
      installation: "📦 Installation",
      usage: "🚀 Usage",
      structure: "📁 Project Structure",
      contributing: "🤝 Contributing",
      license: "📄 License",
      stats: "📊 Stats",
      screenshots: "🖼️ Screenshots",
      toc: "📋 Table of Contents",
      author: "👤 Author",
      architecture: "⚙️ How It Works",
      api: "🔌 API Reference",
      config: "🔧 Configuration",
      docs: "📚 Documentation",
    },
    table: { component: "Component", role: "Role", method: "Method", path: "Path", description: "Description", variable: "Variable", defaultValue: "Default" },
    embeddedNote: (list) => `Embedded components: ${list} (third-party, with their own setup steps).`,
    apiCount: (n) => `**${n}** endpoints in total.`,
    configIntro: "Configuration is done through environment variables (`.env` file or system environment):",
    docsIntro: "Detailed guides in the repository:",
    starCta: "⭐ If you like this project, please give it a star!",
    prerequisites: "Prerequisites",
    envTitle: "⚙️ Environment Variables",
    envIntro: "Copy `.env.example` to `.env` and fill in the values:",
    envVariable: "Variable",
    envDescription: "Description",
    runsAt: (url) => `The app runs at <${url}> by default.`,
    orLauncher: (file) => `On Windows you can also double-click \`${file}\` to start it.`,
    unityUsage: "Open the folder in Unity Hub via **Add → Add project from disk**, open the main scene and press **Play**.",
    webUsage: "Open `index.html` in your browser or serve the folder with any static server (e.g. `npx serve .`).",
    contributingIntro: "Contributions are welcome! Please follow these steps:",
    contributingSteps: [
      "Fork the repository",
      "Create a feature branch (`git checkout -b feature/amazing-feature`)",
      "Commit your changes (`git commit -m 'Add amazing feature'`)",
      "Push to the branch (`git push origin feature/amazing-feature`)",
      "Open a Pull Request",
    ],
    licenseText: (license) => `This project is licensed under the **${license}** license.`,
    licenseFile: "See the [LICENSE](LICENSE) file for details.",
    steps: {
      clone: "Clone the repository",
      install: "Install dependencies",
      venv: "Create a virtual environment",
      activate: "Activate it (macOS/Linux: source .venv/bin/activate)",
      build: "Build",
      db: "Set up the database",
      env: "Configure environment variables",
    },
  },
};
