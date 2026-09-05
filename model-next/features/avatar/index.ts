// features/avatar/index.ts

// Components
export { Avatar } from "./components/Avatar";
export { AvatarPreview } from "./components/AvatarPreview";
export { Experience } from "./components/Experience";
export { AudioTest } from "./components/AudioTest";
export { TTSPanel } from "./components/TTSPanel";
export { CameraLogger } from "./components/CameraLogger";
export { Controller } from "./components/controls";
export { AvatarBehaviorController } from "./components/AvatarBehaviorController";
export { useAvatarBehavior } from "./components/AvatarBehaviorContext";

// Hooks
export { useLipSync } from "./hooks/useLipSync";
export { useDeviceTier } from "./hooks/useDeviceTier";
export type { DeviceTier, DeviceCapabilities } from "./hooks/useDeviceTier";
export { useAssetSync } from "./hooks/useAssetSync";

// Services & Utils
export { assetStorage } from "./services/assetStorage";
export type {
  AssetManifest,
  ManifestAsset,
  AssetVariant,
  AssetSyncProgress,
  AssetPriority,
} from "./services/assetStorage";
export {
  createInitialBehaviorStore,
  updateAvatarProceduralFrame,
} from "./services/AvatarProceduralDriver";
export type {
  ProceduralDriverNodes,
  ProceduralDriverOptions,
} from "./services/AvatarProceduralDriver";
export {
  getAudioContext,
  getMasterGainNode,
  setMasterVolume,
  getMasterVolume,
  getOrDecodeAudioBuffer,
  unlockAudioContext,
  preloadAudioBuffer,
  scheduleAudioPlayback,
  stopAllAudio,
} from "./services/audioManager";
export {
  getSynchronizedEpochMs,
  getClockPrecision,
  isClockCalibrated,
  startBackgroundSync,
  stopBackgroundSync,
  syncNow,
} from "./services/clockSync";
export {
  splitIntoSmallChunks,
  splitIntoSentences,
} from "./services/sentenceSplitter";
export {
  HEADTTS_TO_AVATAR,
  getMouthConfig,
  VISEMES,
  LIP_SYNC_CONFIG,
} from "./services/lipSync.config";

// Types
export type {
  AvatarProps,
  AvatarNode,
  AvatarGLTFResult,
} from "./types/avatar.types";
export type {
  BehaviorState,
  BehaviorStore,
  BreathingData,
  BlinkData,
  GazeData,
  HeadData,
  EyebrowMorphData,
  CheekMorphData,
  MouthCornerMorphData,
  NostrilMorphData,
  LipMorphData,
} from "./types/behavior.types";
export type {
  HeadTTSData,
  LipSyncProps,
} from "./types/lipSync.types";
