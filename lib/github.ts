import dns from "node:dns";
import https from "node:https";
import { Octokit } from "@octokit/rest";

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  created_at: string | null;
  updated_at: string | null;
}

// Sistem DNS'i (getaddrinfo) yavaş olduğunda ilk istek ~12 sn sürebiliyor ve Node'un
// yerleşik fetch'i 10 sn bağlantı sınırına takılıp başarısız oluyor. Bunun yerine
// c-ares (dns.resolve4) ile çözümleyip sonucu önbelleğe alıyoruz.
const dnsCache = new Map<string, { address: string; expires: number }>();
const DNS_TTL = 5 * 60 * 1000;

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;

function fastLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback) {
  const reply = (address: string) => {
    if (options.all) callback(null, [{ address, family: 4 }]);
    else callback(null, address, 4);
  };
  const cached = dnsCache.get(hostname);
  if (cached && cached.expires > Date.now()) return reply(cached.address);

  dns.resolve4(hostname, (err, addresses) => {
    if (!err && addresses.length > 0) {
      dnsCache.set(hostname, { address: addresses[0], expires: Date.now() + DNS_TTL });
      return reply(addresses[0]);
    }
    dns.lookup(hostname, options, callback as never);
  });
}

const agent = new https.Agent({ keepAlive: true });

/** Octokit için node:https tabanlı fetch (hızlı DNS + bağlantı yeniden kullanımı). */
function httpsFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  const headers = new Headers(init?.headers);
  // Yanıtı elle açmamak için sıkıştırma isteme.
  headers.delete("accept-encoding");
  const body = init?.body;

  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: init?.method ?? "GET",
        headers: Object.fromEntries(headers),
        timeout: 60_000,
        agent,
        lookup: fastLookup as never,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("error", reject);
        res.on("end", () => {
          const resHeaders = new Headers();
          for (const [key, value] of Object.entries(res.headers)) {
            if (value !== undefined) resHeaders.set(key, Array.isArray(value) ? value.join(", ") : String(value));
          }
          const status = res.statusCode ?? 500;
          const noBody = status === 204 || status === 304;
          resolve(
            new Response(noBody ? null : new Uint8Array(Buffer.concat(chunks)), {
              status,
              statusText: res.statusMessage,
              headers: resHeaders,
            })
          );
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("GitHub isteği zaman aşımına uğradı")));
    req.on("error", reject);
    init?.signal?.addEventListener("abort", () => req.destroy(new Error("İstek iptal edildi")));
    if (body != null) {
      req.write(typeof body === "string" ? body : Buffer.from(body as ArrayBuffer));
    }
    req.end();
  });
}

export function createOctokit(token: string): Octokit {
  return new Octokit({ auth: token, request: { fetch: httpsFetch } });
}

/** Geçersiz token için null döner; ağ hatalarında fırlatır (token'ı yanlışlıkla "geçersiz" saymamak için). */
export async function validateToken(token: string): Promise<GitHubUser | null> {
  try {
    const octokit = createOctokit(token);
    const { data } = await octokit.users.getAuthenticated();
    return {
      id: data.id,
      login: data.login,
      name: data.name,
      email: data.email,
      avatar_url: data.avatar_url,
    };
  } catch (error) {
    const status = (error as { status?: number })?.status;
    if (status === 401 || status === 403) return null;
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`GitHub'a bağlanılamadı: ${message}`);
  }
}

export interface GitHubProfile {
  login: string;
  name: string;
  bio: string;
  /** README geliştirici kartı için platform → URL. */
  links: { platform: string; url: string }[];
}

