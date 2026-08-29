"use client";

import { Check, User, Sparkles } from "lucide-react";

interface GenderSelectorProps {
  value: "male" | "female";
  onChange: (gender: "male" | "female") => void;
  disabled?: boolean;
}

export function GenderSelector({ value, onChange, disabled = false }: GenderSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Male Persona Tile */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("male")}
        className={`relative flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 cursor-pointer text-left ${
          value === "male"
            ? "border-[#0071e3] bg-[#0071e3]/5 dark:bg-[#0071e3]/10 ring-1 ring-[#0071e3]/40 shadow-xs"
            : "border-black/5 dark:border-white/10 bg-[#f5f5f7] dark:bg-[#2c2c2e] hover:bg-black/5 dark:hover:bg-white/5"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <div
          className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs transition-colors ${
            value === "male"
              ? "bg-[#0071e3] text-white shadow-xs"
              : "bg-black/5 dark:bg-white/10 text-[#86868b]"
          }`}
        >
          <User className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
              Male
            </span>
            <span className="text-[9px] font-semibold text-[#86868b] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">
              Fenrir
            </span>
          </div>
          <p className="text-[11px] text-[#86868b] truncate mt-0.5">Prof. Arthur</p>
        </div>
        {value === "male" && (
          <div className="w-4 h-4 rounded-full bg-[#0071e3] text-white flex items-center justify-center shrink-0">
            <Check className="h-2.5 w-2.5 stroke-[3]" />
          </div>
        )}
      </button>

      {/* Female Persona Tile */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("female")}
        className={`relative flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 cursor-pointer text-left ${
          value === "female"
            ? "border-[#0071e3] bg-[#0071e3]/5 dark:bg-[#0071e3]/10 ring-1 ring-[#0071e3]/40 shadow-xs"
            : "border-black/5 dark:border-white/10 bg-[#f5f5f7] dark:bg-[#2c2c2e] hover:bg-black/5 dark:hover:bg-white/5"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <div
          className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs transition-colors ${
            value === "female"
              ? "bg-[#0071e3] text-white shadow-xs"
              : "bg-black/5 dark:bg-white/10 text-[#86868b]"
          }`}
        >
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
              Female
            </span>
            <span className="text-[9px] font-semibold text-[#86868b] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">
              Bella
            </span>
          </div>
          <p className="text-[11px] text-[#86868b] truncate mt-0.5">Dr. Clara</p>
        </div>
        {value === "female" && (
          <div className="w-4 h-4 rounded-full bg-[#0071e3] text-white flex items-center justify-center shrink-0">
            <Check className="h-2.5 w-2.5 stroke-[3]" />
          </div>
        )}
      </button>
    </div>
  );
}

export default GenderSelector;
