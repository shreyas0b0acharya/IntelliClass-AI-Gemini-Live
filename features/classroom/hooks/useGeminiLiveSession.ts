"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Room, RemoteTrackPublication, RemoteParticipant, Track } from "livekit-client";
import { BoundedLiveAudioPlayer, getTimeTag } from "../services/liveAudioPlayer";
import { GeminiLiveClient } from "../services/geminiLiveClient";
import {
  connectToLivekitRoom,
  publishBridgedAudioTrack,
  setStudentMicrophone,
} from "../services/livekitClient";
import type { SessionRoadmap } from "../types/roadmap";
import { useClassroomStore } from "../store/classroomStore";
import { liveAudioSync } from "@/features/avatar";
import { api } from "@/lib/api";
import type { ClassroomInteractionRecord } from "../types/interaction";

export interface UseGeminiLiveSessionOptions {
  sessionId: string;
  isConductor: boolean;
  participantId?: string;
  participantName?: string;
  onAdvanceTopic?: (nextTopicId: string) => void;
  onProjectMedia?: (assetId: string, caption?: string) => void;
  onSubtitleReceived?: (text: string) => void;
  onError?: (error: unknown) => void;
  initialRoadmap?: SessionRoadmap | null;
  initialTopicId?: string | null;
  initialNotes?: Array<ClassroomInteractionRecord | { id: string; topicId?: string; text: string; timestamp: string }> | null;
}

