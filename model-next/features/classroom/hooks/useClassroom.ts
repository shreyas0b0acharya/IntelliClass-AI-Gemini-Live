"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { api } from "@/lib/api";
import type { ClassroomSession, Profile } from "@/lib/supabase/types";
import { parseLectureScript, type LectureItem, type LectureSpeechItem } from "../types/lecture-item";
import type { ClassroomEvent, InterruptionItem, SessionStateStatus } from "../types/classroom";
import type { HeadTTSData } from "@/features/avatar";
import { fetchSpeechTTS } from "../services/tts";
import { useSpeechQueue } from "./useSpeechQueue";
import { useClassroomSync } from "./useClassroomSync";
import { useClassroomStore } from "../store/classroomStore";
import { toast } from "sonner";

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
  const [stoppedReason, setStoppedReason] = useState<string | undefined>();
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const [currentSubtitle, setCurrentSubtitle] = useState<string>("Ready to begin lecture.");
  const [activeMedia, setActiveMedia] = useState<MediaItemDisplay | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [userQuestion, setUserQuestion] = useState("");

  // 30-Second Empty Room Auto-Stop Timer
  const [emptyRoomCountdown, setEmptyRoomCountdown] = useState<number | null>(null);
  const emptyRoomTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const itemsRef = useRef<LectureItem[]>([]);
  const speechItemsRef = useRef<LectureSpeechItem[]>([]);
  const currentIndexRef = useRef<number>(0);
  const sequenceRef = useRef<number>(0);
  const isLecturerRef = useRef<boolean>(false);
  const isDriverRef = useRef<boolean>(false);
  const sessionStatusRef = useRef<SessionStateStatus>("created");
  const activeInterruptionRef = useRef<InterruptionItem | null>(null);
  const mediaMapRef = useRef<Map<string, { type: "image" | "video"; ref: string }>>(new Map());

  const broadcastEventRef = useRef<((event: ClassroomEvent) => void) | null>(null);
  const executeLectureItemRef = useRef<((item: LectureItem) => void) | null>(null);

  // Helper to safely mutate Zustand store without subscribing to render loops
  const syncStore = useClassroomStore.getState;

  // 1. Advance to Next Item (Autonomous Room Driver)
  const advanceCurrentItem = useCallback(async () => {
    // 1. If we are currently handling an interruption / Q&A answer:
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

    // 2. Normal lecture sequence advancement
    const nextIdx = currentIndexRef.current + 1;
    if (nextIdx >= itemsRef.current.length) {
      console.log("🏁 [Classroom] Lecture script completed all segments!");
      setSessionStatus("ended");
      sessionStatusRef.current = "ended";
      syncStore().setStatus("ended");
      setStoppedReason("script_completed");
      setCurrentSubtitle("Lecture completed. Thank you class!");
      syncStore().setCurrentSubtitle("Lecture completed. Thank you class!");

      if (isDriverRef.current) {
        sequenceRef.current++;
        broadcastEventRef.current?.({
          type: "END",
          sequence: sequenceRef.current,
          stoppedReason: "script_completed",
        });
        api
          .updateClassroomSession(sessionId, {
            status: "ended",
            stopped_reason: "script_completed",
          })
          .catch(console.error);
      }
      return;
    }

    currentIndexRef.current = nextIdx;
    syncStore().setCurrentIndex(nextIdx);
    const currentItem = itemsRef.current[nextIdx];

    executeLectureItemRef.current?.(currentItem);
  }, [sessionId, syncStore]);

  // 2. TTS & Speech Queue Hook
  const speech = useSpeechQueue({
    voice: session?.voice_id || "af_bella",
    onSpeechComplete: (_itemId) => {
      // Authoritative advancement triggered by active room driver or active interruption
      if (
        sessionStatusRef.current === "running" &&
        (isDriverRef.current || isLecturerRef.current || activeInterruptionRef.current)
      ) {
        setTimeout(advanceCurrentItem, 80);
      }
    },
    onError: (err) => {
      toast.error(`Speech synthesis error: ${err.message}`);
    },
  });

  // 3. Execute a specific LectureItem
  const executeLectureItem = useCallback(
    async (item: LectureItem) => {
      if (!item) return;

      // Handle media item
      if (item.type === "image" || item.type === "video") {
        const mediaObj: MediaItemDisplay = {
          type: item.type === "video" ? "video" : "image",
          url: item.mediaRef,
          label: item.caption || "Visual Asset",
        };
        setActiveMedia(mediaObj);
        syncStore().setActiveMedia(mediaObj);

        if (isDriverRef.current || isLecturerRef.current) {
          sequenceRef.current++;
          broadcastEventRef.current?.({
            type: "PLAY_ITEM",
            itemId: item.id,
            sequence: sequenceRef.current,
          });
          setTimeout(advanceCurrentItem, 3500);
        }
        return;
      }

      // Handle pause item
      if (item.type === "pause") {
        setCurrentSubtitle("...");
        syncStore().setCurrentSubtitle("...");
        if (isDriverRef.current || isLecturerRef.current) {
          sequenceRef.current++;
          broadcastEventRef.current?.({
            type: "PLAY_ITEM",
            itemId: item.id,
            sequence: sequenceRef.current,
          });
          setTimeout(advanceCurrentItem, item.durationMs || 1200);
        }
        return;
      }

      // Handle engagement reflection item
      if (item.type === "engagement") {
        const promptText = item.prompt || "Let us pause and reflect...";
        setCurrentSubtitle(promptText);
        syncStore().setCurrentSubtitle(promptText);
        if (isDriverRef.current || isLecturerRef.current) {
          sequenceRef.current++;
          broadcastEventRef.current?.({
            type: "PLAY_ITEM",
            itemId: item.id,
            sequence: sequenceRef.current,
          });
          setTimeout(advanceCurrentItem, 2000);
        }
        return;
      }

      // Handle speech item
      if (item.type === "speech") {
        console.log(`🗣️ [Classroom] Speaking segment #${currentIndexRef.current + 1}: "${item.text.slice(0, 80)}..."`);
        setCurrentSubtitle(item.text);
        syncStore().setCurrentSubtitle(item.text);

        // Pre-fetch next 4 items concurrently
        const nextItems = itemsRef.current
          .slice(currentIndexRef.current + 1, currentIndexRef.current + 6)
          .filter((i): i is LectureSpeechItem => i.type === "speech")
          .map((i) => i.text);

        if (nextItems.length > 0) {
          speech.prefetch(nextItems, session?.voice_id || "af_bella");
        }

        const speechResult = await speech.playSpeech(
          item.text,
          item.id,
          session?.voice_id || "af_bella"
        );

        if (!speechResult || !speechResult.audioPath) {
          console.warn(`⚠️ [Classroom] TTS synthesis unavailable for item #${currentIndexRef.current + 1}. Auto-advancing in 3s.`);
          setTimeout(advanceCurrentItem, 3000);
          return;
        }

        // Room driver broadcasts ready audio path & visemes to all listeners
        if (isDriverRef.current || isLecturerRef.current) {
          sequenceRef.current++;
          api
            .updateClassroomSession(sessionId, {
              current_item_id: item.id,
              current_sentence_index: currentIndexRef.current,
              sequence: sequenceRef.current,
              status: "running",
            })
            .catch(console.error);

          broadcastEventRef.current?.({
            type: "PLAY_ITEM",
            itemId: item.id,
            sequence: sequenceRef.current,
            audioPath: speechResult.audioPath,
            lipSyncData: speechResult.lipSyncData,
            text: item.text,
          });
        }
      }
    },
    [session?.voice_id, advanceCurrentItem, speech, sessionId, syncStore]
  );

  // 4. Realtime Events Receiver (Student Lockstep Player)
  const handleRealtimeEvent = useCallback(
    (event: ClassroomEvent) => {
      if (event.type === "PLAY_ITEM") {
        const foundIdx = itemsRef.current.findIndex((i) => i.id === event.itemId);
        if (foundIdx !== -1) {
          currentIndexRef.current = foundIdx;
          syncStore().setCurrentIndex(foundIdx);
          const item = itemsRef.current[foundIdx];

          // If broadcast includes pre-synthesized audio, play immediately without API delay
          if (event.audioPath && event.lipSyncData) {
            const subText = event.text || (item.type === "speech" ? item.text : "");
            setCurrentSubtitle(subText);
            syncStore().setCurrentSubtitle(subText);
            speech.playDirectSpeech(
              {
                audioPath: event.audioPath,
                lipSyncData: event.lipSyncData,
                text: subText,
              },
              item.id
            );

            // Prefetch next items for student cache
            const nextItems = itemsRef.current
              .slice(foundIdx + 1, foundIdx + 4)
              .filter((i): i is LectureSpeechItem => i.type === "speech")
              .map((i) => i.text);
            if (nextItems.length > 0) {
              speech.prefetch(nextItems, session?.voice_id || "af_bella");
            }
          } else {
            executeLectureItem(item);
          }
        }
      } else if (event.type === "PAUSE") {
        setSessionStatus("paused");
        sessionStatusRef.current = "paused";
        syncStore().setStatus("paused");
        speech.stop();
        setCurrentSubtitle("Lecture paused by professor.");
        syncStore().setCurrentSubtitle("Lecture paused by professor.");
      } else if (event.type === "RESUME") {
        setSessionStatus("running");
        sessionStatusRef.current = "running";
        syncStore().setStatus("running");
        const foundIdx = itemsRef.current.findIndex((i) => i.id === event.itemId);
        if (foundIdx !== -1) {
          currentIndexRef.current = foundIdx;
          syncStore().setCurrentIndex(foundIdx);
          if (event.audioPath && event.lipSyncData) {
            setCurrentSubtitle(event.text || "");
            syncStore().setCurrentSubtitle(event.text || "");
            speech.playDirectSpeech(
              {
                audioPath: event.audioPath,
                lipSyncData: event.lipSyncData,
                text: event.text || "",
              },
              event.itemId
            );
          } else {
            executeLectureItem(itemsRef.current[foundIdx]);
          }
        }
      } else if (event.type === "INTERRUPT") {
        // Synchronized Q&A answer
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
        if (event.audioPath && event.lipSyncData) {
          speech.playDirectSpeech(
            {
              audioPath: event.audioPath,
              lipSyncData: event.lipSyncData,
              text: event.answer,
            },
            event.interruptionId
          );
        } else {
          speech.playSpeech(event.answer, event.interruptionId, session?.voice_id || "af_bella");
        }
      } else if (event.type === "END") {
        setSessionStatus("ended");
        sessionStatusRef.current = "ended";
        syncStore().setStatus("ended");
        if (event.stoppedReason) {
          setStoppedReason(event.stoppedReason);
          syncStore().setStoppedReason(event.stoppedReason);
        }
        speech.stop();
        if (event.stoppedReason === "no_students_timeout") {
          setCurrentSubtitle("Classroom automatically stopped: No students present for 30 seconds.");
          syncStore().setCurrentSubtitle("Classroom automatically stopped: No students present for 30 seconds.");
        } else {
          setCurrentSubtitle("Lecture session has ended.");
          syncStore().setCurrentSubtitle("Lecture session has ended.");
        }
      }
    },
    [executeLectureItem, session?.voice_id, speech, syncStore]
  );

  // 5. Supabase Realtime & Presence Sync
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
  }, [executeLectureItem, broadcastEvent]);

  // 6. Empty Room Auto-Stop Watcher (Disabled so sessions stay active when lecturer steps away)
  useEffect(() => {
    if (emptyRoomTimerRef.current) clearTimeout(emptyRoomTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setEmptyRoomCountdown(null);
    syncStore().setEmptyRoomCountdown(null);
  }, [sessionStatus, syncStore]);

  // 7. Initial Data Load
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
          console.log(`📋 [Classroom] Parsed ${items.length} lecture items (${speechItems.length} speech segments, ${mediaMap.size} visual assets).`);

          // If lecturer opens an ended session, auto-reset to created state so students can enter
          if (isLecturerRef.current && sessionData.status === "ended") {
            sessionData.status = "created";
            sessionData.stopped_reason = "";
            api.updateClassroomSession(sessionId, {
              status: "created",
              current_sentence_index: 0,
              current_item_id: items[0]?.id || "",
              stopped_reason: "",
            }).catch(console.warn);
          }

          setSessionStatus(sessionData.status as SessionStateStatus);
          sessionStatusRef.current = sessionData.status as SessionStateStatus;
          syncStore().setSessionId(sessionData.id);
          syncStore().setTopic(sessionData.topic);
          syncStore().setStatus(sessionData.status as SessionStateStatus);

          if (sessionData.stopped_reason) {
            setStoppedReason(sessionData.stopped_reason);
            syncStore().setStoppedReason(sessionData.stopped_reason);
          }
          sequenceRef.current = sessionData.sequence || 0;
          syncStore().setSequence(sessionData.sequence || 0);

          // DB recovery check
          if (sessionData.current_item_id) {
            const found = items.findIndex((i) => i.id === sessionData.current_item_id);
            if (found !== -1) {
              currentIndexRef.current = found;
              syncStore().setCurrentIndex(found);
            }
          }

          // Initial phrase prefetch
          const initialSpeechTexts = speechItems.slice(0, 6).map((i) => i.text);
          if (initialSpeechTexts.length > 0) {
            speechRef.current.prefetch(initialSpeechTexts, sessionData.voice_id || "af_bella");
          }

          // If session is already running when joining, begin playback
          if (sessionData.status === "running") {
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

    // Postgres Realtime Listener for DB changes
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
          if (!updated) return;

          setSession((prev) => (prev ? { ...prev, ...updated } : updated));
          if (updated.status && updated.status !== sessionStatusRef.current) {
            setSessionStatus(updated.status as SessionStateStatus);
            sessionStatusRef.current = updated.status as SessionStateStatus;
            syncStore().setStatus(updated.status as SessionStateStatus);
            if (updated.stopped_reason) {
              setStoppedReason(updated.stopped_reason);
              syncStore().setStoppedReason(updated.stopped_reason);
            }
          }

          // If script was updated, re-parse
          if (updated.script && updated.script !== session?.script) {
            const { items, speechItems, mediaMap } = parseLectureScript(updated.script);
            itemsRef.current = items;
            speechItemsRef.current = speechItems;
            mediaMapRef.current = mediaMap;
            syncStore().setItems(items);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(dbSub);
    };
  }, [sessionId, syncStore]);

  // 8. Q&A Interruption Handler
  const handleInterrupt = async (questionText?: string) => {
    const question = questionText || userQuestion;
    if (!question.trim() || !session) return;

    setIsThinking(true);
    syncStore().setIsThinking(true);
    setUserQuestion("");
    syncStore().setUserQuestion("");

    try {
      // Persist user question in background without blocking response pipeline
      api
        .sendMessage(sessionId, {
          role: "user",
          message: question,
          user_id: user?.id,
        })
        .catch((e) => console.warn("Failed to persist user question message:", e));

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

      // Persist AI answer in background
      api
        .sendMessage(sessionId, {
          role: "ai",
          message: answer,
        })
        .catch((e) => console.warn("Failed to persist AI answer message:", e));

      let audioPath: string | undefined;
      let lipSyncData: HeadTTSData | undefined;
      try {
        const speechRes = await fetchSpeechTTS({
          text: answer,
          voice: session.voice_id || "af_bella",
        });
        audioPath = speechRes.audioPath;
        lipSyncData = speechRes.lipSyncData;
      } catch (e) {
        console.warn("Direct Q&A speech synthesis fallback:", e);
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
        audioPath,
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
        audioPath,
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

  // 9. Session Controller Actions (Lecturer Only)
  const startSession = async () => {
    if (!isLecturerRef.current) return;

    if (itemsRef.current.length === 0) {
      toast.error("No lecture script found. Please generate the curriculum script before starting broadcast.");
      return;
    }

    console.log(`▶️ [Classroom] Starting live broadcast for session ${sessionId} (${itemsRef.current.length} items)...`);
    admitAllParticipants();
    sequenceRef.current++;
    setSessionStatus("running");
    sessionStatusRef.current = "running";
    syncStore().setStatus("running");
    setStoppedReason(undefined);
    syncStore().setStoppedReason(undefined);

    await api.updateClassroomSession(sessionId, {
      status: "running",
      sequence: sequenceRef.current,
    });

    broadcastEvent({
      type: "RESUME",
      itemId: itemsRef.current[currentIndexRef.current]?.id || "speech_0",
      sequence: sequenceRef.current,
    });

    const cur = itemsRef.current[currentIndexRef.current] || itemsRef.current[0];
    if (cur) {
      executeLectureItem(cur);
    }
  };

  const pauseSession = async () => {
    if (!isLecturerRef.current) return;
    sequenceRef.current++;
    setSessionStatus("paused");
    sessionStatusRef.current = "paused";
    syncStore().setStatus("paused");
    speech.stop();

    await api.updateClassroomSession(sessionId, {
      status: "paused",
      sequence: sequenceRef.current,
    });

    broadcastEvent({ type: "PAUSE", sequence: sequenceRef.current });
  };

  const endSession = async () => {
    if (!isLecturerRef.current) return;
    sequenceRef.current++;
    setSessionStatus("ended");
    sessionStatusRef.current = "ended";
    syncStore().setStatus("ended");
    setStoppedReason("manual_lecturer_end");
    syncStore().setStoppedReason("manual_lecturer_end");
    speech.stop();

    await api.updateClassroomSession(sessionId, {
      status: "ended",
      sequence: sequenceRef.current,
      stopped_reason: "manual_lecturer_end",
    });

    broadcastEvent({
      type: "END",
      sequence: sequenceRef.current,
      stoppedReason: "manual_lecturer_end",
    });
  };

  const restartSession = async () => {
    if (!isLecturerRef.current) return;
    currentIndexRef.current = 0;
    syncStore().setCurrentIndex(0);
    sequenceRef.current++;
    setSessionStatus("created");
    sessionStatusRef.current = "created";
    syncStore().setStatus("created");
    setStoppedReason(undefined);
    syncStore().setStoppedReason(undefined);
    speech.stop();

    await api.updateClassroomSession(sessionId, {
      status: "created",
      current_sentence_index: 0,
      current_item_id: itemsRef.current[0]?.id || "",
      sequence: sequenceRef.current,
      stopped_reason: "",
    });

    broadcastEvent({
      type: "PAUSE",
      sequence: sequenceRef.current,
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
    admitParticipant,
    denyParticipant,
    kickParticipant,
    admitAllParticipants,
    requestRejoin,
    emptyRoomCountdown,
    audioUnlocked,
    setAudioUnlocked,
    currentSubtitle,
    activeMedia,
    setActiveMedia,
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
  };
}
