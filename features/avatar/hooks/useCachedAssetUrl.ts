"use client";

import { useState, useEffect } from "react";
import { assetStorage } from "../services/assetStorage";

export interface CachedAssetResult {
  url: string | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * React hook that resolves a persistent cached Object URL for a 3D asset.
 * Guarantees that:
 * 1. If cached in CacheStorage / memory, it returns the cached blob URL without making any network request.
 * 2. If not yet cached, it fetches ONCE into CacheStorage (with local fallback if CDN is unreachable),
 *    and then provides the cached blob URL.
 * 3. Does NOT return an unverified network URL prematurely, preventing Three.js loaders from
 *    bypassing CacheStorage or throwing unhandled fetch errors while the model is downloading.
 */
export function useCachedAsset(targetUrl?: string): CachedAssetResult {
  const [prevTargetUrl, setPrevTargetUrl] = useState(targetUrl);
  const [state, setState] = useState<CachedAssetResult>(() => {
    if (!targetUrl) return { url: null, isLoading: false, error: null };
    const syncUrl = assetStorage.getSynchronousObjectUrl(targetUrl);
    if (syncUrl) {
      return { url: syncUrl, isLoading: false, error: null };
    }
    return { url: null, isLoading: true, error: null };
  });

  if (targetUrl !== prevTargetUrl) {
    setPrevTargetUrl(targetUrl);
    if (!targetUrl) {
      setState({ url: null, isLoading: false, error: null });
    } else {
      const syncUrl = assetStorage.getSynchronousObjectUrl(targetUrl);
      if (syncUrl) {
        setState({ url: syncUrl, isLoading: false, error: null });
      } else {
        setState({ url: null, isLoading: true, error: null });
      }
    }
  }

  useEffect(() => {
    if (!targetUrl) return;

    let isCurrent = true;

    const resolveUrl = () => {
      const syncUrl = assetStorage.getSynchronousObjectUrl(targetUrl);
      if (syncUrl) {
        setState({ url: syncUrl, isLoading: false, error: null });
        return;
      }

      assetStorage
        .getAssetUrl(targetUrl)
        .then((resolved) => {
          if (!isCurrent) return;
          setState({ url: resolved, isLoading: false, error: null });
        })
        .catch((err) => {
          if (!isCurrent) return;
          console.warn(`[useCachedAsset] Error resolving asset ${targetUrl}:`, err);
          // Fallback to targetUrl rather than breaking
          setState({ url: targetUrl, isLoading: false, error: err });
        });
    };

    resolveUrl();

    // Re-check when background sync completes an item or P0 tier
    const handleAssetsReady = () => {
      if (isCurrent) {
        resolveUrl();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("intelliclass:assets-ready", handleAssetsReady);
      window.addEventListener("intelliclass:asset-synced", handleAssetsReady);
    }

    return () => {
      isCurrent = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("intelliclass:assets-ready", handleAssetsReady);
        window.removeEventListener("intelliclass:asset-synced", handleAssetsReady);
      }
    };
  }, [targetUrl]);

  return state;
}

/**
 * Legacy compatibility hook returning resolved string.
 * Returns in-memory URL if cached, or targetUrl as fallback.
 */
export function useCachedAssetUrl(targetUrl?: string): string {
  const { url } = useCachedAsset(targetUrl);
  return url || targetUrl || "";
}
