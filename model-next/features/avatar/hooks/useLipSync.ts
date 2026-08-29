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
      inf[idx] = THREE.MathUtils.damp(
        inf[idx],
        target,
        smoothingSpeed,
        delta
      );
    }
  }

  const jawIdx = dict["jawOpen"];
  if (jawIdx !== undefined) {
    inf[jawIdx] = THREE.MathUtils.damp(
      inf[jawIdx],
      targetJaw,
      smoothingSpeed,
      delta
    );
  }
}

export function useLipSync({
  head,
  teethLower,
  audioPath,
  lipSyncData,
  play,
  onEnded,
}: LipSyncProps) {
  const headRef = useRef<THREE.SkinnedMesh | undefined>(head);
  const teethLowerRef = useRef<THREE.SkinnedMesh | undefined>(teethLower);
  const lipSyncRef = useRef<HeadTTSData | null>(lipSyncData ?? null);
  const onEndedRef = useRef<(() => void) | undefined>(onEnded);

  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startedAtRef = useRef<number>(0);
  const generationRef = useRef(0);
  const isPlayingRef = useRef(false);

  // Keep mesh and prop refs fresh across renders
  useEffect(() => {
    headRef.current = head;
  }, [head]);

  useEffect(() => {
    teethLowerRef.current = teethLower;
  }, [teethLower]);

  useEffect(() => {
    lipSyncRef.current = lipSyncData ?? null;
  }, [lipSyncData]);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

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
    return () => {
      stopAudio();
    };
  }, []);

  // Load and play audio via persistent AudioContext
  useEffect(() => {
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
          try {
            await ctx.resume();
          } catch {}
        }

        const audioBuffer = await getOrDecodeAudioBuffer(audioPath);

        if (isCancelled || generation !== generationRef.current) {
          return;
        }

        // Stop any previous playing buffer source
        if (sourceRef.current) {
          try {
            sourceRef.current.onended = null;
            sourceRef.current.stop();
            sourceRef.current.disconnect();
          } catch {}
          sourceRef.current = null;
        }

        // Create and connect new buffer source with master gain
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

        const startTime = ctx.currentTime;
        startedAtRef.current = startTime;
        isPlayingRef.current = true;

        source.start(0);
        console.log("[LipSync] Web Audio playing iteration", generation, audioPath);
      } catch (error) {
        if (isCancelled) return;
        console.error("[LipSync] Audio playback failed:", error);
        isPlayingRef.current = false;
        resetMouth();
        onEndedRef.current?.();
      }
    };

    void playAudio();

    return () => {
      isCancelled = true;
    };
  }, [audioPath, play]);

  // Lip-sync animation frame
  useFrame((_, delta) => {
    const data = lipSyncRef.current;
    const headMesh = headRef.current;
    const teethMesh = teethLowerRef.current;

    if (!data || !headMesh || !isPlayingRef.current) {
      if (headMesh) {
        updateMeshMorphs(
          headMesh,
          {},
          0,
          LIP_SYNC_CONFIG.smoothingSpeed,
          delta
        );
      }
      if (teethMesh) {
        updateMeshMorphs(
          teethMesh,
          {},
          0,
          LIP_SYNC_CONFIG.smoothingSpeed,
          delta
        );
      }
      return;
    }

    let ctx: AudioContext;
    try {
      ctx = getAudioContext();
    } catch {
      return;
    }

    // Exact elapsed audio time in milliseconds based on master audio clock
    const currentTime = (ctx.currentTime - startedAtRef.current) * 1000;

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

      if (currentTime >= start && currentTime < end) {
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

    updateMeshMorphs(
      headMesh,
      targetMorphs,
      targetJaw,
      LIP_SYNC_CONFIG.smoothingSpeed,
      delta
    );

    updateMeshMorphs(
      teethMesh,
      targetMorphs,
      targetJaw,
      LIP_SYNC_CONFIG.smoothingSpeed,
      delta
    );
  });
}
