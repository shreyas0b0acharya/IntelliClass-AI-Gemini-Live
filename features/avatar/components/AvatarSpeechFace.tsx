"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useAvatarBehavior } from "./AvatarBehaviorContext";

interface AvatarSpeechFaceProps {
  head?: THREE.SkinnedMesh;
  eyelashes?: THREE.SkinnedMesh;
}

/**
 * Face morphs that only the speech layer drives (nothing else in the avatar
 * touches them): wide / narrowed eyes and lip-corner frown. Everything else the
 * speech layer does to the face (brows, smile, cheeks, lip press) is added to the
 * targets of the existing face components, so their smoothing stays in charge.
 *
 * The layer values are already smoothed by the speech driver, so they are
 * written straight to the morph targets. Models that lack a morph are skipped.
 */
export function AvatarSpeechFace({ head, eyelashes }: AvatarSpeechFaceProps) {
  const behaviorRef = useAvatarBehavior();
  const headRef = useRef<THREE.SkinnedMesh | undefined>(head);
  const eyelashesRef = useRef<THREE.SkinnedMesh | undefined>(eyelashes);

  useEffect(() => {
    headRef.current = head;
  }, [head]);

  useEffect(() => {
    eyelashesRef.current = eyelashes;
  }, [eyelashes]);

  useFrame(() => {
    const speech = behaviorRef.current.speech;
    if (!speech) return;

    for (const mesh of [headRef.current, eyelashesRef.current]) {
      if (!mesh?.morphTargetDictionary || !mesh.morphTargetInfluences) continue;
      setMorph(mesh, "eyeWideLeft", speech.eyeWide);
      setMorph(mesh, "eyeWideRight", speech.eyeWide);
      setMorph(mesh, "eyeSquintLeft", speech.eyeSquint);
      setMorph(mesh, "eyeSquintRight", speech.eyeSquint);
      setMorph(mesh, "mouthFrownLeft", speech.mouthFrown);
      setMorph(mesh, "mouthFrownRight", speech.mouthFrown);
    }
  });

  return null;
}

function setMorph(mesh: THREE.SkinnedMesh, morphName: string, value: number) {
  const index = mesh.morphTargetDictionary?.[morphName];
  if (index === undefined || !mesh.morphTargetInfluences) return;
  mesh.morphTargetInfluences[index] = THREE.MathUtils.clamp(value, 0, 1);
}

export default AvatarSpeechFace;
