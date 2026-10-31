"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  onClick?: () => void;
  /** Verilirse buton bir bağlantı olarak çizilir. */
  href?: string;
  className?: string;
  type?: "button" | "submit" | "reset";
  title?: string;
}

const variants = {
  primary: "bg-[#238636] hover:bg-[#2ea043] text-white border-[#2ea043]",
  secondary: "bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] border-[#30363d]",
  ghost: "bg-transparent hover:bg-[#21262d] text-[#c9d1d9] border-transparent",
  danger: "bg-[#da3633] hover:bg-[#f85149] text-white border-[#f85149]",
};

const sizes = {
  sm: "px-3 py-1 text-[12px]",
  md: "px-4 py-2 text-[14px]",
  lg: "px-6 py-3 text-[16px]",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  onClick,
  href,
  className,
  type = "button",
  title,
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-md border font-medium transition-colors whitespace-nowrap",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    variants[variant],
    sizes[size],
    className
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={classes} title={title}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes} title={title}>
      {children}
    </button>
  );
}
