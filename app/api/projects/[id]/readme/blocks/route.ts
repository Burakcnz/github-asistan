import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ReadmeBlock } from "@/lib/readme-blocks";
import { renderAllBlocks } from "@/lib/readme-renderer";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const readme = await db.readme.findUnique({ where: { projectId: id } });

    if (!readme) {
      return NextResponse.json({ blocks: [], content: "" });
    }

    let blocks: ReadmeBlock[] = [];
    if (readme.blocks && readme.blocks !== "[]") {
      try {
        blocks = JSON.parse(readme.blocks);
      } catch (e) {
        console.error("Failed to parse readme blocks:", e);
      }
    }

    return NextResponse.json({ blocks, content: readme.content });
  } catch {
    return NextResponse.json({ error: "README blokları okunamadı" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { blocks } = body as { blocks: ReadmeBlock[] };

    if (!Array.isArray(blocks)) {
      return NextResponse.json({ error: "Bloklar dizi olmalı" }, { status: 400 });
    }

    const project = await db.project.findUnique({ where: { id }, select: { id: true } });
    if (!project) {
      return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
    }

    const content = renderAllBlocks(blocks);
    const serialized = JSON.stringify(blocks);

    const readme = await db.readme.upsert({
      where: { projectId: id },
      create: { projectId: id, blocks: serialized, content },
      update: { blocks: serialized, content, version: { increment: 1 }, pushedToGithub: false },
    });

    await db.project.update({ where: { id }, data: { hasReadme: content.trim().length > 0 } });

    return NextResponse.json({ blocks, content, version: readme.version });
  } catch (error) {
    console.error("Failed to save blocks:", error);
    return NextResponse.json({ error: "README kaydedilemedi" }, { status: 500 });
  }
}
