// features/avatar/services/AvatarProceduralDriver.ts
//
// High-performance unified procedural animation driver.
// Replaces 12 disjoint React useFrame loops with a single sequential update
// operating purely on mutable typed refs (zero React re-renders).

import * as THREE from "three";
import type { BehaviorStore, BehaviorState } from "../types/behavior.types";
import type { HeadTTSData } from "../types/lipSync.types";
import { getMouthConfig, VISEMES, LIP_SYNC_CONFIG } from "./lipSync.config";
import { getSynchronizedEpochMs } from "./clockSync";

export interface ProceduralDriverNodes {
  headMesh?: THREE.SkinnedMesh;
  teethLowerMesh?: THREE.SkinnedMesh;
  eyelashesMesh?: THREE.SkinnedMesh;
  headBone?: THREE.Bone;
  neckBone?: THREE.Bone;
  spineBone?: THREE.Bone;
  spine1Bone?: THREE.Bone;
  spine2Bone?: THREE.Bone;
  leftShoulderBone?: THREE.Bone;
  rightShoulderBone?: THREE.Bone;
  leftEyeBone?: THREE.Bone;
  rightEyeBone?: THREE.Bone;
}

export interface ProceduralDriverOptions {
  enableProceduralFace: boolean;
  enableEyeMovement: boolean;
  enableBreathing: boolean;
  headFollow?: boolean;
  isAnimated?: boolean;
}

export function createInitialBehaviorStore(initialState: BehaviorState = "idle"): BehaviorStore {
  return {
    state: initialState,
    breathing: {
      chestExpansion: 0,
      shoulderLift: 0,
      neckNod: 0,
      phase: 0,
      stage: "inhale",
    },
    blink: {
      isBlinking: false,
      blinkProgress: 0,
    },
    gaze: {
      target: new THREE.Vector2(0, 0),
      current: new THREE.Vector2(0, 0),
      isHoldingForBlink: false,
      lastSaccadeTime: 0,
    },
    head: {
      target: new THREE.Vector3(0, 0, 0),
      current: new THREE.Vector3(0, 0, 0),
      speed: 2.0,
      drift: new THREE.Vector3(0, 0, 0),
    },
    eyebrows: {
      browInnerUp: 0,
      browOuterUpLeft: 0,
      browOuterUpRight: 0,
      browDownLeft: 0,
      browDownRight: 0,
    },
    cheeks: {
      cheekSquintLeft: 0,
      cheekSquintRight: 0,
      noseSneerLeft: 0,
      noseSneerRight: 0,
      cheekPuff: 0,
    },
    mouthCorners: {
      mouthSmileLeft: 0,
      mouthSmileRight: 0,
      mouthDimpleLeft: 0,
      mouthDimpleRight: 0,
      mouthPressLeft: 0,
      mouthPressRight: 0,
      mouthStretchLeft: 0,
      mouthStretchRight: 0,
    },
    nostrils: {
      noseSneerLeft: 0,
      noseSneerRight: 0,
    },
    lips: {
      mouthPressLeft: 0,
      mouthPressRight: 0,
      mouthRollLower: 0,
      mouthRollUpper: 0,
      mouthClose: 0,
      mouthPucker: 0,
    },
  };
}

/**
 * Executes a single consolidated frame update across procedural physics,
 * eye saccades, breathing, bone rotations, and lip-sync morph targets.
 */
