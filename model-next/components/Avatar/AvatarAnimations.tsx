"use client";

import React, {
    useEffect,
    useRef,
    useState,
} from "react";

import { useFrame } from "@react-three/fiber";
import { useFBX } from "@react-three/drei";
import * as THREE from "three";

import AnimationLoader from "../AnimationLoader";

interface AvatarAnimationsProps {
    modelName: string;
    animation?: string;
    group: React.RefObject<THREE.Group | null>;
    onReady?: () => void;
}

export default function AvatarAnimations({
    modelName,
    animation = "weight shift",
    group,
    onReady,
}: AvatarAnimationsProps) {
    // Start with default weight shift in list immediately so it loads in parallel with model
    const [animList, setAnimList] = useState<
        {
            name: string;
            path: string;
        }[]
    >([
        {
            name: "weight shift",
            path: `/animations/${modelName}/weight shift.fbx`,
        },
    ]);

    const mixerRef = useRef<THREE.AnimationMixer | null>(null);
    const actionsRef = useRef<Map<string, THREE.AnimationAction>>(new Map());
    const currentActionRef = useRef<THREE.AnimationAction | null>(null);
    const currentAnimNameRef = useRef<string | null>(null);

    const onReadyRef = useRef(onReady);
    useEffect(() => {
        onReadyRef.current = onReady;
    }, [onReady]);

    const animationRef = useRef(animation);
    useEffect(() => {
        animationRef.current = animation;
    }, [animation]);

    const getMixer = () => {
        if (!mixerRef.current && group.current) {
            mixerRef.current = new THREE.AnimationMixer(group.current);
        }
        return mixerRef.current;
    };

    /*
     * Drive animation mixer updates on every frame
     */
    useFrame((_, delta) => {
        mixerRef.current?.update(delta);
    });

    /*
     * Clean up mixer on unmount
     */
    useEffect(() => {
        const root = group.current;
        const actions = actionsRef.current;
        const mixer = mixerRef.current;

        return () => {
            if (mixer && root) {
                mixer.stopAllAction();
                actions.forEach((action) => {
                    mixer.uncacheAction(action.getClip(), root);
                });
                actions.clear();
                mixerRef.current = null;
                currentActionRef.current = null;
                currentAnimNameRef.current = "None";
            }
        };
    }, [group]);

    /*
     * Fetch list of available animation files for this avatar model
     */
    useEffect(() => {
        let cancelled = false;

        fetch(`/api/animations/${modelName}`)
            .then((res) => {
                if (!res.ok) {
                    throw new Error("Failed to load animation manifest");
                }
                return res.json();
            })
            .then((data) => {
                if (!cancelled && Array.isArray(data)) {
                    setAnimList((prev) => {
                        const existingPaths = new Set(prev.map((p) => p.path));
                        const additions = data.filter(
                            (d: { path: string }) => !existingPaths.has(d.path)
                        );
                        return [...prev, ...additions];
                    });
                }
            })
            .catch((error) => {
                console.error("Error loading animation list:", error);
            });

        return () => {
            cancelled = true;
        };
    }, [modelName]);

    /*
     * Play an animation action
     */
    const playAction = (targetAnim: string, isFirst = false) => {
        if (!targetAnim || targetAnim.toLowerCase() === "none") {
            if (currentActionRef.current) {
                currentActionRef.current.fadeOut(0.3);
                currentActionRef.current = null;
                currentAnimNameRef.current = "None";
            }
            onReadyRef.current?.();
            return;
        }

        const mixer = getMixer();
        const nextAction = actionsRef.current.get(targetAnim);

        if (!nextAction || !mixer) return;

        if (
            currentAnimNameRef.current === targetAnim &&
            currentActionRef.current?.isRunning()
        ) {
            return;
        }

        const prevAction = currentActionRef.current;
        currentActionRef.current = nextAction;
        currentAnimNameRef.current = targetAnim;

        if (isFirst || !prevAction) {
            nextAction.reset().play();
            mixer.update(0);
            onReadyRef.current?.();
        } else {
            nextAction.reset().fadeIn(0.3).play();
            if (prevAction !== nextAction) {
                prevAction.fadeOut(0.3);
            }
        }
    };

    const playActionRef = useRef(playAction);
    useEffect(() => {
        playActionRef.current = playAction;
    });

    /*
     * Handle clip loaded from FBX without interrupting currently playing animation
     */
    const handleClipLoad = (clip: THREE.AnimationClip) => {
        const root = group.current;
        const mixer = getMixer();
        if (!mixer || !root) return;

        let action = actionsRef.current.get(clip.name);
        if (!action) {
            action = mixer.clipAction(clip, root);
            actionsRef.current.set(clip.name, action);
        }

        const targetAnim = animationRef.current;
        if (!targetAnim || targetAnim.toLowerCase() === "none") {
            onReadyRef.current?.();
            return;
        }

        // If this is the target animation and nothing is active yet, play it immediately!
        if (clip.name === targetAnim && !currentActionRef.current) {
            playActionRef.current(clip.name, true);
        }
    };

    /*
     * Handle animation prop changes (e.g. user switching gestures)
     */
    useEffect(() => {
        const targetAnim = animation || "None";
        playActionRef.current(targetAnim, false);
    }, [animation]);

    return (
        <React.Suspense fallback={null}>
            {animList.map((anim) => (
                <AnimationLoader
                    key={`${modelName}-${anim.path}`}
                    path={anim.path}
                    name={anim.name}
                    onLoad={handleClipLoad}
                />
            ))}
        </React.Suspense>
    );
}

useFBX.preload("/animations/men-avatarsdk/weight shift.fbx");
useFBX.preload("/animations/women-avatarsdk/weight shift.fbx");