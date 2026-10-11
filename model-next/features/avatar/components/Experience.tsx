"use client";

import React, { useEffect } from "react";
import {
  Environment,
  OrbitControls,
  useTexture,
  useGLTF,
} from "@react-three/drei";
import * as THREE from "three";
import { Avatar } from "./Avatar";
import type { HeadTTSData } from "../types/lipSync.types";
import { useDeviceTier } from "../hooks/useDeviceTier";
import { DEFAULT_AVATAR_MODEL, getClassroomModelPath, STAGE_BACKDROP_TEXTURE_PATH } from "@/config";
import { useCachedAssetUrl } from "../hooks/useCachedAssetUrl";

function ClassroomStage() {
  const { capabilities } = useDeviceTier();
  const classroomModelPath = getClassroomModelPath(capabilities.lodLevel);
  const cachedUrl = useCachedAssetUrl(classroomModelPath);
  const { scene } = useGLTF(cachedUrl);

  return <primitive object={scene} />;
}

interface ExperienceProps {
  model?: string;
  animation?: string;
  behaviorState?: "idle" | "listening" | "talking";
  headFollow?: boolean;
  playLipSync: boolean;
  audioPath?: string;
  lipSyncData?: HeadTTSData;
  onLipSyncEnd?: () => void;
  targetEpochMs?: number;
  sequence?: number;
}

export function Experience({
  model = DEFAULT_AVATAR_MODEL,
  animation = "weight shift",
  behaviorState = "idle",
  headFollow = true,
  playLipSync,
  audioPath,
  lipSyncData,
  onLipSyncEnd,
  targetEpochMs,
  sequence,
}: ExperienceProps) {
  const { capabilities } = useDeviceTier();
  const cachedBackdropUrl = useCachedAssetUrl(STAGE_BACKDROP_TEXTURE_PATH);
  const texture = useTexture(cachedBackdropUrl);

  return (
    <>
      <OrbitControls
        target={[0, 1.55, -3.8]}
        enableZoom={true}
        enablePan={true}
        screenSpacePanning={true}
        minDistance={0.4}
        maxDistance={4.5}
      />

      {/* Render full 3D classroom mesh only for High and Medium tiers.
          Low tier renders a lightweight 2D stage plane, saving 40.5MB on mobile! */}
      {capabilities.stageType !== "2d-backdrop" && (
        <React.Suspense fallback={null}>
          <ClassroomStage />
        </React.Suspense>
      )}

      <Avatar
        key={model}
        model={model}
        animation={animation}
        behaviorState={behaviorState}
        position={[0, 0, -3.8]}
        scale={1.1}
        headFollow={headFollow}
        playLipSync={playLipSync}
        audioPath={audioPath}
        lipSyncData={lipSyncData}
        onLipSyncEnd={onLipSyncEnd}
        targetEpochMs={targetEpochMs}
        sequence={sequence}
      />

      {/* Studio portrait lighting: 3-point illumination + frontal eye catchlight across all tiers */}
      <ambientLight intensity={0.9} color={0xffffff} />
      <directionalLight position={[2, 4, 3]} intensity={1.5} color={0xffffff} />
      <directionalLight position={[-2, 2, 2]} intensity={0.7} color={0xdbe5ff} />
      <directionalLight position={[0, 1.5, 3]} intensity={0.4} color={0xffffff} />

      {/* Subtle HDR environment fill for high tier */}
      {capabilities.enableEnvironmentMap && (
        <Environment files="/environment/empty_warehouse_01_1k.hdr" environmentIntensity={0.25} />
      )}

      {/* Stage backdrop projection plane */}
      <mesh receiveShadow={capabilities.shadows} position={[0, 1.8, -4.3]}>
        <planeGeometry args={[8.9, 4.8]} />
        <meshBasicMaterial map={texture} />
      </mesh>
    </>
  );
}

export default Experience;
