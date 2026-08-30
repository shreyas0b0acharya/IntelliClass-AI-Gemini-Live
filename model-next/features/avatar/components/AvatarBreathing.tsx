"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useAvatarBehavior } from "./AvatarBehaviorContext";

interface AvatarBreathingProps {
  spine2?: THREE.Bone | THREE.Object3D;
  leftShoulder?: THREE.Bone | THREE.Object3D;
  rightShoulder?: THREE.Bone | THREE.Object3D;
}

export function AvatarBreathing({
  spine2,
  leftShoulder,
  rightShoulder,
}: AvatarBreathingProps) {
  const behaviorRef = useAvatarBehavior();
  const spine2Ref = useRef<THREE.Bone | THREE.Object3D | undefined>(spine2);
  const leftShoulderRef = useRef<THREE.Bone | THREE.Object3D | undefined>(leftShoulder);
  const rightShoulderRef = useRef<THREE.Bone | THREE.Object3D | undefined>(rightShoulder);

  // Initial resting positions & rotations (NEVER scale bones to prevent hands/arms from shrinking/growing)
  const baseSpine2Pos = useRef<THREE.Vector3 | null>(null);
  const baseLShoulderPos = useRef<THREE.Vector3 | null>(null);
  const baseRShoulderPos = useRef<THREE.Vector3 | null>(null);
  const baseLShoulderRot = useRef<THREE.Euler | null>(null);
  const baseRShoulderRot = useRef<THREE.Euler | null>(null);

  useEffect(() => {
    spine2Ref.current = spine2;
    if (spine2) {
      baseSpine2Pos.current = spine2.position.clone();
      spine2.scale.set(1, 1, 1);
    }
  }, [spine2]);

  useEffect(() => {
    leftShoulderRef.current = leftShoulder;
    if (leftShoulder) {
      baseLShoulderPos.current = leftShoulder.position.clone();
      baseLShoulderRot.current = leftShoulder.rotation.clone();
      leftShoulder.scale.set(1, 1, 1);
    }
  }, [leftShoulder]);

  useEffect(() => {
    rightShoulderRef.current = rightShoulder;
    if (rightShoulder) {
      baseRShoulderPos.current = rightShoulder.position.clone();
      baseRShoulderRot.current = rightShoulder.rotation.clone();
      rightShoulder.scale.set(1, 1, 1);
    }
  }, [rightShoulder]);

  useFrame(() => {
    const b = behaviorRef.current.breathing;
    const chest = b.chestExpansion;
    const shoulders = b.shoulderLift;

    // 1. CHEST / STERNUM (Upward & forward translation, zero scale mutation)
    const s2 = spine2Ref.current;
    if (s2 && baseSpine2Pos.current) {
      s2.position.y = baseSpine2Pos.current.y + chest * 0.0022;
      s2.position.z = baseSpine2Pos.current.z + chest * 0.0016;
    }

    // 2. SHOULDERS / CLAVICLES (Rise upward & slight outward spread)
    const lShoulder = leftShoulderRef.current;
    if (lShoulder) {
      if (baseLShoulderPos.current) {
        lShoulder.position.y = baseLShoulderPos.current.y + shoulders * 0.0032;
        lShoulder.position.x = baseLShoulderPos.current.x + shoulders * 0.0008;
      }
      if (baseLShoulderRot.current) {
        lShoulder.rotation.z = baseLShoulderRot.current.z - (shoulders - 0.5) * 0.008;
      }
    }

    const rShoulder = rightShoulderRef.current;
    if (rShoulder) {
      if (baseRShoulderPos.current) {
        rShoulder.position.y = baseRShoulderPos.current.y + shoulders * 0.0032;
        rShoulder.position.x = baseRShoulderPos.current.x - shoulders * 0.0008;
      }
      if (baseRShoulderRot.current) {
        rShoulder.rotation.z = baseRShoulderRot.current.z + (shoulders - 0.5) * 0.008;
      }
    }
  });

  return null;
}

export default AvatarBreathing;
