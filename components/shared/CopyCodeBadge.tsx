"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CopyCodeBadgeProps {
  code: string;
  className?: string;
  showToast?: boolean;
}

export function CopyCodeBadge({
  code,
  className = "",
  showToast = true,
}: CopyCodeBadgeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!code) return;

    navigator.clipboard.writeText(code);
    setCopied(true);

    if (showToast) {
      toast.success(`Meeting code "${code}" copied to clipboard!`);
    }

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied to clipboard!" : `Click to copy code: ${code}`}
      className={cn(
        "group/copy inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-foreground dark:text-foreground bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 active:scale-95 px-2 py-0.5 rounded-md border border-black/5 dark:border-white/10 transition-all cursor-pointer whitespace-nowrap shrink-0 select-none",
        copied && "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        className
      )}
    >
      <span>{code}</span>
      {copied ? (
        <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0 animate-in zoom-in-50 duration-150" />
      ) : (
        <Copy className="h-3 w-3 opacity-60 group-hover/copy:opacity-100 transition-opacity shrink-0" />
      )}
    </button>
  );
}

export default CopyCodeBadge;
