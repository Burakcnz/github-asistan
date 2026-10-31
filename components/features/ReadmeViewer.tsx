"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

interface ReadmeViewerProps {
  content: string;
}

// GitHub'a benzer: README'lerde yaygın HTML'e (div/p align, img, details, picture)
// izin ver, script/stil/olay öznitelikleri temizlensin.
const schema = {
  ...defaultSchema,
  // GitHub gibi id'lere "user-content-" öneki eklenmesin; bağlantılar bozulmasın.
  clobberPrefix: "",
  tagNames: [...(defaultSchema.tagNames ?? []), "picture", "source", "center", "u"],
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "align"],
    img: [...(defaultSchema.attributes?.img ?? []), "width", "height", "align"],
    source: ["srcSet", "srcset", "media", "type"],
    code: [...(defaultSchema.attributes?.code ?? []), ["className", /^language-./]],
  },
};

export function ReadmeViewer({ content }: ReadmeViewerProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
        components={{
          a: ({ href, children, ...props }) => {
            const external = !!href && /^https?:\/\//.test(href);
            return (
              <a
                href={href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                {...props}
              >
                {children}
              </a>
            );
          },
          img: ({ src, alt, ...props }) =>
            // eslint-disable-next-line @next/next/no-img-element
            src ? <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} loading="lazy" {...props} /> : null,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
