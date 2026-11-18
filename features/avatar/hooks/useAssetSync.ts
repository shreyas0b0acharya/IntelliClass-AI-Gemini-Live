"use client";

import { useEffect, useState, useCallback } from "react";
import {
  assetStorage,
  type AssetSyncProgress,
} from "../services/assetStorage";
import { useDeviceTier } from "./useDeviceTier";

export function useAssetSync(options?: {
  autoStart?: boolean;
  preferredGender?: "men" | "women";
}) {
  const { capabilities } = useDeviceTier();
  const [progress, setProgress] = useState<AssetSyncProgress>(() => ({
    overallPercentage: 0,
    totalBytes: 0,
    downloadedBytes: 0,
    currentAssetKey: null,
    currentAssetName: null,
    currentAssetPercentage: 0,
    currentAssetBytes: 0,
    currentAssetTotalBytes: 0,
    speedBytesPerSec: 0,
    estimatedRemainingSec: 0,
    isP0Ready: false,
    isComplete: false,
    status: "idle",
  }));

  useEffect(() => {
    const unsubscribe = assetStorage.onProgress((p) => {
      setProgress(p);
    });
    return unsubscribe;
  }, []);

  const triggerSync = useCallback(
    (gender?: "men" | "women") => {
      assetStorage.startSync({
        tier: capabilities.lodLevel,
        preferredGender: gender || options?.preferredGender || "men",
      });
    },
    [capabilities.lodLevel, options?.preferredGender]
  );

  useEffect(() => {
    if (options?.autoStart !== false) {
      triggerSync();
    }
  }, [triggerSync, options?.autoStart]);

  const setAudioStreaming = useCallback((isStreaming: boolean) => {
    assetStorage.setAudioStreaming(isStreaming);
  }, []);

  return {
    progress,
    triggerSync,
    setAudioStreaming,
    isP0Ready: progress.isP0Ready,
    isComplete: progress.isComplete,
    isSyncing: progress.status === "syncing",
    isPaused: progress.status === "paused",
  };
}
