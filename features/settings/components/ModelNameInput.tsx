"use client";

import { useAuth } from "@/features/auth";
import { Label } from "@/components/ui/label";
import { User } from "lucide-react";
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
        <Label htmlFor={id}>
          {label}
        </Label>
        {profile?.name && (
          <button
            type="button"
            disabled={disabled}
            onClick={handleUseMyName}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-black/5 dark:bg-white/10 hover:bg-primary/10 hover:text-primary dark:hover:text-primary text-muted-foreground dark:text-muted-foreground transition-colors cursor-pointer disabled:opacity-50"
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
        className="w-full rounded-xl bg-muted dark:bg-muted focus:bg-white dark:focus:bg-card border border-transparent focus:border-primary dark:focus:border-primary px-4 py-2.5 text-sm text-foreground dark:text-foreground placeholder:text-muted-foreground outline-none transition-all shadow-2xs disabled:opacity-50"
      />

      {/* Preset Name Chips */}
      {presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-xs text-muted-foreground mr-1">Presets:</span>
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
                    ? "bg-primary text-white shadow-2xs"
                    : "bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-foreground dark:text-foreground"
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

export default ModelNameInput;