export function updateAvatarProceduralFrame(
  store: BehaviorStore,
  nodes: ProceduralDriverNodes,
  options: ProceduralDriverOptions,
  delta: number,
  time: number,
  mousePos: THREE.Vector2,
  // Lip-sync parameters
  lipSync?: {
    data: HeadTTSData | null;
    isPlaying: boolean;
    targetEpochMs?: number;
    sequence?: number;
    authorizedSeq: number;
  }
): void {
  // Clamp delta to prevent erratic jumps on lag spikes
  const safeDelta = Math.min(delta, 0.1);

  // ── 1. NATURAL BREATHING ──────────────────────────────────────────────────
  if (options.enableBreathing) {
    const isTalking = store.state === "talking";
    const breathSpeed = isTalking ? 1.8 : 0.8;
    store.breathing.phase = (store.breathing.phase + safeDelta * breathSpeed) % (Math.PI * 2);

    const breathWave = Math.sin(store.breathing.phase);
    store.breathing.chestExpansion = (breathWave + 1) * 0.5;
    store.breathing.shoulderLift = Math.max(0, breathWave) * 0.008;
  }

  // ── 2. BLINKING & PROCEDURAL EYE SACCADES ─────────────────────────────────
  if (options.enableProceduralFace) {
    // Periodic blinking cycle
    const blinkInterval = 3.5;
    const blinkDuration = 0.18;
    const blinkPhase = (time % blinkInterval);

    if (blinkPhase < blinkDuration) {
      store.blink.isBlinking = true;
      const progress = Math.sin((blinkPhase / blinkDuration) * Math.PI);
      store.blink.blinkProgress = progress;
    } else {
      store.blink.isBlinking = false;
      store.blink.blinkProgress = 0;
    }

    // Apply eye blink morphs
    if (nodes.headMesh?.morphTargetDictionary && nodes.headMesh?.morphTargetInfluences) {
      const dict = nodes.headMesh.morphTargetDictionary;
      const inf = nodes.headMesh.morphTargetInfluences;
      const blinkLeft = dict["eyeBlinkLeft"];
      const blinkRight = dict["eyeBlinkRight"];
      if (blinkLeft !== undefined) inf[blinkLeft] = store.blink.blinkProgress;
      if (blinkRight !== undefined) inf[blinkRight] = store.blink.blinkProgress;
    }

    if (nodes.eyelashesMesh?.morphTargetDictionary && nodes.eyelashesMesh?.morphTargetInfluences) {
      const dict = nodes.eyelashesMesh.morphTargetDictionary;
      const inf = nodes.eyelashesMesh.morphTargetInfluences;
      const blinkLeft = dict["eyeBlinkLeft"];
      const blinkRight = dict["eyeBlinkRight"];
      if (blinkLeft !== undefined) inf[blinkLeft] = store.blink.blinkProgress;
      if (blinkRight !== undefined) inf[blinkRight] = store.blink.blinkProgress;
    }
  }

  // ── 3. GAZE & EYE BONE TRACKING ───────────────────────────────────────────
  if (options.enableEyeMovement && (nodes.leftEyeBone || nodes.rightEyeBone)) {
    // Subtle natural organic eye micro-saccades
    const gazeDamp = 12;
    store.gaze.target.set(mousePos.x * 0.25, mousePos.y * 0.18);
    store.gaze.current.x = THREE.MathUtils.damp(store.gaze.current.x, store.gaze.target.x, gazeDamp, safeDelta);
    store.gaze.current.y = THREE.MathUtils.damp(store.gaze.current.y, store.gaze.target.y, gazeDamp, safeDelta);

    if (nodes.leftEyeBone) {
      nodes.leftEyeBone.rotation.y = store.gaze.current.x;
      nodes.leftEyeBone.rotation.x = -store.gaze.current.y;
    }
    if (nodes.rightEyeBone) {
      nodes.rightEyeBone.rotation.y = store.gaze.current.x;
      nodes.rightEyeBone.rotation.x = -store.gaze.current.y;
    }
  }

  // ── 4. HEAD TRACKING & ORGANIC DRIFT ──────────────────────────────────────
  if (nodes.headBone && options.headFollow) {
    const headDamp = 4;
    const targetPitch = -mousePos.y * 0.12;
    const targetYaw = mousePos.x * 0.18;

    // Organic living micro-drift
    const driftPitch = Math.sin(time * 0.7) * 0.015;
    const driftYaw = Math.cos(time * 0.5) * 0.02;

    store.head.current.x = THREE.MathUtils.damp(store.head.current.x, targetPitch + driftPitch, headDamp, safeDelta);
    store.head.current.y = THREE.MathUtils.damp(store.head.current.y, targetYaw + driftYaw, headDamp, safeDelta);

    nodes.headBone.rotation.x = store.head.current.x;
    nodes.headBone.rotation.y = store.head.current.y;

    if (nodes.neckBone) {
      nodes.neckBone.rotation.x = store.head.current.x * 0.35;
      nodes.neckBone.rotation.y = store.head.current.y * 0.35;
    }
  }

  // ── 5. SYNCHRONIZED LIP-SYNC MORPHS ───────────────────────────────────────
  const headMesh = nodes.headMesh;
  const teethMesh = nodes.teethLowerMesh;

  if (!headMesh || !headMesh.morphTargetDictionary || !headMesh.morphTargetInfluences) {
    return;
  }

  const dict = headMesh.morphTargetDictionary;
  const inf = headMesh.morphTargetInfluences;

  // If no audio or sequence gated out, smooth mouth to zero
  if (
    !lipSync ||
    !lipSync.isPlaying ||
    !lipSync.data ||
    (lipSync.sequence !== undefined &&
      lipSync.authorizedSeq !== -1 &&
      lipSync.sequence !== lipSync.authorizedSeq)
  ) {
    for (const v of VISEMES) {
      const idx = dict[v];
      if (idx !== undefined && inf[idx] > 0.001) {
        inf[idx] = THREE.MathUtils.damp(inf[idx], 0, LIP_SYNC_CONFIG.smoothingSpeed, safeDelta);
      }
    }
    const jawIdx = dict["jawOpen"];
    if (jawIdx !== undefined && inf[jawIdx] > 0.001) {
      inf[jawIdx] = THREE.MathUtils.damp(inf[jawIdx], 0, LIP_SYNC_CONFIG.smoothingSpeed, safeDelta);
    }
    return;
  }

  // Compute playback position using hardware synchronized epoch time
  let currentTimeMs = 0;
  if (lipSync.targetEpochMs !== undefined) {
    currentTimeMs = getSynchronizedEpochMs() - lipSync.targetEpochMs;
    if (currentTimeMs < 0) return;
  }

  const data = lipSync.data;
  const targetMorphs: Record<string, number> = {};
  let targetJaw = 0;

  const count = Math.min(
    data.visemes?.length ?? 0,
    data.vtimes?.length ?? 0,
    data.vdurations?.length ?? 0
  );

  for (let i = 0; i < count; i++) {
    const start = data.vtimes[i];
    const end = start + data.vdurations[i];

    if (currentTimeMs >= start && currentTimeMs < end) {
      const rawViseme = data.visemes[i];
      const config = getMouthConfig(rawViseme);
      if (!config) continue;

      if (config.morph) {
        targetMorphs[config.morph] = Math.max(
          targetMorphs[config.morph] ?? 0,
          LIP_SYNC_CONFIG.visemeIntensity
        );
      }
      targetJaw = Math.max(targetJaw, config.jawOpen);
    }
  }

  // Batch-apply morphs to Head Mesh
  for (const v of VISEMES) {
    const idx = dict[v];
    if (idx !== undefined) {
      const target = targetMorphs[v] ?? 0;
      inf[idx] = THREE.MathUtils.damp(inf[idx], target, LIP_SYNC_CONFIG.smoothingSpeed, safeDelta);
    }
  }

  const jawIdx = dict["jawOpen"];
  if (jawIdx !== undefined) {
    inf[jawIdx] = THREE.MathUtils.damp(inf[jawIdx], targetJaw, LIP_SYNC_CONFIG.smoothingSpeed, safeDelta);
  }

  // Batch-apply morphs to Teeth Mesh if available
  if (teethMesh && teethMesh.morphTargetDictionary && teethMesh.morphTargetInfluences) {
    const tDict = teethMesh.morphTargetDictionary;
    const tInf = teethMesh.morphTargetInfluences;
    for (const v of VISEMES) {
      const idx = tDict[v];
      if (idx !== undefined) {
        const target = targetMorphs[v] ?? 0;
        tInf[idx] = THREE.MathUtils.damp(tInf[idx], target, LIP_SYNC_CONFIG.smoothingSpeed, safeDelta);
      }
    }
    const tJaw = tDict["jawOpen"];
    if (tJaw !== undefined) {
      tInf[tJaw] = THREE.MathUtils.damp(tInf[tJaw], targetJaw, LIP_SYNC_CONFIG.smoothingSpeed, safeDelta);
    }
  }
}
