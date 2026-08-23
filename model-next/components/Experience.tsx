"use client";

import {
  Environment,
  OrbitControls,
  useTexture,
} from "@react-three/drei";

import { Avatar } from "./Avatar/Avatar";
import Classroom from "./Classroom";

import type {
  HeadTTSData,
} from "./LipSync/lipSync.types";

interface ExperienceProps {
  model?: string;
  animation?: string;
  behaviorState?: "idle" | "listening" | "talking";
  headFollow?: boolean;

  playLipSync: boolean;

  audioPath?: string;
  lipSyncData?: HeadTTSData;

  onLipSyncEnd?: () => void;
}

export const Experience = ({
  model = "men-avatarsdk",
  animation = "weight shift",
  behaviorState = "idle",
  headFollow = true,
  playLipSync,
  audioPath,
  lipSyncData,
  onLipSyncEnd,
}: ExperienceProps) => {
  const texture =
    useTexture(
      "/textures/Blackboard-Stage-Wall.png"
    );

  return (
    <>
      <OrbitControls
        target={[
          0,
          1.8,
          -4.3,
        ]}
      />

      <Classroom />

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
      />

      <Environment
        files="/environment/empty_warehouse_01_1k.hdr"
      />

      <mesh
        receiveShadow
        position={[
          0,
          1.8,
          -4.3,
        ]}
      >
        <planeGeometry
          args={[
            8.9,
            4.8,
          ]}
        />

        <meshBasicMaterial
          map={texture}
        />
      </mesh>
    </>
  );
};

useTexture.preload("/textures/Blackboard-Stage-Wall.png");