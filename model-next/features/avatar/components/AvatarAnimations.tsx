"use client";

import React, {
  useEffect,
  useRef,
  useState,
} from "react";
import { useFrame } from "@react-three/fiber";
import { useFBX } from "@react-three/drei";
import * as THREE from "three";
import { AnimationLoader } from "@/components/shared";

interface AvatarAnimationsProps {
  modelName: string;
  animation?: string;
  group: React.RefObject<THREE.Group | null>;
  onReady?: () => void;
}

export function AvatarAnimations({
  modelName,
  animation = "weight shift",
  group,
  onReady,
}: AvatarAnimationsProps) {
  const currentTargetAnim = animation || "weight shift";

  // Only load animations that are actively requested or predicted
  const [loadedAnimMap, setLoadedAnimMap] = useState<Map<string, string>>(() => {
    const initialMap = new Map<string, string>();
    initialMap.set(currentTargetAnim, `/animations/${modelName}/${currentTargetAnim}.fbx`);
    return initialMap;
  });

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Map<string, THREE.AnimationAction>>(new Map());
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const currentAnimNameRef = useRef<string | null>(null);

  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  const animationRef = useRef(currentTargetAnim);
  useEffect(() => {
    animationRef.current = currentTargetAnim;
  }, [currentTargetAnim]);

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
   * On-demand dynamic loading: when target animation changes, load ONLY that clip
   */
  useEffect(() => {
    if (!currentTargetAnim || currentTargetAnim.toLowerCase() === "none") {
      return;
    }

    setLoadedAnimMap((prev) => {
      if (prev.has(currentTargetAnim)) return prev;
      const nextMap = new Map(prev);
      nextMap.set(currentTargetAnim, `/animations/${modelName}/${currentTargetAnim}.fbx`);
      return nextMap;
    });
  }, [currentTargetAnim, modelName]);

  /*
   * Play an animation action with smooth cross-fading
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
    const targetAnim = currentTargetAnim || "None";
    playActionRef.current(targetAnim, false);
  }, [currentTargetAnim]);

  const animEntries = Array.from(loadedAnimMap.entries());

  return (
    <React.Suspense fallback={null}>
      {animEntries.map(([name, path]) => (
        <AnimationLoader
          key={`${modelName}-${name}`}
          path={path}
          name={name}
          onLoad={handleClipLoad}
        />
      ))}
    </React.Suspense>
  );
}

export default AvatarAnimations;
