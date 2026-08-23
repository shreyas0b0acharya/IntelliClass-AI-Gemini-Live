"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useAvatarBehavior } from "./AvatarBehaviorContext";

interface AvatarLipsProps {
    head?: THREE.SkinnedMesh;
}

export default function AvatarLips({ head }: AvatarLipsProps) {
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

        const targets = behaviorRef.current.lips;
        const smoothing = 1 - Math.exp(-6.5 * Math.min(delta, 0.1));

        updateMorph(mesh, "mouthPressLeft", targets.mouthPressLeft, smoothing);
        updateMorph(mesh, "mouthPressRight", targets.mouthPressRight, smoothing);
        updateMorph(mesh, "mouthRollLower", targets.mouthRollLower, smoothing);
        updateMorph(mesh, "mouthRollUpper", targets.mouthRollUpper, smoothing);
        updateMorph(mesh, "mouthClose", targets.mouthClose, smoothing);
        updateMorph(mesh, "mouthPucker", targets.mouthPucker, smoothing);
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
