"use client";

import { useFBX } from "@react-three/drei";
import { useEffect, useRef } from "react";
import * as THREE from "three";

interface AnimationLoaderProps {
    path: string;
    name: string;
    onLoad: (clip: THREE.AnimationClip) => void;
}

export default function AnimationLoader({
    path,
    name,
    onLoad,
}: AnimationLoaderProps) {
    const { animations } = useFBX(path);
    const onLoadRef = useRef(onLoad);

    useEffect(() => {
        onLoadRef.current = onLoad;
    }, [onLoad]);

    useEffect(() => {
        const sourceClip = animations[0];

        if (!sourceClip) return;

        const clip = sourceClip.clone();
        clip.name = name;
        // Filter out end bones and eye bones so procedural eye movements are not overridden
        clip.tracks = clip.tracks.filter((track) => {
            const trackName = track.name.toLowerCase();
            return (
                !track.name.includes("_end") &&
                !trackName.includes("lefteye") &&
                !trackName.includes("righteye") &&
                !trackName.includes("eyeleft") &&
                !trackName.includes("eyeright")
            );
        });

        onLoadRef.current(clip);
    }, [animations, name]);

    return null;
}