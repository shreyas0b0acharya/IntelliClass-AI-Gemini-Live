"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useAvatarBehavior } from "./AvatarBehaviorContext";

interface AvatarLipsProps {
  head?: THREE.SkinnedMesh;
}

export function AvatarLips({ head }: AvatarLipsProps) {
  const behaviorRef = useAvatarBehavior();
  const headRef = useRef<THREE.SkinnedMesh | undefined>(head);

  useEffect(() => {
    headRef.current = head;
  }, [head]);

  useFrame((_, delta) => {
    const mesh = headRef.current;
    if (!mesh?.morphTargetDictionary || !mesh.morphTargetInfluences) {
      return;
    }

    const isTalking = behaviorRef.current.state === "talking";
    const targets = behaviorRef.current.lips;
    // mouthPress is also driven by AvatarMouthCorners; both add the same speech-layer value so
    // they agree on the target instead of pulling the morph in two directions.
    const press = isTalking ? 0 : (behaviorRef.current.speech?.mouthPress ?? 0);
    // Fast decay when talking so mouth-closing morphs yield instantly to lip-sync
    const smoothing = isTalking
      ? 1 - Math.exp(-20.0 * Math.min(delta, 0.1))
      : 1 - Math.exp(-6.5 * Math.min(delta, 0.1));

    updateMorph(mesh, "mouthPressLeft", isTalking ? 0 : Math.min(1, targets.mouthPressLeft + press), smoothing);
    updateMorph(mesh, "mouthPressRight", isTalking ? 0 : Math.min(1, targets.mouthPressRight + press), smoothing);
    updateMorph(mesh, "mouthRollLower", isTalking ? 0 : targets.mouthRollLower, smoothing);
    updateMorph(mesh, "mouthRollUpper", isTalking ? 0 : targets.mouthRollUpper, smoothing);
    updateMorph(mesh, "mouthClose", isTalking ? 0 : targets.mouthClose, smoothing);
    updateMorph(mesh, "mouthPucker", isTalking ? 0 : targets.mouthPucker, smoothing);
  });

  return null;
}

function updateMorph(
  mesh: THREE.SkinnedMesh,
  morphName: string,
  target: number,
  smoothing: number
) {
  const index = mesh.morphTargetDictionary?.[morphName];
  if (index === undefined) return;

  const current = mesh.morphTargetInfluences?.[index] ?? 0;
  mesh.morphTargetInfluences![index] = THREE.MathUtils.lerp(
    current,
    target,
    smoothing
  );
}

export default AvatarLips;
