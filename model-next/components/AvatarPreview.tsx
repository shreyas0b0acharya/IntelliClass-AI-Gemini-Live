"use client";

import React, { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Avatar } from "@/components/Avatar/Avatar";
import type { HeadTTSData } from "@/components/LipSync/lipSync.types";
import { Loader2, Sparkles, AlertTriangle } from "lucide-react";

interface AvatarPreviewProps {
  model?: string;
  gender?: "male" | "female";
  className?: string;
  isSpeaking?: boolean;
  audioPath?: string;
  lipSyncData?: HeadTTSData;
  onLipSyncEnd?: () => void;
}

/**
 * Suppress the non-fatal THREE.Clock deprecation warning from R3F v9 internals.
 */
if (typeof window !== "undefined") {
  const _origWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("THREE.Clock")) return;
    _origWarn.apply(console, args);
  };
}

/**
 * Lightweight studio scene for the Settings / Create Session preview.
 * Renders ONLY the Avatar model with 3-point lighting.
 */
function LightweightStudioScene({
  model,
  isSpeaking,
  audioPath,
  lipSyncData,
  onLipSyncEnd,
}: {
  model: string;
  isSpeaking: boolean;
  audioPath?: string;
  lipSyncData?: HeadTTSData;
  onLipSyncEnd?: () => void;
}) {
  return (
    <>
      {/* 3-point studio lighting */}
      <ambientLight intensity={0.9} color="#e8e8ed" />
      <directionalLight position={[3, 4, 2]} intensity={1.8} color="#ffffff" />
      <directionalLight position={[-2, 3, -1]} intensity={0.6} color="#b0c4ff" />
      <directionalLight position={[0, -1, 3]} intensity={0.3} color="#ffd6a5" />

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 2.5}
        maxPolarAngle={Math.PI / 1.8}
        minAzimuthAngle={-Math.PI / 6}
        maxAzimuthAngle={Math.PI / 6}
        target={[0, 1.45, -3.8]}
      />

      <Avatar
        key={model}
        model={model}
        animation="weight shift"
        behaviorState={isSpeaking ? "talking" : "idle"}
        position={[0, 0, -3.8]}
        scale={1.05}
        headFollow={true}
        playLipSync={isSpeaking && Boolean(lipSyncData)}
        audioPath={audioPath}
        lipSyncData={lipSyncData}
        onLipSyncEnd={onLipSyncEnd}
      />
    </>
  );
}

export function AvatarPreview({
  model: propModel,
  gender = "male",
  className = "w-full h-64",
  isSpeaking = false,
  audioPath,
  lipSyncData,
  onLipSyncEnd,
}: AvatarPreviewProps) {
  const modelFile = propModel || (gender === "female" ? "women-avatarsdk" : "men-avatarsdk");

  const [mounted, setMounted] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Listen for webglcontextlost / webglcontextrestored
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const handleLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleRestored = () => setContextLost(false);

    el.addEventListener("webglcontextlost", handleLost);
    el.addEventListener("webglcontextrestored", handleRestored);
    return () => {
      el.removeEventListener("webglcontextlost", handleLost);
      el.removeEventListener("webglcontextrestored", handleRestored);
    };
  }, [mounted]);

  const handleCreated = useCallback((state: { gl: THREE.WebGLRenderer }) => {
    canvasRef.current = state.gl.domElement;
  }, []);

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-gradient-to-b from-[#1c1c1f] to-[#121214] shadow-xs ${className}`}
    >
      {/* Context-lost overlay */}
      {contextLost && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-[#121316]/90 backdrop-blur-sm">
          <AlertTriangle className="h-6 w-6 text-amber-400" />
          <span className="text-[11px] font-medium text-neutral-400">
            GPU context lost — reload the page to restore.
          </span>
        </div>
      )}

      {mounted ? (
        <Suspense
          fallback={
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#121316]">
              <Loader2 className="h-6 w-6 animate-spin text-[#0071e3]" />
              <span className="text-[11px] font-medium text-neutral-400">
                Rendering 3D Studio...
              </span>
            </div>
          }
        >
          <Canvas
            shadows={false}
            camera={{
              position: [0, 1.48, -2.1],
              fov: 38,
              near: 0.1,
              far: 50,
            }}
            frameloop="always"
            dpr={[1, 1.5]}
            gl={{
              antialias: true,
              powerPreference: "low-power",
              alpha: false,
              stencil: false,
              depth: true,
            }}
            onCreated={handleCreated}
            className="w-full h-full cursor-grab active:cursor-grabbing"
          >
            <color attach="background" args={["#18181b"]} />

            <LightweightStudioScene
              model={modelFile}
              isSpeaking={isSpeaking}
              audioPath={audioPath}
              lipSyncData={lipSyncData}
              onLipSyncEnd={onLipSyncEnd}
            />
          </Canvas>
        </Suspense>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#121316]">
          <Loader2 className="h-6 w-6 animate-spin text-[#0071e3]" />
          <span className="text-[11px] font-medium text-neutral-400">
            Preparing 3D Viewport...
          </span>
        </div>
      )}

      {/* Badge Overlay */}
      <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 dark:bg-black/70 backdrop-blur-md text-[10px] font-semibold text-white pointer-events-none border border-white/10">
        <Sparkles className="h-3 w-3 text-[#0071e3]" />
        <span>3D Studio Preview</span>
      </div>

      <div className="absolute bottom-2 right-2 z-10 px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-xs text-[9px] font-mono text-white/70 pointer-events-none border border-white/5">
        Drag to rotate
      </div>
    </div>
  );
}
