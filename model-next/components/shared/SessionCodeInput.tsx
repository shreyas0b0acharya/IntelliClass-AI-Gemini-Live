"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth";
import { ArrowRight, Loader2, Sparkles, KeyRound } from "lucide-react";
import { AppButton } from "@/components/app";

interface SessionCodeInputProps {
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  size?: "default" | "large";
  buttonText?: string;
}

export function SessionCodeInput({
  className = "",
  placeholder = "Enter session code...",
  autoFocus = false,
  size = "default",
  buttonText = "Join",
}: SessionCodeInputProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [sessionCode, setSessionCode] = useState("");

  const hasCode = sessionCode.trim().length > 0;
  const isLarge = size === "large";

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = sessionCode.trim();
    if (!clean) return;

    const targetSessionUrl = `/session/${encodeURIComponent(clean)}`;

    if (!user) {
      router.push(`/login?redirectTo=${encodeURIComponent(targetSessionUrl)}`);
    } else {
      router.push(targetSessionUrl);
    }
  };

  return (
    <form
      onSubmit={handleJoin}
      className={`flex items-center gap-2 bg-[#f5f5f7] dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 rounded-full p-1 shadow-xs focus-within:ring-2 focus-within:ring-[#0071e3]/30 focus-within:border-[#0071e3] transition-all h-10 ${className}`}
    >
      <input
        type="text"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={sessionCode}
        onChange={(e) => setSessionCode(e.target.value)}
        className={`bg-transparent font-medium px-3.5 outline-none text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#86868b] dark:placeholder:text-[#86868b] text-xs sm:text-sm w-36 sm:w-48 ${
          isLarge ? "w-48 sm:w-64" : ""
        }`}
      />
      <AppButton
        type="submit"
        disabled={!hasCode}
        variant={hasCode ? "primary" : "secondary"}
        size="xs"
        shape="pill"
        className="h-8 px-4 font-medium text-xs shadow-xs"
        rightIcon={hasCode ? <ArrowRight className="h-3 w-3" /> : undefined}
      >
        <span>{buttonText}</span>
      </AppButton>
    </form>
  );
}
