"use client";

import { useEffect, useState } from "react";
import { Sparkles, Mic, Volume2 } from "lucide-react";
import { DEFAULT_AVATAR_MODEL, DEFAULT_FEMALE_AVATAR_MODEL } from "@/config";

interface Lecturer2DFallbackProps {
  model?: string;
  isSpeaking: boolean;
  subtitle?: string;
  isThinking?: boolean;
  sessionStatus?: string;
}

export function Lecturer2DFallback({
  model = DEFAULT_AVATAR_MODEL,
  isSpeaking,
}: Lecturer2DFallbackProps) {
  const isFemale = model === DEFAULT_FEMALE_AVATAR_MODEL;
  const avatarName = isFemale ? "Professor Elena" : "Professor Sharma";
  const avatarInitials = isFemale ? "PE" : "PS";

  // Rhythmic waveform bar heights during speech
  const [waveformBars, setWaveformBars] = useState([20, 40, 65, 30, 80, 50, 25, 70, 45, 20]);

  useEffect(() => {
    if (!isSpeaking) return;

    const interval = setInterval(() => {
      setWaveformBars(
        Array.from({ length: 12 }, () => Math.floor(Math.random() * 70) + 15)
      );
    }, 110);

    return () => clearInterval(interval);
  }, [isSpeaking]);

  return (
    <div className="relative w-full h-full min-h-0 rounded-2xl md:rounded-3xl overflow-hidden bg-gradient-to-b from-card via-background to-black border border-white/10 shadow-2xl flex flex-col items-center justify-between p-3 sm:p-6 select-none">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className={`absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl transition-all duration-700 ${
            isSpeaking
              ? "bg-primary/20 scale-110 opacity-100"
              : "bg-white/[0.03] scale-90 opacity-50"
          }`}
        />
      </div>

      {/* Top Status Pill */}
      <div className="relative z-10 w-full flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white text-xs font-semibold">
          <span
            className={`w-2 h-2 rounded-full ${
              isSpeaking ? "bg-chart-2 animate-ping" : "bg-white/40"
            }`}
          />
          <span>{isSpeaking ? "Speaking" : "Active Lecturer"}</span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/70">
          <Sparkles className="h-3 w-3 text-primary" />
          <span>IntelliClass Stream (Optimized Mode)</span>
        </div>
      </div>

      {/* Main Center Avatar Portrait & Audio Waveform */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto space-y-6">
        {/* Avatar Ring Container */}
        <div className="relative flex items-center justify-center">
          {/* Animated Speaking Rings */}
          {isSpeaking && (
            <>
              <div className="absolute -inset-4 rounded-full bg-primary/20 animate-ping duration-1000" />
              <div className="absolute -inset-8 rounded-full border border-primary/30 animate-pulse duration-700" />
            </>
          )}

          <div
            className={`w-32 h-32 sm:w-40 sm:h-40 rounded-full flex flex-col items-center justify-center text-white font-bold text-3xl sm:text-4xl shadow-2xl transition-all duration-500 border-2 ${
              isSpeaking
                ? "bg-gradient-to-br from-primary to-primary border-white/40 scale-105 shadow-primary/30"
                : "bg-gradient-to-br from-muted to-card border-white/15 scale-100"
            }`}
          >
            <span>{avatarInitials}</span>
            <span className="text-xs sm:text-xs font-medium tracking-wider text-white/80 uppercase mt-1">
              AI Faculty
            </span>
          </div>

          {/* Floating Microphone Indicator */}
          <div
            className={`absolute bottom-0 right-1 w-9 h-9 rounded-full flex items-center justify-center shadow-lg border border-white/20 transition-all ${
              isSpeaking
                ? "bg-chart-2 text-white scale-110"
                : "bg-muted text-white/50 scale-100"
            }`}
          >
            {isSpeaking ? <Volume2 className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </div>
        </div>

        {/* Lecturer Info & Dynamic Audio Waveform */}
        <div className="text-center space-y-3">
          <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">{avatarName}</h3>

          {/* Synchronized Animated Waveform Bars */}
          <div className="flex items-center justify-center gap-1.5 h-8 px-4 py-1 rounded-2xl bg-white/[0.04] border border-white/10">
            {waveformBars.map((height, idx) => (
              <div
                key={idx}
                style={{ "--bar-height": isSpeaking ? `${height}%` : "15%" } as React.CSSProperties}
                className={`w-1 h-[var(--bar-height)] rounded-full transition-all duration-150 ${
                  isSpeaking ? "bg-primary" : "bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
