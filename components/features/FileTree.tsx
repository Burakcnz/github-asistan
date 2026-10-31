"use client";

import { formatFileSize, formatRelativeDate } from "@/lib/utils";

interface FileEntry {
  name: string;
  lastModified: string;
  size?: number;
  language?: string;
}

interface FileTreeProps {
  folders: FileEntry[];
  files: FileEntry[];
  projectName: string;
}

const LANG_COLORS: Record<string, string> = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Python: "#3572A5",
  Rust: "#dea584",
  Go: "#00ADD8",
  "C#": "#178600",
  Java: "#b07219",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  JSON: "#a8b9cc",
  Markdown: "#4493f8",
  YAML: "#cb171e",
  Shell: "#89e051",
  PowerShell: "#012456",
  Batch: "#c1f12e",
};

const FILE_ICON_PATH =
  "M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V4.664a.25.25 0 0 0-.073-.177l-2.914-2.914a.25.25 0 0 0-.177-.073Z";
const FOLDER_ICON_PATH =
  "M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z";

export function FileTree({ folders, files, projectName }: FileTreeProps) {
  const empty = folders.length === 0 && files.length === 0;

  return (
    <div className="border border-[#30363d] rounded-md overflow-hidden">
      <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-2 flex items-center gap-2">
        <svg height="16" viewBox="0 0 16 16" width="16" fill="#8b949e" aria-hidden="true">
          <path d={FOLDER_ICON_PATH} />
        </svg>
        <span className="text-[14px] text-[#f0f6fc] font-semibold truncate">{projectName}/</span>
      </div>

      {empty ? (
        <p className="px-4 py-6 text-center text-[13px] text-[#8b949e]">Gösterilecek dosya yok.</p>
      ) : (
        <table className="w-full text-left table-fixed">
          <thead className="sr-only">
            <tr>
              <th>Ad</th>
              <th>Tür</th>
              <th>Güncellenme</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#30363d]">
            {folders.map((folder) => (
              <tr key={`d:${folder.name}`} className="hover:bg-[#161b22] transition-colors">
                <td className="px-4 py-[6px] text-[14px] w-1/2">
                  <div className="flex items-center gap-3 min-w-0">
                    <svg height="16" viewBox="0 0 16 16" width="16" fill="#54aeff" className="shrink-0" aria-hidden="true">
                      <path d={FOLDER_ICON_PATH} />
                    </svg>
                    <span className="text-[#c9d1d9] font-medium truncate">{folder.name}</span>
                  </div>
                </td>
                <td className="px-4 py-[6px] text-[13px] text-[#8b949e]" />
                <td className="px-4 py-[6px] text-[12px] text-[#8b949e] whitespace-nowrap text-right">
                  {formatRelativeDate(folder.lastModified)}
                </td>
              </tr>
            ))}

            {files.map((file) => (
              <tr key={`f:${file.name}`} className="hover:bg-[#161b22] transition-colors">
                <td className="px-4 py-[6px] text-[14px] w-1/2">
                  <div className="flex items-center gap-3 min-w-0">
                    <svg
                      height="16"
                      viewBox="0 0 16 16"
                      width="16"
                      fill={LANG_COLORS[file.language || ""] || "#8b949e"}
                      className="shrink-0"
                      aria-hidden="true"
                    >
                      <path d={FILE_ICON_PATH} />
                    </svg>
                    <span className="text-[#c9d1d9] font-medium truncate">{file.name}</span>
                  </div>
                </td>
                <td className="px-4 py-[6px] text-[13px] text-[#8b949e] truncate">
                  {file.language && file.language !== "Other" ? file.language : ""}
                  {file.size ? <span className="ml-2 text-[#6e7681]">{formatFileSize(file.size)}</span> : null}
                </td>
                <td className="px-4 py-[6px] text-[12px] text-[#8b949e] whitespace-nowrap text-right">
                  {formatRelativeDate(file.lastModified)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
