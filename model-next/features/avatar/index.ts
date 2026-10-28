// features/avatar/index.ts

// Components
export { Avatar } from "./components/Avatar";
export { AvatarPreview } from "./components/AvatarPreview";
export { LandingHeroAvatarStage } from "./components/LandingHeroAvatarStage";
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
export { useCachedAssetUrl, useCachedAsset } from "./hooks/useCachedAssetUrl";
export type { CachedAssetResult } from "./hooks/useCachedAssetUrl";

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
  AvatarModelId,
  AvatarModelInfo,
} from "./types/avatar.types";
export {
  AVATAR_MODELS,
  DEFAULT_AVATAR_MODEL,
  getAvatarMetadata,
  resolveAvatarModel,
  validatePersonaPairing,
} from "./services/avatarRegistry";
export type { PersonaValidationResult } from "./services/avatarRegistry";

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
  LipSyncData,
  HeadTTSData,
  LipSyncProps,
} from "./types/lipSync.types";
