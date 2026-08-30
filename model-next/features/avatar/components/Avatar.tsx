"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useGraph } from "@react-three/fiber";
import { useGLTF as useDreiGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";

import { useLipSync } from "../hooks/useLipSync";
import type { LipSyncProps } from "../types/lipSync.types";
import { AvatarBehaviorController } from "./AvatarBehaviorController";
import { AvatarBlink } from "./AvatarBlink";
import { AvatarMeshes } from "./AvatarMeshes";
import { AvatarAnimations } from "./AvatarAnimations";
import type { AvatarGLTFResult, AvatarProps } from "../types/avatar.types";
import { AvatarEyeMovement } from "./AvatarEyeMovement";
import { AvatarBreathing } from "./AvatarBreathing";
import { AvatarHeadMovement } from "./AvatarHeadMovement";
import { AvatarEyebrows } from "./AvatarEyebrows";
import { AvatarCheeks } from "./AvatarCheeks";
import { AvatarMouthCorners } from "./AvatarMouthCorners";
import { AvatarNostrils } from "./AvatarNostrils";
import { AvatarLips } from "./AvatarLips";
import { useDeviceTier } from "../hooks/useDeviceTier";

function AvatarLipSync(props: LipSyncProps) {
  useLipSync(props);
  return null;
}

export function Avatar({
  model = "men-avatarsdk",
  animation = "weight shift",
  behaviorState = "idle",
  position,
  scale,
  headFollow = true,
  playLipSync = false,
  audioPath,
  lipSyncData,
  onLipSyncEnd,
  targetEpochMs,
  sequence,
}: AvatarProps) {
  const modelName = model || "men-avatarsdk";
  const { capabilities } = useDeviceTier();

  const [isReady, setIsReady] = useState(false);

  // Fallback timer: ensure avatar is never stuck invisible in edge cases
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, [modelName]);

  const { scene } = useDreiGLTF(`/models/${modelName}.glb`);

  /*
   * Clone the model so every avatar instance
   * has independent skeleton/morph state.
   */
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);

  // Clean up geometries and materials on unmount to prevent WebGL memory leaks
  useEffect(() => {
    return () => {
      clone.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.SkinnedMesh) {
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
  }, [clone]);

  const { nodes, materials } = useGraph(clone) as unknown as AvatarGLTFResult;

  const leftEyeBone =
    nodes.LeftEye ||
    nodes.EyeLeft ||
    (clone.getObjectByName("LeftEye") as THREE.Bone) ||
    (clone.getObjectByName("EyeLeft") as THREE.Bone);

  const rightEyeBone =
    nodes.RightEye ||
    nodes.EyeRight ||
    (clone.getObjectByName("RightEye") as THREE.Bone) ||
    (clone.getObjectByName("EyeRight") as THREE.Bone);

  const spineBone =
    nodes.Spine || (clone.getObjectByName("Spine") as THREE.Bone);

  const spine1Bone =
    nodes.Spine1 || (clone.getObjectByName("Spine1") as THREE.Bone);

  const spine2Bone =
    nodes.Spine2 || (clone.getObjectByName("Spine2") as THREE.Bone);

  const leftShoulderBone =
    nodes.LeftShoulder ||
    (clone.getObjectByName("LeftShoulder") as THREE.Bone);

  const rightShoulderBone =
    nodes.RightShoulder ||
    (clone.getObjectByName("RightShoulder") as THREE.Bone);

  const neckBone =
    nodes.Neck || (clone.getObjectByName("Neck") as THREE.Bone);

  const headBone =
    nodes.Head || (clone.getObjectByName("Head") as THREE.Bone);

  const group = useRef<THREE.Group>(null);
  const isAnimated = Boolean(animation && animation.toLowerCase() !== "none");

  return (
    <group
      ref={group}
      position={position}
      scale={scale}
      visible={isReady}
    >
      <AvatarBehaviorController
        behaviorState={behaviorState}
        isSpeaking={playLipSync}
      >
        <group name="AvatarRoot">
          {/* On-demand single animation clip loader */}
          <AvatarAnimations
            key={modelName}
            modelName={modelName}
            animation={animation}
            group={group}
            onReady={() => setIsReady(true)}
          />

          {/* BLINKING */}
          {capabilities.enableProceduralFace && (
            <AvatarBlink
              head={nodes.AvatarHead}
              eyelashes={nodes.AvatarEyelashes}
            />
          )}

          {/* EYEBROWS */}
          {capabilities.enableProceduralFace && (
            <AvatarEyebrows
              head={nodes.AvatarHead}
              eyelashes={nodes.AvatarEyelashes}
            />
          )}

          {/* CHEEKS */}
          {capabilities.enableProceduralFace && (
            <AvatarCheeks
              head={nodes.AvatarHead}
              eyelashes={nodes.AvatarEyelashes}
            />
          )}

          {/* MOUTH CORNERS */}
          {capabilities.enableProceduralFace && (
            <AvatarMouthCorners
              head={nodes.AvatarHead}
              eyelashes={nodes.AvatarEyelashes}
            />
          )}

          {/* NOSTRILS */}
          {capabilities.enableProceduralFace && (
            <AvatarNostrils
              head={nodes.AvatarHead}
              eyelashes={nodes.AvatarEyelashes}
            />
          )}

          {/* LIPS */}
          {capabilities.enableProceduralFace && (
            <AvatarLips head={nodes.AvatarHead} />
          )}

          {/* HEAD, NECK & BODY TRACKING */}
          <AvatarHeadMovement
            head={headBone}
            neck={neckBone}
            spine2={spine2Bone}
            spine1={spine1Bone}
            spine={spineBone}
            leftEye={leftEyeBone}
            rightEye={rightEyeBone}
            headFollow={headFollow}
            isAnimated={isAnimated}
          />

          {/* EYE MOVEMENTS & GAZE SYNCHRONIZATION */}
          {capabilities.enableEyeMovement && (
            <AvatarEyeMovement
              leftEye={leftEyeBone}
              rightEye={rightEyeBone}
              head={headBone}
              headFollow={headFollow}
            />
          )}

          {/* NATURAL BREATHING */}
          {capabilities.enableBreathing && (
            <AvatarBreathing
              spine2={spine2Bone}
              leftShoulder={leftShoulderBone}
              rightShoulder={rightShoulderBone}
            />
          )}

          {/* HEADTTS LIP SYNC */}
          {audioPath && lipSyncData && (
            <AvatarLipSync
              head={nodes.AvatarHead}
              teethLower={nodes.AvatarTeethLower}
              audioPath={audioPath}
              lipSyncData={lipSyncData}
              play={playLipSync}
              onEnded={onLipSyncEnd}
              targetEpochMs={targetEpochMs}
              sequence={sequence}
            />
          )}

          {/* MODEL MESHES */}
          <AvatarMeshes nodes={nodes} materials={materials} />
        </group>
      </AvatarBehaviorController>
    </group>
  );
}

export default Avatar;
