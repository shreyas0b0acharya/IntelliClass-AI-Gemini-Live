"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { AnimationLoader } from "@/components/shared";
import { useAvatarBehavior } from "./AvatarBehaviorContext";
import { AvatarHandGestureDriver } from "../services/AvatarHandGestureDriver";
import { planGestures } from "../services/gesturePlanner";
import { getSynchronizedEpochMs } from "../services/clockSync";
import type { LipSyncData } from "../types/lipSync.types";

interface AvatarAnimationsProps {
  modelName: string;
  animation?: string;
  group: React.RefObject<THREE.Group | null>;
  onReady?: () => void;
  /** Spoken text + word timings let gestures follow the actual speech. */
  speechText?: string;
  lipSyncData?: LipSyncData;
  targetEpochMs?: number;
}

export function AvatarAnimations({
  modelName,
  animation = "weight shift",
  group,
  onReady,
  speechText,
  lipSyncData,
  targetEpochMs,
}: AvatarAnimationsProps) {
  const currentTargetAnim = animation || "weight shift";
  const behaviorRef = useAvatarBehavior();
  const gestureDriverRef = useRef<AvatarHandGestureDriver | null>(null);

  if (!gestureDriverRef.current) {
    gestureDriverRef.current = new AvatarHandGestureDriver();
  }

  // Deterministic gesture timeline for the sentence being spoken.
  const gesturePlan = useMemo(() => {
    if (!speechText && !lipSyncData?.words?.length) return null;
    return planGestures({ text: speechText, lipSync: lipSyncData });
  }, [speechText, lipSyncData]);

  const targetEpochRef = useRef(targetEpochMs);
  useEffect(() => {
    targetEpochRef.current = targetEpochMs;
  }, [targetEpochMs]);

  useEffect(() => {
    gestureDriverRef.current?.setSpeech(gesturePlan);
  }, [gesturePlan]);

  const [loadedAnimMap, setLoadedAnimMap] = useState<Map<string, string>>(() => {
    const initial = new Map<string, string>();
    initial.set(currentTargetAnim, `/animations/${modelName}/${currentTargetAnim}.fbx`);
    return initial;
  });

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Map<string, THREE.AnimationAction>>(new Map());
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const currentAnimNameRef = useRef<string | null>(null);
  const onReadyRef = useRef(onReady);
  const animationRef = useRef(currentTargetAnim);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    animationRef.current = currentTargetAnim;
  }, [currentTargetAnim]);

  const getMixer = () => {
    if (!mixerRef.current && group.current) {
      mixerRef.current = new THREE.AnimationMixer(group.current);
    }
    return mixerRef.current;
  };

  // Keep this frame order: restore offsets -> advance FBX -> add hand gestures.
  useFrame((state, delta) => {
    const driver = gestureDriverRef.current;
    driver?.setRoot(group.current);
    driver?.removePreviousOffsets();
    mixerRef.current?.update(Math.min(delta, 0.1));
    if (!driver) return;
    const epoch = targetEpochRef.current;
    driver.update(
      state.clock.getElapsedTime(),
      delta,
      behaviorRef.current.state === "talking",
      epoch !== undefined ? getSynchronizedEpochMs() - epoch : undefined,
    );
    const behavior = behaviorRef.current;
    if (behavior.prosody) behavior.prosody.emphasis = driver.prosodyEmphasis;
    else behavior.prosody = { emphasis: driver.prosodyEmphasis };
  });

  useEffect(() => {
    return () => {
      gestureDriverRef.current?.dispose();
      const root = group.current;
      const mixer = mixerRef.current;
      const actions = actionsRef.current;
      if (mixer) {
        mixer.stopAllAction();
        if (root) {
          actions.forEach((action) => mixer.uncacheAction(action.getClip(), root));
        }
        actions.clear();
        mixerRef.current = null;
        currentActionRef.current = null;
        currentAnimNameRef.current = "None";
      }
    };
  }, [group]);

  useEffect(() => {
    if (!currentTargetAnim || currentTargetAnim.toLowerCase() === "none") return;
    queueMicrotask(() => {
      setLoadedAnimMap((previous) => {
        if (previous.has(currentTargetAnim)) return previous;
        const next = new Map(previous);
        next.set(currentTargetAnim, `/animations/${modelName}/${currentTargetAnim}.fbx`);
        return next;
      });
    });
  }, [currentTargetAnim, modelName]);

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
    ) return;

    const previousAction = currentActionRef.current;
    currentActionRef.current = nextAction;
    currentAnimNameRef.current = targetAnim;

    if (isFirst || !previousAction) {
      nextAction.reset().play();
      mixer.update(0);
      onReadyRef.current?.();
    } else {
      nextAction.reset().fadeIn(0.3).play();
      if (previousAction !== nextAction) previousAction.fadeOut(0.3);
    }
  };

  const playActionRef = useRef(playAction);
  useEffect(() => {
    playActionRef.current = playAction;
  });

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

    if (clip.name === targetAnim && !currentActionRef.current) {
      playActionRef.current(clip.name, true);
    }
  };

  useEffect(() => {
    playActionRef.current(currentTargetAnim || "None", false);
  }, [currentTargetAnim]);

  return (
    <React.Suspense fallback={null}>
      {Array.from(loadedAnimMap.entries()).map(([name, path]) => (
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
