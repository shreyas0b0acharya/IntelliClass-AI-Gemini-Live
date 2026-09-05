"use client";

import { useRef, KeyboardEvent } from "react";
import { Tv, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileViewSwitcherProps {
  activeTab: "stage" | "chat";
  onTabChange: (tab: "stage" | "chat") => void;
  unreadCount?: number;
}

export function MobileViewSwitcher({
  activeTab,
  onTabChange,
  unreadCount = 0,
}: MobileViewSwitcherProps) {
  const stageTabRef = useRef<HTMLButtonElement>(null);
  const chatTabRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, current: "stage" | "chat") => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const nextTab = current === "stage" ? "chat" : "stage";
      onTabChange(nextTab);
      if (nextTab === "stage") {
        stageTabRef.current?.focus();
      } else {
        chatTabRef.current?.focus();
      }
    } else if (e.key === "Home") {
      e.preventDefault();
      onTabChange("stage");
      stageTabRef.current?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      onTabChange("chat");
      chatTabRef.current?.focus();
    }
  };

  return (
    <nav
      role="tablist"
      aria-label="Classroom display modes"
      className="shrink-0 w-full flex items-center justify-center px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-2xl border-t border-black/5 dark:border-white/10 z-20 transition-all select-none"
    >
      <div className="inline-flex items-center p-1 rounded-full bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/5 max-w-sm w-full gap-1">
        {/* ── Tab 1: Lecture Stage ── */}
        <button
          ref={stageTabRef}
          id="tab-stage"
          role="tab"
          type="button"
          aria-selected={activeTab === "stage"}
          aria-controls="panel-stage"
          tabIndex={activeTab === "stage" ? 0 : -1}
          onClick={() => onTabChange("stage")}
          onKeyDown={(e) => handleKeyDown(e, "stage")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 h-10 px-3 rounded-full text-xs font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40",
            activeTab === "stage"
              ? "bg-white dark:bg-[#636366] text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.06)] scale-[1.01]"
              : "text-muted-foreground hover:text-foreground hover:bg-white/40 dark:hover:bg-white/5"
          )}
        >
          <Tv className={cn("h-4 w-4 shrink-0 transition-colors", activeTab === "stage" ? "text-[#0071e3] dark:text-sky-400" : "text-muted-foreground")} />
          <span>Lecture Stage</span>
        </button>

        {/* ── Tab 2: Chat & Notes ── */}
        <button
          ref={chatTabRef}
          id="tab-chat"
          role="tab"
          type="button"
          aria-selected={activeTab === "chat"}
          aria-controls="panel-chat"
          tabIndex={activeTab === "chat" ? 0 : -1}
          onClick={() => onTabChange("chat")}
          onKeyDown={(e) => handleKeyDown(e, "chat")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 h-10 px-3 rounded-full text-xs font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/40 relative",
            activeTab === "chat"
              ? "bg-white dark:bg-[#636366] text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.06)] scale-[1.01]"
              : "text-muted-foreground hover:text-foreground hover:bg-white/40 dark:hover:bg-white/5"
          )}
        >
          <MessageSquare className={cn("h-4 w-4 shrink-0 transition-colors", activeTab === "chat" ? "text-[#0071e3] dark:text-sky-400" : "text-muted-foreground")} />
          <span>Chat & Notes</span>

          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#0071e3] text-white">
              {unreadCount}
              <span className="sr-only">, {unreadCount} new answers</span>
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}
