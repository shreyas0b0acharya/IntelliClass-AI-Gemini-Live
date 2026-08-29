"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useAvatarBehavior } from "./AvatarBehaviorContext";

interface AvatarCheeksProps {
  head?: THREE.SkinnedMesh;
  eyelashes?: THREE.SkinnedMesh;
}

export function AvatarCheeks({ head, eyelashes }: AvatarCheeksProps) {
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
    const targets = behaviorRef.current.cheeks;

    const smoothing = 1 - Math.exp(-6.5 * Math.min(delta, 0.1));
    const meshes = [hMesh, eMesh];

    for (const mesh of meshes) {
      if (!mesh?.morphTargetDictionary || !mesh.morphTargetInfluences) {
        continue;
      }

      updateMorph(mesh, "cheekSquintLeft", targets.cheekSquintLeft, smoothing);
      updateMorph(mesh, "cheekSquintRight", targets.cheekSquintRight, smoothing);
      updateMorph(mesh, "noseSneerLeft", targets.noseSneerLeft, smoothing);
      updateMorph(mesh, "noseSneerRight", targets.noseSneerRight, smoothing);
      updateMorph(mesh, "cheekPuff", targets.cheekPuff, smoothing);
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

export default AvatarCheeks;
