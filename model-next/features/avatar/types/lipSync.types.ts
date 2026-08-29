import * as THREE from "three";

export interface HeadTTSData {
  visemes: string[];
  vtimes: number[];
  vdurations: number[];
  phonemes?: string[];
  words?: string[];
  wtimes?: number[];
  wdurations?: number[];
}

export interface LipSyncProps {
  head: THREE.SkinnedMesh | undefined;
  teethLower: THREE.SkinnedMesh | undefined;
  audioPath?: string;
  lipSyncData?: HeadTTSData;
  play: boolean;
  onEnded?: () => void;
}
