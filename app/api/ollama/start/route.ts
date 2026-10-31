import { NextResponse } from "next/server";
import { startOllama } from "@/lib/ollama";

export async function POST() {
  try {
    const started = await startOllama();
    if (started) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json(
      { error: "Ollama başlatılamadı. Kurulu olduğundan emin olun." },
      { status: 500 }
    );
  } catch {
    return NextResponse.json({ error: "Ollama başlatılamadı" }, { status: 500 });
  }
}
