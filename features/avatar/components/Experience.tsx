"use client";

import React from "react";
import {
  Environment,
  OrbitControls,
  useTexture,
  useGLTF,
} from "@react-three/drei";
import { Avatar } from "./Avatar";
import type { HeadTTSData } from "../types/lipSync.types";
import { useDeviceTier } from "../hooks/useDeviceTier";
import { DEFAULT_AVATAR_MODEL, getClassroomModelPath, STAGE_BACKDROP_TEXTURE_PATH } from "@/config";
import { useCachedAsset } from "../hooks/useCachedAssetUrl";

function ClassroomStageInner({ modelUrl }: { modelUrl: string }) {
  const { scene } = useGLTF(modelUrl);
  return <primitive object={scene} />;
}

function ClassroomStage() {
  const { capabilities } = useDeviceTier();
  const classroomModelPath = getClassroomModelPath(capabilities.lodLevel);
  const { url: cachedUrl } = useCachedAsset(classroomModelPath);
  if (!cachedUrl) return null;
  return <ClassroomStageInner modelUrl={cachedUrl} />;
}

function StageBackdropPlaneInner({
  textureUrl,
  receiveShadow,
}: {
  textureUrl: string;
  receiveShadow?: boolean;
}) {
  const texture = useTexture(textureUrl);
  return (
    <mesh receiveShadow={receiveShadow} position={[0, 1.8, -4.3]}>
      <planeGeometry args={[8.9, 4.8]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}

function StageBackdropPlane({ receiveShadow }: { receiveShadow?: boolean }) {
  const { url: cachedBackdropUrl } = useCachedAsset(STAGE_BACKDROP_TEXTURE_PATH);
  if (!cachedBackdropUrl) return null;
  return (
    <StageBackdropPlaneInner
      textureUrl={cachedBackdropUrl}
      receiveShadow={receiveShadow}
    />
  );
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
  speechText?: string;
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
  speechText,
}: ExperienceProps) {
  const { capabilities } = useDeviceTier();

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
        speechText={speechText}
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
      <StageBackdropPlane receiveShadow={capabilities.shadows} />
    </>
  );
}

export default Experience;
