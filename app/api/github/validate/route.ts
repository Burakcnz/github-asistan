import { NextResponse } from "next/server";
import { validateToken } from "@/lib/github";
import { ensureUser, refreshGithubProfile, setGithubLogin } from "@/lib/shared";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    let token: string | null = null;
    let storedUserId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    } else {
      const user = await ensureUser();
      token = user.githubToken;
      storedUserId = user.id;
    }

    if (!token) {
      return NextResponse.json({ error: "Kayıtlı token yok" }, { status: 401 });
    }

    const githubUser = await validateToken(token);
    if (!githubUser) {
      return NextResponse.json({ error: "Token geçersiz veya yetkisiz" }, { status: 401 });
    }
    if (storedUserId && token) {
      await setGithubLogin(storedUserId, githubUser.login);
      void refreshGithubProfile(storedUserId, token);
    }
    return NextResponse.json(githubUser);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token doğrulanamadı";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
