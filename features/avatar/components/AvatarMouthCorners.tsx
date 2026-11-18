"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useAvatarBehavior } from "./AvatarBehaviorContext";

interface AvatarMouthCornersProps {
  head?: THREE.SkinnedMesh;
  eyelashes?: THREE.SkinnedMesh;
}

export function AvatarMouthCorners({
  head,
  eyelashes,
}: AvatarMouthCornersProps) {
  const behaviorRef = useAvatarBehavior();
  const headRef = useRef<THREE.SkinnedMesh | undefined>(head);
  const eyelashesRef = useRef<THREE.SkinnedMesh | undefined>(eyelashes);

  useEffect(() => {
    headRef.current = head;
  }, [head]);

  useEffect(() => {
    eyelashesRef.current = eyelashes;
  }, [eyelashes]);

  useFrame((_, delta) => {
    const hMesh = headRef.current;
    const eMesh = eyelashesRef.current;
    const isTalking = behaviorRef.current.state === "talking";
    const random = behaviorRef.current.mouthCorners;
    const speech = behaviorRef.current.speech;
    const targets = {
      ...random,
      mouthSmileLeft: Math.min(1, random.mouthSmileLeft + (speech?.smileLeft ?? 0)),
      mouthSmileRight: Math.min(1, random.mouthSmileRight + (speech?.smileRight ?? 0)),
      mouthPressLeft: isTalking ? 0 : Math.min(1, random.mouthPressLeft + (speech?.mouthPress ?? 0)),
      mouthPressRight: isTalking ? 0 : Math.min(1, random.mouthPressRight + (speech?.mouthPress ?? 0)),
    };

    const smoothing = 1 - Math.exp(-6.5 * Math.min(delta, 0.1));
    const meshes = [hMesh, eMesh];

    for (const mesh of meshes) {
      if (!mesh?.morphTargetDictionary || !mesh.morphTargetInfluences) {
        continue;
      }

      updateMorph(mesh, "mouthSmileLeft", targets.mouthSmileLeft, smoothing);
      updateMorph(mesh, "mouthSmileRight", targets.mouthSmileRight, smoothing);
      updateMorph(mesh, "mouthDimpleLeft", targets.mouthDimpleLeft, smoothing);
      updateMorph(mesh, "mouthDimpleRight", targets.mouthDimpleRight, smoothing);
      updateMorph(mesh, "mouthPressLeft", targets.mouthPressLeft, smoothing);
      updateMorph(mesh, "mouthPressRight", targets.mouthPressRight, smoothing);
      updateMorph(mesh, "mouthStretchLeft", targets.mouthStretchLeft, smoothing);
      updateMorph(mesh, "mouthStretchRight", targets.mouthStretchRight, smoothing);
    }
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

export default AvatarMouthCorners;
