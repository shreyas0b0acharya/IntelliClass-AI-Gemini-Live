"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useModelPreferences,
  MALE_MODEL_PRESETS,
  FEMALE_MODEL_PRESETS,
  DEFAULT_MODEL_PREFERENCES,
  getModelPreferences,
} from "@/lib/settings";
import { AvatarPreview } from "@/components/AvatarPreview";
import { GenderSelector } from "@/components/settings/GenderSelector";
import { ModelNameInput } from "@/components/settings/ModelNameInput";
import { VoiceSpeedControls } from "@/components/settings/VoiceSpeedControls";
import { HeadTTSTestButton } from "@/components/settings/HeadTTSTestButton";
import { useAuth } from "@/lib/auth/AuthContext";
import type { HeadTTSData } from "@/components/LipSync/lipSync.types";
import { AppButton } from "@/components/app/AppButton";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  Sparkles,
  Check,
  RotateCcw,
  Sliders,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

export default function AvatarSettingsPage() {
  const router = useRouter();
  const { isLecturer, isLoading } = useAuth();
  const { updatePreferences } = useModelPreferences();

  // Redirect students away from Avatar Settings to Account Settings
  useEffect(() => {
    if (!isLoading && !isLecturer) {
      router.replace("/settings");
    }
  }, [isLoading, isLecturer, router]);

  // Local editable state initialized directly from synchronous getModelPreferences()
  const [defaultGender, setDefaultGender] = useState<"male" | "female">(
    () => getModelPreferences().defaultGender
  );
  const [defaultMaleModelName, setDefaultMaleModelName] = useState(
    () => getModelPreferences().defaultMaleModelName
  );
  const [defaultFemaleModelName, setDefaultFemaleModelName] = useState(
    () => getModelPreferences().defaultFemaleModelName
  );
  const [defaultMaleVoice, setDefaultMaleVoice] = useState(
    () => getModelPreferences().defaultMaleVoice
  );
  const [defaultFemaleVoice, setDefaultFemaleVoice] = useState(
    () => getModelPreferences().defaultFemaleVoice
  );
  const [speechSpeed, setSpeechSpeed] = useState(
    () => getModelPreferences().speechSpeed
  );

  // HeadTTS synthesis & LipSync state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioPath, setAudioPath] = useState<string | undefined>();
  const [lipSyncData, setLipSyncData] = useState<HeadTTSData | undefined>();
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePreferences({
        defaultGender,
        defaultMaleModelName: defaultMaleModelName.trim() || DEFAULT_MODEL_PREFERENCES.defaultMaleModelName,
        defaultFemaleModelName: defaultFemaleModelName.trim() || DEFAULT_MODEL_PREFERENCES.defaultFemaleModelName,
        defaultMaleVoice,
        defaultFemaleVoice,
        speechSpeed,
      });
      setIsSaved(true);
      toast.success("AI Avatar preferences saved to cloud!");
      setTimeout(() => setIsSaved(false), 2500);
    } catch {
      toast.error("Failed to save preferences to Supabase.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setDefaultGender(DEFAULT_MODEL_PREFERENCES.defaultGender);
    setDefaultMaleModelName(DEFAULT_MODEL_PREFERENCES.defaultMaleModelName);
    setDefaultFemaleModelName(DEFAULT_MODEL_PREFERENCES.defaultFemaleModelName);
    setDefaultMaleVoice(DEFAULT_MODEL_PREFERENCES.defaultMaleVoice);
    setDefaultFemaleVoice(DEFAULT_MODEL_PREFERENCES.defaultFemaleVoice);
    setSpeechSpeed(DEFAULT_MODEL_PREFERENCES.speechSpeed);
    try {
      await updatePreferences(DEFAULT_MODEL_PREFERENCES);
      toast.info("Reset to system default preferences in Supabase.");
    } catch {
      toast.error("Failed to reset preferences in Supabase.");
    }
  };

  const currentModelName =
    defaultGender === "male" ? defaultMaleModelName : defaultFemaleModelName;
  const currentVoiceId =
    defaultGender === "female" ? defaultFemaleVoice : defaultMaleVoice;

  const previewPrompt = `Hello! I am ${currentModelName || "your professor"}. I will deliver your interactive AI lectures with HeadTTS neural speech synthesis.`;

  if (isLoading || !isLecturer) {
    return null;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Navigation Breadcrumb Bar with Apple Back Button ────────── */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3">
          <AppButton
            asChild
            variant="ghost"
            size="xs"
            shape="pill"
            className="h-8 px-2.5 text-xs text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white"
            leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}
          >
            <Link href="/dashboard">
              <span>Back</span>
            </Link>
          </AppButton>

          <div className="h-3.5 w-px bg-black/10 dark:bg-white/10" />

          <Breadcrumb className="text-xs">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/dashboard" className="hover:text-[#0071e3] transition-colors">
                    Faculty Studio
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/settings" className="hover:text-[#0071e3] transition-colors">
                    Settings
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-semibold text-[#0071e3]">
                  AI Avatar &amp; Voice
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      {/* ── Apple Inset Header Card ─────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/5 dark:border-white/10 shadow-xs p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#0071e3]/10 dark:bg-[#0071e3]/20 flex items-center justify-center text-[#0071e3] shrink-0 shadow-xs">
            <Sliders className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
              AI Avatar &amp; Voice Studio
            </h1>
            <p className="text-xs text-[#86868b] mt-0.5 leading-relaxed">
              Configure default 3D instructor models, Kokoro neural voices, speech pace, and real-time lip sync preview.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Left Column: Inset Grouped Settings Cards ─────────────── */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Default Avatar Persona & Gender */}
          <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/5 dark:border-white/10 shadow-xs p-6 space-y-3.5">
            <div className="space-y-0.5">
              <h2 className="text-[11px] font-semibold tracking-wider text-[#86868b] uppercase">
                Default Avatar Persona &amp; Gender
              </h2>
              <p className="text-xs text-[#86868b]">
                Select the primary 3D instructor persona to automatically select when creating a new lecture.
              </p>
            </div>

            <GenderSelector
              value={defaultGender}
              onChange={(g) => {
                setDefaultGender(g);
                setAudioPath(undefined);
                setLipSyncData(undefined);
                setIsSpeaking(false);
              }}
            />
          </div>

          {/* Section 2: Default Model Names & Presets */}
          <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/5 dark:border-white/10 shadow-xs p-6 space-y-5">
            <div className="space-y-0.5">
              <h2 className="text-[11px] font-semibold tracking-wider text-[#86868b] uppercase">
                Default Model Names &amp; Presets
              </h2>
              <p className="text-xs text-[#86868b]">
                Specify default display names and titles for male and female 3D instructor models.
              </p>
            </div>

            {/* Male Model Name */}
            <ModelNameInput
              id="default-male-name"
              label="Male Model Default Name"
              value={defaultMaleModelName}
              onChange={setDefaultMaleModelName}
              presets={MALE_MODEL_PRESETS}
              gender="male"
            />

            {/* Female Model Name */}
            <div className="pt-3 border-t border-black/5 dark:border-white/5">
              <ModelNameInput
                id="default-female-name"
                label="Female Model Default Name"
                value={defaultFemaleModelName}
                onChange={setDefaultFemaleModelName}
                presets={FEMALE_MODEL_PRESETS}
                gender="female"
              />
            </div>
          </div>

          {/* Section 3: HeadTTS Voice & Audio Configuration */}
          <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/5 dark:border-white/10 shadow-xs p-6 space-y-4">
            <div className="space-y-0.5">
              <h2 className="text-[11px] font-semibold tracking-wider text-[#86868b] uppercase">
                HeadTTS Voice &amp; Audio Configuration
              </h2>
              <p className="text-xs text-[#86868b]">
                Select local Kokoro neural voice profiles and speech pace delivered by HeadTTS.
              </p>
            </div>

            <VoiceSpeedControls
              gender={defaultGender}
              voiceId={currentVoiceId}
              onVoiceChange={(v) => {
                if (defaultGender === "male") setDefaultMaleVoice(v);
                else setDefaultFemaleVoice(v);
              }}
              speed={speechSpeed}
              onSpeedChange={setSpeechSpeed}
            />
          </div>
        </div>

        {/* ── Right Column: 3D Viewport Preview & Actions ────────────── */}
        <div className="lg:col-span-5 space-y-6">
          {/* Section 4: 3D Viewport Preview */}
          <div className="bg-white dark:bg-[#1c1c1e] rounded-3xl border border-black/5 dark:border-white/10 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  {currentModelName || "3D Instructor Avatar"}
                </h3>
                <p className="text-[11px] text-[#86868b]">
                  {defaultGender === "male" ? "Male Avatar Mesh" : "Female Avatar Mesh"} &bull; Real-time 3D Viewport
                </p>
              </div>
              <span className="text-[10px] font-semibold bg-[#0071e3]/10 text-[#0071e3] px-2.5 py-0.5 rounded-full border border-[#0071e3]/20">
                ACTIVE
              </span>
            </div>

            {/* 3D Canvas Preview Frame */}
            <AvatarPreview
              gender={defaultGender}
              isSpeaking={isSpeaking}
              audioPath={audioPath}
              lipSyncData={lipSyncData}
              onLipSyncEnd={() => setIsSpeaking(false)}
              className="w-full h-72 rounded-2xl"
            />

            {/* Reusable HeadTTS Test Button */}
            <div className="pt-0.5">
              <HeadTTSTestButton
                text={previewPrompt}
                voice={currentVoiceId}
                speed={speechSpeed}
                isPlaying={isSpeaking}
                onPlayStateChange={setIsSpeaking}
                onDataReceived={(path, data) => {
                  setAudioPath(path);
                  setLipSyncData(data);
                }}
                className="w-full rounded-full h-11 font-semibold text-xs shadow-xs cursor-pointer gap-2"
              />
            </div>
          </div>

          {/* Action Controls: Save & Reset */}
          <div className="bg-white dark:bg-[#1c1c1e] rounded-3xl border border-black/5 dark:border-white/10 shadow-xs p-6 space-y-3">
            <AppButton
              onClick={handleSave}
              disabled={isSaving}
              isLoading={isSaving}
              loadingText="Saving to Supabase..."
              variant={isSaved ? "success" : "primary"}
              shape="pill"
              className="w-full h-11 font-semibold text-xs sm:text-sm shadow-xs border-0"
              leftIcon={
                !isSaving ? (
                  isSaved ? (
                    <Check className="h-4 w-4 stroke-[2.5]" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )
                ) : undefined
              }
            >
              <span>{isSaved ? "Preferences Saved!" : "Save Model Preferences"}</span>
            </AppButton>

            <AppButton
              variant="secondary"
              shape="pill"
              onClick={handleReset}
              className="w-full h-10 text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white font-medium text-xs border-0 shadow-none"
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
            >
              <span>Reset to System Defaults</span>
            </AppButton>
          </div>
        </div>
      </div>
    </div>
  );
}
