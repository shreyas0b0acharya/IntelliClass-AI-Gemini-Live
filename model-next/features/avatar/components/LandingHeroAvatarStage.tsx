"use client";

import React, { Suspense, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
import { Volume2, VolumeX, Loader2, RotateCcw } from "lucide-react";
import { Avatar } from "./Avatar";
import type { HeadTTSData } from "../types/lipSync.types";
import {
  scheduleAudioPlayback,
  stopAllAudio,
} from "../services/audioManager";
import { getSynchronizedEpochMs } from "../services/clockSync";
import {
  DEFAULT_FEMALE_AVATAR_MODEL,
  DEFAULT_MALE_AVATAR_MODEL,
  STANDING_CHALKBOARD_MODEL_PATH,
  AVATAR_MODEL_PATHS,
  type AvatarModelId,
} from "@/config";
import { useCachedAssetUrl } from "../hooks/useCachedAssetUrl";

// ─────────────────────────────────────────────
// 1. Standing Chalkboard 3D Component
// ─────────────────────────────────────────────
function StandingChalkboard() {
  const cachedUrl = useCachedAssetUrl(STANDING_CHALKBOARD_MODEL_PATH);
  const { scene } = useGLTF(cachedUrl);
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);

  return (
    <primitive
      object={clone}
      position={[-0.40, 0, -3.85]}
      rotation={[0, 0.22, 0]}
      scale={1.0}
    />
  );
}

useGLTF.preload(STANDING_CHALKBOARD_MODEL_PATH);
useGLTF.preload(AVATAR_MODEL_PATHS[DEFAULT_FEMALE_AVATAR_MODEL]);
useGLTF.preload(AVATAR_MODEL_PATHS[DEFAULT_MALE_AVATAR_MODEL]);

// ─────────────────────────────────────────────
// 2. Persona Audio & Script Config (Static Assets)
// ─────────────────────────────────────────────
interface PersonaConfig {
  id: AvatarModelId;
  name: string;
  role: string;
  gender: "female" | "male";
  audioPath: string;
  jsonPath: string;
  subtitle: string;
}

const PERSONA_CONFIGS: Record<AvatarModelId, PersonaConfig> = {
  "women-avatarsdk": {
    id: "women-avatarsdk",
    name: "Dr. Clara",
    role: "Female Professor",
    gender: "female",
    audioPath: "/audio/welcome-female.mp3",
    jsonPath: "/audio/welcome-female.json",
    subtitle: "Welcome to IntelliClass AI. I am Dr. Clara, your autonomous AI professor. Explore textbooks turned into live interactive 3D lectures.",
  },
  "men-avatarsdk": {
    id: "men-avatarsdk",
    name: "Prof. Arthur",
    role: "Male Professor",
    gender: "male",
    audioPath: "/audio/welcome-male.mp3",
    jsonPath: "/audio/welcome-male.json",
    subtitle: "Welcome to IntelliClass AI. I am Professor Arthur, your autonomous AI lecturer. Explore textbooks turned into live interactive 3D lectures.",
  },
};

