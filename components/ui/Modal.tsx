"use client";

import { cn } from "@/lib/utils";
import { ReactNode, useEffect, useId, useRef } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, footer, className }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // İlk odaklanabilir öğeye odaklan.
    const first = panelRef.current?.querySelector<HTMLElement>("input, button, select, textarea, [tabindex]:not([tabindex='-1'])");
    first?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        ref={panelRef}
        className={cn(
          "relative w-full max-w-lg max-h-[90vh] flex flex-col bg-[#161b22] border border-[#30363d] rounded-md shadow-2xl",
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
            <h2 id={titleId} className="text-[15px] font-semibold text-[#f0f6fc]">
              {title}
            </h2>
            <button onClick={onClose} className="w-7 h-7 rounded-md text-[#8b949e] hover:text-[#f0f6fc] hover:bg-[#30363d]" aria-label="Kapat">
              ✕
            </button>
          </div>
        )}
        <div className="p-4 overflow-auto">{children}</div>
        {footer && <div className="px-4 py-3 border-t border-[#30363d] flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
