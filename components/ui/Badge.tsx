"use client";

import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  size?: "sm" | "md";
}

export function Badge({
  children,
  variant = "default",
  size = "sm",
}: BadgeProps) {
  const variants = {
    default: "bg-[#30363d] text-[#8b949e] border-[#30363d]",
    success: "bg-[#23863626] text-[#3fb950] border-[#23863644]",
    warning: "bg-[#9e6a0326] text-[#d29922] border-[#9e6a0344]",
    danger: "bg-[#da363326] text-[#f85149] border-[#da363344]",
    info: "bg-[#388bfd26] text-[#58a6ff] border-[#388bfd44]",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-[12px]",
    md: "px-3 py-1 text-[14px]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        variants[variant],
        sizes[size]
      )}
    >
      {children}
    </span>
  );
}
