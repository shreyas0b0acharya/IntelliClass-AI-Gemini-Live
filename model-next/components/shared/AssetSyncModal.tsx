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

  const [isMinimized, setIsMinimized] = useState(false);

  // If complete or idle with no missing assets, hide the modal completely
  if (isComplete || progress.status === "idle") {
    return null;
  }

  // ── Minimized Floating Pill ───────────────────────────────────────────────
  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-neutral-900/90 hover:bg-neutral-900 border border-white/15 backdrop-blur-xl text-white shadow-2xl cursor-pointer transition-all hover:scale-105"
      >
        <div className="relative flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-[#0071e3]" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">Preparing IntelliClass</span>
            <span className="text-[11px] text-white/60">{progress.overallPercentage}%</span>
          </div>
          <span className="text-[10px] text-white/50 truncate max-w-[140px]">
            {progress.currentAssetName || "Syncing assets..."}
          </span>
        </div>
        <Maximize2 className="h-3.5 w-3.5 text-white/40 ml-1" />
      </div>
    );
  }

  // ── Full Glassmorphic Modal ───────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-md rounded-3xl bg-[#1c1c1e]/95 border border-white/15 shadow-2xl p-6 sm:p-7 text-white backdrop-blur-2xl flex flex-col space-y-5">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#0071e3]/20 border border-[#0071e3]/40 flex items-center justify-center text-[#0071e3]">
              <HardDriveDownload className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">Preparing IntelliClass</h3>
              <p className="text-xs text-white/60">Syncing core 3D & visual package</p>
            </div>
          </div>

          <button
            onClick={() => setIsMinimized(true)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            title="Minimize to background"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        </div>

        {/* Overall Progress Metrics */}
        <div className="space-y-2 bg-white/[0.04] p-4 rounded-2xl border border-white/5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white/80">Overall Progress</span>
            <span className="font-bold text-[#0071e3] text-sm">
              {progress.overallPercentage}%
            </span>
          </div>

          {/* Primary Progress Bar */}
          <div className="relative w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              style={{ "--progress-bar-width": `${progress.overallPercentage}%` } as React.CSSProperties}
              className="h-full w-[var(--progress-bar-width)] bg-gradient-to-r from-[#0071e3] to-[#4facfe] rounded-full transition-all duration-300"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-white/50 pt-1">
            <span>
              {formatBytes(progress.downloadedBytes)} / {formatBytes(progress.totalBytes)}
            </span>
            {progress.estimatedRemainingSec > 0 && (
              <span>
                ETA: {formatDuration(progress.estimatedRemainingSec)} (
                {formatBytes(progress.speedBytesPerSec)}/s)
              </span>
            )}
          </div>
        </div>

        {/* Current Active Item Detail */}
        {progress.currentAssetName && (
          <div className="space-y-1.5 px-1">
            <div className="flex items-center justify-between text-xs text-white/70">
              <span className="truncate max-w-[240px]">
                {progress.currentAssetName}
              </span>
              <span className="text-[11px] font-medium text-white/90">
                {progress.currentAssetPercentage}%
              </span>
            </div>
            <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                style={{ "--asset-bar-width": `${progress.currentAssetPercentage}%` } as React.CSSProperties}
                className="h-full w-[var(--asset-bar-width)] bg-white/60 rounded-full transition-all duration-200"
              />
            </div>
          </div>
        )}

        {/* Itemized Phased Priority Checklist */}
        <div className="space-y-2 pt-1 border-t border-white/10">
          <div className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
            Package Components
          </div>

          <div className="space-y-1.5 text-xs">
            {/* P0 */}
            <div className="flex items-center justify-between py-1 px-2.5 rounded-xl bg-white/[0.02]">
              <span className="text-white/80">P0: 3D Avatar & Stage Backdrop</span>
              {progress.isP0Ready ? (
                <span className="flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[#0071e3] text-[11px]">
                  <Loader2 className="h-3 w-3 animate-spin" /> Syncing
                </span>
              )}
            </div>

            {/* P1 */}
            <div className="flex items-center justify-between py-1 px-2.5 rounded-xl bg-white/[0.02]">
              <span className="text-white/80">P1: 3D Auditorium Mesh</span>
              {progress.overallPercentage >= 85 ? (
                <span className="flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                </span>
              ) : (
                <span className="text-white/40 text-[11px]">Pending</span>
              )}
            </div>

            {/* P2 */}
            <div className="flex items-center justify-between py-1 px-2.5 rounded-xl bg-white/[0.02]">
              <span className="text-white/80">P2: Studio Environment Lighting</span>
              {progress.isComplete ? (
                <span className="flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                </span>
              ) : (
                <span className="text-white/40 text-[11px]">Pending</span>
              )}
            </div>
          </div>
        </div>

        {/* Live Audio Streaming Notification */}
        {isPaused && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span>Paused for live lecture audio. Resuming automatically...</span>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2">
          <button
            onClick={() => setIsMinimized(true)}
            className="w-full py-2.5 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs tracking-tight transition-all border border-white/10"
          >
            Continue to Dashboard in Background
          </button>
        </div>
      </div>
    </div>
  );
}
