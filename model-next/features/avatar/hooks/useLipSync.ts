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

function updateMeshMorphs(
  mesh: THREE.SkinnedMesh | undefined,
  targetMorphs: Record<string, number>,
  targetJaw: number,
  smoothingSpeed: number,
  delta: number
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
    inf[jawIdx] = THREE.MathUtils.damp(inf[jawIdx], targetJaw, smoothingSpeed, delta);
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

  // Sequence gate: morphs are only driven when authorizedSeq matches props.sequence
  const authorizedSeqRef = useRef<number>(-1);

  // Keep refs fresh across renders
  useEffect(() => { headRef.current = head; }, [head]);
  useEffect(() => { teethLowerRef.current = teethLower; }, [teethLower]);
  useEffect(() => { lipSyncRef.current = lipSyncData ?? null; }, [lipSyncData]);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);

  // When sequence prop changes, authorize the new sequence
  useEffect(() => {
    if (sequence !== undefined) {
      authorizedSeqRef.current = sequence;
    }
  }, [sequence]);

  const resetMouth = () => {
    resetMeshMorphs(headRef.current);
    resetMeshMorphs(teethLowerRef.current);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
      resetMouth();
    };
  }, []);

  // Update playing state & assert invariant in dev
  useEffect(() => {
    if (play) {
      isPlayingRef.current = true;
      if (process.env.NODE_ENV !== "production" && targetEpochMs === undefined) {
        console.warn(
          "[LipSync Warning] useLipSync rendered with play=true but targetEpochMs is undefined. " +
          "Ensure targetEpochMs is threaded from scheduleAudioPlayback."
        );
      }
    } else {
      // Do not reset morph weights synchronously here. The useFrame loop below
      // already damps every viseme/jaw target toward zero while not playing.
      // Keeping this transition frame-driven avoids a visible mouth/face pop.
      isPlayingRef.current = false;
    }
  }, [play, targetEpochMs]);

  // ── Animation frame — drive morph targets strictly from timeline ──
  useFrame((_, delta) => {
    const data = lipSyncRef.current;
    const headMesh = headRef.current;
    const teethMesh = teethLowerRef.current;

    // ── Sequence gate ──────────────────────────────────────────────────────
    if (
      sequence !== undefined &&
      authorizedSeqRef.current !== -1 &&
      sequence !== authorizedSeqRef.current
    ) {
      if (headMesh) updateMeshMorphs(headMesh, {}, 0, LIP_SYNC_CONFIG.smoothingSpeed, delta);
      if (teethMesh) updateMeshMorphs(teethMesh, {}, 0, LIP_SYNC_CONFIG.smoothingSpeed, delta);
      return;
    }

    if (!data || !headMesh || !isPlayingRef.current) {
      if (headMesh) updateMeshMorphs(headMesh, {}, 0, LIP_SYNC_CONFIG.smoothingSpeed, delta);
      if (teethMesh) updateMeshMorphs(teethMesh, {}, 0, LIP_SYNC_CONFIG.smoothingSpeed, delta);
      return;
    }

    // ── Compute timeline playback position ─────────────────────────────────
    let currentTimeMs = 0;
    if (targetEpochMs !== undefined) {
      currentTimeMs = getSynchronizedEpochMs() - targetEpochMs;
      // Before scheduled start: keep mouth at rest
      if (currentTimeMs < 0) {
        if (headMesh) updateMeshMorphs(headMesh, {}, 0, LIP_SYNC_CONFIG.smoothingSpeed, delta);
        if (teethMesh) updateMeshMorphs(teethMesh, {}, 0, LIP_SYNC_CONFIG.smoothingSpeed, delta);
        return;
      }
    }

    // ── Viseme lookup ──────────────────────────────────────────────────────
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

    updateMeshMorphs(headMesh, targetMorphs, targetJaw, LIP_SYNC_CONFIG.smoothingSpeed, delta);
    updateMeshMorphs(teethMesh, targetMorphs, targetJaw, LIP_SYNC_CONFIG.smoothingSpeed, delta);
  });
}
