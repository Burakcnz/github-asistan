"use client";

import { ReadmeViewer } from "@/components/features/ReadmeViewer";

interface ReadmePreviewProps {
  markdown: string;
}

export function ReadmePreview({ markdown }: ReadmePreviewProps) {
  if (!markdown.trim()) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px] text-[#8b949e] text-[14px]">
        <div className="text-center">
          <div className="text-[32px] mb-2">📝</div>
          <p>Önizleme için blok ekleyin veya README oluşturun</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-[860px] mx-auto">
        <ReadmeViewer content={markdown} />
      </div>
    </div>
  );
}
