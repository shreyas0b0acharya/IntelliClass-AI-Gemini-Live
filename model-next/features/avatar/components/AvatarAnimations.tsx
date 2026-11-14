"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { AnimationLoader } from "@/components/shared";
import { useAvatarBehavior } from "./AvatarBehaviorContext";
import { AvatarBodyLanguageDriver } from "../services/AvatarBodyLanguageDriver";
import { planGestures } from "../services/gesturePlanner";
import { getSynchronizedEpochMs } from "../services/clockSync";
import { createSpeechLayer } from "../types/behavior.types";
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
  // Owns gestures, face / head / gaze cues, blinks, breaths and body language for this avatar.
  const [body] = useState(() => new AvatarBodyLanguageDriver());

  // Deterministic behaviour plan for the sentence being spoken (same text -> same plan on every device).
  const gesturePlan = useMemo(() => {
    if (!speechText && !lipSyncData?.words?.length) return null;
    return planGestures({ text: speechText, lipSync: lipSyncData });
  }, [speechText, lipSyncData]);

  // Hand the plan to the driver together with the synchronized moment its audio starts.
  useEffect(() => {
    if (!gesturePlan) return;
    body.speak(gesturePlan, targetEpochMs, getSynchronizedEpochMs());
  }, [body, gesturePlan, targetEpochMs]);

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

  // Keep this frame order: restore offsets -> advance FBX -> add body language on top.
  useFrame((state, delta) => {
    body.setRoot(group.current);
    body.removePreviousOffsets();
    mixerRef.current?.update(Math.min(delta, 0.1));
    const behavior = behaviorRef.current;
    let layer = behavior.speech;
    if (!layer) {
      layer = createSpeechLayer();
      behavior.speech = layer;
    }
    body.update(
      state.clock.getElapsedTime(),
      delta,
      getSynchronizedEpochMs(),
      behavior.state === "talking",
      layer,
    );
  });

  useEffect(() => {
    const root = group.current;
    const actions = actionsRef.current;
    return () => {
      body.dispose();
      const mixer = mixerRef.current;
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
  }, [body, group]);

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
