"use client";

import React, { useEffect, useState, useRef, Component, type ErrorInfo, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { Experience, type HeadTTSData, useDeviceTier } from "@/features/avatar";
import { DEFAULT_AVATAR_MODEL, CLASSROOM_STAGE_CAMERA } from "@/config";
import { Lecturer2DFallback } from "./Lecturer2DFallback";

interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
  onCatch?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class CanvasErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("[AvatarStage] 3D Canvas error caught, falling back to 2D view:", error, errorInfo);
    this.props.onCatch?.();
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
import type { MediaItemDisplay } from "../hooks/useClassroom";

interface AvatarStageProps {
  model?: string;
  isSpeaking: boolean;
  audioPath?: string;
  lipSyncData?: HeadTTSData;
  onLipSyncEnd: () => void;
  targetEpochMs?: number;
  sequence?: number;
  speechText?: string;
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
  model = DEFAULT_AVATAR_MODEL,
  isSpeaking,
  audioPath,
  lipSyncData,
  onLipSyncEnd,
  targetEpochMs,
  sequence,
  speechText,
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
  const [renderVersion, setRenderVersion] = useState(0);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Auto-switch to 3D canvas when core assets complete downloading in background
  useEffect(() => {
    const handleAssetsReady = () => {
      console.info("[AvatarStage] Background assets ready! Re-mounting 3D stage.");
      setRenderVersion((v) => v + 1);
    };
    window.addEventListener("intelliclass:assets-ready", handleAssetsReady);
    return () => {
      window.removeEventListener("intelliclass:assets-ready", handleAssetsReady);
    };
  }, []);

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
        isThinking={isThinking}
        sessionStatus={sessionStatus}
      />
    );
  }

  const fallback2D = (
    <Lecturer2DFallback
      model={model}
      isSpeaking={isSpeaking}
      subtitle={subtitle}
      isThinking={isThinking}
      sessionStatus={sessionStatus}
    />
  );

  return (
    <div
      ref={canvasContainerRef}
      className="relative w-full h-full min-h-0 overflow-hidden rounded-2xl md:rounded-3xl bg-card shadow-2xl border border-border/40"
    >
      <CanvasErrorBoundary fallback={fallback2D}>
        {/* 3D Adaptive Canvas */}
        <Canvas
          dpr={capabilities.dpr}
          shadows={capabilities.shadows ? { type: THREE.PCFShadowMap } : false}
          gl={{
            powerPreference: "high-performance",
            antialias: capabilities.tier === "high",
            preserveDrawingBuffer: false,
          }}
          camera={CLASSROOM_STAGE_CAMERA}
          className="w-full h-full"
        >
          <color attach="background" args={["#121316"]} />
          <Experience
            key={`${model}_${renderVersion}`}
            model={model}
            animation="weight shift"
            behaviorState={isSpeaking ? "talking" : isThinking ? "listening" : "idle"}
            headFollow={true}
            playLipSync={isSpeaking}
            audioPath={audioPath}
            lipSyncData={lipSyncData}
            onLipSyncEnd={onLipSyncEnd}
            targetEpochMs={targetEpochMs}
            sequence={sequence}
            speechText={speechText}
          />
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  );
}

export default AvatarStage;
