"use client";

import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { Experience } from "@/components/Experience";
import type { HeadTTSData } from "@/components/LipSync/lipSync.types";

interface AvatarStageProps {
  model?: string;
  isSpeaking: boolean;
  audioPath?: string;
  lipSyncData?: HeadTTSData;
  onLipSyncEnd: () => void;
}

export function AvatarStage({
  model = "men-avatarsdk",
  isSpeaking,
  audioPath,
  lipSyncData,
  onLipSyncEnd,
}: AvatarStageProps) {
  return (
    <div className="relative w-full h-full min-h-[400px] overflow-hidden rounded-3xl bg-neutral-900 shadow-2xl border border-border/40">
      {/* 3D Canvas */}
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{
          position: [-0.03, 1.539, 0.768],
          fov: 42,
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
        />
      </Canvas>
    </div>
  );
}
