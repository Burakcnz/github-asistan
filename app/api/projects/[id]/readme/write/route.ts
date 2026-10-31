import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { db } from "@/lib/db";

/** Uygulamadaki README'yi proje klasörüne README.md olarak yazar. Var olan dosya README.md.bak olarak yedeklenir. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await db.project.findUnique({ where: { id }, include: { readme: true } });
    if (!project) {
      return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
    }
    if (!project.readme?.content.trim()) {
      return NextResponse.json({ error: "Kaydedilecek README yok. Önce oluşturun." }, { status: 400 });
    }

    const dirOk = await fs
      .stat(project.localPath)
      .then((s) => s.isDirectory())
      .catch(() => false);
    if (!dirOk) {
      return NextResponse.json({ error: `Proje klasörü bulunamadı: ${project.localPath}` }, { status: 404 });
    }

    const entries = await fs.readdir(project.localPath);
    const existingName = entries.find((n) => n.toLowerCase() === "readme.md");
    const target = path.join(project.localPath, existingName ?? "README.md");
    const content = project.readme.content.endsWith("\n") ? project.readme.content : project.readme.content + "\n";

    let backup: string | null = null;
    if (existingName) {
      const current = await fs.readFile(target, "utf-8").catch(() => null);
      if (current === content) {
        return NextResponse.json({ success: true, path: target, unchanged: true });
      }
      if (current !== null) {
        backup = `${target}.bak`;
        await fs.writeFile(backup, current, "utf-8");
      }
    }

    await fs.writeFile(target, content, "utf-8");
    await db.project.update({ where: { id }, data: { hasReadme: true } });

    return NextResponse.json({ success: true, path: target, backup });
  } catch (error) {
    console.error("Failed to write README:", error);
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    return NextResponse.json({ error: `README diske yazılamadı: ${message}` }, { status: 500 });
  }
}
