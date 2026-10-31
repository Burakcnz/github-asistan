import { NextResponse } from "next/server";
import { getOllamaStatus, getSystemInfo } from "@/lib/ollama";
import { ensureUser } from "@/lib/shared";

export async function GET() {
  try {
    const [status, systemInfo, user] = await Promise.all([getOllamaStatus(), getSystemInfo(), ensureUser()]);
    return NextResponse.json({ ...status, systemInfo, selectedModel: user.ollamaModel });
  } catch {
    return NextResponse.json({ error: "Ollama durumu alınamadı" }, { status: 500 });
  }
}
