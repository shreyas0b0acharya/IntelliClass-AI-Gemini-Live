"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { HeadTTSData, LipSyncProps } from "../types/lipSync.types";
import { getMouthConfig, VISEMES, LIP_SYNC_CONFIG } from "../services/lipSync.config";
import { getSynchronizedEpochMs } from "../services/clockSync";

// ─────────────────────────────────────────────
// Mesh helpers
// ─────────────────────────────────────────────

function findMorphIndex(dict: Record<string, number>, name: string): number | undefined {
  if (dict[name] !== undefined) return dict[name];
  if (dict[`viseme_${name}`] !== undefined) return dict[`viseme_${name}`];
  const stripped = name.replace(/^viseme_/, "");
  if (dict[stripped] !== undefined) return dict[stripped];
  if (name === "ih" || name === "I") {
    return dict["ih"] ?? dict["viseme_I"] ?? dict["I"] ?? dict["viseme_ih"];
  }
  if (name === "oh" || name === "O") {
    return dict["oh"] ?? dict["viseme_O"] ?? dict["O"] ?? dict["viseme_oh"];
  }
  if (name === "ou" || name === "U") {
    return dict["ou"] ?? dict["viseme_U"] ?? dict["U"] ?? dict["viseme_ou"];
  }
  return undefined;
}

function resetMeshMorphs(mesh: THREE.SkinnedMesh | undefined) {
  if (!mesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences) {
    return;
  }

  const dict = mesh.morphTargetDictionary;
  const inf = mesh.morphTargetInfluences;

  for (const viseme of VISEMES) {
    const idx = findMorphIndex(dict, viseme);
    if (idx !== undefined) {
      inf[idx] = 0;
    }
  }

  const jawIdx = dict["jawOpen"] ?? dict["mouthOpen"];
  if (jawIdx !== undefined) {
    inf[jawIdx] = 0;
  }
}

function updateSingleMeshMorphs(
  mesh: THREE.SkinnedMesh | undefined,
  targetMorphs: Record<string, number>,
  targetJaw: number,
  smoothingSpeed: number,
  delta: number,
  isSpeaking: boolean
) {
  if (!mesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences) {
    return;
  }

  const dict = mesh.morphTargetDictionary;
  const inf = mesh.morphTargetInfluences;

  // Hard clamp jaw target to realistic conversational maximum
  const clampedTargetJaw = Math.min(targetJaw, LIP_SYNC_CONFIG.maxJawSpeech);

  for (const viseme of VISEMES) {
    const idx = findMorphIndex(dict, viseme);
    if (idx !== undefined) {
      const target = targetMorphs[viseme] ?? 0;
      inf[idx] = THREE.MathUtils.damp(inf[idx], target, smoothingSpeed, delta);
    }
  }

  const jawIdx = dict["jawOpen"] ?? dict["mouthOpen"];
  if (jawIdx !== undefined) {
    // Asymmetric jaw smoothing: responsive attack, smooth organic release to prevent jitter
    const currentJaw = inf[jawIdx];
    const speed =
      clampedTargetJaw > currentJaw
        ? smoothingSpeed * LIP_SYNC_CONFIG.attackMultiplier
        : smoothingSpeed * LIP_SYNC_CONFIG.releaseMultiplier;
    inf[jawIdx] = THREE.MathUtils.damp(currentJaw, clampedTargetJaw, speed, delta);
  }

  // Ensure mouthClose and mouthPress are dampened to 0 while speaking so lips are never clamped shut
  if (isSpeaking || clampedTargetJaw > 0.02) {
    const clampedMorphs = [
      "mouthClose",
      "mouthPressLeft",
      "mouthPressRight",
      "mouthRollLower",
      "mouthRollUpper",
    ];
    for (const morph of clampedMorphs) {
      const idx = dict[morph];
      if (idx !== undefined) {
        inf[idx] = THREE.MathUtils.damp(inf[idx], 0, smoothingSpeed * 1.5, delta);
      }
    }
  }
}

function updateMeshMorphs(
  headMesh: THREE.SkinnedMesh | undefined,
  teethMesh: THREE.SkinnedMesh | undefined,
  targetMorphs: Record<string, number>,
  targetJaw: number,
  smoothingSpeed: number,
  delta: number,
  isSpeaking: boolean = false
) {
  updateSingleMeshMorphs(headMesh, targetMorphs, targetJaw, smoothingSpeed, delta, isSpeaking);
  updateSingleMeshMorphs(teethMesh, targetMorphs, targetJaw, smoothingSpeed, delta, isSpeaking);
  syncTeethWithHead(teethMesh, headMesh);
}

