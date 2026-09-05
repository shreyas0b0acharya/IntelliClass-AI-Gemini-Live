"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  parseLectureScript,
  type LectureItem,
  type LectureSpeechItem,
} from "../types/lecture-item";
import type {
  ClassroomEvent,
  InterruptionItem,
  SessionStateStatus,
} from "../types/classroom";
import type { ClassroomSession, Profile } from "@/lib/supabase/types";
import { useClassroomSync } from "./useClassroomSync";
import { useSpeechQueue } from "./useSpeechQueue";
import { useClassroomStore } from "../store/classroomStore";
import {
  getSynchronizedEpochMs,
  startBackgroundSync,
  preloadAudioBuffer,
  stopAllAudio,
  type HeadTTSData,
} from "@/features/avatar";
import { fetchSpeechTTS } from "../services/tts";

const LEAD_TIME_MS = 350;

export interface MediaItemDisplay {
  type: "image" | "video";
  url: string;
  label?: string;
}

export function useClassroom(sessionId: string) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<ClassroomSession | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStateStatus>("created");
  const [stoppedReason, setStoppedReason] = useState<string | undefined>(undefined);
  const [currentSubtitle, setCurrentSubtitle] = useState<string>("");
  const [activeMedia, setActiveMedia] = useState<MediaItemDisplay | null>(null);
  const [emptyRoomCountdown] = useState<number | null>(null);
  const [userQuestion, setUserQuestion] = useState<string>("");
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false);

  // Stable tab identifier for database conductor lease arbitration
  const myTabIdRef = useRef<string>("");
  useEffect(() => {
    if (!myTabIdRef.current) {
      myTabIdRef.current =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `tab_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    }
  }, []);
  const isConductorLeaseActiveRef = useRef<boolean>(false);
  const driverLeaseVersionRef = useRef<number>(0);
  const executingItemIdRef = useRef<string | null>(null);
  const processedExecutionIdsRef = useRef<Set<string>>(new Set());

  // Mutable refs to prevent stale closures inside timers and event listeners
  const itemsRef = useRef<LectureItem[]>([]);
  const speechItemsRef = useRef<LectureSpeechItem[]>([]);
  const currentIndexRef = useRef<number>(0);
  const sequenceRef = useRef<number>(0);
  const isLecturerRef = useRef<boolean>(false);
  const isDriverRef = useRef<boolean>(false);
  const sessionStatusRef = useRef<SessionStateStatus>("created");
  const activeInterruptionRef = useRef<InterruptionItem | null>(null);
  const mediaMapRef = useRef<Map<string, { type: "image" | "video"; ref: string }>>(new Map());

  const emptyRoomTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const advanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const broadcastEventRef = useRef<((event: ClassroomEvent) => void) | null>(null);
  const executeLectureItemRef = useRef<((item: LectureItem) => void) | null>(null);
  const advanceCurrentItemRef = useRef<(() => void) | null>(null);

  // Gap detection state
  const lastSeqRef = useRef<number>(-1);

  // Helper to safely mutate Zustand store without subscribing to render loops
  const syncStore = useClassroomStore.getState;

  // ── 0. SNTP Background Clock Sync ─────────────────────────────────────
  useEffect(() => {
    const stopSync = startBackgroundSync();
    return () => stopSync();
  }, []);

  // ── Helper to schedule item progression with cancellation guard ─────────
  const scheduleAdvance = useCallback((delayMs: number) => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      advanceCurrentItemRef.current?.();
    }, delayMs);
  }, []); // stable — uses ref, never needs to re-create

  // ── 1. Advance to Next Item (Room Conductor) ────────────────────────────
  const advanceCurrentItem = useCallback(async () => {
    if (!isLecturerRef.current || !isConductorLeaseActiveRef.current) return;
    executingItemIdRef.current = null;

    // If we are handling a Q&A interruption resume:
    if (activeInterruptionRef.current) {
      const resumeId = activeInterruptionRef.current.resumeFromItemId;
      activeInterruptionRef.current = null;

      if (resumeId) {
        const resumeIdx = itemsRef.current.findIndex((i) => i.id === resumeId);
        if (resumeIdx !== -1) {
          currentIndexRef.current = resumeIdx;
          syncStore().setCurrentIndex(resumeIdx);
          executeLectureItemRef.current?.(itemsRef.current[resumeIdx]);
          return;
        }
      }
    }

    // Normal sequence advancement
    const nextIdx = currentIndexRef.current + 1;
    if (nextIdx >= itemsRef.current.length) {
      console.log("🏁 [Classroom] Lecture script completed all segments!");
      setSessionStatus("ended");
      sessionStatusRef.current = "ended";
      syncStore().setStatus("ended");
      setStoppedReason("script_completed");
      setCurrentSubtitle("Lecture completed. Thank you class!");
      syncStore().setCurrentSubtitle("Lecture completed. Thank you class!");

      sequenceRef.current++;
      broadcastEventRef.current?.({
        type: "END",
        sequence: sequenceRef.current,
        driverLeaseVersion: driverLeaseVersionRef.current,
        stoppedReason: "script_completed",
      });
      api
        .updateClassroomSession(sessionId, {
          status: "ended",
          stopped_reason: "script_completed",
          releaseLease: true,
        })
        .catch(console.error);
      return;
    }

    currentIndexRef.current = nextIdx;
    syncStore().setCurrentIndex(nextIdx);
    executeLectureItemRef.current?.(itemsRef.current[nextIdx]);
  }, [sessionId, syncStore]);

  // ── 2. TTS & Speech Queue Hook ───────────────────────────────────────
  const speech = useSpeechQueue({
    voice: session?.voice_id || "af_bella",
    onSpeechComplete: (_itemId) => {
      executingItemIdRef.current = null;
      // Only the active conductor advances — students follow strictly via broadcast
      if (
        sessionStatusRef.current === "running" &&
        isLecturerRef.current &&
        isConductorLeaseActiveRef.current
      ) {
        scheduleAdvance(80);
      }
    },
    onError: (err) => {
      executingItemIdRef.current = null;
      toast.error(`Speech synthesis error: ${err.message}`);
    },
  });

  // ── 3. Execute a specific LectureItem (Active Conductor Only) ───────────
  const executeLectureItem = useCallback(
    async (item: LectureItem) => {
      if (!item) return;
      if (!isLecturerRef.current || !isConductorLeaseActiveRef.current) return;

      // In-flight execution lock to prevent Strict Mode / retried duplicates
      if (executingItemIdRef.current === item.id) {
        console.warn(`[Classroom] Item ${item.id} is already in-flight. Skipping duplicate call.`);
        return;
      }
      executingItemIdRef.current = item.id;

      // ── Media item ───────────────────────────────────────────────────
      if (item.type === "image" || item.type === "video") {
        const mediaObj: MediaItemDisplay = {
          type: item.type === "video" ? "video" : "image",
          url: item.mediaRef,
          label: item.caption || "Visual Asset",
        };
        setActiveMedia(mediaObj);
        syncStore().setActiveMedia(mediaObj);

        sequenceRef.current++;
        const targetEpochMs = Math.round(getSynchronizedEpochMs() + LEAD_TIME_MS);
        const durationMs = 1500;

        broadcastEventRef.current?.({
          type: "SCHEDULED_PLAY",
          sequence: sequenceRef.current,
          driverLeaseVersion: driverLeaseVersionRef.current,
          executionId: `${sessionId}_${item.id}_seq${sequenceRef.current}_${targetEpochMs}`,
          itemId: item.id,
          targetEpochMs,
          leadTimeMs: LEAD_TIME_MS,
          audioUrl: "", // no audio for media items
          durationMs,
          lipSyncData: { visemes: [], vtimes: [], vdurations: [] },
          text: item.caption || "",
          media: mediaObj,
        });
        scheduleAdvance(durationMs);
        return;
      }

      // ── Pause item ───────────────────────────────────────────────────
      if (item.type === "pause") {
        setCurrentSubtitle("...");
        syncStore().setCurrentSubtitle("...");
        sequenceRef.current++;
        const durationMs = Math.round(item.durationMs || 1200);
        const targetEpochMs = Math.round(getSynchronizedEpochMs() + LEAD_TIME_MS);

        broadcastEventRef.current?.({
          type: "SCHEDULED_PLAY",
          sequence: sequenceRef.current,
          driverLeaseVersion: driverLeaseVersionRef.current,
          executionId: `${sessionId}_${item.id}_seq${sequenceRef.current}_${targetEpochMs}`,
          itemId: item.id,
          targetEpochMs,
          leadTimeMs: LEAD_TIME_MS,
          audioUrl: "",
          durationMs,
          lipSyncData: { visemes: [], vtimes: [], vdurations: [] },
          text: "...",
        });
        scheduleAdvance(durationMs);
        return;
      }

      // ── Engagement item ──────────────────────────────────────────────
      if (item.type === "engagement") {
        const promptText = item.prompt || "Let us pause and reflect...";
        setCurrentSubtitle(promptText);
        syncStore().setCurrentSubtitle(promptText);
        sequenceRef.current++;
        const targetEpochMs = Math.round(getSynchronizedEpochMs() + LEAD_TIME_MS);
        const durationMs = 2000;

        broadcastEventRef.current?.({
          type: "SCHEDULED_PLAY",
          sequence: sequenceRef.current,
          driverLeaseVersion: driverLeaseVersionRef.current,
          executionId: `${sessionId}_${item.id}_seq${sequenceRef.current}_${targetEpochMs}`,
          itemId: item.id,
          targetEpochMs,
          leadTimeMs: LEAD_TIME_MS,
          audioUrl: "",
          durationMs,
          lipSyncData: { visemes: [], vtimes: [], vdurations: [] },
          text: promptText,
        });
        scheduleAdvance(durationMs);
        return;
      }

      // ── Speech item ──────────────────────────────────────────────────
      if (item.type === "speech") {
        console.log(`🗣️ [Classroom] Speaking segment #${currentIndexRef.current + 1}: "${item.text.slice(0, 80)}..."`);
        setCurrentSubtitle(item.text);
        syncStore().setCurrentSubtitle(item.text);

        // Pre-fetch next 5 items concurrently while current item synthesizes
        const nextItems = itemsRef.current
          .slice(currentIndexRef.current + 1, currentIndexRef.current + 6)
          .filter((i): i is LectureSpeechItem => i.type === "speech")
          .map((i) => i.text);
        if (nextItems.length > 0) {
          speech.prefetch(nextItems, session?.voice_id || "af_bella");
        }

        // Synthesize (uses cache if already prefetched)
        const speechResult = await speech.synthesizeItem(
          item.text,
          item.id,
          session?.voice_id || "af_bella"
        );

        if (!speechResult || !speechResult.audioPath) {
          console.warn(`⚠️ [Classroom] TTS unavailable for item #${currentIndexRef.current + 1}. Auto-advancing in 3s.`);
          executingItemIdRef.current = null;
          scheduleAdvance(3000);
          return;
        }

        // Check lease before scheduling and broadcasting
        if (!isConductorLeaseActiveRef.current) {
          console.warn("[Classroom] Lost conductor lease during synthesis. Aborting playback.");
          executingItemIdRef.current = null;
          return;
        }

        sequenceRef.current++;
        const targetEpochMs = Math.round(getSynchronizedEpochMs() + LEAD_TIME_MS);
        const seq = sequenceRef.current;
        const durationMs = Math.round(speechResult.durationMs || 0);
        const executionId = `${sessionId}_${item.id}_seq${seq}_${targetEpochMs}`;

        // Persist progress & timeline metadata to DB (fire-and-forget)
        api
          .updateClassroomSession(sessionId, {
            current_item_id: item.id,
            current_sentence_index: currentIndexRef.current,
            sequence: seq,
            status: "running",
            driverTabId: myTabIdRef.current,
            target_epoch_ms: targetEpochMs,
            duration_ms: durationMs,
          })
          .catch(console.error);

        // Broadcast to all students with executionId & driverLeaseVersion
        broadcastEventRef.current?.({
          type: "SCHEDULED_PLAY",
          sequence: seq,
          driverLeaseVersion: driverLeaseVersionRef.current,
          executionId,
          itemId: item.id,
          targetEpochMs,
          leadTimeMs: LEAD_TIME_MS,
          audioUrl: speechResult.audioPath,
          durationMs,
          lipSyncData: speechResult.lipSyncData,
          text: item.text,
        });

        // Driver plays locally with the SAME targetEpochMs — sample-accurate sync
        speech.playScheduled({
          audioUrl: speechResult.audioPath,
          targetEpochMs,
          lipSyncData: speechResult.lipSyncData,
          sequence: seq,
          text: item.text,
          itemId: item.id,
          durationMs,
          offsetMs: 0,
        });
      }
    },
    [session?.voice_id, speech, sessionId, syncStore, scheduleAdvance]
  );

  // ── 4. Unified 5s Atomic CAS Conductor Lease Engine ────────────────────
  useEffect(() => {
    if (!isLecturerRef.current || !sessionId) return;

    let active = true;

    const pollOrRenewLease = async () => {
      try {
        const res = await fetch(`/api/classroom/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ driverTabId: myTabIdRef.current }),
        });

        if (!res.ok) {
          isConductorLeaseActiveRef.current = false;
          return;
        }

        const data = await res.json();
        const isClaimWon = data?.activeDriverTabId === myTabIdRef.current;
        const wasConductor = isConductorLeaseActiveRef.current;
        isConductorLeaseActiveRef.current = isClaimWon;

        if (typeof data?.driverLeaseVersion === "number") {
          driverLeaseVersionRef.current = data.driverLeaseVersion;
        }

        // Standby Promotion Timeline Reconciliation:
        // If we just got promoted from standby to active conductor during a running session:
        if (!wasConductor && isClaimWon && sessionStatusRef.current === "running") {
          console.log("👑 [Classroom] Conductor lease granted to this tab. Running timeline reconciliation...");
          const snapRes = await fetch(`/api/classroom/${sessionId}/snapshot`);
          if (snapRes.ok) {
            const snapData = await snapRes.json();
            const now = getSynchronizedEpochMs();
            const itemEndEpoch = (snapData?.targetEpochMs || 0) + (snapData?.durationMs || 0);

            if (now < itemEndEpoch) {
              const remainingMs = itemEndEpoch - now;
              console.log(`⏳ [Classroom] Waiting ${remainingMs}ms for current sentence to finish in student buffers.`);
              setTimeout(() => {
                if (active && isConductorLeaseActiveRef.current && sessionStatusRef.current === "running") {
                  advanceCurrentItem();
                }
              }, remainingMs);
            } else {
              advanceCurrentItem();
            }
          }
        }
      } catch (err) {
        console.warn("[Classroom] Conductor lease poll error:", err);
      }
    };

    pollOrRenewLease();
    const interval = setInterval(pollOrRenewLease, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [sessionId, advanceCurrentItem]);

  // ── 5. Realtime Events Receiver ──────────────────────────────────────
  const handleRealtimeEvent = useCallback(
    (event: ClassroomEvent) => {
      // Update driver lease version tracking when newer version arrives
      if (
        "driverLeaseVersion" in event &&
        typeof event.driverLeaseVersion === "number" &&
        event.driverLeaseVersion > driverLeaseVersionRef.current
      ) {
        driverLeaseVersionRef.current = event.driverLeaseVersion;
        if (typeof event.sequence === "number") {
          lastSeqRef.current = event.sequence;
        }
      }

      // RESTART always passes through — it carries the new lease version and
      // must unconditionally reset state regardless of current guards.
      if (event.type !== "RESTART") {
        // Stale lease packet drop
        if (
          "driverLeaseVersion" in event &&
          typeof event.driverLeaseVersion === "number" &&
          driverLeaseVersionRef.current > 0 &&
          event.driverLeaseVersion < driverLeaseVersionRef.current
        ) {
          console.warn("[Realtime] Dropping stale broadcast packet from older lease version.");
          return;
        }

        // Duplicate executionId drop
        if ("executionId" in event && event.executionId && processedExecutionIdsRef.current.has(event.executionId)) {
          return;
        }
        if ("executionId" in event && event.executionId) {
          processedExecutionIdsRef.current.add(event.executionId);
        }
      }

      // ── SCHEDULED_PLAY ─────────────────────────────────────────────
      if (event.type === "SCHEDULED_PLAY") {
        if (lastSeqRef.current === -1 || event.sequence >= lastSeqRef.current) {
          lastSeqRef.current = event.sequence;
        } else {
          console.warn(
            `[Sync] Stale or duplicate packet received: sequence ${event.sequence} <= current ${lastSeqRef.current}. Ignoring.`
          );
          return;
        }

        if (sessionStatusRef.current !== "running") {
          setSessionStatus("running");
          sessionStatusRef.current = "running";
          syncStore().setStatus("running");
        }

        const foundIdx = itemsRef.current.findIndex((i) => i.id === event.itemId);
        if (foundIdx !== -1) {
          currentIndexRef.current = foundIdx;
          syncStore().setCurrentIndex(foundIdx);
        }

        // ── Handle projected visual slide / diagram ──
        if (event.media) {
          setActiveMedia(event.media);
          syncStore().setActiveMedia(event.media);
        } else if (foundIdx !== -1) {
          const matchedItem = itemsRef.current[foundIdx];
          if (matchedItem.type === "image" || matchedItem.type === "video") {
            const mediaObj: MediaItemDisplay = {
              type: matchedItem.type === "video" ? "video" : "image",
              url: matchedItem.mediaRef,
              label: matchedItem.caption || "Visual Asset",
            };
            setActiveMedia(mediaObj);
            syncStore().setActiveMedia(mediaObj);
          }
        }

        // Non-audio scheduled items (media/pause/engagement) — just advance subtitle
        if (!event.audioUrl) {
          setCurrentSubtitle(event.text || "");
          syncStore().setCurrentSubtitle(event.text || "");
          return;
        }

        preloadAudioBuffer(event.audioUrl);

        setCurrentSubtitle(event.text || "");
        syncStore().setCurrentSubtitle(event.text || "");

        // Prefetch next items for student cache
        if (foundIdx !== -1) {
          const nextItems = itemsRef.current
            .slice(foundIdx + 1, foundIdx + 4)
            .filter((i): i is LectureSpeechItem => i.type === "speech")
            .map((i) => i.text);
          if (nextItems.length > 0) {
            speech.prefetch(nextItems, session?.voice_id || "af_bella");
          }
        }

        // Schedule sample-accurate playback
        speech.playScheduled({
          audioUrl: event.audioUrl,
          targetEpochMs: event.targetEpochMs,
          lipSyncData: event.lipSyncData,
          sequence: event.sequence,
          text: event.text || "",
          itemId: event.itemId,
          durationMs: event.durationMs,
          offsetMs: 0,
        });
      }

      // ── SEEK_SYNC (late joiner catch-up) ───────────────────────────
      else if (event.type === "SEEK_SYNC") {
        lastSeqRef.current = event.sequence;
        const foundIdx = itemsRef.current.findIndex((i) => i.id === event.itemId);
        if (foundIdx !== -1) {
          currentIndexRef.current = foundIdx;
          syncStore().setCurrentIndex(foundIdx);
        }

        const syncedNow = getSynchronizedEpochMs();
        const elapsedMs = Math.max(0, syncedNow - event.targetEpochMs);
        const remainingMs = event.durationMs - elapsedMs;

        setCurrentSubtitle(event.text || "");
        syncStore().setCurrentSubtitle(event.text || "");

        if (remainingMs > 200 && event.audioUrl) {
          preloadAudioBuffer(event.audioUrl);
          speech.playScheduled({
            audioUrl: event.audioUrl,
            targetEpochMs: event.targetEpochMs,
            lipSyncData: event.lipSyncData,
            sequence: event.sequence,
            text: event.text || "",
            itemId: event.itemId,
            durationMs: event.durationMs,
            offsetMs: elapsedMs,
          });
        }
      }

      // ── PAUSE ──────────────────────────────────────────────────────
      else if (event.type === "PAUSE") {
        lastSeqRef.current = event.sequence;
        setSessionStatus("paused");
        sessionStatusRef.current = "paused";
        syncStore().setStatus("paused");
        executingItemIdRef.current = null;
        speech.stop();
        setCurrentSubtitle("Lecture paused by professor.");
        syncStore().setCurrentSubtitle("Lecture paused by professor.");
      }

      // ── RESUME ─────────────────────────────────────────────────────
      else if (event.type === "RESUME") {
        lastSeqRef.current = event.sequence;
        setSessionStatus("running");
        sessionStatusRef.current = "running";
        syncStore().setStatus("running");

        const foundIdx = itemsRef.current.findIndex((i) => i.id === event.itemId);
        if (foundIdx !== -1) {
          currentIndexRef.current = foundIdx;
          syncStore().setCurrentIndex(foundIdx);

          if (event.targetEpochMs && event.audioUrl && event.lipSyncData) {
            setCurrentSubtitle(event.text || "");
            syncStore().setCurrentSubtitle(event.text || "");
            preloadAudioBuffer(event.audioUrl);
            speech.playScheduled({
              audioUrl: event.audioUrl,
              targetEpochMs: event.targetEpochMs,
              lipSyncData: event.lipSyncData,
              sequence: event.sequence,
              text: event.text || "",
              itemId: event.itemId,
              durationMs: 0,
              offsetMs: 0,
            });
          }
        }
      }

      // ── INTERRUPT (Q&A) ────────────────────────────────────────────
      else if (event.type === "INTERRUPT") {
        activeInterruptionRef.current = {
          id: event.interruptionId,
          type: "question_answer",
          studentName: event.studentName,
          question: event.question,
          answer: event.answer,
          resumeFromItemId: event.resumeFromItemId,
        };

        setCurrentSubtitle(event.answer);
        syncStore().setCurrentSubtitle(event.answer);

        if (event.targetEpochMs && event.audioUrl && event.lipSyncData) {
          preloadAudioBuffer(event.audioUrl);
          speech.playScheduled({
            audioUrl: event.audioUrl,
            targetEpochMs: event.targetEpochMs,
            lipSyncData: event.lipSyncData,
            sequence: event.sequence,
            text: event.answer,
            itemId: event.interruptionId,
            durationMs: 0,
            offsetMs: 0,
          });
        } else {
          speech.playSpeech(event.answer, event.interruptionId, session?.voice_id || "af_bella");
        }
      }

      // ── MEDIA_PROJECT (Live visual slide/diagram projection) ─────────
      else if (event.type === "MEDIA_PROJECT") {
        lastSeqRef.current = Math.max(lastSeqRef.current, event.sequence);
        const mediaObj: MediaItemDisplay = {
          type: event.media.type,
          url: event.media.url,
          label: event.media.label || "Projected Visual",
        };
        setActiveMedia(mediaObj);
        syncStore().setActiveMedia(mediaObj);
        toast.info(`🖼️ Visual projected: ${mediaObj.label}`);
      }

      // ── MEDIA_DISMISS ───────────────────────────────────────────────
      else if (event.type === "MEDIA_DISMISS") {
        lastSeqRef.current = Math.max(lastSeqRef.current, event.sequence);
        setActiveMedia(null);
        syncStore().setActiveMedia(null);
      }

      // ── END ────────────────────────────────────────────────────────
      else if (event.type === "END") {
        lastSeqRef.current = event.sequence;
        setSessionStatus("ended");
        sessionStatusRef.current = "ended";
        syncStore().setStatus("ended");
        executingItemIdRef.current = null;
        setActiveMedia(null);
        syncStore().setActiveMedia(null);
        if (event.stoppedReason) {
          setStoppedReason(event.stoppedReason);
          syncStore().setStoppedReason(event.stoppedReason);
        }
        speech.stop();
        setCurrentSubtitle(
          event.stoppedReason === "no_students_timeout"
            ? "Classroom automatically stopped: No students present for 30 seconds."
            : "Lecture session has ended."
        );
        syncStore().setCurrentSubtitle(
          event.stoppedReason === "no_students_timeout"
            ? "Classroom automatically stopped: No students present for 30 seconds."
            : "Lecture session has ended."
        );
      }
      // ── RESTART ────────────────────────────────────────────────────
      // Hard-resets all sequence tracking so stale lastSeqRef from the
      // previous run never blocks the fresh sequence starting at 0.
      else if (event.type === "RESTART") {
        console.log("[Realtime] RESTART received — resetting sequence and index.");
        lastSeqRef.current = -1;
        sequenceRef.current = 0;
        currentIndexRef.current = 0;
        syncStore().setCurrentIndex(0);
        executingItemIdRef.current = null;
        processedExecutionIdsRef.current.clear();
        driverLeaseVersionRef.current = event.driverLeaseVersion ?? 0;
        speech.stop();
        setActiveMedia(null);
        syncStore().setActiveMedia(null);
        setSessionStatus("created");
        sessionStatusRef.current = "created";
        syncStore().setStatus("created");
        setStoppedReason(undefined);
        syncStore().setStoppedReason(undefined);
        setCurrentSubtitle("Lecture restarting. Please wait for the professor to begin.");
        syncStore().setCurrentSubtitle("Lecture restarting. Please wait for the professor to begin.");
      }
    },
    [session?.voice_id, speech, syncStore]
  );

  const handleKicked = useCallback(() => {
    speech.stop();
  }, [speech]);

  // ── 6. Supabase Realtime & Presence Sync ────────────────────────────
  const {
    broadcastEvent,
    activeStudentCount,
    activeLecturerCount,
    participants,
    myAdmissionStatus,
    isDriver,
    admitParticipant,
    denyParticipant,
    kickParticipant,
    admitAllParticipants,
    requestRejoin,
  } = useClassroomSync({
    sessionId,
    userId: user?.id,
    userName: profile?.name || user?.email?.split("@")[0] || "Participant",
    role: profile?.role || "student",
    onEvent: handleRealtimeEvent,
    onKicked: handleKicked,
  });

  useEffect(() => {
    isDriverRef.current = isDriver;
  }, [isDriver]);

  const speechRef = useRef(speech);
  useEffect(() => {
    speechRef.current = speech;
  }, [speech]);

  useEffect(() => {
    executeLectureItemRef.current = executeLectureItem;
    broadcastEventRef.current = broadcastEvent;
    advanceCurrentItemRef.current = advanceCurrentItem;
  }, [executeLectureItem, broadcastEvent, advanceCurrentItem]);

  // ── 7. Empty Room Auto-Stop Watcher ─────────────────────────────────
  useEffect(() => {
    if (emptyRoomTimerRef.current) clearTimeout(emptyRoomTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    syncStore().setEmptyRoomCountdown(null);
  }, [sessionStatus, syncStore]);

  // ── 7.5. Unmount / Screen Leave Cleanup & Lecturer Auto-Pause ────────
  useEffect(() => {
    const emptyTimer = emptyRoomTimerRef.current;
    const countTimer = countdownIntervalRef.current;

    const handleBeforeUnload = () => {
      speechRef.current?.stop();
      stopAllAudio();

      if (isLecturerRef.current && sessionStatusRef.current === "running") {
        broadcastEventRef.current?.({
          type: "PAUSE",
          sequence: sequenceRef.current + 1,
          driverLeaseVersion: driverLeaseVersionRef.current,
        });

        // Use keepalive fetch so PostgreSQL updates even if page unloads instantly
        fetch(`/api/classroom/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "paused",
            stopped_reason: "lecturer_left",
            releaseLease: true,
          }),
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);

      // Cancel any pending timer
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
      if (emptyTimer) clearTimeout(emptyTimer);
      if (countTimer) clearInterval(countTimer);

      // Silence all local audio immediately
      speechRef.current?.stop();
      stopAllAudio();

      // If lecturer leaves a running broadcast, cleanly pause and notify all students
      if (isLecturerRef.current && sessionStatusRef.current === "running") {
        console.log("🏫 [Classroom] Lecturer left running session. Auto-pausing broadcast...");
        broadcastEventRef.current?.({
          type: "PAUSE",
          sequence: sequenceRef.current + 1,
          driverLeaseVersion: driverLeaseVersionRef.current,
        });

        api
          .updateClassroomSession(sessionId, {
            status: "paused",
            stopped_reason: "lecturer_left",
            releaseLease: true,
          })
          .catch(() => {});
      }
    };
  }, [sessionId]); // intentionally only sessionId — all others accessed via stable refs

  // ── 8. Initial Data Load ─────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    async function loadClassroom() {
      try {
        const { profile: profileData, user: authUser } = await api.getProfile();
        if (!isMounted) return;

        if (authUser) setUser(authUser);
        if (profileData) {
          setProfile(profileData);
          isLecturerRef.current = profileData.role === "lecturer";
          syncStore().setIsLecturer(profileData.role === "lecturer");
        }

        const { session: sessionData } = await api.getClassroomSession(sessionId);
        if (sessionData && isMounted) {
          setSession(sessionData);

          const rawScript = sessionData.script || "";
          console.log(`🏫 [Classroom] Loaded session ${sessionId} (Topic: "${sessionData.topic}", Script: ${rawScript.length} chars, Status: ${sessionData.status})`);

          const { items, speechItems, mediaMap } = parseLectureScript(rawScript);
          itemsRef.current = items;
          speechItemsRef.current = speechItems;
          mediaMapRef.current = mediaMap;
          syncStore().setItems(items);
          console.log(`📋 [Classroom] Parsed ${items.length} lecture items (${speechItems.length} speech, ${mediaMap.size} visual assets).`);

          // NOTE: If lecturer re-enters an "ended" session, the UI shows a
          // "Restart Broadcast" overlay. We intentionally do NOT auto-reset here
          // to avoid a race where status is modified before the profile is loaded.

          setSessionStatus(sessionData.status as SessionStateStatus);
          sessionStatusRef.current = sessionData.status as SessionStateStatus;
          syncStore().setSessionId(sessionData.id);
          syncStore().setTopic(sessionData.topic);
          syncStore().setStatus(sessionData.status as SessionStateStatus);

          if (sessionData.stopped_reason) {
            setStoppedReason(sessionData.stopped_reason);
            syncStore().setStoppedReason(sessionData.stopped_reason);
          }

          // Restore sequence from DB
          sequenceRef.current = sessionData.sequence || 0;
          lastSeqRef.current = sessionData.sequence ? sessionData.sequence - 1 : -1;
          syncStore().setSequence(sessionData.sequence || 0);

          // DB recovery: restore current item index
          if (sessionData.current_item_id) {
            const found = items.findIndex((i) => i.id === sessionData.current_item_id);
            if (found !== -1) {
              currentIndexRef.current = found;
              syncStore().setCurrentIndex(found);
            }
          }

          // Prefetch initial speech items
          const initialSpeechTexts = speechItems.slice(0, 6).map((i) => i.text);
          if (initialSpeechTexts.length > 0) {
            speechRef.current.prefetch(initialSpeechTexts, sessionData.voice_id || "af_bella");
          }

          // If session is already running when joining (late join):
          // ONLY the active lecturer conductor resumes script execution! Students wait for SCHEDULED_PLAY
          if (isLecturerRef.current && isConductorLeaseActiveRef.current && sessionData.status === "running") {
            const cur = items[currentIndexRef.current] || items[0];
            if (cur) {
              setTimeout(() => {
                executeLectureItemRef.current?.(cur);
              }, 400);
            }
          }
        }
      } catch (err) {
        console.error("Error loading classroom:", err);
      }
    }

    loadClassroom();

    // Postgres Realtime Listener for DB changes (session status updates)
    const dbSub = supabase
      .channel(`db:sessions:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const updated = payload.new as ClassroomSession;
          if (updated && updated.status) {
            setSessionStatus(updated.status as SessionStateStatus);
            sessionStatusRef.current = updated.status as SessionStateStatus;
            syncStore().setStatus(updated.status as SessionStateStatus);

            if (updated.status === "ended") {
              speechRef.current.stop();
            }
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(dbSub);
    };
  }, [sessionId, syncStore]);

  // ── 9. Q&A Interruption Handler ──────────────────────────────────────
  const handleInterrupt = async (questionText?: string) => {
    const question = questionText || userQuestion;
    if (!question.trim() || !session) return;

    setIsThinking(true);
    syncStore().setIsThinking(true);
    setUserQuestion("");
    syncStore().setUserQuestion("");

    try {
      api
        .sendMessage(sessionId, {
          role: "user",
          message: question,
          user_id: user?.id,
        })
        .catch((e) => console.warn("Failed to persist user question:", e));

      const curItem = itemsRef.current[currentIndexRef.current];
      const modelPersona = session.voice_id?.startsWith("af_") ? "Dr. Clara" : "Prof. Arthur";
      const { answer } = await api.askQuestion(sessionId, {
        question,
        courseId: session.course_id,
        studentName: profile?.name || "Student",
        lecturerName: modelPersona,
        lastSpokenSentence: curItem?.type === "speech" ? curItem.text : "",
        sessionTopic: session.topic,
        currentIndex: currentIndexRef.current,
      });

      api
        .sendMessage(sessionId, { role: "ai", message: answer })
        .catch((e) => console.warn("Failed to persist AI answer:", e));

      let audioUrl: string | undefined;
      let lipSyncData: HeadTTSData | undefined;
      let targetEpochMs: number | undefined;

      try {
        const speechRes = await fetchSpeechTTS({
          text: answer,
          voice: session.voice_id || "af_bella",
        });
        audioUrl = speechRes.audioPath;
        lipSyncData = speechRes.lipSyncData;
        targetEpochMs = Math.round(getSynchronizedEpochMs() + LEAD_TIME_MS);
      } catch (e) {
        console.warn("Q&A speech synthesis fallback:", e);
      }

      const nextItemId =
        itemsRef.current[currentIndexRef.current + 1]?.id ||
        itemsRef.current[currentIndexRef.current]?.id ||
        "speech_0";
      const interruptionId = `qa_${Date.now()}`;
      sequenceRef.current++;

      broadcastEvent({
        type: "INTERRUPT",
        interruptionId,
        studentName: profile?.name || "Student",
        question,
        answer,
        resumeFromItemId: nextItemId,
        sequence: sequenceRef.current,
        driverLeaseVersion: driverLeaseVersionRef.current,
        targetEpochMs,
        audioUrl,
        lipSyncData,
      });

      handleRealtimeEvent({
        type: "INTERRUPT",
        interruptionId,
        studentName: profile?.name || "Student",
        question,
        answer,
        resumeFromItemId: nextItemId,
        sequence: sequenceRef.current,
        driverLeaseVersion: driverLeaseVersionRef.current,
        targetEpochMs,
        audioUrl,
        lipSyncData,
      });

      toast.success("Question addressed to professor");
    } catch (err: unknown) {
      console.error("Interruption error:", err);
      const msg = err instanceof Error ? err.message : "Failed to process question.";
      toast.error(msg);
    } finally {
      setIsThinking(false);
      syncStore().setIsThinking(false);
    }
  };

  // ── 10. Session Controller Actions (Lecturer Only) ────────────────────

  const startSession = async () => {
    if (!isLecturerRef.current) return;

    if (itemsRef.current.length === 0) {
      toast.error("No lecture script found. Please generate the curriculum script before starting broadcast.");
      return;
    }

    console.log(`▶️ [Classroom] Starting live broadcast for session ${sessionId} (${itemsRef.current.length} items)...`);
    admitAllParticipants();

    // Only reset sequence on initial fresh start from zero
    const isInitialStart = sessionStatusRef.current === "created" && currentIndexRef.current === 0 && sequenceRef.current === 0;
    if (isInitialStart) {
      sequenceRef.current = 0;
      lastSeqRef.current = -1;
    }

    setSessionStatus("running");
    sessionStatusRef.current = "running";
    syncStore().setStatus("running");
    setStoppedReason(undefined);
    syncStore().setStoppedReason(undefined);

    sequenceRef.current++;

    // Atomically claim conductor lease in PostgreSQL
    const claimRes = await api.updateClassroomSession(sessionId, {
      status: "running",
      sequence: sequenceRef.current,
      driverTabId: myTabIdRef.current,
    });

    if (claimRes?.session?.active_driver_tab_id && claimRes.session.active_driver_tab_id !== myTabIdRef.current) {
      console.warn("[Classroom] CAS conductor claim lost to another lecturer tab.");
      isConductorLeaseActiveRef.current = false;
      return;
    }

    isConductorLeaseActiveRef.current = true;
    if (typeof claimRes?.session?.driver_lease_version === "number") {
      driverLeaseVersionRef.current = claimRes.session.driver_lease_version;
    }

    sequenceRef.current++;
    const targetEpochMs = Math.round(getSynchronizedEpochMs() + LEAD_TIME_MS);

    broadcastEvent({
      type: "RESUME",
      sequence: sequenceRef.current,
      driverLeaseVersion: driverLeaseVersionRef.current,
      itemId: itemsRef.current[currentIndexRef.current]?.id || "speech_0",
      targetEpochMs,
    });

    const cur = itemsRef.current[currentIndexRef.current] || itemsRef.current[0];
    if (cur) {
      executeLectureItem(cur);
    }
  };

  const pauseSession = async () => {
    if (!isLecturerRef.current) return;
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    sequenceRef.current++;
    setSessionStatus("paused");
    sessionStatusRef.current = "paused";
    syncStore().setStatus("paused");
    executingItemIdRef.current = null;
    speech.stop();

    await api.updateClassroomSession(sessionId, {
      status: "paused",
      sequence: sequenceRef.current,
      releaseLease: true,
    });

    broadcastEvent({
      type: "PAUSE",
      sequence: sequenceRef.current,
      driverLeaseVersion: driverLeaseVersionRef.current,
    });
  };

  const endSession = async () => {
    if (!isLecturerRef.current) return;
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    sequenceRef.current++;
    setSessionStatus("ended");
    sessionStatusRef.current = "ended";
    syncStore().setStatus("ended");
    setStoppedReason("manual_lecturer_end");
    syncStore().setStoppedReason("manual_lecturer_end");
    executingItemIdRef.current = null;
    speech.stop();

    await api.updateClassroomSession(sessionId, {
      status: "ended",
      sequence: sequenceRef.current,
      stopped_reason: "manual_lecturer_end",
      releaseLease: true,
    });

    broadcastEvent({
      type: "END",
      sequence: sequenceRef.current,
      driverLeaseVersion: driverLeaseVersionRef.current,
      stoppedReason: "manual_lecturer_end",
    });
  };

  const restartSession = async () => {
    if (!isLecturerRef.current) return;
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    currentIndexRef.current = 0;
    syncStore().setCurrentIndex(0);

    sequenceRef.current = 0;
    lastSeqRef.current = -1;

    setSessionStatus("created");
    sessionStatusRef.current = "created";
    syncStore().setStatus("created");
    setStoppedReason(undefined);
    syncStore().setStoppedReason(undefined);
    executingItemIdRef.current = null;
    speech.stop();

    await api.updateClassroomSession(sessionId, {
      status: "created",
      current_sentence_index: 0,
      current_item_id: itemsRef.current[0]?.id || "",
      sequence: 0,
      stopped_reason: "",
      releaseLease: true,
    });

    // Broadcast RESTART (not PAUSE) so all students unconditionally hard-reset
    // their sequence guards — prevents old lastSeqRef blocking the new run.
    broadcastEvent({
      type: "RESTART",
      sequence: 0,
      driverLeaseVersion: driverLeaseVersionRef.current,
    });

    setCurrentSubtitle("Lecture restarted. Ready to broadcast.");
    syncStore().setCurrentSubtitle("Lecture restarted. Ready to broadcast.");
    toast.success("Session restarted. Ready for students to join.");
  };

  const updateScript = async (newScript: string) => {
    if (!isLecturerRef.current) return;
    const { items, speechItems, mediaMap } = parseLectureScript(newScript);
    itemsRef.current = items;
    speechItemsRef.current = speechItems;
    mediaMapRef.current = mediaMap;
    syncStore().setItems(items);
    await api.updateClassroomSession(sessionId, { script: newScript });
    toast.success("Curriculum script updated successfully!");
  };

  const projectMedia = useCallback(
    (mediaObj: MediaItemDisplay) => {
      setActiveMedia(mediaObj);
      syncStore().setActiveMedia(mediaObj);
      if (isLecturerRef.current) {
        sequenceRef.current++;
        broadcastEventRef.current?.({
          type: "MEDIA_PROJECT",
          sequence: sequenceRef.current,
          driverLeaseVersion: driverLeaseVersionRef.current,
          media: mediaObj,
        });
        toast.success(`Projected "${mediaObj.label || "Visual"}" to stage`);
      }
    },
    [syncStore]
  );

  const dismissMedia = useCallback(() => {
    setActiveMedia(null);
    syncStore().setActiveMedia(null);
    if (isLecturerRef.current) {
      sequenceRef.current++;
      broadcastEventRef.current?.({
        type: "MEDIA_DISMISS",
        sequence: sequenceRef.current,
        driverLeaseVersion: driverLeaseVersionRef.current,
      });
      toast.info("Dismissed visual projection");
    }
  }, [syncStore]);

  return {
    user,
    profile,
    session,
    sessionStatus,
    stoppedReason,
    isLecturer: profile?.role === "lecturer",
    activeStudentCount,
    activeLecturerCount,
    participants,
    myAdmissionStatus,
    emptyRoomCountdown,
    audioUnlocked,
    setAudioUnlocked,
    currentSubtitle,
    activeMedia,
    setActiveMedia,
    projectMedia,
    dismissMedia,
    isThinking,
    userQuestion,
    setUserQuestion,
    handleInterrupt,
    currentSpeech: speech.currentSpeech,
    handleAudioEnd: speech.handleAudioEnd,
    startSession,
    pauseSession,
    endSession,
    restartSession,
    updateScript,
    admitParticipant,
    denyParticipant,
    kickParticipant,
    admitAllParticipants,
    requestRejoin,
  };
}
