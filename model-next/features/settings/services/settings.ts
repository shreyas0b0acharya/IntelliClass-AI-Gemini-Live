"use client";

import { useSyncExternalStore, useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import type { ModelPreferences } from "../types/settings.types";

export type { ModelPreferences };

import {
  DEFAULT_MALE_VOICE_ID,
  DEFAULT_FEMALE_VOICE_ID,
  DEFAULT_ELEVENLABS_VOICE_ID,
  DEFAULT_ELEVENLABS_MODEL_ID,
  DEFAULT_TTS_PROVIDER,
  DEFAULT_SPEECH_SPEED,
  MALE_MODEL_PRESETS,
  FEMALE_MODEL_PRESETS,
} from "@/config";

export { MALE_MODEL_PRESETS, FEMALE_MODEL_PRESETS };

export const DEFAULT_MODEL_PREFERENCES: ModelPreferences = {
  defaultGender: "male",
  defaultMaleModelName: MALE_MODEL_PRESETS[0],
  defaultFemaleModelName: FEMALE_MODEL_PRESETS[0],
  defaultMaleVoice: DEFAULT_MALE_VOICE_ID,
  defaultFemaleVoice: DEFAULT_FEMALE_VOICE_ID,
  speechSpeed: DEFAULT_SPEECH_SPEED,
  speechPitch: 1.0,
  modelQuality: "high",
  ttsProvider: DEFAULT_TTS_PROVIDER,
  elevenLabsVoiceId: DEFAULT_ELEVENLABS_VOICE_ID,
  elevenLabsModelId: DEFAULT_ELEVENLABS_MODEL_ID,
};

import type { VoiceOption, VoiceGender, TTSModelOption } from "@/features/classroom/types/speech";
import {
  TTS_MODELS,
  HEADTTS_VOICE_OPTIONS,
  ELEVENLABS_VOICE_OPTIONS,
  ALL_DEFAULT_VOICE_OPTIONS,
} from "@/features/classroom/constants/voices";

export type { VoiceOption, VoiceGender, TTSModelOption };
export { TTS_MODELS, HEADTTS_VOICE_OPTIONS, ELEVENLABS_VOICE_OPTIONS };
export const VOICE_OPTIONS = HEADTTS_VOICE_OPTIONS;
export const UNIFIED_VOICE_REGISTRY: VoiceOption[] = ALL_DEFAULT_VOICE_OPTIONS;

/**
 * Resolves voice metadata safely.
 * If voice is not in known registry, preserves ID and marks gender as "unknown" (never guesses "male").
 */
export function getVoiceMetadata(voiceId?: string, customList?: VoiceOption[]): VoiceOption {
  if (!voiceId) return HEADTTS_VOICE_OPTIONS[0];

  const pool = customList && customList.length > 0 ? customList : UNIFIED_VOICE_REGISTRY;
  const found = pool.find((v) => v.id === voiceId);
  if (found) return found;

  const isEleven = voiceId.length >= 18 || voiceId.startsWith("elevenlabs:");
  const cleanId = voiceId.replace("elevenlabs:", "");

  return {
    id: cleanId,
    name: `Custom Voice (${cleanId.slice(0, 6)}...)`,
    provider: isEleven ? "elevenlabs" : "headtts",
    gender: "unknown", // Unknown gender: never guess "male"
    description: "Dynamically resolved voice",
  };
}

const SETTINGS_STORAGE_KEY = "intelliclass_model_preferences";

let cachedPreferences: ModelPreferences | null = null;
let remoteFetchPromise: Promise<void> | null = null;

function subscribePreferences(callback: () => void) {
  const handler = (e?: Event) => {
    const customEvent = e as CustomEvent<ModelPreferences | null> | undefined;
    if (customEvent && customEvent.detail === null) {
      cachedPreferences = DEFAULT_MODEL_PREFERENCES;
    } else {
      cachedPreferences = null;
    }
    callback();
  };
  window.addEventListener("intelliclass_preferences_changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("intelliclass_preferences_changed", handler);
    window.removeEventListener("storage", handler);
  };
}

/**
 * Retrieve saved preferences synchronously or fallback to system defaults
 */
export function getModelPreferences(): ModelPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_MODEL_PREFERENCES;
  }

  if (cachedPreferences !== null) {
    return cachedPreferences;
  }

  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      cachedPreferences = DEFAULT_MODEL_PREFERENCES;
      return DEFAULT_MODEL_PREFERENCES;
    }
    const parsed = JSON.parse(raw);
    const result: ModelPreferences = {
      ...DEFAULT_MODEL_PREFERENCES,
      ...parsed,
    };
    cachedPreferences = result;
    return result;
  } catch (err) {
    console.warn("Failed to read model preferences from localStorage:", err);
    cachedPreferences = DEFAULT_MODEL_PREFERENCES;
    return DEFAULT_MODEL_PREFERENCES;
  }
}

