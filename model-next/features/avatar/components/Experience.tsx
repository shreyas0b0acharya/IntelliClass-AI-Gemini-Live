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

function ClassroomStage() {
  const { scene } = useGLTF("/models/CLASSROOM.glb");

  // Dispose geometries and materials on unmount
  useEffect(() => {
    return () => {
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => {
              m.map?.dispose();
              m.dispose();
            });
          } else if (obj.material) {
            obj.material.map?.dispose();
            obj.material.dispose();
          }
        }
      });
    };
  }, [scene]);

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
  model = "men-avatarsdk",
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
  const texture = useTexture("/textures/Blackboard-Stage-Wall.png");

  return (
    <>
      <OrbitControls target={[0, 1.8, -4.3]} enableZoom={true} enablePan={false} />

      {/* Render full 3D classroom mesh only for High and Medium tiers.
          Low tier renders a lightweight 2D stage plane, saving 40.5MB on mobile! */}
      {capabilities.stageType !== "2d-backdrop" ? (
        <React.Suspense fallback={null}>
          <ClassroomStage />
        </React.Suspense>
      ) : (
        /* Minimal stage lighting fallback */
        <>
          <ambientLight intensity={1.2} />
          <directionalLight position={[0, 4, 2]} intensity={1.5} />
        </>
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

      {/* HDR Environment lighting for High tier only */}
      {capabilities.enableEnvironmentMap ? (
        <Environment files="/environment/empty_warehouse_01_1k.hdr" />
      ) : (
        <ambientLight intensity={0.9} />
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
