"use client";

import { useCallback, useRef, useState } from "react";
import type { SpeechItem, SpeechStatus } from "../types/speech";
import type { HeadTTSData } from "@/features/avatar";
import { fetchSpeechTTS } from "../services/tts";
import {
  preloadAudioBuffer,
  scheduleAudioPlayback,
} from "@/features/avatar";

export interface UseSpeechQueueOptions {
  voice?: string;
  onSpeechComplete?: (itemId: string, requestId: string) => void;
  onError?: (error: Error, itemId?: string) => void;
}

// ─────────────────────────────────────────────
// Payload shape for scheduled playback
// ─────────────────────────────────────────────
export interface ScheduledPlayPayload {
  audioUrl: string;
  targetEpochMs: number;    // synchronized epoch when audio should start
  lipSyncData: HeadTTSData;
  sequence: number;         // monotonic sequence — used to gate morph animation
  text: string;
  itemId: string;
  durationMs?: number;
  offsetMs?: number;        // for SEEK_SYNC late-joiner seeking (default 0)
}

export function useSpeechQueue({
  voice = "af_bella",
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
    activeRequestIdRef.current = null;
    activeItemIdRef.current = null;
    setCurrentSpeech(null);
    setStatus("idle");
  }, []);

  // ── Internal: fetch or deduplicate in-flight TTS synthesis ────────────

  const getOrFetchItem = useCallback(
    async (text: string, selectedVoice: string, signal?: AbortSignal): Promise<SpeechItem> => {
      const cleanText = text.trim();
      const cacheKey = `${cleanText}_${selectedVoice}`;

      const existing = prefetchCacheRef.current.get(cacheKey);
      if (existing) return existing;

      const inFlight = inFlightRef.current.get(cacheKey);
      if (inFlight) return inFlight;

      const fetchPromise = (async () => {
        try {
          const item = await fetchSpeechTTS({ text: cleanText, voice: selectedVoice, signal });

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
    []
  );

  // ── Prefetch upcoming sentences concurrently in background ────────────

  const prefetch = useCallback(
    async (texts: string[], selectedVoice: string = voice) => {
      const uniqueTexts = Array.from(new Set(texts.map((t) => t?.trim()).filter(Boolean)));
      if (uniqueTexts.length === 0) return;

      await Promise.allSettled(
        uniqueTexts.map((text) =>
          getOrFetchItem(text, selectedVoice).catch((err) => {
            console.warn("[SpeechQueue] Background prefetch skipped:", err?.message);
          })
        )
      );
    },
    [voice, getOrFetchItem]
  );

  // ── Synthesize item — returns TTS result for broadcast (driver only) ──

  const synthesizeItem = useCallback(
    async (text: string, itemId: string, selectedVoice: string = voice): Promise<SpeechItem | null> => {
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
        const result = await getOrFetchItem(text.trim(), selectedVoice, controller.signal);
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
    [voice, onError, getOrFetchItem]
  );

  // ── NEW: Play a hardware-scheduled packet ─────────────────────────────
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

      // scheduleAudioPlayback handles:
      //   - ctx.resume() if suspended
      //   - future scheduling (delta > 0) or late-joiner seek (delta < 0)
      //   - calls onEnded on error so sequencer never stalls (Fix #8)
      scheduleAudioPlayback(audioUrl, targetEpochMs, onEnded, offsetMs)
        .then((source) => {
          if (!source) {
            // scheduleAudioPlayback already called onEnded on error
            // But if we're in a cancelled state, ensure status is consistent
            if (activeRequestIdRef.current === requestId) {
              // onEnded wasn't called (edge case guard) — auto-advance after 3s
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

  // ── Legacy: play speech by synthesizing on the fly (showcase/preview) ─

  const playSpeech = useCallback(
    async (text: string, itemId: string, selectedVoice: string = voice) => {
      const item = await synthesizeItem(text, itemId, selectedVoice);
      if (!item) return null;

      const speechItem: SpeechItem = { ...item };
      setCurrentSpeech(speechItem);
      setStatus("playing");
      return item;
    },
    [voice, synthesizeItem]
  );

  // ── Legacy: play pre-synthesized item directly (non-scheduled) ─────────

  const playDirectSpeech = useCallback(
    (
      item: {
        audioPath: string;
        lipSyncData: HeadTTSData;
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
        // Expected: fired by a previous audio segment's onended after we've moved on.
        // This is the stale-guard working correctly — not an error.
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

  return {
    currentSpeech,
    status,
    playSpeech,
    playScheduled,   // ← NEW: primary path for multi-device sync
    playDirectSpeech,
    synthesizeItem,  // ← NEW: driver uses this to get audio before broadcasting
    handleAudioEnd,
    stop,
    prefetch,
  };
}