/**
 * Synchronize lower teeth morph targets in 100% lockstep with the head's jaw and lips.
 * Whenever the jaw opens or the mouth forms vowels/visemes, the lower teeth set follows
 * the lower jaw and lips with zero lag or detachment.
 */
function syncTeethWithHead(
  teethMesh: THREE.SkinnedMesh | undefined,
  headMesh: THREE.SkinnedMesh | undefined
) {
  if (
    !teethMesh ||
    !teethMesh.morphTargetDictionary ||
    !teethMesh.morphTargetInfluences ||
    !headMesh ||
    !headMesh.morphTargetDictionary ||
    !headMesh.morphTargetInfluences
  ) {
    return;
  }

  const hDict = headMesh.morphTargetDictionary;
  const hInf = headMesh.morphTargetInfluences;
  const tDict = teethMesh.morphTargetDictionary;
  const tInf = teethMesh.morphTargetInfluences;

  // Mirror every corresponding morph target that exists on teethMesh from headMesh
  for (const name in tDict) {
    const tIdx = tDict[name];
    if (tIdx === undefined) continue;

    const hIdx = findMorphIndex(hDict, name);
    if (hIdx !== undefined) {
      tInf[tIdx] = hInf[hIdx];
    }
  }
}

// ─────────────────────────────────────────────
// Pure Visual 3D Lip-Sync Driver Hook
// ─────────────────────────────────────────────
// Hard Invariant: useLipSync NEVER creates an AudioBufferSourceNode or plays audio.
// Audio playback is 100% owned by audioManager.scheduleAudioPlayback().

