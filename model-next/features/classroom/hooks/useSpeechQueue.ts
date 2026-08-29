"use client";

import { useCallback, useRef, useState } from "react";
import type { SpeechItem, SpeechStatus } from "../types/speech";
import type { HeadTTSData } from "@/features/avatar";
import { fetchSpeechTTS } from "../services/tts";

export interface UseSpeechQueueOptions {
  voice?: string;
  onSpeechComplete?: (itemId: string, requestId: string) => void;
  onError?: (error: Error, itemId?: string) => void;
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const prefetchCacheRef = useRef<Map<string, SpeechItem>>(new Map());
  const inFlightRef = useRef<Map<string, Promise<SpeechItem>>>(new Map());

  /**
   * Stop current speech & abort any in-flight TTS generation
   */
  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    activeRequestIdRef.current = null;
    activeItemIdRef.current = null;
    setCurrentSpeech(null);
    setStatus("idle");
  }, []);

  /**
   * Internal fetcher with in-flight deduplication
   */
  const getOrFetchItem = useCallback(
    async (text: string, selectedVoice: string, signal?: AbortSignal): Promise<SpeechItem> => {
      const cleanText = text.trim();
      const cacheKey = `${cleanText}_${selectedVoice}`;

      const existing = prefetchCacheRef.current.get(cacheKey);
      if (existing) return existing;

      // Check if already being fetched
      const inFlight = inFlightRef.current.get(cacheKey);
      if (inFlight) return inFlight;

      const fetchPromise = (async () => {
        try {
          const item = await fetchSpeechTTS({
            text: cleanText,
            voice: selectedVoice,
            signal,
          });

          // Preload audio into browser cache in advance
          if (typeof window !== "undefined" && item.audioPath) {
            fetch(item.audioPath, { cache: "force-cache" }).catch(() => {});
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

  /**
   * Prefetch upcoming sentences concurrently in background
   */
  const prefetch = useCallback(
    async (texts: string[], selectedVoice: string = voice) => {
      const uniqueTexts = Array.from(new Set(texts.map((t) => t?.trim()).filter(Boolean)));
      if (uniqueTexts.length === 0) return;

      await Promise.allSettled(
        uniqueTexts.map((text) =>
          getOrFetchItem(text, selectedVoice).catch((err) => {
            console.warn("Background TTS prefetch skipped item:", err);
          })
        )
      );
    },
    [voice, getOrFetchItem]
  );

  /**
   * Play speech for a specific text item
   */
  const playSpeech = useCallback(
    async (text: string, itemId: string, selectedVoice: string = voice) => {
      // 1. Cancel previous in-flight active request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      activeRequestIdRef.current = requestId;
      activeItemIdRef.current = itemId;

      const cleanText = text.trim();
      const cacheKey = `${cleanText}_${selectedVoice}`;
      const cached = prefetchCacheRef.current.get(cacheKey);

      if (cached) {
        const item: SpeechItem = { ...cached, requestId };
        setCurrentSpeech(item);
        setStatus("playing");
        return item;
      }

      setStatus("generating");

      try {
        const result = await getOrFetchItem(cleanText, selectedVoice, controller.signal);

        // Stale guard: check if active request changed while waiting
        if (activeRequestIdRef.current !== requestId) {
          return null;
        }

        const itemWithReq: SpeechItem = { ...result, requestId };
        setCurrentSpeech(itemWithReq);
        setStatus("playing");
        return itemWithReq;
      } catch (err: unknown) {
        const error = err as Error;
        if (error.name === "AbortError" || activeRequestIdRef.current !== requestId) {
          return null;
        }
        console.error("useSpeechQueue playback failure:", error);
        setStatus("error");
        if (onError) onError(error, itemId);
        return null;
      }
    },
    [voice, onError, getOrFetchItem]
  );

  /**
   * Play pre-synthesized audio directly (e.g. received via live broadcast)
   */
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

  /**
   * Called by the 3D Avatar (useLipSync onEnd) when audio finishes
   */
  const handleAudioEnd = useCallback(
    (requestId?: string) => {
      // Stale response guard
      if (requestId && activeRequestIdRef.current && requestId !== activeRequestIdRef.current) {
        console.warn("Ignoring stale audio end event from previous requestId:", requestId);
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
    playDirectSpeech,
    handleAudioEnd,
    stop,
    prefetch,
  };
}
