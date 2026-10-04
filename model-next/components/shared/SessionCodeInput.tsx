"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      className={`flex items-center gap-2 bg-muted dark:bg-card border border-black/10 dark:border-white/10 rounded-full p-1 shadow-xs focus-within:ring-2 focus-within:ring-ring/30 focus-within:border-primary transition-all h-10 ${className}`}
    >
      <input
        type="text"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={sessionCode}
        onChange={(e) => setSessionCode(e.target.value)}
        className={`bg-transparent font-medium px-3.5 outline-none text-foreground dark:text-foreground placeholder:text-muted-foreground dark:placeholder:text-muted-foreground text-xs sm:text-sm w-36 sm:w-48 ${isLarge ? "w-48 sm:w-64" : ""
          }`}
      />
      <Button
        type="submit"
        disabled={!hasCode}
        variant={hasCode ? "default" : "secondary"}
        size="xs"
 className="h-8 "
      >
        <span>{buttonText}</span>
        {hasCode && <ArrowRight className="h-3 w-3" />}
      </Button>
    </form>
  );
}
