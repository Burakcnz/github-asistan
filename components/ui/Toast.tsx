"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  href?: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string, href?: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => undefined });

export function useToast() {
  return useContext(ToastContext).toast;
}

const STYLES: Record<ToastType, string> = {
  success: "border-[#238636] bg-[#0f2a17] text-[#3fb950]",
  error: "border-[#da3633] bg-[#2d1214] text-[#ff7b72]",
  info: "border-[#1f6feb] bg-[#0c1d33] text-[#58a6ff]",
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, message: string, href?: string) => {
      const id = nextId++;
      setItems((prev) => [...prev.slice(-3), { id, type, message, href }]);
      setTimeout(() => dismiss(id), type === "error" ? 8000 : 4500);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(380px,calc(100vw-32px))]" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.type === "error" ? "alert" : "status"}
            className={cn("rounded-md border px-4 py-3 text-[13px] shadow-lg flex items-start gap-3", STYLES[t.type])}
          >
            <span className="flex-1 break-words">
              {t.message}
              {t.href && (
                <a href={t.href} target="_blank" rel="noopener noreferrer" className="ml-2 underline">
                  Aç
                </a>
              )}
            </span>
            <button onClick={() => dismiss(t.id)} className="opacity-70 hover:opacity-100" aria-label="Kapat">
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
