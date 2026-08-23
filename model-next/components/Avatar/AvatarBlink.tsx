"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useAvatarBehavior } from "./AvatarBehaviorContext";

interface AvatarBlinkProps {
    head?: THREE.SkinnedMesh;
    eyelashes?: THREE.SkinnedMesh;
}

export default function AvatarBlink({
    head,
    eyelashes,
}: AvatarBlinkProps) {
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
        const headMesh = headRef.current;
        const eyelashesMesh = eyelashesRef.current;
        const blinkProgress = behaviorRef.current.blink.blinkProgress;

        const smoothing = 1 - Math.exp(-22 * Math.min(delta, 0.1));

        updateBlink(headMesh, blinkProgress, smoothing);
        updateBlink(eyelashesMesh, blinkProgress, smoothing);
    });

    return null;
}

function updateBlink(
    mesh: THREE.SkinnedMesh | undefined,
    target: number,
    smoothing: number
) {
    if (!mesh?.morphTargetDictionary || !mesh.morphTargetInfluences) {
        return;
    }

    updateMorph(mesh, "eyeBlinkLeft", target, smoothing);
    updateMorph(mesh, "eyeBlinkRight", target, smoothing);
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