export function useLipSync({
  head,
  teethLower,
  lipSyncData,
  play,
  onEnded,
  targetEpochMs,
  sequence,
}: LipSyncProps) {
  const headRef = useRef<THREE.SkinnedMesh | undefined>(head);
  const teethLowerRef = useRef<THREE.SkinnedMesh | undefined>(teethLower);
  const lipSyncRef = useRef<HeadTTSData | null>(lipSyncData ?? null);
  const onEndedRef = useRef<(() => void) | undefined>(onEnded);
  const isPlayingRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const localElapsedMsRef = useRef<number>(0);
  const endedCalledRef = useRef<boolean>(false);

  // Keep refs fresh across renders
  useEffect(() => { headRef.current = head; }, [head]);
  useEffect(() => { teethLowerRef.current = teethLower; }, [teethLower]);
  useEffect(() => { lipSyncRef.current = lipSyncData ?? null; }, [lipSyncData]);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);

  const resetMouth = () => {
    const h = headRef.current ?? head;
    const t = teethLowerRef.current ?? teethLower;
    resetMeshMorphs(h);
    resetMeshMorphs(t);
    syncTeethWithHead(t, h);
  };

  // Reset timers on each new sequence or speech packet arrives
  useEffect(() => {
    localElapsedMsRef.current = 0;
    endedCalledRef.current = false;
  }, [sequence, targetEpochMs, lipSyncData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
      resetMouth();
    };
  }, []);

  // Update playing state
  useEffect(() => {
    if (play) {
      isPlayingRef.current = true;
      if (!wasPlayingRef.current) {
        localElapsedMsRef.current = 0;
        endedCalledRef.current = false;
      }
    } else {
      isPlayingRef.current = false;
      localElapsedMsRef.current = 0;
      endedCalledRef.current = false;
    }
    wasPlayingRef.current = play;
  }, [play]);

  // ── Animation frame — drive morph targets from timeline or procedural talking ──
  useFrame((state, delta) => {
    const data = lipSyncData ?? lipSyncRef.current;
    const headMesh = head ?? headRef.current;
    const teethMesh = teethLower ?? teethLowerRef.current;

    if (!headMesh) return;

    const isPlaying = play || isPlayingRef.current;

    if (!isPlaying) {
      updateMeshMorphs(headMesh, teethMesh, {}, 0, LIP_SYNC_CONFIG.smoothingSpeed, delta, false);
      return;
    }

    const count = Math.min(
      data?.visemes?.length ?? 0,
      data?.vtimes?.length ?? 0,
      data?.vdurations?.length ?? 0
    );

    // ── Fallback: If no pre-computed viseme data or viseme array empty, drive gentle conversational cadence ──
    if (!data || count === 0) {
      const t = state.clock.getElapsedTime();
      // Conversational syllable cadence (~3.2 Hz natural speaking rhythm + subtle sub-harmonics)
      const syllable = Math.max(0, Math.sin(t * 12.0) * 0.6 + Math.sin(t * 6.5) * 0.4);
      const emphasis = Math.sin(t * 2.8) > 0.3 ? 1.15 : 0.85;
      // Gentle conversational jaw drop: 0.02 to 0.22 max (never wide gaping)
      const targetJaw = THREE.MathUtils.clamp(syllable * 0.18 * emphasis, 0.02, 0.22);

      const targetMorphs: Record<string, number> = {
        aa: THREE.MathUtils.clamp(syllable * 0.22, 0.02, 0.24),
        E: THREE.MathUtils.clamp(Math.sin(t * 14.0) * 0.15, 0, 0.18),
        ou: THREE.MathUtils.clamp(Math.cos(t * 9.0) * 0.12, 0, 0.15),
      };

      updateMeshMorphs(headMesh, teethMesh, targetMorphs, targetJaw, LIP_SYNC_CONFIG.smoothingSpeed, delta, true);
      return;
    }

    const totalDurationMs = data.vtimes[count - 1] + data.vdurations[count - 1];

    // ── Compute timeline playback position with clock skew resilience ────────
    let currentTimeMs = 0;
    if (targetEpochMs !== undefined && targetEpochMs > 0) {
      const syncTime = getSynchronizedEpochMs() - targetEpochMs;
      // Clock skew resilience: if syncTime is unreasonably past the speech duration (> duration + 800ms)
      // or excessively ahead of time (< -1000ms), seamlessly fall back to local delta timer
      if (syncTime < -1000 || (totalDurationMs > 0 && syncTime > totalDurationMs + 800)) {
        localElapsedMsRef.current += delta * 1000;
        currentTimeMs = localElapsedMsRef.current;
      } else if (syncTime < 0) {
        // Normal pre-roll window before scheduled audio: keep mouth at resting neutral
        updateMeshMorphs(headMesh, teethMesh, {}, 0, LIP_SYNC_CONFIG.smoothingSpeed, delta, false);
        return;
      } else {
        currentTimeMs = syncTime;
      }
    } else {
      localElapsedMsRef.current += delta * 1000;
      currentTimeMs = localElapsedMsRef.current;
    }

    // ── Continuous Speech Jaw Envelope & Viseme Lookup ────────────────────
    const firstVisemeStart = count > 0 ? data.vtimes[0] : 0;
    const lastVisemeEnd = totalDurationMs;
    const isWithinSpeechWindow =
      currentTimeMs >= Math.max(0, firstVisemeStart - 50) && currentTimeMs <= lastVisemeEnd + 100;

    let targetJaw = 0;
    const targetMorphs: Record<string, number> = {};

    for (let i = 0; i < count; i++) {
      const start = data.vtimes[i];
      const end = start + data.vdurations[i];

      // Smooth coarticulation blend window (+- 45ms envelope overlap with smooth cosine ease)
      const blendWindowMs = 45;
      if (currentTimeMs >= start - blendWindowMs && currentTimeMs <= end + blendWindowMs) {
        const rawViseme = data.visemes[i];
        const config = getMouthConfig(rawViseme);
        if (!config) continue;

        let weight = 1.0;
        if (currentTimeMs < start) {
          const ratio = (currentTimeMs - (start - blendWindowMs)) / blendWindowMs;
          weight = 0.5 - 0.5 * Math.cos(ratio * Math.PI); // Smooth S-curve ease-in
        } else if (currentTimeMs > end) {
          const ratio = (end + blendWindowMs - currentTimeMs) / blendWindowMs;
          weight = 0.5 - 0.5 * Math.cos(ratio * Math.PI); // Smooth S-curve ease-out
        }

        if (config.morph) {
          const morphTarget = LIP_SYNC_CONFIG.visemeIntensity * weight;
          targetMorphs[config.morph] = Math.max(targetMorphs[config.morph] ?? 0, morphTarget);
        }
        targetJaw = Math.max(
          targetJaw,
          Math.min(config.jawOpen * weight, LIP_SYNC_CONFIG.maxJawSpeech)
        );
      }
    }

    // Normalize overlapping morph weights to prevent unnatural mesh inflation
    let totalMorphWeight = 0;
    for (const v in targetMorphs) {
      totalMorphWeight += targetMorphs[v];
    }
    if (totalMorphWeight > 0.85) {
      const scale = 0.85 / totalMorphWeight;
      for (const v in targetMorphs) {
        targetMorphs[v] *= scale;
      }
    }

    updateMeshMorphs(
      headMesh,
      teethMesh,
      targetMorphs,
      targetJaw,
      LIP_SYNC_CONFIG.smoothingSpeed,
      delta,
      isWithinSpeechWindow
    );

    // End of viseme sequence handling (only trigger onEnded if not externally synchronized by Web Audio)
    if (totalDurationMs > 0 && currentTimeMs >= totalDurationMs + 100) {
      if (!endedCalledRef.current) {
        endedCalledRef.current = true;
        // Only invoke onEnded for standalone visual preview without audioManager
        if (targetEpochMs === undefined) {
          onEndedRef.current?.();
        }
      }
    }
  });
}
