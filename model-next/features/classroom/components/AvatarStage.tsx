"use client";

import { useEffect, useState, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { Experience, type HeadTTSData, useDeviceTier } from "@/features/avatar";
import { Lecturer2DFallback } from "./Lecturer2DFallback";
import type { MediaItemDisplay } from "../hooks/useClassroom";

interface AvatarStageProps {
  model?: string;
  isSpeaking: boolean;
  audioPath?: string;
  lipSyncData?: HeadTTSData;
  onLipSyncEnd: () => void;
  targetEpochMs?: number;
  sequence?: number;
  subtitle?: string;
  activeMedia?: MediaItemDisplay | null;
  userQuestion?: string;
  isThinking?: boolean;
  sessionStatus?: string;
  onCloseMedia?: () => void;
  onQuestionChange?: (q: string) => void;
  onQuestionSubmit?: (e?: React.FormEvent) => void;
}

export function AvatarStage({
  model = "men-avatarsdk",
  isSpeaking,
  audioPath,
  lipSyncData,
  onLipSyncEnd,
  targetEpochMs,
  sequence,
  subtitle,
  activeMedia,
  userQuestion,
  isThinking,
  sessionStatus,
  onCloseMedia,
  onQuestionChange,
  onQuestionSubmit,
}: AvatarStageProps) {
  const { capabilities, tier, setSpeakingState } = useDeviceTier();
  const [isContextLost, setIsContextLost] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Notify tier monitor of speaking state to avoid mid-speech tier upgrades
  useEffect(() => {
    setSpeakingState(isSpeaking);
  }, [isSpeaking, setSpeakingState]);

  // Robust WebGL Context Loss & Recovery Listener
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      console.warn("[WebGL] Context lost — switching to 2D Lecturer Fallback");
      setIsContextLost(true);
    };

    const handleContextRestored = () => {
      console.info("[WebGL] Context restored — reconstructing GPU resources");
      // Brief delay to allow Three.js to recompile shaders and upload buffers
      setTimeout(() => {
        setIsContextLost(false);
      }, 300);
    };

    container.addEventListener("webglcontextlost", handleContextLost, false);
    container.addEventListener("webglcontextrestored", handleContextRestored, false);

    return () => {
      container.removeEventListener("webglcontextlost", handleContextLost);
      container.removeEventListener("webglcontextrestored", handleContextRestored);
    };
  }, []);

  // ── Render 2D Fallback if tier is fallback-2d or GPU context is lost ──
  if (tier === "fallback-2d" || isContextLost) {
    return (
      <Lecturer2DFallback
        model={model}
        isSpeaking={isSpeaking}
        subtitle={subtitle}
        activeMedia={activeMedia}
        userQuestion={userQuestion}
        isThinking={isThinking}
        sessionStatus={sessionStatus}
        onCloseMedia={onCloseMedia}
        onQuestionChange={onQuestionChange}
        onQuestionSubmit={onQuestionSubmit}
      />
    );
  }

  return (
    <div
      ref={canvasContainerRef}
      className="relative w-full h-full min-h-0 overflow-hidden rounded-2xl md:rounded-3xl bg-card shadow-2xl border border-border/40"
    >
      {/* 3D Adaptive Canvas */}
      <Canvas
        dpr={capabilities.dpr}
        shadows={capabilities.shadows ? { type: THREE.PCFShadowMap } : false}
        gl={{
          powerPreference: "high-performance",
          antialias: capabilities.tier === "high",
          preserveDrawingBuffer: false,
        }}
        camera={{
          position: [-0.03, 1.539, 0.768],
          fov: 42,
          near: 0.01,
          far: 50,
        }}
        className="w-full h-full"
      >
        <color attach="background" args={["#121316"]} />
        <Experience
          model={model}
          animation="weight shift"
          behaviorState={isSpeaking ? "talking" : "idle"}
          headFollow={true}
          playLipSync={isSpeaking}
          audioPath={audioPath}
          lipSyncData={lipSyncData}
          onLipSyncEnd={onLipSyncEnd}
          targetEpochMs={targetEpochMs}
          sequence={sequence}
        />
      </Canvas>
    </div>
  );
}

export default AvatarStage;
