import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GitHub Asistan - Proje",
};

export default function ProjectLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9]">
      {children}
    </div>
  );
}
