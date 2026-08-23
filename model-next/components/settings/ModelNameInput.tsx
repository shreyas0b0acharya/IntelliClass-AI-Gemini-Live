"use client";

import { useAuth } from "@/lib/auth/AuthContext";
import { Label } from "@/components/ui/label";
import { User, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface ModelNameInputProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  presets: string[];
  gender: "male" | "female";
  disabled?: boolean;
  id?: string;
}

export function ModelNameInput({
  label = "Lecturer Model Name",
  value,
  onChange,
  presets,
  gender,
  disabled = false,
  id = "model-name-input",
}: ModelNameInputProps) {
  const { profile } = useAuth();

  const handleUseMyName = () => {
    if (!profile?.name) {
      toast.info("User account name not found.");
      return;
    }
    const prefix = gender === "female" ? "Dr." : "Prof.";
    const fullName = `${prefix} ${profile.name}`;
    onChange(fullName);
    toast.success(`Populated model name: ${fullName}`);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-[11px] font-semibold tracking-wider text-[#86868b] uppercase">
          {label}
        </Label>
        {profile?.name && (
          <button
            type="button"
            disabled={disabled}
            onClick={handleUseMyName}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-black/5 dark:bg-white/10 hover:bg-[#0071e3]/10 hover:text-[#0071e3] dark:hover:text-[#0071e3] text-[#86868b] dark:text-[#a1a1a6] transition-colors cursor-pointer disabled:opacity-50"
          >
            <User className="h-3 w-3" />
            <span>Use My Name ({profile.name})</span>
          </button>
        )}
      </div>

      {/* Apple HIG Standardized Input */}
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={gender === "male" ? "e.g. Prof. Arthur" : "e.g. Dr. Clara"}
        className="w-full rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] focus:bg-white dark:focus:bg-[#1c1c1e] border border-transparent focus:border-[#0071e3] dark:focus:border-[#0071e3] px-4 py-2.5 text-sm text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] outline-none transition-all shadow-2xs disabled:opacity-50"
      />

      {/* Preset Name Chips */}
      {presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[11px] text-[#86868b] mr-1">Presets:</span>
          {presets.map((preset) => {
            const isSelected = value.trim().toLowerCase() === preset.toLowerCase();
            return (
              <button
                key={preset}
                type="button"
                disabled={disabled}
                onClick={() => onChange(preset)}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#0071e3] text-white shadow-2xs"
                    : "bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[#1d1d1f] dark:text-[#f5f5f7]"
                } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {preset}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
