"use client";

import { useState, useEffect } from "react";
import { assetStorage } from "../services/assetStorage";

/**
 * React hook that returns a persistent local blob Object URL for a given 3D asset.
 * If already cached in browser CacheStorage / IndexedDB, returns immediately.
 * Otherwise, downloads once from Supabase Storage CDN, commits to CacheStorage, and yields the blob URL.
 */
export function useCachedAssetUrl(targetUrl?: string): string {
  const [resolvedUrl, setResolvedUrl] = useState<string>(() => {
    if (!targetUrl) return "";
    return assetStorage.getSynchronousObjectUrl(targetUrl) || targetUrl;
  });

  useEffect(() => {
    if (!targetUrl) return;
    let isCurrent = true;

    assetStorage.getAssetUrl(targetUrl).then((url) => {
      if (isCurrent && url !== resolvedUrl) {
        setResolvedUrl(url);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [targetUrl, resolvedUrl]);

  return resolvedUrl || targetUrl || "";
}
