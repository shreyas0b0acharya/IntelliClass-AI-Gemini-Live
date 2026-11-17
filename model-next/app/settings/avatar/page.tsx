
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useIsMounted } from "@/hooks/useIsMounted";

import {
  useModelPreferences,
  MALE_MODEL_PRESETS,
  FEMALE_MODEL_PRESETS,
  DEFAULT_MODEL_PREFERENCES,
  getModelPreferences,
  GenderSelector,
  ModelNameInput,
  VoiceSpeedControls,
} from "@/features/settings";

import type { HeadTTSData } from "@/features/avatar";

// Pure CSR Dynamic Import for 3D Avatar Preview (skips SSR evaluation)
const AvatarPreview = dynamic(
  () => import("@/features/avatar/components/AvatarPreview").then((m) => m.AvatarPreview),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[360px] flex flex-col items-center justify-center gap-3 bg-muted/20 rounded-2xl border border-border/40 select-none">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground font-medium">Loading 3D avatar preview...</span>
      </div>
    ),
  }
);

import {
  scheduleAudioPlayback,
  stopAllAudio,
} from "@/features/avatar/services/audioManager";

import {
  getSynchronizedEpochMs,
} from "@/features/avatar/services/clockSync";

import { useAuth } from "@/features/auth";
import { Button } from "@/components/ui/button";

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
  Loader2,
} from "lucide-react";

import { toast } from "sonner";

