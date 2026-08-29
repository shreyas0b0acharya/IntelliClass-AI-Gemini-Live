"use client";

import * as React from "react";
import { Moon, Sun, Laptop } from "lucide-react";
import { useTheme } from "next-themes";
import { AppButton } from "@/components/app";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!mounted) {
    return (
      <AppButton
        variant="ghost"
        size="icon-sm"
        shape="pill"
        className="border border-black/10 dark:border-white/10 text-[#86868b]"
      >
        <Sun className="h-4 w-4" />
      </AppButton>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <AppButton
          variant="ghost"
          size="icon-sm"
          shape="pill"
          title="Toggle Theme"
          className="border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 shadow-xs relative"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform duration-300 dark:-rotate-90 dark:scale-0 text-amber-500" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform duration-300 dark:rotate-0 dark:scale-100 text-indigo-400" />
          <span className="sr-only">Toggle theme</span>
        </AppButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 rounded-2xl p-1.5 shadow-xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl"
      >
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className={`flex items-center gap-2.5 rounded-xl cursor-pointer py-2 text-xs ${
            theme === "light"
              ? "bg-black/5 dark:bg-white/10 font-bold text-[#1d1d1f] dark:text-[#f5f5f7]"
              : "text-[#86868b] dark:text-[#a1a1a6]"
          }`}
        >
          <Sun className="h-4 w-4 text-amber-500 shrink-0" />
          <span>Light Mode</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className={`flex items-center gap-2.5 rounded-xl cursor-pointer py-2 text-xs ${
            theme === "dark"
              ? "bg-black/5 dark:bg-white/10 font-bold text-[#1d1d1f] dark:text-[#f5f5f7]"
              : "text-[#86868b] dark:text-[#a1a1a6]"
          }`}
        >
          <Moon className="h-4 w-4 text-indigo-400 shrink-0" />
          <span>Dark Mode</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className={`flex items-center gap-2.5 rounded-xl cursor-pointer py-2 text-xs ${
            theme === "system"
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
