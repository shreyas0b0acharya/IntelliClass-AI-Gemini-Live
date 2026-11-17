"use client";

import { useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  Loader2,
  HardDriveDownload,
  Minimize2,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAssetSync } from "@/features/avatar";

interface AssetSyncModalProps {
  preferredGender?: "men" | "women";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDuration(sec: number): string {
  if (sec <= 0) return "calculating...";
  if (sec < 60) return `${sec} sec`;
  const mins = Math.floor(sec / 60);
  const remainingSecs = sec % 60;
  return `${mins} min ${remainingSecs} sec`;
}

export function AssetSyncModal({ preferredGender = "men" }: AssetSyncModalProps) {
  const { progress, isComplete, isPaused } = useAssetSync({
    autoStart: true,
    preferredGender,
  });

  const [isMinimized, setIsMinimized] = useState(() => {
    if (typeof window !== "undefined" && (window.navigator?.webdriver || window.location.search.includes("e2e=true"))) {
      return true;
    }
    return false;
  });

  // If complete or idle with no missing assets, hide the modal completely
  if (isComplete || progress.status === "idle") {
    return null;
  }

  // ── Minimized Floating Pill ───────────────────────────────────────────────
  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-card/95 hover:bg-card border border-border/80 backdrop-blur-xl text-card-foreground shadow-2xl cursor-pointer transition-all hover:scale-105"
      >
        <div className="relative flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">Preparing IntelliClass</span>
            <span className="text-xs font-mono font-bold text-primary">{progress.overallPercentage}%</span>
          </div>
          <span className="text-xs text-muted-foreground truncate max-w-[140px]">
            {progress.currentAssetName || "Syncing assets..."}
          </span>
        </div>
        <Maximize2 className="h-3.5 w-3.5 text-muted-foreground ml-1" />
      </div>
    );
  }

  // ── Full Modal ────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-md rounded-3xl bg-card border border-border shadow-2xl p-6 sm:p-7 text-card-foreground backdrop-blur-2xl flex flex-col space-y-5">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
              <HardDriveDownload className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight text-foreground">Preparing IntelliClass</h3>
              <p className="text-xs text-muted-foreground font-medium">Syncing core 3D &amp; visual package</p>
            </div>
          </div>

          <button
            onClick={() => setIsMinimized(true)}
            className="p-2 rounded-xl bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/50 transition-colors"
            title="Minimize to background"
            aria-label="Minimize to background"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        </div>

        {/* Overall Progress Metrics */}
        <div className="space-y-2.5 bg-muted/50 dark:bg-muted/30 p-4 rounded-2xl border border-border/60">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">Overall Progress</span>
            <span className="font-bold font-mono text-primary text-base">
              {progress.overallPercentage}%
            </span>
          </div>

          {/* Primary Progress Bar */}
          <div className="relative w-full h-2.5 rounded-full bg-secondary dark:bg-secondary/60 border border-border/30 overflow-hidden">
            <div
              style={{ "--progress-bar-width": `${progress.overallPercentage}%` } as React.CSSProperties}
              className="h-full w-[var(--progress-bar-width)] bg-primary rounded-full transition-all duration-300 shadow-xs"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium pt-0.5">
            <span className="font-mono">
              {formatBytes(progress.downloadedBytes)} / {formatBytes(progress.totalBytes)}
            </span>
            {progress.estimatedRemainingSec > 0 && (
              <span className="font-mono">
                ETA: {formatDuration(progress.estimatedRemainingSec)} (
                {formatBytes(progress.speedBytesPerSec)}/s)
              </span>
            )}
          </div>
        </div>

        {/* Current Active Item Detail */}
        {progress.currentAssetName && (
          <div className="space-y-1.5 px-1">
            <div className="flex items-center justify-between text-xs">
              <span className="truncate max-w-[240px] font-medium text-foreground">
                {progress.currentAssetName}
              </span>
              <span className="text-xs font-semibold font-mono text-primary">
                {progress.currentAssetPercentage}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-secondary dark:bg-secondary/60 border border-border/30 overflow-hidden">
              <div
                style={{ "--asset-bar-width": `${progress.currentAssetPercentage}%` } as React.CSSProperties}
                className="h-full w-[var(--asset-bar-width)] bg-primary/80 dark:bg-primary/90 rounded-full transition-all duration-200"
              />
            </div>
          </div>
        )}

        {/* Itemized Phased Priority Checklist */}
        <div className="space-y-2 pt-1 border-t border-border/60">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Package Components
          </div>

          <div className="space-y-1.5 text-xs">
            {/* P0 */}
            <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-muted/40 border border-border/40">
              <span className="font-medium text-foreground">P0: 3D Avatar &amp; Stage Backdrop</span>
              {progress.isP0Ready ? (
                <span className="flex items-center gap-1.5 text-chart-2 dark:text-chart-2 font-semibold text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-primary font-semibold text-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing
                </span>
              )}
            </div>

            {/* P1 */}
            <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-muted/40 border border-border/40">
              <span className="font-medium text-foreground">P1: 3D Auditorium Mesh</span>
              {progress.overallPercentage >= 85 ? (
                <span className="flex items-center gap-1.5 text-chart-2 dark:text-chart-2 font-semibold text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                </span>
              ) : (
                <span className="text-muted-foreground font-medium text-xs">Pending</span>
              )}
            </div>

            {/* P2 */}
            <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-muted/40 border border-border/40">
              <span className="font-medium text-foreground">P2: Studio Environment Lighting</span>
              {progress.isComplete ? (
                <span className="flex items-center gap-1.5 text-chart-2 dark:text-chart-2 font-semibold text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                </span>
              ) : (
                <span className="text-muted-foreground font-medium text-xs">Pending</span>
              )}
            </div>
          </div>
        </div>

        {/* Live Audio Streaming Notification */}
        {isPaused && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-chart-4/15 border border-chart-4/30 text-chart-4 text-xs font-medium">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>Paused for live lecture audio. Resuming automatically...</span>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-1">
          <Button
            variant="outline"
            onClick={() => setIsMinimized(true)}
            className="w-full h-10 rounded-2xl font-semibold text-xs tracking-tight bg-secondary/70 hover:bg-secondary text-foreground hover:text-foreground border border-border shadow-xs transition-all"
          >
            Continue to Dashboard in Background
          </Button>
        </div>
      </div>
    </div>
  );
}
