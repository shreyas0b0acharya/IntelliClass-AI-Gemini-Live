"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Room, RemoteTrackPublication, RemoteParticipant, Track } from "livekit-client";
import { BoundedLiveAudioPlayer } from "../services/liveAudioPlayer";
import { GeminiLiveClient } from "../services/geminiLiveClient";
import {
  connectToLivekitRoom,
  publishBridgedAudioTrack,
  setStudentMicrophone,
} from "../services/livekitClient";
import type { SessionRoadmap } from "../types/roadmap";

export interface UseGeminiLiveSessionOptions {
  sessionId: string;
  isConductor: boolean;
  participantId?: string;
  participantName?: string;
  onAdvanceTopic?: (nextTopicId: string) => void;
  onProjectMedia?: (assetId: string, caption?: string) => void;
  onSubtitleReceived?: (text: string) => void;
  onError?: (error: unknown) => void;
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
}: UseGeminiLiveSessionOptions) {
  const [connectionStatus, setConnectionStatus] = useState<
    "disconnected" | "connecting" | "connected" | "error"
  >("disconnected");
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [currentRms, setCurrentRms] = useState<number>(0);
  const [hasFloor, setHasFloor] = useState<boolean>(false);
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [roadmap, setRoadmap] = useState<SessionRoadmap | null>(null);
  const [currentTopicId, setCurrentTopicId] = useState<string | null>(null);

  const playerRef = useRef<BoundedLiveAudioPlayer | null>(null);
  const clientRef = useRef<GeminiLiveClient | null>(null);
  const roomRef = useRef<Room | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const localMicStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

  // 1. RMS Polling loop for Avatar lip-sync
  const updateRms = useCallback(() => {
    if (playerRef.current) {
      const rms = playerRef.current.getCurrentRms();
      setCurrentRms(rms);
      setIsSpeaking(rms > 0.015);
    }
    animFrameRef.current = requestAnimationFrame(updateRms);
  }, []);

  // 2. Setup audio resampler worklet for streaming mic audio into Gemini Live
  const setupAudioWorkletForStream = useCallback(
    async (stream: MediaStream) => {
      try {
        const audioCtx = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        await audioCtx.audioWorklet.addModule("/worklets/pcm-resampler.js");

        const source = audioCtx.createMediaStreamSource(stream);
        const workletNode = new AudioWorkletNode(audioCtx, "pcm-resampler");

        workletNode.port.onmessage = (e: MessageEvent) => {
          if (clientRef.current && e.data instanceof ArrayBuffer) {
            clientRef.current.sendAudioChunk(e.data);
          }
        };

        source.connect(workletNode);
        workletNodeRef.current = workletNode;
      } catch (err) {
        console.warn("Failed to initialize PCM resampler worklet:", err);
      }
    },
    []
  );

  // 3. Connect Conductor (Gemini Live + LiveKit publisher)
  const connectConductor = useCallback(async () => {
    try {
      setConnectionStatus("connecting");

      // A. Mint Gemini Live Ephemeral Token
      const liveRes = await fetch(`/api/classroom/${sessionId}/live-token`, {
        method: "POST",
      });
      if (!liveRes.ok) {
        throw new Error(`Failed to obtain Gemini Live token: ${liveRes.statusText}`);
      }
      const liveData = await liveRes.json();
      setRoadmap(liveData.roadmap);
      setCurrentTopicId(liveData.currentTopicId);

      // B. Mint LiveKit Room Token
      const lkRes = await fetch(`/api/classroom/${sessionId}/livekit-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, participantName }),
      });
      if (!lkRes.ok) {
        throw new Error(`Failed to obtain LiveKit token: ${lkRes.statusText}`);
      }
      const lkData = await lkRes.json();

      // C. Initialize Audio Player & Audio Bridge
      const player = new BoundedLiveAudioPlayer();
      playerRef.current = player;

      // Start RMS monitoring
      animFrameRef.current = requestAnimationFrame(updateRms);

      // D. Connect LiveKit Room
      const room = await connectToLivekitRoom({
        url: lkData.url,
        token: lkData.token,
        isConductor: true,
        onTrackSubscribed: (track: Track, _publication: RemoteTrackPublication, _participant: RemoteParticipant) => {
          // When a student is granted floor and speaks, their audio arrives here
          if (track.kind === "audio") {
            const mediaStreamTrack = track.mediaStreamTrack;
            if (mediaStreamTrack) {
              const stream = new MediaStream([mediaStreamTrack]);
              setupAudioWorkletForStream(stream);
            }
          }
        },
      });
      roomRef.current = room;

      // E. Publish Web Audio bridged track to LiveKit SFU
      const bridgedTrack = player.getMediaStreamTrack();
      if (bridgedTrack) {
        await publishBridgedAudioTrack(room, bridgedTrack);
      }

      // F. Initialize Gemini Live Client
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
        onAdvanceTopic: async (args) => {
          if (args.nextTopicId) {
            setCurrentTopicId(args.nextTopicId);
            onAdvanceTopic?.(args.nextTopicId);
          }
        },
        onProjectMedia: async (assetId, caption) => {
          onProjectMedia?.(assetId, caption);
        },
        onError: (err) => {
          setConnectionStatus("error");
          onError?.(err);
        },
        onClose: () => {
          setConnectionStatus("disconnected");
        },
      });

      await geminiClient.connect();
      clientRef.current = geminiClient;
    } catch (err) {
      console.error("Conductor Live session initialization failed:", err);
      setConnectionStatus("error");
      onError?.(err);
    }
  }, [
    sessionId,
    participantId,
    participantName,
    updateRms,
    setupAudioWorkletForStream,
    onAdvanceTopic,
    onProjectMedia,
    onSubtitleReceived,
    onError,
  ]);

  // 4. Connect Student (LiveKit subscriber)
  const connectStudent = useCallback(async () => {
    try {
      setConnectionStatus("connecting");

      const lkRes = await fetch(`/api/classroom/${sessionId}/livekit-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, participantName }),
      });
      if (!lkRes.ok) {
        throw new Error(`Failed to obtain LiveKit token: ${lkRes.statusText}`);
      }
      const lkData = await lkRes.json();

      const room = await connectToLivekitRoom({
        url: lkData.url,
        token: lkData.token,
        isConductor: false,
        onTrackSubscribed: (track: Track) => {
          if (track.kind === "audio") {
            const el = track.attach();
            el.autoplay = true;
            document.body.appendChild(el);
          }
        },
      });
      roomRef.current = room;
      setConnectionStatus("connected");
    } catch (err) {
      console.error("Student Live session initialization failed:", err);
      setConnectionStatus("error");
      onError?.(err);
    }
  }, [sessionId, participantId, participantName, onError]);

  // 5. Lecture Controls
  const startLecture = useCallback(
    (customKickoffPrompt?: string) => {
      if (!clientRef.current) return;
      const initialTopic = roadmap?.topics?.[0]?.title || "today's lecture topic";
      const prompt =
        customKickoffPrompt ||
        `Alright Professor, please warmly greet the class, introduce today's lecture on "${initialTopic}", and begin teaching Topic 1!`;
      clientRef.current.sendTextMessage(prompt);
    },
    [roadmap]
  );

  const sendUserPrompt = useCallback((text: string) => {
    if (!clientRef.current) return;
    clientRef.current.sendTextMessage(text);
  }, []);

  const grantStudentFloor = useCallback(
    async (studentIdentity: string) => {
      try {
        const res = await fetch(`/api/classroom/${sessionId}/grant-floor`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentIdentity, action: "grant" }),
        });
        return res.ok;
      } catch (err) {
        console.error("Failed to grant floor to student:", err);
        return false;
      }
    },
    [sessionId]
  );

  const revokeStudentFloor = useCallback(
    async (studentIdentity: string) => {
      try {
        const res = await fetch(`/api/classroom/${sessionId}/grant-floor`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentIdentity, action: "revoke" }),
        });
        return res.ok;
      } catch (err) {
        console.error("Failed to revoke floor:", err);
        return false;
      }
    },
    [sessionId]
  );

  const toggleStudentMic = useCallback(
    async (enabled: boolean) => {
      if (!roomRef.current) return;
      try {
        await setStudentMicrophone(roomRef.current, enabled);
        setIsMicActive(enabled);
      } catch (err) {
        console.error("Failed to toggle student microphone:", err);
      }
    },
    []
  );

  // 6. Conductor Local Microphone toggle (for testing or speaking into AI)
  const toggleConductorMic = useCallback(
    async (enabled: boolean) => {
      if (!isConductor) return;
      if (enabled) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          localMicStreamRef.current = stream;
          await setupAudioWorkletForStream(stream);
          setIsMicActive(true);
        } catch (err) {
          console.error("Failed to access local microphone:", err);
        }
      } else {
        if (localMicStreamRef.current) {
          localMicStreamRef.current.getTracks().forEach((t) => t.stop());
          localMicStreamRef.current = null;
        }
        setIsMicActive(false);
      }
    },
    [isConductor, setupAudioWorkletForStream]
  );

  // 7. Cleanup
  const disconnect = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (localMicStreamRef.current) {
      localMicStreamRef.current.getTracks().forEach((t) => t.stop());
      localMicStreamRef.current = null;
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
      playerRef.current.close();
      playerRef.current = null;
    }
    setConnectionStatus("disconnected");
    setIsSpeaking(false);
    setCurrentRms(0);
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
    connectConductor,
    connectStudent,
    startLecture,
    sendUserPrompt,
    grantStudentFloor,
    revokeStudentFloor,
    toggleStudentMic,
    toggleConductorMic,
    disconnect,
  };
}