export function LandingHeroAvatarStage() {
  // Default to female model initially (Dr. Clara)
  const [selectedModel, setSelectedModel] = useState<AvatarModelId>(DEFAULT_FEMALE_AVATAR_MODEL);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [targetEpochMs, setTargetEpochMs] = useState<number | undefined>(undefined);
  const [lipSyncCache, setLipSyncCache] = useState<Record<string, HeadTTSData>>({});
  const [mounted, setMounted] = useState(false);

  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const currentPersona = PERSONA_CONFIGS[selectedModel];

  useEffect(() => {
    setMounted(true);
  }, []);

  // Preload viseme JSON for both models on mount
  useEffect(() => {
    Object.values(PERSONA_CONFIGS).forEach(async (persona) => {
      try {
        const res = await fetch(persona.jsonPath);
        if (res.ok) {
          const data: HeadTTSData = await res.json();
          setLipSyncCache((prev) => ({ ...prev, [persona.id]: data }));
        }
      } catch (err) {
        console.warn(`Could not preload viseme data for ${persona.name}:`, err);
      }
    });
  }, []);

  // Cleanly stop any playing audio when component unmounts
  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, []);

  // Handler: Stop current audio playback cleanly
  const stopPlayback = useCallback(() => {
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.onended = null;
        activeSourceRef.current.stop();
        activeSourceRef.current.disconnect();
      } catch { }
      activeSourceRef.current = null;
    }
    stopAllAudio();
    setIsPlaying(false);
    setIsLoadingAudio(false);
    setTargetEpochMs(undefined);
  }, []);

  // Handler: When speech finishes naturally
  const handleSpeechEnded = useCallback(() => {
    setIsPlaying(false);
    setIsLoadingAudio(false);
    setTargetEpochMs(undefined);
    activeSourceRef.current = null;
  }, []);

  // Handler: Toggle Speaker ON/OFF
  const toggleSpeaker = useCallback(async () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }

    try {
      setIsLoadingAudio(true);
      const persona = PERSONA_CONFIGS[selectedModel];

      // Ensure viseme data is loaded
      let visemes = lipSyncCache[selectedModel];
      if (!visemes) {
        const res = await fetch(persona.jsonPath);
        if (res.ok) {
          visemes = await res.json();
          setLipSyncCache((prev) => ({ ...prev, [selectedModel]: visemes }));
        }
      }

      // Schedule synchronized sample-accurate playback
      const epoch = getSynchronizedEpochMs() + 60;
      setTargetEpochMs(epoch);
      setIsPlaying(true);
      setIsLoadingAudio(false);

      const src = await scheduleAudioPlayback(persona.audioPath, epoch, () => {
        handleSpeechEnded();
      });

      if (src) {
        activeSourceRef.current = src;
      } else {
        // Fallback safety if audio context was blocked
        setIsPlaying(false);
        setTargetEpochMs(undefined);
      }
    } catch (err) {
      console.error("Error starting welcome audio:", err);
      stopPlayback();
    }
  }, [isPlaying, selectedModel, lipSyncCache, stopPlayback, handleSpeechEnded]);

  // Handler: Switch Model (Women vs Men)
  const handleSelectModel = useCallback(
    (modelId: AvatarModelId) => {
      if (modelId === selectedModel) return;

      // Invariant: Stop current audio immediately so female audio does not play on male avatar
      if (isPlaying) {
        stopPlayback();
      }

      setSelectedModel(modelId);
    },
    [selectedModel, isPlaying, stopPlayback]
  );

  return (
    <div className="relative w-full flex flex-col items-center">
      {/* ── 3D Canvas Viewport (Seamless Screen Integration) ──────── */}
      <div className="relative w-full h-[440px] sm:h-[480px] md:h-[500px] select-none">
        {/* Subtle rotate guidance hint */}
        <div className="absolute top-2 right-2 z-10 pointer-events-none text-[11px] text-[#86868b] dark:text-[#a1a1a6] flex items-center gap-1.5 bg-black/5 dark:bg-white/10 px-2.5 py-1 rounded-full backdrop-blur-xs">
          <RotateCcw className="w-3 h-3" />
          <span>Drag to rotate</span>
        </div>

        {/* Client-side Hydration Guard */}
        {!mounted ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-[#86868b]">
            <Loader2 className="w-6 h-6 animate-spin text-[#0071e3]" />
            <span className="text-xs font-medium">Loading 3D classroom scene...</span>
          </div>
        ) : (
          <Canvas
            camera={{
              position: [0.35, 1.55, -1.4],
              fov: 45,
              near: 0.1,
              far: 50,
            }}
            gl={{
              alpha: true,
              powerPreference: "high-performance",
              antialias: true,
              preserveDrawingBuffer: false,
            }}
            className="w-full h-full cursor-grab active:cursor-grabbing"
          >
            {/* Studio Lighting */}
            <ambientLight intensity={0.9} color="#f0f0f5" />
            <directionalLight position={[3, 4, 2]} intensity={1.8} color="#ffffff" />
            <directionalLight position={[-2, 3, -1]} intensity={0.7} color="#b0c4ff" />
            <directionalLight position={[0, -1, 3]} intensity={0.3} color="#ffd6a5" />

            {/* Bounded Orbit Controls */}
            <OrbitControls
              enableZoom={false}
              enablePan={false}
              minPolarAngle={Math.PI / 2.5}
              maxPolarAngle={Math.PI / 1.8}
              minAzimuthAngle={-Math.PI / 5}
              maxAzimuthAngle={Math.PI / 5}
              target={[0, 1.35, -3.8]}
            />

            {/* 1. Standing Chalkboard (Stationed for both personas) */}
            <Suspense fallback={null}>
              <StandingChalkboard />
            </Suspense>

            {/* 2. AvatarSDK Model with Talking Mode / Lip-Sync */}
            <Suspense fallback={null}>
              <group position={[0.6, 0, -3.75]} rotation={[0, -0.15, 0]}>
                <Avatar
                  key={selectedModel}
                  model={selectedModel}
                  animation="weight shift"
                  behaviorState={isPlaying ? "talking" : "idle"}
                  scale={1.05}
                  headFollow={true}
                  playLipSync={isPlaying}
                  audioPath={currentPersona.audioPath}
                  lipSyncData={lipSyncCache[selectedModel]}
                  targetEpochMs={targetEpochMs}
                  speechText={currentPersona.subtitle}
                  onLipSyncEnd={handleSpeechEnded}
                />
              </group>
            </Suspense>
          </Canvas>
        )}

        {/* Live Subtitle Caption Bar (Appears when speaking) */}
        {isPlaying && (
          <div className="absolute bottom-2 inset-x-2 sm:inset-x-4 z-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-black/85 dark:bg-black/90 backdrop-blur-md text-white text-xs sm:text-[13px] px-4 py-2.5 rounded-2xl border border-white/15 shadow-xl text-center leading-relaxed max-w-md mx-auto">
              <span className="text-[#2997ff] font-semibold mr-1.5">{currentPersona.name}:</span>
              &ldquo;{currentPersona.subtitle}&rdquo;
            </div>
          </div>
        )}
      </div>

      {/* ── Floating Controls Bar Underneath ────────────────────────── */}
      <div className="w-full pt-3 flex flex-wrap items-center justify-center gap-3">
        {/* Speaker Toggle Button */}
        <button
          type="button"
          onClick={toggleSpeaker}
          disabled={isLoadingAudio}
          className={`inline-flex items-center justify-center gap-2.5 px-4 py-2 rounded-full text-xs sm:text-[13px] font-semibold transition-all duration-200 shadow-xs active:scale-98 ${isPlaying
            ? "bg-[#0071e3] text-white hover:bg-[#0077ed] ring-2 ring-[#0071e3]/30"
            : "bg-[#f5f5f7] dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] border border-[#e5e5ea] dark:border-[#2c2c2e] hover:bg-[#e5e5ea] dark:hover:bg-[#2c2c2e]"
            }`}
          title={isPlaying ? "Click to mute" : "Click to hear voice introduction"}
        >
          {isLoadingAudio ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isPlaying ? (
            <>
              <Volume2 className="w-4 h-4 animate-pulse text-white" />
              <span>Speaking... (Click to Mute)</span>
              {/* Animated sound wave bars */}
              <span className="flex items-center gap-0.5 ml-1">
                <span className="w-0.5 h-3 bg-white rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-0.5 h-4 bg-white rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-0.5 h-2 bg-white rounded-full animate-bounce" />
              </span>
            </>
          ) : (
            <>
              <VolumeX className="w-4 h-4 text-[#86868b] dark:text-[#a1a1a6]" />
              <span>Listen to Intro</span>
            </>
          )}
        </button>

        {/* Model Switcher Segmented Control */}
        <div className="inline-flex items-center bg-[#f5f5f7] dark:bg-[#1c1c1e] p-1 rounded-full border border-[#e5e5ea] dark:border-[#2c2c2e]">
          <button
            type="button"
            onClick={() => handleSelectModel(DEFAULT_FEMALE_AVATAR_MODEL)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${selectedModel === DEFAULT_FEMALE_AVATAR_MODEL
              ? "bg-white dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] shadow-xs"
              : "text-[#86868b] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]"
              }`}
          >
            <span>👩</span>
            <span>Dr. Clara (Women)</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectModel(DEFAULT_MALE_AVATAR_MODEL)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${selectedModel === DEFAULT_MALE_AVATAR_MODEL
              ? "bg-white dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] shadow-xs"
              : "text-[#86868b] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]"
              }`}
          >
            <span>👨</span>
            <span>Prof. Arthur (Men)</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default LandingHeroAvatarStage;