export default function AvatarSettingsPage() {
  const router = useRouter();
  const hasMounted = useIsMounted();

  const { isLecturer, isLoading } = useAuth();
  const { updatePreferences } = useModelPreferences();

  // --------------------------------------------------
  // Redirect students away from Avatar Settings
  // --------------------------------------------------

  useEffect(() => {
    if (!isLoading && !isLecturer) {
      router.replace("/settings");
    }
  }, [isLoading, isLecturer, router]);

  // --------------------------------------------------
  // Avatar preferences
  // --------------------------------------------------

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

  // --------------------------------------------------
  // TTS and LipSync state
  // --------------------------------------------------

  const [isSpeaking, setIsSpeaking] = useState(false);

  const [audioPath, setAudioPath] = useState<string | undefined>();

  const [lipSyncData, setLipSyncData] = useState<
    HeadTTSData | undefined
  >();

  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // --------------------------------------------------
  // Audio playback controls
  // --------------------------------------------------

  /**
   * Called when HeadTTS generates audio successfully.
   *
   * The audio manager handles actual audio playback.
   * AvatarPreview handles the visual lip-sync animation.
   */
  const handleAudioDataReceived = (
    path: string | undefined,
    data: HeadTTSData | undefined
  ) => {
    if (!path) {
      toast.error("Audio generation completed without an audio file.");
      setIsSpeaking(false);
      return;
    }

    // Stop any previous preview audio.
    stopAllAudio();

    // Update avatar preview data.
    setAudioPath(path);
    setLipSyncData(data);

    // Schedule audio using the synchronized clock.
    const targetEpochMs = getSynchronizedEpochMs() + 100;

    void scheduleAudioPlayback(
      path,
      targetEpochMs,
      () => {
        // Audio playback completed.
        setIsSpeaking(false);
      }
    );
  };

  /**
   * Handles Play and Stop state changes from HeadTTSTestButton.
   */
  const handlePlayStateChange = (playing: boolean) => {
    if (!playing) {
      // Stop actual audio when the user clicks Stop.
      stopAllAudio();
    }

    setIsSpeaking(playing);
  };

  /**
   * Handles avatar lip-sync completion.
   */
  const handleLipSyncEnd = () => {
    setIsSpeaking(false);
  };

  /**
   * Reset preview when avatar gender changes.
   */
  const handleGenderChange = (gender: "male" | "female") => {
    stopAllAudio();

    setDefaultGender(gender);
    setAudioPath(undefined);
    setLipSyncData(undefined);
    setIsSpeaking(false);
  };

  // --------------------------------------------------
  // Save preferences
  // --------------------------------------------------

  const handleSave = async () => {
    setIsSaving(true);

    try {
      await updatePreferences({
        defaultGender,

        defaultMaleModelName:
          defaultMaleModelName.trim() ||
          DEFAULT_MODEL_PREFERENCES.defaultMaleModelName,

        defaultFemaleModelName:
          defaultFemaleModelName.trim() ||
          DEFAULT_MODEL_PREFERENCES.defaultFemaleModelName,

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

  // --------------------------------------------------
  // Reset preferences
  // --------------------------------------------------

  const handleReset = async () => {
    stopAllAudio();

    setDefaultGender(DEFAULT_MODEL_PREFERENCES.defaultGender);

    setDefaultMaleModelName(
      DEFAULT_MODEL_PREFERENCES.defaultMaleModelName
    );

    setDefaultFemaleModelName(
      DEFAULT_MODEL_PREFERENCES.defaultFemaleModelName
    );

    setDefaultMaleVoice(
      DEFAULT_MODEL_PREFERENCES.defaultMaleVoice
    );

    setDefaultFemaleVoice(
      DEFAULT_MODEL_PREFERENCES.defaultFemaleVoice
    );

    setSpeechSpeed(
      DEFAULT_MODEL_PREFERENCES.speechSpeed
    );

    setAudioPath(undefined);
    setLipSyncData(undefined);
    setIsSpeaking(false);

    try {
      await updatePreferences(DEFAULT_MODEL_PREFERENCES);

      toast.info("Reset to system default preferences in Supabase.");
    } catch {
      toast.error("Failed to reset preferences in Supabase.");
    }
  };

  // --------------------------------------------------
  // Current avatar configuration
  // --------------------------------------------------

  const currentModelName =
    defaultGender === "male"
      ? defaultMaleModelName
      : defaultFemaleModelName;

  const currentVoiceId =
    defaultGender === "female"
      ? defaultFemaleVoice
      : defaultMaleVoice;

  const previewPrompt = `Hello! I am ${
    currentModelName || "your professor"
  }. I will deliver your interactive AI lectures with HeadTTS neural speech synthesis.`;

  // --------------------------------------------------
  // Authentication loading
  // --------------------------------------------------

  if (!hasMounted || isLoading || !isLecturer) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded-xl" />
        <div className="h-96 w-full bg-muted/40 rounded-3xl" />
      </div>
    );
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="space-y-6 animate-in fade-in duration-200">

      {/* Navigation Breadcrumb */}

      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3">

          <Button
            asChild
            variant="ghost"
            size="xs"
            className="h-8"
          >
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </Link>
          </Button>

          <div className="h-3.5 w-px bg-black/10 dark:bg-white/10" />

          <Breadcrumb>
            <BreadcrumbList>

              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link
                    href="/dashboard"
                    className="hover:text-primary transition-colors"
                  >
                    Faculty Studio
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>

              <BreadcrumbSeparator />

              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link
                    href="/settings"
                    className="hover:text-primary transition-colors"
                  >
                    Settings
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>

              <BreadcrumbSeparator />

              <BreadcrumbItem>
                <BreadcrumbPage>
                  AI Avatar &amp; Voice
                </BreadcrumbPage>
              </BreadcrumbItem>

            </BreadcrumbList>
          </Breadcrumb>

        </div>
      </div>

      {/* Header Card */}

      <div className="bg-white dark:bg-card rounded-2xl border border-black/5 dark:border-white/10 shadow-xs p-6">

        <div className="flex items-center gap-4">

          <div className="w-12 h-12 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary shrink-0 shadow-xs">
            <Sliders className="h-6 w-6" />
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground dark:text-foreground">
              AI Avatar &amp; Voice Studio
            </h1>

            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Configure default 3D instructor models, Kokoro neural voices,
              speech pace, and real-time lip sync preview.
            </p>
          </div>

        </div>
      </div>

      {/* Main Settings Grid */}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column */}

        <div className="lg:col-span-7 space-y-6">

          {/* Section 1: Avatar Gender */}

          <div className="bg-white dark:bg-card rounded-2xl border border-black/5 dark:border-white/10 shadow-xs p-6 space-y-3.5">

            <div className="space-y-0.5">
              <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Default Avatar Persona &amp; Gender
              </h2>

              <p className="text-xs text-muted-foreground">
                Select the primary 3D instructor persona to automatically
                select when creating a new lecture.
              </p>
            </div>

            <GenderSelector
              value={defaultGender}
              onChange={handleGenderChange}
            />

          </div>

          {/* Section 2: Model Names */}

          <div className="bg-white dark:bg-card rounded-2xl border border-black/5 dark:border-white/10 shadow-xs p-6 space-y-5">

            <div className="space-y-0.5">
              <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Default Model Names &amp; Presets
              </h2>

              <p className="text-xs text-muted-foreground">
                Specify default display names and titles for male and female
                3D instructor models.
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

          {/* Section 3: Voice Configuration */}

          <div className="bg-white dark:bg-card rounded-2xl border border-black/5 dark:border-white/10 shadow-xs p-6 space-y-4">

            <div className="space-y-0.5">
              <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                HeadTTS Voice &amp; Audio Configuration
              </h2>

              <p className="text-xs text-muted-foreground">
                Select local Kokoro neural voice profiles and speech pace
                delivered by HeadTTS.
              </p>
            </div>

            <VoiceSpeedControls
              gender={defaultGender}
              voiceId={currentVoiceId}
              onVoiceChange={(voice) => {
                if (defaultGender === "male") {
                  setDefaultMaleVoice(voice);
                } else {
                  setDefaultFemaleVoice(voice);
                }
              }}
              speed={speechSpeed}
              onSpeedChange={setSpeechSpeed}
            />

          </div>

        </div>

        {/* Right Column */}

        <div className="lg:col-span-5 space-y-6">

          {/* Section 4: 3D Avatar Preview */}

          <div className="bg-white dark:bg-card rounded-3xl border border-black/5 dark:border-white/10 shadow-xs p-6 space-y-4">

            <div className="flex items-center justify-between">

              <div className="space-y-0.5">

                <h3 className="text-sm font-bold text-foreground dark:text-foreground">
                  {currentModelName || "3D Instructor Avatar"}
                </h3>

                <p className="text-xs text-muted-foreground">
                  {defaultGender === "male"
                    ? "Male Avatar Mesh"
                    : "Female Avatar Mesh"}{" "}
                  &bull; Real-time 3D Viewport
                </p>

              </div>

              <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20">
                ACTIVE
              </span>

            </div>

            {/* Avatar Canvas */}
            <AvatarPreview
              gender={defaultGender}
              isSpeaking={false}
              className="w-full h-72 rounded-2xl"
            />
          </div>

          {/* Save and Reset Actions */}

          <div className="bg-white dark:bg-card rounded-3xl border border-black/5 dark:border-white/10 shadow-xs p-6 space-y-3">

            <Button
              onClick={handleSave}
              disabled={isSaving}
              variant="default"
              className="w-full h-11"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span>Saving to Supabase...</span>
                </>
              ) : (
                <>
                  {isSaved ? (
                    <Check className="h-4 w-4 stroke-2" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}

                  <span>
                    {isSaved
                      ? "Preferences Saved!"
                      : "Save Model Preferences"}
                  </span>
                </>
              )}
            </Button>

            <Button
              variant="secondary"
              onClick={handleReset}
              className="w-full h-10 inline-flex items-center justify-center"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset to System Defaults</span>
            </Button>

          </div>

        </div>

      </div>

    </div>
  );
}
