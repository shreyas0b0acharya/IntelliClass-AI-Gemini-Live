"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useAvatarBehavior } from "./AvatarBehaviorContext";

interface AvatarEyebrowsProps {
  head?: THREE.SkinnedMesh;
  eyelashes?: THREE.SkinnedMesh;
}

export function AvatarEyebrows({
  head,
  eyelashes,
}: AvatarEyebrowsProps) {
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
    const random = behaviorRef.current.eyebrows;
    const speech = behaviorRef.current.speech;
    // Context-driven brows (emphasis flashes, question raise, concern, furrow) ride on top of the
    // random living behaviour; they are added to the TARGET so the smoothing below stays in charge.
    const targets = {
      browInnerUp: Math.min(1, random.browInnerUp + (speech?.browInnerUp ?? 0)),
      browOuterUpLeft: Math.min(1, random.browOuterUpLeft + (speech?.browOuterUpLeft ?? 0)),
      browOuterUpRight: Math.min(1, random.browOuterUpRight + (speech?.browOuterUpRight ?? 0)),
      browDownLeft: Math.min(1, random.browDownLeft + (speech?.browDownLeft ?? 0)),
      browDownRight: Math.min(1, random.browDownRight + (speech?.browDownRight ?? 0)),
    };

    const smoothing = 1 - Math.exp(-7.5 * Math.min(delta, 0.1));
    const meshes = [hMesh, eMesh];

    for (const mesh of meshes) {
      if (!mesh?.morphTargetDictionary || !mesh.morphTargetInfluences) {
        continue;
      }

      updateMorph(mesh, "browInnerUp", targets.browInnerUp, smoothing);
      updateMorph(mesh, "browOuterUpLeft", targets.browOuterUpLeft, smoothing);
      updateMorph(mesh, "browOuterUpRight", targets.browOuterUpRight, smoothing);
      updateMorph(mesh, "browDownLeft", targets.browDownLeft, smoothing);
      updateMorph(mesh, "browDownRight", targets.browDownRight, smoothing);
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

export default AvatarEyebrows;