function normalizeInteractionRecord(
  item: ClassroomInteractionRecord | { id?: string; topicId?: string; text?: string; timestamp?: string },
  idx: number
): ClassroomInteractionRecord & { text: string; topicId?: string } {
  if ("speaker" in item && "type" in item && (item as ClassroomInteractionRecord).speaker) {
    const rec = item as ClassroomInteractionRecord;
    return {
      ...rec,
      text: rec.text || "",
      topicId: rec.topicId,
    };
  }
  return {
    id: item.id || `init_${idx}`,
    sequence: idx + 1,
    timestamp: item.timestamp || new Date().toISOString(),
    topicId: item.topicId,
    speaker: "professor",
    speakerName: "Professor",
    type: "lecture_speech",
    text: item.text || "",
  };
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  try {
    const { supabase } = await import("@/lib/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  } catch { }
  return headers;
}

export function useGeminiLiveSession({
  sessionId,
  isConductor,
  participantId,
  participantName,
  onAdvanceTopic,
  onProjectMedia,
  onSubtitleReceived,
  onError,
  initialRoadmap,
  initialTopicId,
  initialNotes,
}: UseGeminiLiveSessionOptions) {
  const [connectionStatus, setConnectionStatus] = useState<
    "disconnected" | "connecting" | "connected" | "error"
  >("disconnected");
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [currentRms, setCurrentRms] = useState<number>(0);
  const [hasFloor, setHasFloor] = useState<boolean>(false);
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [roadmap, setRoadmap] = useState<SessionRoadmap | null>(initialRoadmap || null);
  const [currentTopicId, setCurrentTopicId] = useState<string | null>(initialTopicId || null);

  // Synchronous refs to prevent stale closure issues during async turn dispatching
  const roadmapRef = useRef<SessionRoadmap | null>(initialRoadmap || null);
  const currentTopicIdRef = useRef<string | null>(initialTopicId || null);
  const isLecturingActiveRef = useRef<boolean>(false);
  const continuationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Timing references for measuring click-to-speech cold start latency
  const startClickTimestampRef = useRef<number | null>(null);

  // Audio Context and Stream references
  const playerRef = useRef<BoundedLiveAudioPlayer | null>(null);
  const clientRef = useRef<GeminiLiveClient | null>(null);
  const roomRef = useRef<Room | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const localMicStreamRef = useRef<MediaStream | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micMuteGainRef = useRef<GainNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

  // Auto-Save Notes & Durable Checkpoint State with Structured Interaction Capture
  const notesBufferRef = useRef<Array<ClassroomInteractionRecord & { text: string; topicId?: string }>>(
    Array.isArray(initialNotes)
      ? initialNotes.map((n, idx) => normalizeInteractionRecord(n, idx))
      : []
  );
  const accumulatedSpeechTurnRef = useRef<string>("");
  const lastSubtitleRef = useRef<string>("");
  const notesVersionRef = useRef<number>(1);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const flushNotesAndSaveCheckpoint = useCallback(async () => {
    // Flush in-flight turn text if any
    let inFlight = accumulatedSpeechTurnRef.current.trim();
    if (inFlight.length <= 5 && lastSubtitleRef.current?.trim()) {
      inFlight = lastSubtitleRef.current.trim();
    }
    // Clean out internal tool/JSON tokens
    inFlight = inFlight.replace(/```json[\s\S]*?```/g, "").replace(/\{"name":.*?\}/g, "").trim();

    if (inFlight.length > 5) {
      if (!notesBufferRef.current.some((n) => n.text === inFlight)) {
        notesBufferRef.current.push({
          id: `int_${Date.now()}_${notesBufferRef.current.length}`,
          sequence: notesBufferRef.current.length + 1,
          timestamp: new Date().toISOString(),
          topicId: currentTopicIdRef.current || undefined,
          speaker: "professor",
          speakerName: "Professor",
          type: "lecture_speech",
          text: inFlight,
        });
      }
      accumulatedSpeechTurnRef.current = "";
    }

    // Only the faculty conductor saves lecture notes and session checkpoints to the backend
    if (!isConductor || !sessionId || notesBufferRef.current.length === 0) return;
    try {
      const checkpoint = {
        classId: sessionId,
        currentTopicId: currentTopicIdRef.current,
        notes: notesBufferRef.current,
        notesVersion: notesVersionRef.current++,
        lastNoteSequence: notesBufferRef.current.length,
        checkpointAt: new Date().toISOString(),
      };
      await api.updateClassroomSession(sessionId, {
        live_session_stats: checkpoint,
      });
      console.log(`${getTimeTag()} 💾 [Notes Auto-Save] Auto-saved ${notesBufferRef.current.length} notes & checkpoint to database`);
    } catch (err: unknown) {
      // Suppress 403 warnings for unauthorized/read-only participant contexts
      if ((err as { status?: number })?.status === 403) return;
      console.warn("Notes auto-save flush warning:", err);
    }
  }, [sessionId, isConductor]);

  const getNotes = useCallback(() => {
    return [...notesBufferRef.current];
  }, []);

  const getInteractionRecords = useCallback(() => {
    return [...notesBufferRef.current];
  }, []);

  // Sync prop updates to state and refs
  useEffect(() => {
    if (Array.isArray(initialNotes) && initialNotes.length > 0 && notesBufferRef.current.length === 0) {
      notesBufferRef.current = initialNotes.map((n, idx) => normalizeInteractionRecord(n, idx));
    }
  }, [initialNotes]);

  useEffect(() => {
    if (initialRoadmap) {
      setRoadmap(initialRoadmap);
      roadmapRef.current = initialRoadmap;
    }
  }, [initialRoadmap]);

  useEffect(() => {
    if (initialTopicId) {
      setCurrentTopicId(initialTopicId);
      currentTopicIdRef.current = initialTopicId;
    }
  }, [initialTopicId]);

  // 1. RMS Polling loop for Avatar lip-sync (Active on both Conductor and Student)
  const updateRms = useCallback(() => {
    const liveSpeaking = liveAudioSync.isSpeaking();
    let rms = 0;
    if (playerRef.current) {
      rms = playerRef.current.getCurrentRms();
    } else {
      const live = liveAudioSync.getAnalysis(0.016);
      rms = live.rms;
    }
    setCurrentRms(rms);
    setIsSpeaking(rms > 0.015 || liveSpeaking);
    animFrameRef.current = requestAnimationFrame(updateRms);
  }, []);

  // 2. Setup audio resampler worklet for streaming mic audio into Gemini Live
  const setupAudioWorkletForStream = useCallback(
    async (stream: MediaStream) => {
      try {
        console.log(`${getTimeTag()} 🎤 [Microphone] Initializing PCM resampler worklet for incoming stream...`);

        // Clean up any existing source/worklet to prevent duplicated streams
        if (micSourceNodeRef.current) {
          try { micSourceNodeRef.current.disconnect(); } catch {}
          micSourceNodeRef.current = null;
        }
        if (micMuteGainRef.current) {
          try { micMuteGainRef.current.disconnect(); } catch {}
          micMuteGainRef.current = null;
        }
        if (workletNodeRef.current) {
          try { workletNodeRef.current.disconnect(); } catch {}
          workletNodeRef.current = null;
        }

        // Reuse or create mic audio context
        let micCtx = micAudioCtxRef.current;
        if (!micCtx || micCtx.state === "closed") {
          const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          micCtx = new AudioContextClass();
          micAudioCtxRef.current = micCtx;
        }

        // CRITICAL: Ensure mic audio context is actively running in browser
        if (micCtx.state === "suspended") {
          await micCtx.resume();
          console.log(`${getTimeTag()} 🎤 [Microphone] AudioContext resumed successfully (state=${micCtx.state})`);
        }

        await micCtx.audioWorklet.addModule("/worklets/pcm-resampler.js");

        const source = micCtx.createMediaStreamSource(stream);
        micSourceNodeRef.current = source;

        const workletNode = new AudioWorkletNode(micCtx, "pcm-resampler");
        workletNodeRef.current = workletNode;

        let consecutiveVoiceChunks = 0;
        workletNode.port.onmessage = (e: MessageEvent) => {
          let buffer: ArrayBuffer | null = null;
          let rms = 0;
          if (e.data instanceof ArrayBuffer) {
            buffer = e.data;
          } else if (e.data && e.data.buffer instanceof ArrayBuffer) {
            buffer = e.data.buffer;
            rms = Number(e.data.rms) || 0;
          }
          if (!buffer) return;

          // Local Interruption Detection:
          // When actual user speech is detected (RMS > 0.025 for >= 2 consecutive 40ms chunks):
          if (rms > 0.025) {
            consecutiveVoiceChunks++;
            if (consecutiveVoiceChunks >= 2) {
              if (playerRef.current && playerRef.current.getCurrentRms() > 0.01) {
                console.log(
                  `${getTimeTag()} ⚡ [Local Interruption] User speech detected (RMS: ${rms.toFixed(3)}) while professor is speaking. Flushing local audio.`
                );
                playerRef.current.flush();
                setIsSpeaking(false);
                setCurrentRms(0);
                liveAudioSync.reset();
              }
              if (continuationTimeoutRef.current) {
                clearTimeout(continuationTimeoutRef.current);
                continuationTimeoutRef.current = null;
              }
            }
          } else {
            consecutiveVoiceChunks = 0;
          }

          if (clientRef.current) {
            // Stream clean 40ms audio chunk directly to Gemini Live
            clientRef.current.sendAudioChunk(buffer);
          }
        };

        source.connect(workletNode);

        // CRITICAL Web Audio optimization: Connect worklet to destination through gain=0
        // This guarantees the browser audio thread actively pulls buffers through the worklet!
        const muteGain = micCtx.createGain();
        muteGain.gain.value = 0;
        workletNode.connect(muteGain);
        muteGain.connect(micCtx.destination);
        micMuteGainRef.current = muteGain;

        console.log(`${getTimeTag()} ✅ [Microphone] PCM resampler worklet running and streaming audio.`);
      } catch (err) {
        console.warn(`${getTimeTag()} ⚠️ [Microphone] Failed to initialize PCM resampler worklet:`, err);
      }
    },
    []
  );

  /**
   * Resumes Web Audio playback on user click gesture (e.g. "Start Live Broadcast" or "Start Class")
   */
  const resumeAudio = useCallback(async () => {
    if (!playerRef.current) {
      playerRef.current = new BoundedLiveAudioPlayer();
    }
    await playerRef.current.resume();
  }, []);

  const setAudioMuted = useCallback((muted: boolean) => {
    if (playerRef.current) {
      playerRef.current.setMuted(muted);
    }
  }, []);

  const setVolume = useCallback((volume: number) => {
    if (playerRef.current) {
      playerRef.current.setVolume(volume);
    }
  }, []);

  // Listen for global volume changes (e.g. from VolumeControl)
  useEffect(() => {
    const handleVolumeEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ volume: number }>;
      if (typeof customEvent.detail?.volume === "number") {
        setVolume(customEvent.detail.volume);
      }
    };
    window.addEventListener("intelliclass:volume", handleVolumeEvent);
    return () => {
      window.removeEventListener("intelliclass:volume", handleVolumeEvent);
    };
  }, [setVolume]);

  // 3. Connect Conductor (Gemini Live + LiveKit publisher)
  const connectConductor = useCallback(
    async (options?: { isResume?: boolean; lastSpokenSentence?: string; activeTopicId?: string }) => {
      try {
        console.log(`${getTimeTag()} 🚀 [Conductor Connect] Conductor connecting to session "${sessionId}" (isResume=${Boolean(options?.isResume)})...`);
        setConnectionStatus("connecting");

        // C. Initialize Audio Player early and resume immediately inside user gesture
        const player = playerRef.current || new BoundedLiveAudioPlayer();
        playerRef.current = player;
        await player.resume();

        // Configure first sentence elapsed latency telemetry
        player.onFirstSentencePlayback = () => {
          if (startClickTimestampRef.current) {
            const elapsedSec = ((Date.now() - startClickTimestampRef.current) / 1000).toFixed(2);
            console.log(
              `${getTimeTag()} 🎙️ [FIRST SENTENCE STARTED] Professor speech began speaking! (Elapsed from click: +${elapsedSec}s)`
            );
          } else {
            console.log(`${getTimeTag()} 🎙️ [FIRST SENTENCE STARTED] Professor speech began speaking!`);
          }
        };

        // Start RMS monitoring loop for avatar lip-sync
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = requestAnimationFrame(updateRms);

        // PIPELINE PARALLELISM: Mint Gemini Live token and LiveKit token concurrently!
        console.log(`${getTimeTag()} 🎫 [Token Minting] Fetching live-token and livekit-token in parallel...`);
        const tokenFetchStart = Date.now();

        const authHeaders = await getAuthHeaders();

        const [liveRes, lkRes] = await Promise.all([
          fetch(`/api/classroom/${sessionId}/live-token`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              participantId,
              participantName,
              isResume: options?.isResume,
              lastSpokenSentence: options?.lastSpokenSentence,
              activeTopicId: options?.activeTopicId || currentTopicIdRef.current,
            }),
          }),
          fetch(`/api/classroom/${sessionId}/livekit-token`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ participantId, participantName }),
          }),
        ]);

      const tokenFetchDuration = Date.now() - tokenFetchStart;
      console.log(`${getTimeTag()} ⚡ [Token Minting] Parallel fetch completed in ${tokenFetchDuration}ms!`);

      if (!liveRes.ok) {
        let errDetail = liveRes.statusText;
        try {
          const errJson = await liveRes.json();
          errDetail = errJson.error || errJson.message || errDetail;
        } catch { }
        throw new Error(`Failed to obtain Gemini Live token: ${errDetail}`);
      }
      if (!lkRes.ok) {
        let errDetail = lkRes.statusText;
        try {
          const errJson = await lkRes.json();
          errDetail = errJson.error || errJson.message || errDetail;
        } catch { }
        throw new Error(`Failed to obtain LiveKit token: ${errDetail}`);
      }

      const [liveData, lkData] = await Promise.all([liveRes.json(), lkRes.json()]);

      console.log(
        `${getTimeTag()} ✅ [Gemini Live] Token obtained! Voice: "${liveData.voiceName}", Model: "${liveData.model}"`
      );
      console.log(`${getTimeTag()} ✅ [LiveKit] Token obtained for room: "${lkData.room}"`);

      if (liveData.roadmap) {
        setRoadmap(liveData.roadmap);
        roadmapRef.current = liveData.roadmap;
        useClassroomStore.getState().setRoadmap(liveData.roadmap);
      }
      if (liveData.currentTopicId) {
        setCurrentTopicId(liveData.currentTopicId);
        currentTopicIdRef.current = liveData.currentTopicId;
        useClassroomStore.getState().setCurrentTopicId(liveData.currentTopicId);
      }

      // Concurrently connect LiveKit Room in the background for remote student broadcasts
      const livekitConnectPromise = (async () => {
        try {
          console.log(`${getTimeTag()} 🎥 [LiveKit] Initiating background connection to room "${lkData.room}"...`);
          const room = await connectToLivekitRoom({
            url: lkData.url,
            token: lkData.token,
            isConductor: true,
            onTrackSubscribed: (track: Track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
              // Acoustic loop guard: Never route AI Professor's own audio back into Gemini Live!
              if (
                publication.trackName === "ai-professor-audio" ||
                participant.identity?.includes("conductor") ||
                participant.identity?.includes("professor")
              ) {
                return;
              }
              if (track.kind === "audio") {
                console.log(
                  `${getTimeTag()} 🎧 [LiveKit] Student published audio track from "${participant.identity}". Routing to Gemini Live...`
                );
                const mediaStreamTrack = track.mediaStreamTrack;
                if (mediaStreamTrack) {
                  const stream = new MediaStream([mediaStreamTrack]);
                  setupAudioWorkletForStream(stream);
                }
              }
            },
          });
          roomRef.current = room;

          // Publish Web Audio bridged track to LiveKit SFU
          const bridgedTrack = player.getMediaStreamTrack();
          if (bridgedTrack) {
            await publishBridgedAudioTrack(room, bridgedTrack);
          }
          console.log(`${getTimeTag()} ✅ [LiveKit] Web Audio bridged track published to SFU in background!`);
        } catch (lkErr) {
          console.warn(`${getTimeTag()} ⚠️ [LiveKit] Background SFU connection notice:`, lkErr);
        }
      })();

      // Initialize Gemini Live Client
      const geminiClient = new GeminiLiveClient({
        token: liveData.token,
        model: liveData.model,
        sessionId,
        voiceName: liveData.voiceName,
        systemInstruction: liveData.systemInstruction,
        player,
        onOpen: () => {
          setConnectionStatus("connected");
        },
        onTextReceived: (text: string) => {
          accumulatedSpeechTurnRef.current += text;
        },
        onSubtitleReceived: (text: string) => {
          if (text?.trim()) lastSubtitleRef.current = text.trim();
          onSubtitleReceived?.(text);
        },
        onInterrupted: () => {
          console.log(`${getTimeTag()} 🛑 [Gemini Live Session] Turn interrupted by user speech! Resetting speaking state.`);
          setIsSpeaking(false);
          setCurrentRms(0);
          accumulatedSpeechTurnRef.current = "";
          if (continuationTimeoutRef.current) {
            clearTimeout(continuationTimeoutRef.current);
            continuationTimeoutRef.current = null;
          }
        },
        onTurnComplete: () => {
          let cleanTurn = accumulatedSpeechTurnRef.current.trim();
          if (cleanTurn.length <= 5 && lastSubtitleRef.current?.trim()) {
            cleanTurn = lastSubtitleRef.current.trim();
          }
          // Strip internal tool tokens / JSON system artifacts
          cleanTurn = cleanTurn.replace(/```json[\s\S]*?```/g, "").replace(/\{"name":.*?\}/g, "").trim();

          if (cleanTurn.length > 5) {
            const lastUnansweredQuestion = [...notesBufferRef.current]
              .reverse()
              .find((n) => n.type === "student_question");
            const isCorrelatedAnswer = Boolean(lastUnansweredQuestion);

            const record: ClassroomInteractionRecord = {
              id: `turn_${Date.now()}_${notesBufferRef.current.length}`,
              sequence: notesBufferRef.current.length + 1,
              timestamp: new Date().toISOString(),
              topicId: currentTopicIdRef.current || undefined,
              speaker: "professor",
              speakerName: "Professor",
              type: isCorrelatedAnswer ? "professor_answer" : "lecture_speech",
              text: cleanTurn,
              correlatedId: isCorrelatedAnswer ? lastUnansweredQuestion?.id : undefined,
            };
            notesBufferRef.current.push(record as any);
            accumulatedSpeechTurnRef.current = "";
            flushNotesAndSaveCheckpoint();
          }

          // Automatic pedagogical topic continuation:
          if (isLecturingActiveRef.current) {
            if (continuationTimeoutRef.current) clearTimeout(continuationTimeoutRef.current);
            continuationTimeoutRef.current = setTimeout(() => {
              if (isLecturingActiveRef.current && clientRef.current) {
                console.log(`${getTimeTag()} 🔄 [Gemini Live] Triggering pedagogical topic continuation...`);
                continueLecture();
              }
            }, 2500);
          }
        },
        onAdvanceTopic: async (args) => {
          let resolvedTopicId = args.nextTopicId;
          if (!resolvedTopicId && args.completedTopicId) {
            const activeRoadmap = roadmapRef.current || useClassroomStore.getState().roadmap;
            const topics = activeRoadmap?.topics || [];
            const completedIdx = topics.findIndex((t) => t.id === args.completedTopicId);
            if (completedIdx >= 0 && completedIdx < topics.length - 1) {
              resolvedTopicId = topics[completedIdx + 1].id;
            }
          }

          if (resolvedTopicId) {
            console.log(`${getTimeTag()} 🗺️ [Gemini Live] Advancing topic to "${resolvedTopicId}"`);
            setCurrentTopicId(resolvedTopicId);
            currentTopicIdRef.current = resolvedTopicId;
            useClassroomStore.getState().setCurrentTopicId(resolvedTopicId);
            onAdvanceTopic?.(resolvedTopicId);
          }
        },
        onProjectMedia: async (assetId, caption) => {
          console.log(`${getTimeTag()} 🖼️ [Gemini Live] Projecting media asset "${assetId}"`);
          onProjectMedia?.(assetId, caption);
        },
        onRecordLearningInsight: async (args) => {
          console.log(`${getTimeTag()} 🧠 [Learning Insight] "${args.title}" (${args.insightType})`);
          const insightRecord: ClassroomInteractionRecord = {
            id: `insight_${Date.now()}_${notesBufferRef.current.length}`,
            sequence: notesBufferRef.current.length + 1,
            timestamp: new Date().toISOString(),
            topicId: args.topicId || currentTopicIdRef.current || undefined,
            speaker: "professor",
            speakerName: "Professor",
            type: args.insightType as any,
            text: `${args.title}: ${args.content}`,
            meta: {
              conceptName: args.title,
              isMisconception: args.insightType === "student_misconception",
              demonstratedUnderstanding: args.demonstratedUnderstanding,
            },
          };
          notesBufferRef.current.push(insightRecord as any);
          flushNotesAndSaveCheckpoint().catch(console.warn);
        },
        onError: (err) => {
          console.error(`${getTimeTag()} 🔴 [Gemini Live Client] Error:`, err);
          setConnectionStatus("error");
          onError?.(err);
        },
        onClose: () => {
          console.log(`${getTimeTag()} ⚪ [Gemini Live Client] Connection closed.`);
          setConnectionStatus("disconnected");
        },
      });

      console.log(`${getTimeTag()} 🔌 [Gemini Live Session] Establishing WebSocket connection...`);
      await geminiClient.connect();
      clientRef.current = geminiClient;
      setConnectionStatus("connected");
      console.log(`${getTimeTag()} 🎉 [Gemini Live Session] Conductor setup 100% complete!`);
    } catch (err) {
      console.error(`${getTimeTag()} ❌ Conductor Live session initialization failed:`, err);
      setConnectionStatus("error");
      onError?.(err);
    }
  }, [
    sessionId,
    participantId,
    participantName,
    updateRms,
    setupAudioWorkletForStream,
    onSubtitleReceived,
    onAdvanceTopic,
    onProjectMedia,
    onError,
  ]);

  // 4. Connect Student (LiveKit subscriber)
  const connectStudent = useCallback(async () => {
    try {
      console.log(`${getTimeTag()} 🎓 [LiveKit Student] Connecting to session "${sessionId}" as student...`);
      setConnectionStatus("connecting");

      const authHeaders = await getAuthHeaders();
      const lkRes = await fetch(`/api/classroom/${sessionId}/livekit-token`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ participantId, participantName }),
      });
      if (!lkRes.ok) {
        let errDetail = lkRes.statusText;
        try {
          const errJson = await lkRes.json();
          errDetail = errJson.error || errJson.message || errDetail;
        } catch { }
        throw new Error(`Failed to obtain LiveKit token: ${errDetail}`);
      }
      const lkData = await lkRes.json();

      const room = await connectToLivekitRoom({
        url: lkData.url,
        token: lkData.token,
        isConductor: false,
        onTrackSubscribed: (track: Track) => {
          if (track.kind === "audio") {
            console.log(`${getTimeTag()} 🔊 [LiveKit Student] Subscribed to AI Professor audio track. Attaching audio element.`);
            const el = track.attach();
            el.autoplay = true;
            document.body.appendChild(el);

            if (track.mediaStreamTrack) {
              liveAudioSync.connectMediaStreamTrack(track.mediaStreamTrack);
              if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
              animFrameRef.current = requestAnimationFrame(updateRms);
            }
          }
        },
      });
      roomRef.current = room;
      setConnectionStatus("connected");
      console.log(`${getTimeTag()} ✅ [LiveKit Student] Connected to classroom audio stream!`);
    } catch (err) {
      console.error(`${getTimeTag()} ❌ Student Live session initialization failed:`, err);
      setConnectionStatus("error");
      onError?.(err);
    }
  }, [sessionId, participantId, participantName, onError]);

  // 5. Lecture Controls
  const startLecture = useCallback(
    (customKickoffPrompt?: string | { isResume?: boolean; lastSpokenSentence?: string; customPrompt?: string }) => {
      // Record exact Start click timestamp for latency measurement
      startClickTimestampRef.current = Date.now();
      console.log(`${getTimeTag()} ▶️ [START/RESUME CLICK] Start/Resume lecture initiated!`);

      let customKickoffPromptStr: string | undefined;
      let forceResume: boolean | undefined;
      let lastSpokenText: string | undefined;
      if (typeof customKickoffPrompt === "object" && customKickoffPrompt !== null) {
        customKickoffPromptStr = customKickoffPrompt.customPrompt;
        forceResume = customKickoffPrompt.isResume;
        lastSpokenText = customKickoffPrompt.lastSpokenSentence;
      } else if (typeof customKickoffPrompt === "string") {
        customKickoffPromptStr = customKickoffPrompt;
      }

      if (playerRef.current) {
        playerRef.current.resetFirstSentenceFlag();
        playerRef.current.startClickTime = startClickTimestampRef.current;
        playerRef.current.resume().catch(() => { });
      }

      if (!clientRef.current) {
        console.warn(`${getTimeTag()} ⚠️ [Gemini Live] Client not initialized yet. startLecture will queue prompt.`);
      }

      isLecturingActiveRef.current = true;

      const activeRoadmap = roadmapRef.current || roadmap || useClassroomStore.getState().roadmap;
      const allTopics = activeRoadmap?.topics || [];
      const totalTopics = allTopics.length;

      // Determine resume vs fresh start based on currentTopicId, prior notes, or forced flag
      const activeTopicId = currentTopicIdRef.current || allTopics[0]?.id;
      const activeTopicIdx = activeTopicId ? allTopics.findIndex((t) => t.id === activeTopicId) : 0;
      const hasPriorNotes = notesBufferRef.current.length > 0;
      const isResume = forceResume !== undefined ? forceResume : (activeTopicIdx > 0 || hasPriorNotes || Boolean(lastSpokenText));

      const activeTopic = allTopics[activeTopicIdx] || allTopics[0];
      const activeTopicTitle = activeTopic?.title || "Current Topic";
      const activeTopicDesc = activeTopic?.description || "";
      const analogies =
        (activeTopic as unknown as { suggestedAnalogies?: string[]; pedagogicalAnalogies?: string[] })?.suggestedAnalogies ||
        (activeTopic as unknown as { pedagogicalAnalogies?: string[] })?.pedagogicalAnalogies ||
        [];
      const analogyNote = analogies.length ? ` Ground it in this analogy: "${analogies[0]}".` : "";
      const objectives = activeTopic?.learningObjectives?.join("; ") || "";

      // Build delivered-topics context for resume
      const deliveredContext = isResume && activeTopicIdx > 0
        ? `You have already delivered and completed the following topics: ${allTopics.slice(0, activeTopicIdx).map((t, idx) => `Topic ${idx + 1}: "${t.title}"`).join(", ")}. Do NOT repeat or re-introduce any of these completed topics.`
        : "";

      console.log(`${getTimeTag()} 🎙️ [Gemini Live] Kickoff → Topic ${activeTopicIdx + 1}/${totalTopics}: "${activeTopicTitle}" (resume=${isResume}, lastSpoken="${lastSpokenText?.slice(0, 40) || ''}")`);

      const prompt =
        customKickoffPromptStr ||
        (isResume
          ? `Welcome back, students! We are RESUMING this lecture directly on Topic ${activeTopicIdx + 1} of ${totalTopics}: "${activeTopicTitle}". ${deliveredContext}
${lastSpokenText ? `Right before our pause, we were exploring: "${lastSpokenText}". Seamlessly continue directly from this explanation.` : ""}
DO NOT greet or re-introduce the course. Pick up the teaching flow immediately on "${activeTopicTitle}".${activeTopicDesc ? ` Topic overview: ${activeTopicDesc}.` : ""}${analogyNote}
${objectives ? `Core objectives to cover: ${objectives}.` : ""}

First, call search_course_materials with query="${activeTopicTitle}" to retrieve relevant material, then deliver an engaging, continuous, in-depth lecture of at least 4–6 spoken sentences. Use the specific technical keywords and concepts from the uploaded course materials. Never use generic filler explanations.`
          : `Welcome, students! We are beginning today's lecture. Topic 1 of ${totalTopics}: "${activeTopicTitle}".${activeTopicDesc ? ` Overview: ${activeTopicDesc}.` : ""}${analogyNote}
${objectives ? `Learning objectives: ${objectives}.` : ""}

First, call search_course_materials with query="${activeTopicTitle}" to retrieve relevant content from the uploaded course materials. Then deliver an engaging, continuous, in-depth lecture of at least 4–6 full spoken sentences explaining why this concept matters, unpacking core mechanics step by step using the specific terminology from the course documents. Do not pause after a greeting — start lecturing immediately!`);

      if (clientRef.current) {
        clientRef.current.sendTextMessage(prompt);
      }
    },
    [roadmap]
  );

  const continueLecture = useCallback(
    (directive?: string) => {
      if (!clientRef.current) return;
      const activeRoadmap = roadmapRef.current || useClassroomStore.getState().roadmap;
      const activeTopicId = currentTopicIdRef.current;
      const allTopics = activeRoadmap?.topics || [];
      const curTopicIdx = activeTopicId ? allTopics.findIndex((t) => t.id === activeTopicId) : 0;
      const curTopic = allTopics[curTopicIdx] || allTopics[0];
      const topicTitle = curTopic?.title || "Current Topic";
      const topicNumber = curTopicIdx + 1;
      const totalTopics = allTopics.length;
      const objectives = curTopic?.learningObjectives?.join("; ") || "";

      const prompt =
        directive ||
        `Continue teaching Topic ${topicNumber} of ${totalTopics}: "${topicTitle}".${objectives ? ` Remaining objectives: ${objectives}.` : ""}
Unpack the next core concept, explain trade-offs and real-world implications, and deliver a rich 4–6 sentence pedagogical explanation grounded in the uploaded course materials and specific terminology. If you have finished this topic, call advance_topic then immediately begin the next one.`;

      console.log(`${getTimeTag()} 🎙️ [Gemini Live] Continuing lecture for Topic ${topicNumber}: "${topicTitle}"...`);
      clientRef.current.sendTextMessage(prompt);
    },
    []
  );

  const sendUserPrompt = useCallback((text: string, studentName?: string) => {
    if (!clientRef.current) return;
    if (continuationTimeoutRef.current) {
      clearTimeout(continuationTimeoutRef.current);
      continuationTimeoutRef.current = null;
    }
    console.log(`${getTimeTag()} 🙋 [USER QUESTION] Sending student question to Professor: "${text}"`);

    // Clean prompt wrapper to isolate pure student question text
    const cleanQuestion = text
      .replace(/^\[Question from [^\]]+\]:\s*"?/, "")
      .replace(/"?\s*\n\nCRITICAL INSTRUCTION:[\s\S]*$/, "")
      .trim();

    const studentRecord: ClassroomInteractionRecord = {
      id: `question_${Date.now()}_${notesBufferRef.current.length}`,
      sequence: notesBufferRef.current.length + 1,
      timestamp: new Date().toISOString(),
      topicId: currentTopicIdRef.current || undefined,
      speaker: "student",
      speakerName: studentName || "Student",
      type: "student_question",
      text: cleanQuestion,
    };
    notesBufferRef.current.push(studentRecord as any);

    clientRef.current.sendTextMessage(text);
  }, []);

  const grantStudentFloor = useCallback(
    async (studentIdentity: string) => {
      try {
        console.log(`${getTimeTag()} ✋ [Floor Control] Granting microphone floor to "${studentIdentity}"`);
        const authHeaders = await getAuthHeaders();
        const res = await fetch(`/api/classroom/${sessionId}/grant-floor`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ studentIdentity, action: "grant" }),
        });
        return res.ok;
      } catch (err) {
        console.error(`${getTimeTag()} Failed to grant floor to student:`, err);
        return false;
      }
    },
    [sessionId]
  );

  const revokeStudentFloor = useCallback(
    async (studentIdentity: string) => {
      try {
        console.log(`${getTimeTag()} ✋ [Floor Control] Revoking microphone floor from "${studentIdentity}"`);
        const authHeaders = await getAuthHeaders();
        const res = await fetch(`/api/classroom/${sessionId}/grant-floor`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ studentIdentity, action: "revoke" }),
        });
        return res.ok;
      } catch (err) {
        console.error(`${getTimeTag()} Failed to revoke floor:`, err);
        return false;
      }
    },
    [sessionId]
  );

  const toggleStudentMic = useCallback(
    async (enabled: boolean) => {
      try {
        console.log(`${getTimeTag()} 🎤 [Student Mic] Toggling microphone: ${enabled ? "ON" : "OFF"}`);
        if (enabled) {
          // Immediately silence professor speech upon user opening microphone
          if (playerRef.current) playerRef.current.flush();
          setIsSpeaking(false);
          setCurrentRms(0);
          if (continuationTimeoutRef.current) {
            clearTimeout(continuationTimeoutRef.current);
            continuationTimeoutRef.current = null;
          }
          if (clientRef.current) clientRef.current.sendInterruptionSignal();
        }

        if (roomRef.current) {
          await setStudentMicrophone(roomRef.current, enabled);
        }

        // If local clientRef exists (direct sole-user or host interaction)
        if (clientRef.current) {
          if (enabled) {
            if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
              const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
              });
              localMicStreamRef.current = stream;
              await setupAudioWorkletForStream(stream);
            }
          } else {
            if (localMicStreamRef.current) {
              localMicStreamRef.current.getTracks().forEach((t) => t.stop());
              localMicStreamRef.current = null;
            }
            if (micSourceNodeRef.current) {
              try { micSourceNodeRef.current.disconnect(); } catch {}
              micSourceNodeRef.current = null;
            }
            if (workletNodeRef.current) {
              try { workletNodeRef.current.disconnect(); } catch {}
              workletNodeRef.current = null;
            }
            clientRef.current.sendAudioStreamEnd();
          }
        }

        setIsMicActive(enabled);
      } catch (err: unknown) {
        console.error(`${getTimeTag()} Failed to toggle student microphone:`, err);
        const { toast } = await import("sonner");
        const msg = err instanceof Error ? err.message : "Microphone not supported.";
        if (msg.includes("getUserMedia") || msg.includes("secure") || msg.includes("undefined")) {
          toast.error("Microphone requires HTTPS or localhost. Please connect over HTTPS on mobile.");
        } else {
          toast.error(msg);
        }
      }
    },
    [setupAudioWorkletForStream]
  );

  // 6. Conductor Local Microphone toggle (for asking questions into AI directly or testing)
  const toggleConductorMic = useCallback(
    async (enabled: boolean) => {
      if (!isConductor) return;
      if (enabled) {
        try {
          if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
            const { toast } = await import("sonner");
            toast.error("Microphone requires HTTPS or localhost. Please connect over HTTPS on mobile.");
            return;
          }

          // Immediately pause/flush active professor playback & halt speech
          if (playerRef.current) {
            playerRef.current.flush();
          }
          setIsSpeaking(false);
          setCurrentRms(0);
          if (continuationTimeoutRef.current) {
            clearTimeout(continuationTimeoutRef.current);
            continuationTimeoutRef.current = null;
          }
          if (clientRef.current) {
            clientRef.current.sendInterruptionSignal();
          }

          console.log(`${getTimeTag()} 🎤 [Conductor Mic] Requesting user microphone access...`);
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          localMicStreamRef.current = stream;
          await setupAudioWorkletForStream(stream);
          setIsMicActive(true);
          console.log(`${getTimeTag()} 🎤 [Conductor Mic] Microphone active! Speak to Professor.`);
        } catch (err) {
          console.error(`${getTimeTag()} Failed to access local microphone:`, err);
          const { toast } = await import("sonner");
          toast.error("Could not access microphone. Please check permissions.");
        }
      } else {
        console.log(`${getTimeTag()} 🎤 [Conductor Mic] Muting microphone.`);
        if (localMicStreamRef.current) {
          localMicStreamRef.current.getTracks().forEach((t) => t.stop());
          localMicStreamRef.current = null;
        }
        if (micSourceNodeRef.current) {
          try { micSourceNodeRef.current.disconnect(); } catch {}
          micSourceNodeRef.current = null;
        }
        if (micMuteGainRef.current) {
          try { micMuteGainRef.current.disconnect(); } catch {}
          micMuteGainRef.current = null;
        }
        if (workletNodeRef.current) {
          try { workletNodeRef.current.disconnect(); } catch {}
          workletNodeRef.current = null;
        }
        if (clientRef.current) {
          clientRef.current.sendAudioStreamEnd();
        }
        setIsMicActive(false);
      }
    },
    [isConductor, setupAudioWorkletForStream]
  );

  // 7. Cleanup
  const disconnect = useCallback(() => {
    console.log(`${getTimeTag()} 🔌 [Gemini Live Session] Disconnecting session and tearing down audio graph...`);
    isLecturingActiveRef.current = false;
    if (continuationTimeoutRef.current) {
      clearTimeout(continuationTimeoutRef.current);
      continuationTimeoutRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (localMicStreamRef.current) {
      localMicStreamRef.current.getTracks().forEach((t) => t.stop());
      localMicStreamRef.current = null;
    }
    if (micSourceNodeRef.current) {
      try { micSourceNodeRef.current.disconnect(); } catch {}
      micSourceNodeRef.current = null;
    }
    if (micMuteGainRef.current) {
      try { micMuteGainRef.current.disconnect(); } catch {}
      micMuteGainRef.current = null;
    }
    if (workletNodeRef.current) {
      try { workletNodeRef.current.disconnect(); } catch {}
      workletNodeRef.current = null;
    }
    if (micAudioCtxRef.current) {
      try {
        micAudioCtxRef.current.close();
      } catch { }
      micAudioCtxRef.current = null;
    }
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
    if (notesBufferRef.current.length > 0) {
      flushNotesAndSaveCheckpoint().catch(console.warn);
    }
    liveAudioSync.disconnectStudentAudio();
    liveAudioSync.reset();
    setConnectionStatus("disconnected");
    setIsSpeaking(false);
    setCurrentRms(0);
    setIsMicActive(false);
  }, [flushNotesAndSaveCheckpoint]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connectionStatus,
    isSpeaking,
    currentRms,
    hasFloor,
    isMicActive,
    roadmap,
    currentTopicId,
    flushNotesAndSaveCheckpoint,
    getNotes,
    getInteractionRecords,
    resumeAudio,
    setAudioMuted,
    setVolume,
    connectConductor,
    connectStudent,
    startLecture,
    continueLecture,
    sendUserPrompt,
    grantStudentFloor,
    revokeStudentFloor,
    toggleStudentMic,
    toggleConductorMic,
    disconnect,
  };
}
