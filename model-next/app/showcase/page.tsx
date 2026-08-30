"use client";

import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Experience,
  Controller,
  TTSPanel,
  CameraLogger,
  splitIntoSentences,
  type HeadTTSData,
  AudioTest,
  scheduleAudioPlayback,
  getSynchronizedEpochMs,
} from "@/features/avatar";
import { Navbar } from "@/components/shared";

interface TTSResult {
  audioPath: string;
  lipSyncData: HeadTTSData;
}

export default function App() {
  const [model, setModel] = useState("men-avatarsdk");
  const [animations, setAnimations] = useState<string[]>([]);
  const [animation, setAnimation] = useState("weight shift");
  const [behavior, setBehavior] = useState<"idle" | "listening" | "talking">("idle");

  const [playLipSync, setPlayLipSync] = useState(false);
  const [audioPath, setAudioPath] = useState<string | undefined>();
  const [lipSyncData, setLipSyncData] = useState<HeadTTSData | undefined>();

  // Sentence Streaming Queue State
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState("");
  const queueRef = useRef<TTSResult[]>([]);
  const sentenceIndexRef = useRef(0);
  const totalSentencesRef = useRef(0);
  const cancelRef = useRef(false);
  const fetchInProgressRef = useRef(false);
  const sentencesRef = useRef<string[]>([]);
  const waitingForNextRef = useRef(false);

  /*
   * Load animations.
   */
  useEffect(() => {
    let cancelled = false;

    fetch(`/api/animations/${model}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to load animations");
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        const names = data.map((item: { name: string }) => item.name);
        setAnimations(["None", ...names]);
        if (names.length > 0) {
          const defaultAnim =
            names.find((n) => n.toLowerCase().includes("weight shift")) ||
            names[0];
          setAnimation(defaultAnim);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Error loading animations:", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [model]);

  /**
   * Helper to call /api/tts for a single sentence
   */
  const fetchSentenceTTS = async (text: string, voice?: string): Promise<TTSResult> => {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice }),
    });

    if (!response.ok) {
      let errorMessage = "TTS generation failed";
      try {
        const errorJson = await response.json();
        errorMessage = errorJson.error || errorJson.details || errorMessage;
      } catch {
        const rawText = await response.text();
        errorMessage = rawText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data: TTSResult = await response.json();
    if (!data.audioPath || !data.lipSyncData) {
      throw new Error("TTS API returned invalid data");
    }
    return data;
  };

  /**
   * Stops current playback and clears queue
   */
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [targetEpochMs, setTargetEpochMs] = useState<number | undefined>();

  const handleStopSpeech = useCallback(() => {
    cancelRef.current = true;
    queueRef.current = [];
    sentencesRef.current = [];
    waitingForNextRef.current = false;
    sentenceIndexRef.current = 0;
    totalSentencesRef.current = 0;
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.onended = null;
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch {}
      activeSourceRef.current = null;
    }
    setPlayLipSync(false);
    setAudioPath(undefined);
    setLipSyncData(undefined);
    setTargetEpochMs(undefined);
    setIsGenerating(false);
    setStatusText("");
  }, []);

  /**
   * Plays the next sentence in the queue or triggers fetch if not ready yet
   */
  const playNextSentence = useCallback(() => {
    if (cancelRef.current) return;

    if (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      sentenceIndexRef.current += 1;
      const curIndex = sentenceIndexRef.current;
      const total = totalSentencesRef.current;

      setStatusText(
        total > 1
          ? `Speaking (${curIndex}/${total})...`
          : "Speaking..."
      );

      const targetEpoch = getSynchronizedEpochMs() + 50;
      setTargetEpochMs(targetEpoch);
      setAudioPath(next.audioPath);
      setLipSyncData(next.lipSyncData);
      setPlayLipSync(true);

      void scheduleAudioPlayback(next.audioPath, targetEpoch, () => {
        if (!cancelRef.current) {
          playNextSentence();
        }
      }).then((src) => {
        activeSourceRef.current = src;
      });
    } else if (sentenceIndexRef.current < totalSentencesRef.current) {
      // Waiting for background fetch of next sentence
      waitingForNextRef.current = true;
      setStatusText(
        `Buffering sentence ${sentenceIndexRef.current + 1} of ${totalSentencesRef.current}...`
      );
    } else {
      // All sentences done!
      handleStopSpeech();
    }
  }, [handleStopSpeech]);

  /**
   * Background pre-fetcher for remaining sentences
   */
  const prefetchRemainingSentences = async (
    sentences: string[],
    startIndex: number,
    voice?: string
  ) => {
    for (let i = startIndex; i < sentences.length; i++) {
      if (cancelRef.current) break;

      try {
        const result = await fetchSentenceTTS(sentences[i], voice);
        if (cancelRef.current) break;

        queueRef.current.push(result);

        // If mouth was waiting for this specific sentence to finish buffering
        if (waitingForNextRef.current) {
          waitingForNextRef.current = false;
          playNextSentence();
        }
      } catch (err) {
        console.error(`Failed to prefetch sentence ${i + 1}:`, err);
      }
    }
    fetchInProgressRef.current = false;
  };

  /**
   * Handles user submission of text
   */
  const handleSpeakText = async (fullText: string, voice?: string) => {
    // 1. Reset state
    handleStopSpeech();
    cancelRef.current = false;

    // 2. Split into sentences
    const sentences = splitIntoSentences(fullText);
    if (sentences.length === 0) return;

    sentencesRef.current = sentences;
    totalSentencesRef.current = sentences.length;
    sentenceIndexRef.current = 0;
    setIsGenerating(true);

    setStatusText(
      sentences.length > 1
        ? `Synthesizing sentence 1 of ${sentences.length}...`
        : "Synthesizing speech..."
    );

    try {
      // 3. Synthesize sentence 1 immediately so playback starts right away!
      const firstResult = await fetchSentenceTTS(sentences[0], voice);

      if (cancelRef.current) return;

      sentenceIndexRef.current = 1;
      const targetEpoch = getSynchronizedEpochMs() + 50;
      setTargetEpochMs(targetEpoch);
      setAudioPath(firstResult.audioPath);
      setLipSyncData(firstResult.lipSyncData);
      setPlayLipSync(true);

      void scheduleAudioPlayback(firstResult.audioPath, targetEpoch, () => {
        if (!cancelRef.current) {
          playNextSentence();
        }
      }).then((src) => {
        activeSourceRef.current = src;
      });

      setStatusText(
        sentences.length > 1
          ? `Speaking (1/${sentences.length})...`
          : "Speaking..."
      );

      // 4. Concurrently pre-fetch remaining sentences in background
      if (sentences.length > 1) {
        fetchInProgressRef.current = true;
        void prefetchRemainingSentences(sentences, 1, voice);
      }
    } catch (error) {
      console.error("Instant TTS synthesis error:", error);
      alert(error instanceof Error ? error.message : "TTS generation failed");
      handleStopSpeech();
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden flex flex-col bg-background">
      <Navbar />

      <main className="relative flex-1 w-full overflow-hidden">
        <AudioTest currentAudioPath={audioPath} />
        {/* CONTROLS */}
        <div className="absolute left-4 top-4 z-10 flex flex-col gap-2 max-h-[calc(100vh-5rem)] overflow-y-auto">
        <Controller
          name="Model"
          options={["men-avatarsdk", "women-avatarsdk"]}
          value={model}
          onChange={setModel}
        />

        <Controller
          name="Animation"
          options={animations}
          value={animation}
          onChange={setAnimation}
        />

        <Controller
          name="Behavior"
          options={["idle", "listening", "talking"]}
          value={behavior}
          onChange={(val) => setBehavior(val as "idle" | "listening" | "talking")}
        />

        <TTSPanel
          onSpeakText={handleSpeakText}
          onStop={handleStopSpeech}
          isSpeaking={playLipSync}
          isGenerating={isGenerating}
          statusText={statusText}
        />
      </div>

      {/* 3D SCENE */}
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{
          position: [-0.03, 1.539, 0.768],
          fov: 42,
        }}
      >
        <CameraLogger />

        <color attach="background" args={["#ececec"]} />

        <Experience
          model={model}
          animation={animation}
          behaviorState={behavior}
          playLipSync={playLipSync}
          audioPath={audioPath}
          lipSyncData={lipSyncData}
          targetEpochMs={targetEpochMs}
        />
      </Canvas>
      </main>
    </div>
  );
}