/**
 * Syncs preferences from Supabase into local cache & state
 */
export async function syncPreferencesFromSupabase(): Promise<ModelPreferences> {
  if (typeof window === "undefined") return DEFAULT_MODEL_PREFERENCES;
  if (remoteFetchPromise) {
    await remoteFetchPromise;
    return getModelPreferences();
  }

  remoteFetchPromise = (async () => {
    try {
      const { preferences: remotePrefs } = await api.getSettings();
      if (remotePrefs) {
        cachedPreferences = remotePrefs;
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(remotePrefs));
        window.dispatchEvent(
          new CustomEvent("intelliclass_preferences_changed", { detail: remotePrefs })
        );
      } else {
        cachedPreferences = DEFAULT_MODEL_PREFERENCES;
      }
    } catch (err) {
      console.warn("Could not sync preferences from Supabase:", err);
    } finally {
      remoteFetchPromise = null;
    }
  })();

  await remoteFetchPromise;
  return getModelPreferences();
}

/**
 * Save model preferences to localStorage, notify listeners, and persist to Supabase
 */
export function saveModelPreferences(
  updates: Partial<ModelPreferences>,
  persistRemote: boolean = true
): ModelPreferences {
  if (typeof window === "undefined") {
    return { ...DEFAULT_MODEL_PREFERENCES, ...updates };
  }

  try {
    const current = getModelPreferences();
    const updated: ModelPreferences = {
      ...current,
      ...updates,
    };
    cachedPreferences = updated;
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent("intelliclass_preferences_changed", { detail: updated })
    );

    // Persist to Supabase in background
    if (persistRemote) {
      api.saveSettings(updated).catch((err) => {
        console.warn("Background save to Supabase preferences failed:", err);
      });
    }

    return updated;
  } catch (err) {
    console.error("Failed to save model preferences:", err);
    return DEFAULT_MODEL_PREFERENCES;
  }
}

/**
 * Custom React Hook for model preferences with real-time sync with Supabase and cross-tabs
 */
export function useModelPreferences() {
  const preferences = useSyncExternalStore(
    subscribePreferences,
    getModelPreferences,
    () => DEFAULT_MODEL_PREFERENCES
  );

  // Sync from Supabase on mount
  useEffect(() => {
    syncPreferencesFromSupabase();
  }, []);

  const updatePreferences = useCallback(
    async (updates: Partial<ModelPreferences>) => {
      saveModelPreferences(updates, false); // Instant local optimistic update
      try {
        const res = await api.saveSettings(updates);
        if (res.preferences) {
          saveModelPreferences(res.preferences, false);
        }
        return res.preferences;
      } catch (err) {
        console.error("Failed to update preferences on Supabase:", err);
        throw err;
      }
    },
    []
  );

  return {
    preferences,
    updatePreferences,
    defaultName:
      preferences.defaultGender === "male"
        ? preferences.defaultMaleModelName
        : preferences.defaultFemaleModelName,
  };
}
