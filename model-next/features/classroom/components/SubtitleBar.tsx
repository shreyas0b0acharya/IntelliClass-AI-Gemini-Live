"use client";

interface SubtitleBarProps {
  subtitle: string;
}

export function SubtitleBar({ subtitle }: SubtitleBarProps) {
  if (!subtitle || !subtitle.trim()) return null;

  return (
    <div className="w-full max-w-2xl px-4 pointer-events-none">
      <div className="p-4 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/10 text-center text-sm font-semibold text-white shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
        {subtitle}
      </div>
    </div>
  );
}
