import { NextResponse } from "next/server";
import { isOllamaRunning, isValidModelName, pullModel } from "@/lib/ollama";

export async function POST(request: Request) {
  try {
    const { model } = await request.json().catch(() => ({}));

    if (typeof model !== "string" || !isValidModelName(model)) {
      return NextResponse.json({ error: "Geçersiz model adı" }, { status: 400 });
    }

    if (!(await isOllamaRunning())) {
      return NextResponse.json({ error: "Ollama çalışmıyor. Önce başlatın." }, { status: 503 });
    }

    const upstream = await pullModel(model, request.signal);
    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      return NextResponse.json({ error: `İndirme başlatılamadı: ${text || upstream.status}` }, { status: 502 });
    }

    // Ollama'nın JSON satır akışını doğrudan istemciye aktar.
    return new Response(upstream.body, {
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" },
    });
  } catch {
    return NextResponse.json({ error: "Model indirilemedi" }, { status: 500 });
  }
}
