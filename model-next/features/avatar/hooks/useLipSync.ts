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

function resetMeshMorphs(mesh: THREE.SkinnedMesh | undefined) {
  if (!mesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences) {
    return;
  }

  const dict = mesh.morphTargetDictionary;
  const inf = mesh.morphTargetInfluences;

  for (const viseme of VISEMES) {
    const idx = dict[viseme];
    if (idx !== undefined) {
      inf[idx] = 0;
    }
  }

  const jawIdx = dict["jawOpen"];
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

  for (const viseme of VISEMES) {
    const idx = dict[viseme];
    if (idx !== undefined) {
      const target = targetMorphs[viseme] ?? 0;
      inf[idx] = THREE.MathUtils.damp(inf[idx], target, smoothingSpeed, delta);
    }
  }

  const jawIdx = dict["jawOpen"];
  if (jawIdx !== undefined) {
    // Asymmetric jaw smoothing: snappy attack when opening, smooth release when closing
    const currentJaw = inf[jawIdx];
    const speed = targetJaw > currentJaw ? smoothingSpeed * 1.35 : smoothingSpeed * 0.75;
    inf[jawIdx] = THREE.MathUtils.damp(currentJaw, targetJaw, speed, delta);
  }

  // Ensure mouthClose and mouthPress are dampened to 0 while speaking so lips are never clamped shut
  if (isSpeaking || targetJaw > 0.02) {
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

    const hIdx =
      hDict[name] !== undefined
        ? hDict[name]
        : hDict[`viseme_${name}`] !== undefined
        ? hDict[`viseme_${name}`]
        : hDict[name.replace(/^viseme_/, "")];

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

    // ── Fallback: If no pre-computed viseme data or viseme array empty, drive lively conversational syllable cadence ──
    if (!data || count === 0) {
      const t = state.clock.getElapsedTime();
      // Conversational syllable cadence (~3.5 Hz primary rhythm + modulation)
      const syllable = Math.max(0, Math.sin(t * 14.0) * 0.65 + Math.sin(t * 7.5) * 0.35);
      const emphasis = Math.sin(t * 3.2) > 0.2 ? 1.25 : 0.85;
      const targetJaw = THREE.MathUtils.clamp(syllable * 0.48 * emphasis, 0.12, 0.60);

      const targetMorphs: Record<string, number> = {
        aa: THREE.MathUtils.clamp(syllable * 0.55, 0.08, 0.65),
        E: THREE.MathUtils.clamp(Math.sin(t * 16.0) * 0.40, 0, 0.45),
        ou: THREE.MathUtils.clamp(Math.cos(t * 11.0) * 0.35, 0, 0.40),
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

    // Base conversational jaw keeps mouth naturally parted throughout spoken phrases
    const baseSpeechJaw = isWithinSpeechWindow ? 0.22 : 0;
    let targetJaw = baseSpeechJaw;
    const targetMorphs: Record<string, number> = {};

    for (let i = 0; i < count; i++) {
      const start = data.vtimes[i];
      const end = start + data.vdurations[i];

      // Smooth coarticulation blend window (+- 30ms envelope overlap)
      if (currentTimeMs >= start - 30 && currentTimeMs <= end + 30) {
        const rawViseme = data.visemes[i];
        const config = getMouthConfig(rawViseme);
        if (!config) continue;

        let weight = 1.0;
        if (currentTimeMs < start) {
          weight = Math.max(0, (currentTimeMs - (start - 30)) / 30);
        } else if (currentTimeMs > end) {
          weight = Math.max(0, (end + 30 - currentTimeMs) / 30);
        }

        if (config.morph) {
          const morphTarget = LIP_SYNC_CONFIG.visemeIntensity * weight;
          targetMorphs[config.morph] = Math.max(targetMorphs[config.morph] ?? 0, morphTarget);
        }
        targetJaw = Math.max(targetJaw, config.jawOpen * weight, baseSpeechJaw);
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
