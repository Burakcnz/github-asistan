"use client";

import { cn } from "@/lib/utils";
import { forwardRef, InputHTMLAttributes, useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-[12px] font-medium text-[#8b949e] mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-[14px] text-[#c9d1d9] placeholder-[#484f58]",
              "focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff]",
              "transition-colors",
              icon && "pl-10",
              error && "border-[#f85149] focus:border-[#f85149] focus:ring-[#f85149]",
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-[12px] text-[#f85149]">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
