"use client";

import React, { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Avatar } from "./Avatar";
import type { HeadTTSData } from "../types/lipSync.types";
import {
  DEFAULT_AVATAR_MODEL,
  DEFAULT_FEMALE_AVATAR_MODEL,
  STUDIO_PREVIEW_CAMERA,
} from "@/config";
import { Loader2, Sparkles, AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      <ambientLight intensity={0.9} color={0xe8e8ed} />
      <directionalLight position={[3, 4, 2]} intensity={1.8} color={0xffffff} />
      <directionalLight position={[-2, 3, -1]} intensity={0.6} color={0xb0c4ff} />
      <directionalLight position={[0, -1, 3]} intensity={0.3} color={0xffd6a5} />

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
        playLipSync={isSpeaking}
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
  const modelFile = propModel || (gender === "female" ? DEFAULT_FEMALE_AVATAR_MODEL : DEFAULT_AVATAR_MODEL);

  const [mounted, setMounted] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Gracefully clean up WebGL renderer when component unmounts
  useEffect(() => {
    return () => {
      if (rendererRef.current) {
        try {
          rendererRef.current.dispose();
        } catch {}
        rendererRef.current = null;
      }
    };
  }, []);

  const recoverContext = useCallback(() => {
    setContextLost(false);
    setCanvasKey((k) => k + 1);
  }, []);

  const handleCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    rendererRef.current = gl;
    canvasRef.current = gl.domElement;

    // Suppress WebGL shader compiler precision warnings in browser console
    const _origWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      if (typeof args[0] === "string" && (args[0].includes("X4122") || args[0].includes("sum of"))) return;
      _origWarn.apply(console, args);
    };

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      console.warn("[AvatarPreview] WebGL Context lost — attempting self-healing recovery...");
      setContextLost(true);
      // Auto-recover after a brief delay so the user is never stuck
      setTimeout(() => {
        setCanvasKey((k) => k + 1);
        setContextLost(false);
      }, 600);
    };

    const handleContextRestored = () => {
      console.info("[AvatarPreview] WebGL Context restored");
      setCanvasKey((k) => k + 1);
      setContextLost(false);
    };

    const el = gl.domElement;
    el.addEventListener("webglcontextlost", handleContextLost);
    el.addEventListener("webglcontextrestored", handleContextRestored);

    return () => {
      el.removeEventListener("webglcontextlost", handleContextLost);
      el.removeEventListener("webglcontextrestored", handleContextRestored);
    };
  }, []);

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-gradient-to-b from-card to-background shadow-xs ${className}`}
    >
      {/* Context-lost self-healing overlay */}
      {contextLost && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2.5 bg-background/90 backdrop-blur-md p-4 text-center animate-in fade-in duration-200">
          <AlertTriangle className="h-6 w-6 text-chart-4 animate-pulse" />
          <span className="text-xs font-semibold text-foreground">
            Restoring 3D Viewport...
          </span>
          <p className="text-[11px] text-muted-foreground max-w-xs">
            GPU display state was reset by the browser. Rebuilding WebGL context.
          </p>
          <Button
            variant="outline"
            size="xs"
            onClick={recoverContext}
            className="mt-1 gap-1.5"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Restore Now</span>
          </Button>
        </div>
      )}

      {mounted ? (
        <Suspense
          fallback={
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs font-medium text-muted-foreground">
                Rendering 3D Studio...
              </span>
            </div>
          }
        >
          <Canvas
            key={canvasKey}
            shadows={false}
            camera={{
              position: STUDIO_PREVIEW_CAMERA.position,
              fov: STUDIO_PREVIEW_CAMERA.fov,
              near: STUDIO_PREVIEW_CAMERA.near,
              far: STUDIO_PREVIEW_CAMERA.far,
            }}
            frameloop="always"
            dpr={[1, 1.5]}
            gl={{
              antialias: true,
              powerPreference: "high-performance",
              alpha: false,
              stencil: false,
              depth: true,
              preserveDrawingBuffer: false,
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
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs font-medium text-muted-foreground">
            Preparing 3D Viewport...
          </span>
        </div>
      )}

      {/* Badge Overlay */}
      <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 dark:bg-black/70 backdrop-blur-md text-xs font-semibold text-white pointer-events-none border border-white/10">
        <Sparkles className="h-3 w-3 text-primary" />
        <span>3D Studio Preview</span>
      </div>

      <div className="absolute bottom-2 right-2 z-10 px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-xs text-xs font-mono text-white/70 pointer-events-none border border-white/5">
        Drag to rotate
      </div>
    </div>
  );
}

export default AvatarPreview;
