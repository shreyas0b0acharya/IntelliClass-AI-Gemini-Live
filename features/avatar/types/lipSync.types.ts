import * as THREE from "three";

export interface LipSyncData {
  visemes: string[];
  vtimes: number[];       // ms from audio start when this viseme begins
  vdurations: number[];   // ms each viseme lasts
  phonemes?: string[];
  words?: string[];
  wtimes?: number[];      // ms from audio start when word begins
  wdurations?: number[];  // ms each word lasts
}

// 100% Backward-Compatible Alias for existing HeadTTS usages
export type HeadTTSData = LipSyncData;

export interface LipSyncProps {
  head: THREE.SkinnedMesh | undefined;
  teethLower: THREE.SkinnedMesh | undefined;
  audioPath?: string;
  lipSyncData?: HeadTTSData;
  play: boolean;
  onEnded?: () => void;

  /**
   * Synchronized wall-clock epoch (ms) when audio playback should start / started.
   * When provided, the viseme animation clock is driven by:
   *   currentTime = getSynchronizedEpochMs() - targetEpochMs
   * This makes blendshape timing identical across ALL devices regardless of
   * when each client's local JS thread scheduled the audio.
   *
   * When absent, falls back to legacy behaviour (ctx.currentTime - startedAt).
   */
  targetEpochMs?: number;

  /**
   * Monotonic sequence number of the current playback slot.
   * useLipSync will only drive morphs when this matches the internally
   * "authorized" sequence — preventing ghost animation from stale/dropped
   * packets. If the sequence doesn't match, morphs stay at rest (mouth closed).
   */
  sequence?: number;
}
