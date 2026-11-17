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
  } catch {}
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
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

  // Sync prop updates to state and refs
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
        const workletNode = new AudioWorkletNode(micCtx, "pcm-resampler");

        workletNode.port.onmessage = (e: MessageEvent) => {
          if (clientRef.current && e.data instanceof ArrayBuffer) {
            // Stream audio chunk directly to Gemini Live
            clientRef.current.sendAudioChunk(e.data);
          }
        };

        source.connect(workletNode);
        workletNodeRef.current = workletNode;
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
  const connectConductor = useCallback(async () => {
    try {
      console.log(`${getTimeTag()} 🚀 [Conductor Connect] Conductor connecting to session "${sessionId}"...`);
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
          body: JSON.stringify({ participantId, participantName }),
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
        } catch {}
        throw new Error(`Failed to obtain Gemini Live token: ${errDetail}`);
      }
      if (!lkRes.ok) {
        let errDetail = lkRes.statusText;
        try {
          const errJson = await lkRes.json();
          errDetail = errJson.error || errJson.message || errDetail;
        } catch {}
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
        onSubtitleReceived: (text: string) => {
          onSubtitleReceived?.(text);
        },
        onTurnComplete: () => {
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
          if (args.nextTopicId) {
            console.log(`${getTimeTag()} 🗺️ [Gemini Live] Advancing topic to "${args.nextTopicId}"`);
            setCurrentTopicId(args.nextTopicId);
            currentTopicIdRef.current = args.nextTopicId;
            useClassroomStore.getState().setCurrentTopicId(args.nextTopicId);
            onAdvanceTopic?.(args.nextTopicId);
          }
        },
        onProjectMedia: async (assetId, caption) => {
          console.log(`${getTimeTag()} 🖼️ [Gemini Live] Projecting media asset "${assetId}"`);
          onProjectMedia?.(assetId, caption);
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
        } catch {}
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
    (customKickoffPrompt?: string) => {
      // Record exact Start click timestamp for latency measurement
      startClickTimestampRef.current = Date.now();
      console.log(`${getTimeTag()} ▶️ [START/RESUME CLICK] Start/Resume lecture initiated!`);

      if (playerRef.current) {
        playerRef.current.resetFirstSentenceFlag();
        playerRef.current.startClickTime = startClickTimestampRef.current;
        playerRef.current.resume().catch(() => {});
      }

      if (!clientRef.current) {
        console.warn(`${getTimeTag()} ⚠️ [Gemini Live] Client not initialized yet. startLecture will queue prompt.`);
      }

      isLecturingActiveRef.current = true;

      const activeRoadmap = roadmapRef.current || roadmap || useClassroomStore.getState().roadmap;
      const firstTopic = activeRoadmap?.topics?.[0];
      const initialTopicTitle = firstTopic?.title || "Foundations and Overview";
      const initialTopicDesc = firstTopic?.description || "";
      const analogies =
        firstTopic?.suggestedAnalogies ||
        (firstTopic as unknown as { pedagogicalAnalogies?: string[] })?.pedagogicalAnalogies ||
        [];
      const analogyNote = analogies.length ? `Ground the concept in this analogy: "${analogies[0]}".` : "";

      console.log(`${getTimeTag()} 🎙️ [Gemini Live] Kickoff prompt dispatched for Topic 1: "${initialTopicTitle}"...`);

      const prompt =
        customKickoffPrompt ||
        `Welcome students! Today we are beginning Topic 1: "${initialTopicTitle}". ${initialTopicDesc ? `Topic Overview: ${initialTopicDesc}.` : ""}
${analogyNote}

Please deliver an engaging, continuous, in-depth conceptual lecture explaining this topic right now.
Deliver at least 4 to 6 full spoken sentences explaining why this concept matters, unpacking the core mechanics step-by-step, and teaching with intellectual rigor and encouragement.
Do not pause after a single greeting sentence or wait for replies; start lecturing thoroughly!`;

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
      const curTopic =
        activeRoadmap?.topics?.find((t) => t.id === activeTopicId) || activeRoadmap?.topics?.[0];

      const prompt =
        directive ||
        `Please continue teaching Topic "${curTopic?.title || 'Current Topic'}". Unpack the next technical concept, explain the trade-offs, and continue lecturing smoothly in a rich 4-to-6 sentence pedagogical flow.`;

      console.log(`${getTimeTag()} 🎙️ [Gemini Live] Continuing lecture for "${curTopic?.title}"...`);
      clientRef.current.sendTextMessage(prompt);
    },
    []
  );

  const sendUserPrompt = useCallback((text: string) => {
    if (!clientRef.current) return;
    if (continuationTimeoutRef.current) {
      clearTimeout(continuationTimeoutRef.current);
      continuationTimeoutRef.current = null;
    }
    console.log(`${getTimeTag()} 🙋 [USER QUESTION] Sending student question to Professor: "${text}"`);
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
      if (!roomRef.current) return;
      try {
        console.log(`${getTimeTag()} 🎤 [Student Mic] Toggling microphone: ${enabled ? "ON" : "OFF"}`);
        await setStudentMicrophone(roomRef.current, enabled);
        setIsMicActive(enabled);
        if (!enabled && clientRef.current) {
          clientRef.current.sendAudioStreamEnd();
        }
      } catch (err) {
        console.error(`${getTimeTag()} Failed to toggle student microphone:`, err);
      }
    },
    []
  );

  // 6. Conductor Local Microphone toggle (for asking questions into AI directly or testing)
  const toggleConductorMic = useCallback(
    async (enabled: boolean) => {
      if (!isConductor) return;
      if (enabled) {
        try {
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
        }
      } else {
        console.log(`${getTimeTag()} 🎤 [Conductor Mic] Muting microphone.`);
        if (localMicStreamRef.current) {
          localMicStreamRef.current.getTracks().forEach((t) => t.stop());
          localMicStreamRef.current = null;
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
    if (micAudioCtxRef.current) {
      try {
        micAudioCtxRef.current.close();
      } catch {}
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
    liveAudioSync.disconnectStudentAudio();
    liveAudioSync.reset();
    setConnectionStatus("disconnected");
    setIsSpeaking(false);
    setCurrentRms(0);
    setIsMicActive(false);
  }, []);

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
