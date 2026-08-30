"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { HeadTTSData, LipSyncProps } from "../types/lipSync.types";
import { getMouthConfig, VISEMES, LIP_SYNC_CONFIG } from "../services/lipSync.config";
import {
  getAudioContext,
  unlockAudioContext,
  getOrDecodeAudioBuffer,
  getMasterGainNode,
} from "../services/audioManager";
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
// Hook
// ─────────────────────────────────────────────

export function useLipSync({
  head,
  teethLower,
  audioPath,
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

  // For legacy (non-epoch) timing fallback
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startedAtRef = useRef<number>(0);         // AudioContext time when audio started
  const generationRef = useRef(0);
  const isPlayingRef = useRef(false);

  // Sequence gate: morphs are only driven when authorizedSeq matches props.sequence
  // -1 means "accept anything" (legacy / no sequence provided)
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

  const stopAudio = () => {
    const source = sourceRef.current;
    if (source) {
      try {
        source.onended = null;
        source.stop();
        source.disconnect();
      } catch {}
    }
    sourceRef.current = null;
    isPlayingRef.current = false;
    resetMouth();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopAudio(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Legacy playback path ──
  // Used when NO targetEpochMs is provided (e.g. showcase / preview pages).
  // When targetEpochMs IS provided, scheduling is done externally by
  // scheduleAudioPlayback() in audioManager — we only drive morphs here.
  useEffect(() => {
    // If caller is using the new epoch-scheduled path, skip legacy playback
    if (targetEpochMs !== undefined) return;

    if (!play || !audioPath) {
      stopAudio();
      return;
    }

    const generation = ++generationRef.current;
    let isCancelled = false;

    const playAudio = async () => {
      try {
        unlockAudioContext();
        const ctx = getAudioContext();

        if (ctx.state !== "running") {
          try { await ctx.resume(); } catch {}
        }

        const audioBuffer = await getOrDecodeAudioBuffer(audioPath);
        if (isCancelled || generation !== generationRef.current) return;

        // Stop any previous source
        if (sourceRef.current) {
          try {
            sourceRef.current.onended = null;
            sourceRef.current.stop();
            sourceRef.current.disconnect();
          } catch {}
          sourceRef.current = null;
        }

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(getMasterGainNode());
        sourceRef.current = source;

        source.onended = () => {
          if (generation !== generationRef.current) return;
          sourceRef.current = null;
          isPlayingRef.current = false;
          resetMouth();
          onEndedRef.current?.();
        };

        startedAtRef.current = ctx.currentTime;
        isPlayingRef.current = true;
        source.start(0);
      } catch (error) {
        if (isCancelled) return;
        console.error("[LipSync] Legacy audio playback failed:", error);
        isPlayingRef.current = false;
        resetMouth();
        onEndedRef.current?.();
      }
    };

    void playAudio();
    return () => { isCancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioPath, play, targetEpochMs]);

  // When epoch-scheduled path is used, signal isPlaying based on play prop
  useEffect(() => {
    if (targetEpochMs === undefined) return;
    if (play) {
      isPlayingRef.current = true;
    } else {
      isPlayingRef.current = false;
      resetMouth();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, targetEpochMs]);

  // ── Animation frame — drive morph targets ──
  useFrame((_, delta) => {
    const data = lipSyncRef.current;
    const headMesh = headRef.current;
    const teethMesh = teethLowerRef.current;

    // ── Sequence gate ──────────────────────────────────────────────────────
    // If a sequence is specified and doesn't match the authorized one, keep
    // mouth at rest. This prevents ghost animation from stale/dropped packets.
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

    // ── Compute playback position ──────────────────────────────────────────
    // NEW (epoch-locked): all devices compute the same currentTime
    //   currentTime = getSynchronizedEpochMs() - targetEpochMs
    //   This is wall-clock elapsed ms since the scheduled start, identical
    //   across every device regardless of local JS execution timing.
    //
    // LEGACY (ctx-clock): fallback for preview/showcase without epoch
    //   currentTime = (ctx.currentTime - startedAt) * 1000
    let currentTimeMs: number;

    if (targetEpochMs !== undefined) {
      currentTimeMs = getSynchronizedEpochMs() - targetEpochMs;
      // Before scheduled start: don't animate (avoid showing morphs too early)
      if (currentTimeMs < 0) {
        if (headMesh) updateMeshMorphs(headMesh, {}, 0, LIP_SYNC_CONFIG.smoothingSpeed, delta);
        if (teethMesh) updateMeshMorphs(teethMesh, {}, 0, LIP_SYNC_CONFIG.smoothingSpeed, delta);
        return;
      }
    } else {
      let ctx: AudioContext;
      try { ctx = getAudioContext(); } catch { return; }
      currentTimeMs = (ctx.currentTime - startedAtRef.current) * 1000;
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