/** Geliştirici kartı için profil + sosyal hesaplar (LinkedIn vb. /user/social_accounts'tan). */
export async function fetchGithubProfile(token: string): Promise<GitHubProfile> {
  const octokit = createOctokit(token);
  const { data } = await octokit.users.getAuthenticated();
  const links: { platform: string; url: string }[] = [{ platform: "github", url: data.html_url }];
  try {
    const { data: socials } = await octokit.request("GET /user/social_accounts");
    for (const s of socials as { provider: string; url: string }[]) {
      const platform = s.provider === "generic" ? "website" : s.provider === "twitter" ? "x" : s.provider;
      if (!links.some((l) => l.url === s.url)) links.push({ platform, url: s.url });
    }
  } catch {
    // social_accounts erişimi yoksa atla
  }
  if (data.twitter_username && !links.some((l) => l.platform === "x")) {
    links.push({ platform: "x", url: `https://x.com/${data.twitter_username}` });
  }
  if (data.blog && !links.some((l) => l.url.replace(/\/$/, "") === data.blog!.replace(/\/$/, ""))) {
    links.push({ platform: "website", url: /^https?:\/\//.test(data.blog) ? data.blog : `https://${data.blog}` });
  }
  if (data.email) links.push({ platform: "email", url: data.email });
  return { login: data.login, name: data.name ?? "", bio: data.bio ?? "", links };
}

export async function getUserRepos(token: string): Promise<GitHubRepo[]> {
  const octokit = createOctokit(token);
  const { data } = await octokit.repos.listForAuthenticatedUser({
    sort: "updated",
    per_page: 100,
  });
  return data.map((repo) => ({
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description,
    html_url: repo.html_url,
    default_branch: repo.default_branch,
    language: repo.language,
    stargazers_count: repo.stargazers_count,
    forks_count: repo.forks_count,
    created_at: repo.created_at,
    updated_at: repo.updated_at,
  }));
}

export async function createRepo(
  token: string,
  name: string,
  description: string,
  isPrivate: boolean = false
): Promise<GitHubRepo | { error: string }> {
  try {
    const octokit = createOctokit(token);
    const { data } = await octokit.repos.createForAuthenticatedUser({
      name,
      description,
      private: isPrivate,
      auto_init: true,
    });
    return {
      id: data.id,
      name: data.name,
      full_name: data.full_name,
      description: data.description,
      html_url: data.html_url,
      default_branch: data.default_branch,
      language: data.language,
      stargazers_count: data.stargazers_count,
      forks_count: data.forks_count,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  } catch (error: any) {
    const msg = error?.response?.data?.message || error?.message || "Bilinmeyen hata";
    return { error: `Repo oluşturulamadı: ${msg}` };
  }
}

export async function checkRepoExists(
  token: string,
  owner: string,
  repoName: string
): Promise<GitHubRepo | null> {
  try {
    const octokit = createOctokit(token);
    const { data } = await octokit.repos.get({ owner, repo: repoName });
    return {
      id: data.id,
      name: data.name,
      full_name: data.full_name,
      description: data.description,
      html_url: data.html_url,
      default_branch: data.default_branch,
      language: data.language,
      stargazers_count: data.stargazers_count,
      forks_count: data.forks_count,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  } catch (error: any) {
    if (error?.status === 404) return null;
    throw error;
  }
}

export interface PushFileInput {
  path: string;
  content: string;
  encoding?: "utf-8" | "base64";
}

function errorMessage(error: unknown): string {
  const e = error as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message || e?.message || "Bilinmeyen hata";
}

export async function pushToRepo(
  token: string,
  owner: string,
  repo: string,
  files: PushFileInput[],
  message: string,
  branch: string = "main",
  allowInitFallback: boolean = true
): Promise<{ success: boolean; error?: string }> {
  try {
    const octokit = createOctokit(token);

    let latestCommitSha: string | null = null;
    try {
      const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
      latestCommitSha = refData.object.sha;
    } catch {
      latestCommitSha = null;
    }

    // Binary dosyalar önce blob olarak yüklenir; metin dosyaları ağaca doğrudan gömülür.
    const treeItems: { path: string; mode: "100644"; type: "blob"; content?: string; sha?: string }[] = [];
    const binaries = files.filter((f) => f.encoding === "base64");
    for (const f of files) {
      if (f.encoding !== "base64") {
        treeItems.push({ path: f.path, mode: "100644", type: "blob", content: f.content });
      }
    }
    const CONCURRENCY = 5;
    for (let i = 0; i < binaries.length; i += CONCURRENCY) {
      const batch = binaries.slice(i, i + CONCURRENCY);
      const blobs = await Promise.all(
        batch.map((f) => octokit.git.createBlob({ owner, repo, content: f.content, encoding: "base64" }))
      );
      batch.forEach((f, idx) => {
        treeItems.push({ path: f.path, mode: "100644", type: "blob", sha: blobs[idx].data.sha });
      });
    }

    const { data: tree } = await octokit.git.createTree({
      owner,
      repo,
      ...(latestCommitSha ? { base_tree: latestCommitSha } : {}),
      tree: treeItems,
    });

    const { data: commit } = await octokit.git.createCommit({
      owner,
      repo,
      message,
      tree: tree.sha,
      parents: latestCommitSha ? [latestCommitSha] : [],
    });

    if (latestCommitSha) {
      await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: commit.sha });
    } else {
      await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: commit.sha });
    }

    return { success: true };
  } catch (error) {
    const msg = errorMessage(error);

    if (allowInitFallback && msg.includes("Git Repository is empty")) {
      try {
        const octokit = createOctokit(token);
        await octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: ".gitkeep",
          message: "Initialize repository",
          content: "",
          branch,
        });
        return pushToRepo(token, owner, repo, files, message, branch, false);
      } catch (initError) {
        return { success: false, error: `Boş repo başlatılamadı: ${errorMessage(initError)}` };
      }
    }

    return { success: false, error: `Push başarısız: ${msg}` };
  }
}

export async function getRepoCommits(
  token: string,
  owner: string,
  repo: string,
  limit: number = 10
): Promise<{ sha: string; message: string; author: string; date: string }[]> {
  try {
    const octokit = createOctokit(token);
    const { data } = await octokit.repos.listCommits({
      owner,
      repo,
      per_page: limit,
    });

    return data.map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author?.name || "Unknown",
      date: commit.commit.author?.date || new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}
