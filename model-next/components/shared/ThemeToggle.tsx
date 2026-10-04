"use client";

import * as React from "react";
import { Moon, Sun, Laptop } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const emptySubscribe = () => () => { };

interface ThemeToggleProps {
  variant?: "button" | "segmented";
}

export function ThemeToggle({ variant = "button" }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!mounted) {
    if (variant === "segmented") {
      return (
        <div className="flex items-center p-0.5 rounded-full bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/5 h-7 w-24 opacity-50" />
      );
    }
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full border border-black/10 dark:border-white/10 text-[#86868b]"
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  // ── Segmented Control Variant (Apple HIG Inset Capsule for Menus & Settings) ──
  if (variant === "segmented") {
    return (
      <div
        role="radiogroup"
        aria-label="Interface theme"
        className="inline-flex items-center p-0.5 rounded-full bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/5 gap-0.5 select-none"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          role="radio"
          aria-checked={theme === "light"}
          onClick={() => setTheme("light")}
          title="Light Mode"
          className={`flex items-center justify-center h-6 w-7 rounded-full transition-all duration-150 ${theme === "light"
              ? "bg-white text-amber-500 shadow-xs scale-[1.02]"
              : "text-muted-foreground hover:text-foreground"
            }`}
        >
          <Sun className="h-3.5 w-3.5" />
          <span className="sr-only">Light Mode</span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={theme === "dark"}
          onClick={() => setTheme("dark")}
          title="Dark Mode"
          className={`flex items-center justify-center h-6 w-7 rounded-full transition-all duration-150 ${theme === "dark"
              ? "bg-[#636366] text-indigo-300 shadow-xs scale-[1.02]"
              : "text-muted-foreground hover:text-foreground"
            }`}
        >
          <Moon className="h-3.5 w-3.5" />
          <span className="sr-only">Dark Mode</span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={theme === "system"}
          onClick={() => setTheme("system")}
          title="System Preference"
          className={`flex items-center justify-center h-6 w-7 rounded-full transition-all duration-150 ${theme === "system"
              ? "bg-white dark:bg-[#636366] text-foreground shadow-xs scale-[1.02]"
              : "text-muted-foreground hover:text-foreground"
            }`}
        >
          <Laptop className="h-3.5 w-3.5" />
          <span className="sr-only">System Preference</span>
        </button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Toggle Theme"
          className="rounded-full border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 shadow-xs relative"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform duration-300 dark:-rotate-90 dark:scale-0 text-amber-500" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform duration-300 dark:rotate-0 dark:scale-100 text-indigo-400" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 rounded-2xl p-1.5 shadow-xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl"
      >
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className={`flex items-center gap-2.5 rounded-xl cursor-pointer py-2 text-xs ${theme === "light"
              ? "bg-black/5 dark:bg-white/10 font-bold text-[#1d1d1f] dark:text-[#f5f5f7]"
              : "text-[#86868b] dark:text-[#a1a1a6]"
            }`}
        >
          <Sun className="h-4 w-4 text-amber-500 shrink-0" />
          <span>Light Mode</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className={`flex items-center gap-2.5 rounded-xl cursor-pointer py-2 text-xs ${theme === "dark"
              ? "bg-black/5 dark:bg-white/10 font-bold text-[#1d1d1f] dark:text-[#f5f5f7]"
              : "text-[#86868b] dark:text-[#a1a1a6]"
            }`}
        >
          <Moon className="h-4 w-4 text-indigo-400 shrink-0" />
          <span>Dark Mode</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className={`flex items-center gap-2.5 rounded-xl cursor-pointer py-2 text-xs ${theme === "system"
              ? "bg-black/5 dark:bg-white/10 font-bold text-[#1d1d1f] dark:text-[#f5f5f7]"
              : "text-[#86868b] dark:text-[#a1a1a6]"
            }`}
        >
          <Laptop className="h-4 w-4 text-[#86868b] shrink-0" />
          <span>System Preference</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
