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
            ? "border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-ring/40 shadow-xs"
            : "border-black/5 dark:border-white/10 bg-muted dark:bg-muted hover:bg-black/5 dark:hover:bg-white/5"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <div
          className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs transition-colors ${
            value === "male"
              ? "bg-primary text-white shadow-xs"
              : "bg-black/5 dark:bg-white/10 text-muted-foreground"
          }`}
        >
          <User className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold text-foreground dark:text-foreground truncate">
              Male
            </span>
            <span className="text-xs font-semibold text-muted-foreground bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">
              Fenrir
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">Prof. Arthur</p>
        </div>
        {value === "male" && (
          <div className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
            <Check className="h-2.5 w-2.5 stroke-2" />
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
            ? "border-primary bg-primary/5 dark:bg-primary/10 ring-1 ring-ring/40 shadow-xs"
            : "border-black/5 dark:border-white/10 bg-muted dark:bg-muted hover:bg-black/5 dark:hover:bg-white/5"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <div
          className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs transition-colors ${
            value === "female"
              ? "bg-primary text-white shadow-xs"
              : "bg-black/5 dark:bg-white/10 text-muted-foreground"
          }`}
        >
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-bold text-foreground dark:text-foreground truncate">
              Female
            </span>
            <span className="text-xs font-semibold text-muted-foreground bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">
              Bella
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">Dr. Clara</p>
        </div>
        {value === "female" && (
          <div className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
            <Check className="h-2.5 w-2.5 stroke-2" />
          </div>
        )}
      </button>
    </div>
  );
}

export default GenderSelector;
