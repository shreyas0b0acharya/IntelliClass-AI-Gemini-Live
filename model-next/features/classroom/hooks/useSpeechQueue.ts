"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SpeechItem, SpeechStatus, TTSProviderId } from "../types/speech";
import type { LipSyncData, HeadTTSData } from "@/features/avatar";
import { fetchSpeechTTS } from "../services/tts";
import {
  preloadAudioBuffer,
  scheduleAudioPlayback,
  stopAllAudio,
} from "@/features/avatar";

export interface UseSpeechQueueOptions {
  voice?: string;
  provider?: TTSProviderId;
  modelId?: string;
  speed?: number;
  onSpeechComplete?: (itemId: string, requestId: string) => void;
  onError?: (error: Error, itemId?: string) => void;
}

// ─────────────────────────────────────────────
// Payload shape for scheduled playback
// ─────────────────────────────────────────────
export interface ScheduledPlayPayload {
  audioUrl: string;
  targetEpochMs: number;    // synchronized epoch when audio should start
  lipSyncData: LipSyncData;
  sequence: number;         // monotonic sequence — used to gate morph animation
  text: string;
  itemId: string;
  durationMs?: number;
  offsetMs?: number;        // for SEEK_SYNC late-joiner seeking (default 0)
}

export function useSpeechQueue({
  voice = "af_bella",
  provider = "headtts",
  modelId,
  speed = 1.0,
  onSpeechComplete,
  onError,
}: UseSpeechQueueOptions = {}) {
  const [currentSpeech, setCurrentSpeech] = useState<SpeechItem | null>(null);
  const [status, setStatus] = useState<SpeechStatus>("idle");

  const activeRequestIdRef = useRef<string | null>(null);
  const activeItemIdRef = useRef<string | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const prefetchCacheRef = useRef<Map<string, SpeechItem>>(new Map());
  const inFlightRef = useRef<Map<string, Promise<SpeechItem>>>(new Map());

  // ── Stop ──────────────────────────────────────────────────────────────

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Cancel any hardware-scheduled source
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.onended = null;
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch {}
      activeSourceRef.current = null;
    }
    stopAllAudio();
    activeRequestIdRef.current = null;
    activeItemIdRef.current = null;
    setCurrentSpeech(null);
    setStatus("idle");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  // ── Internal: fetch or deduplicate in-flight TTS synthesis ────────────

  const getOrFetchItem = useCallback(
    async (
      text: string,
      selectedVoice: string = voice,
      selectedProvider: TTSProviderId = provider,
      selectedModelId?: string,
      selectedSpeed: number = speed,
      signal?: AbortSignal
    ): Promise<SpeechItem> => {
      const cleanText = text.trim();
      const effModel = selectedModelId || (selectedProvider === "elevenlabs" ? "eleven_flash_v2_5" : "kokoro-82m-onnx");
      const cacheKey = `${selectedProvider}_${effModel}_${selectedVoice}_${cleanText}_${selectedSpeed.toFixed(2)}`;

      const existing = prefetchCacheRef.current.get(cacheKey);
      if (existing) return existing;

      const inFlight = inFlightRef.current.get(cacheKey);
      if (inFlight) return inFlight;

      const fetchPromise = (async () => {
        try {
          const item = await fetchSpeechTTS({
            text: cleanText,
            voice: selectedVoice,
            provider: selectedProvider,
            modelId: effModel,
            speed: selectedSpeed,
            signal,
          });

          // Preload decoded buffer immediately — it'll be in RAM before LEAD_TIME expires
          if (typeof window !== "undefined" && item.audioPath) {
            preloadAudioBuffer(item.audioPath);
          }

          prefetchCacheRef.current.set(cacheKey, item);
          return item;
        } finally {
          inFlightRef.current.delete(cacheKey);
        }
      })();

      inFlightRef.current.set(cacheKey, fetchPromise);
      return fetchPromise;
    },
    [voice, provider, modelId, speed]
  );

  // ── Prefetch upcoming sentences in background (device-aware depth) ──
  const prefetch = useCallback(
    async (
      texts: string[],
      selectedVoice: string = voice,
      selectedProvider: TTSProviderId = provider,
      selectedModelId?: string,
      selectedSpeed: number = speed
    ) => {
      const isMobileOrSlow =
        typeof window !== "undefined" &&
        (window.innerWidth <= 768 ||
          (navigator as unknown as { connection?: { saveData?: boolean } })?.connection?.saveData);

      // On mobile/constrained networks, prefetch only N+1 (1 sentence)
      // On desktop, prefetch up to N+2 (2 sentences)
      const maxDepth = isMobileOrSlow ? 1 : 2;
      const uniqueTexts = Array.from(new Set(texts.map((t) => t?.trim()).filter(Boolean))).slice(0, maxDepth);

      if (uniqueTexts.length === 0) return;

      await Promise.allSettled(
        uniqueTexts.map((text) =>
          getOrFetchItem(text, selectedVoice, selectedProvider, selectedModelId, selectedSpeed).catch((err) => {
            console.warn("[SpeechQueue] Background prefetch skipped:", err?.message);
          })
        )
      );
    },
    [voice, provider, speed, getOrFetchItem]
  );

  // ── Synthesize item — returns TTS result for broadcast (driver only) ──

  const synthesizeItem = useCallback(
    async (
      text: string,
      itemId: string,
      selectedVoice: string = voice,
      selectedProvider: TTSProviderId = provider,
      selectedModelId?: string,
      selectedSpeed: number = speed
    ): Promise<SpeechItem | null> => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      activeRequestIdRef.current = requestId;
      activeItemIdRef.current = itemId;

      setStatus("generating");
      try {
        const result = await getOrFetchItem(
          text.trim(),
          selectedVoice,
          selectedProvider,
          selectedModelId,
          selectedSpeed,
          controller.signal
        );
        if (activeRequestIdRef.current !== requestId) return null;
        return { ...result, requestId };
      } catch (err: unknown) {
        const error = err as Error;
        if (error.name === "AbortError" || activeRequestIdRef.current !== requestId) return null;
        console.error("[SpeechQueue] Synthesis failure:", error);
        setStatus("error");
        if (onError) onError(error, itemId);
        return null;
      }
    },
    [voice, provider, speed, onError, getOrFetchItem]
  );

  // ── Play a hardware-scheduled packet ─────────────────────────────
  //
  // Called by BOTH the driver (after local synthesis) AND students (after
  // receiving SCHEDULED_PLAY over broadcast). Uses scheduleAudioPlayback()
  // for sample-accurate multi-device sync.

  const playScheduled = useCallback(
    (payload: ScheduledPlayPayload) => {
      const {
        audioUrl,
        targetEpochMs,
        lipSyncData,
        sequence,
        text,
        itemId,
        durationMs = 0,
        offsetMs = 0,
      } = payload;

      // Cancel any currently playing source cleanly
      stop();

      const requestId = `sched_${sequence}_${Date.now()}`;
      activeRequestIdRef.current = requestId;
      activeItemIdRef.current = itemId;

      const speechItem: SpeechItem = {
        requestId,
        cacheKey: audioUrl,
        audioPath: audioUrl,
        audioUrl,
        durationMs,
        lipSyncData,
        text,
        targetEpochMs,
        sequence,
      };

      setCurrentSpeech(speechItem);
      setStatus("playing");

      const onEnded = () => {
        // Stale guard: only advance if this is still the active request
        if (activeRequestIdRef.current !== requestId) return;
        activeSourceRef.current = null;
        activeRequestIdRef.current = null;
        activeItemIdRef.current = null;
        setCurrentSpeech(null);
        setStatus("idle");
        if (onSpeechComplete) onSpeechComplete(itemId, requestId);
      };

      scheduleAudioPlayback(audioUrl, targetEpochMs, onEnded, offsetMs)
        .then((source) => {
          if (!source) {
            if (activeRequestIdRef.current === requestId) {
              console.warn("[SpeechQueue] scheduleAudioPlayback returned null, auto-advancing in 3s");
              setTimeout(() => {
                if (activeRequestIdRef.current === requestId) {
                  onEnded();
                }
              }, 3000);
            }
            return;
          }
          activeSourceRef.current = source;
        })
        .catch((err) => {
          console.error("[SpeechQueue] Unexpected error in playScheduled:", err);
          onEnded();
        });
    },
    [stop, onSpeechComplete]
  );

  // ── Play speech by synthesizing on the fly (showcase/preview) ─

  const playSpeech = useCallback(
    async (
      text: string,
      itemId: string,
      selectedVoice: string = voice,
      selectedProvider: TTSProviderId = provider,
      selectedModelId?: string,
      selectedSpeed: number = speed
    ) => {
      const item = await synthesizeItem(
        text,
        itemId,
        selectedVoice,
        selectedProvider,
        selectedModelId,
        selectedSpeed
      );
      if (!item) return null;

      const speechItem: SpeechItem = { ...item };
      setCurrentSpeech(speechItem);
      setStatus("playing");
      return item;
    },
    [voice, provider, speed, synthesizeItem]
  );

  // ── Play pre-synthesized item directly (non-scheduled) ─────────

  const playDirectSpeech = useCallback(
    (
      item: {
        audioPath: string;
        lipSyncData: LipSyncData;
        text?: string;
        requestId?: string;
        cacheKey?: string;
        audioUrl?: string;
        durationMs?: number;
      },
      itemId: string
    ) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const requestId = item.requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      activeRequestIdRef.current = requestId;
      activeItemIdRef.current = itemId;

      const speechItem: SpeechItem = {
        requestId,
        cacheKey: item.cacheKey || requestId,
        audioPath: item.audioPath,
        audioUrl: item.audioUrl || item.audioPath,
        durationMs: item.durationMs || 0,
        lipSyncData: item.lipSyncData,
        text: item.text || "",
      };

      setCurrentSpeech(speechItem);
      setStatus("playing");
    },
    []
  );

  // ── handleAudioEnd (called by useLipSync onEnded in legacy path) ───────

  const handleAudioEnd = useCallback(
    (requestId?: string) => {
      if (requestId && activeRequestIdRef.current && requestId !== activeRequestIdRef.current) {
        console.debug("[SpeechQueue] Stale audio end ignored (requestId:", requestId, ")");
        return;
      }

      const finishedItemId = activeItemIdRef.current;
      const finishedRequestId = activeRequestIdRef.current;

      setCurrentSpeech(null);
      setStatus("idle");
      activeRequestIdRef.current = null;
      activeItemIdRef.current = null;

      if (finishedItemId && onSpeechComplete) {
        onSpeechComplete(finishedItemId, finishedRequestId || "");
      }
    },
    [onSpeechComplete]
  );

  return useMemo(
    () => ({
      currentSpeech,
      status,
      playSpeech,
      playScheduled,
      playDirectSpeech,
      synthesizeItem,
      handleAudioEnd,
      stop,
      prefetch,
    }),
    [currentSpeech, status, playSpeech, playScheduled, playDirectSpeech, synthesizeItem, handleAudioEnd, stop, prefetch]
  );
}
