import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { ensureUser } from "@/lib/shared";
import { invalidateScanCache } from "@/lib/folder-scanner";

export async function GET() {
  try {
    const user = await ensureUser();
    return NextResponse.json({ workspacePath: user.workspacePath });
  } catch {
    return NextResponse.json({ error: "Çalışma alanı okunamadı" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const raw = typeof body.workspacePath === "string" ? body.workspacePath.trim().replace(/^"|"$/g, "") : "";

    if (!raw) {
      return NextResponse.json({ error: "Klasör yolu boş olamaz" }, { status: 400 });
    }

    const workspacePath = path.resolve(raw);
    let isDir = false;
    try {
      isDir = fs.statSync(workspacePath).isDirectory();
    } catch {
      // yok
    }
    if (!isDir) {
      return NextResponse.json({ error: `Klasör bulunamadı: ${workspacePath}` }, { status: 400 });
    }

    const user = await ensureUser();
    await db.user.update({ where: { id: user.id }, data: { workspacePath } });
    invalidateScanCache();

    return NextResponse.json({ success: true, workspacePath });
  } catch {
    return NextResponse.json({ error: "Çalışma alanı kaydedilemedi" }, { status: 500 });
  }
}
