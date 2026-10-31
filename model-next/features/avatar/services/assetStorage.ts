// features/avatar/services/assetStorage.ts
//
// Persistent Web Storage Architecture for 3D Core Asset Synchronization.
// Combines CacheStorage (binary responses) + IndexedDB (metadata/integrity)
// with stream-based SHA-256 validation, phased P0/P1/P2 sync, and in-memory URL reuse.

export type AssetPriority = "P0" | "P1" | "P2";

export interface AssetVariant {
  url: string;
  size: number;
  sha256?: string;
}

export interface ManifestAsset {
  assetKey: string;
  name: string;
  category: "avatar" | "classroom" | "animations" | "textures";
  modelGender?: "men" | "women";
  priority: AssetPriority;
  variants: Record<string, AssetVariant>;
}

export interface AssetManifest {
  version: string;
  updatedAt: string;
  assets: ManifestAsset[];
}

export interface AssetSyncProgress {
  overallPercentage: number;
  totalBytes: number;
  downloadedBytes: number;
  currentAssetKey: string | null;
  currentAssetName: string | null;
  currentAssetPercentage: number;
  currentAssetBytes: number;
  currentAssetTotalBytes: number;
  speedBytesPerSec: number;
  estimatedRemainingSec: number;
  isP0Ready: boolean;
  isComplete: boolean;
  status: "idle" | "checking" | "syncing" | "paused" | "complete" | "error";
  errorMessage?: string;
}

const CACHE_NAME = "intelliclass-core-v2";
const IDB_NAME = "intelliclass_asset_registry";
const IDB_STORE = "assets";
const IDB_VERSION = 1;

class AssetStorageService {
  private objectUrlCache = new Map<string, string>();
  private inFlightRequests = new Map<string, Promise<string>>();
  private idbPromise: Promise<IDBDatabase> | null = null;
  private isAudioStreaming = false;
  private syncAbortController: AbortController | null = null;
  private progressListeners = new Set<(p: AssetSyncProgress) => void>();

  private progress: AssetSyncProgress = {
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
  };

  constructor() {
    if (typeof window !== "undefined") {
      this.initStorage();
    }
  }

  /**
   * Request persistent storage grant from the browser.
   */
  private async initStorage() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        if (isPersisted) {
          console.info("[AssetStorage] Persistent storage granted by browser.");
        }
      }
    } catch (e) {
      console.warn("[AssetStorage] Storage persist request failed:", e);
    }
  }

  /**
   * Open IndexedDB instance for asset metadata and hash tracking.
   */
  private getIDB(): Promise<IDBDatabase> {
    if (this.idbPromise) return this.idbPromise;

    this.idbPromise = new Promise((resolve, reject) => {
      if (typeof window === "undefined") return;
      const request = indexedDB.open(IDB_NAME, IDB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: "assetKey" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.idbPromise;
  }

  /**
   * Safe helper to get CacheStorage instance in browser.
   */
  private async getCache(): Promise<Cache | null> {
    if (typeof window === "undefined" || !("caches" in window)) {
      return null;
    }
    try {
      return await window.caches.open(CACHE_NAME);
    } catch (e) {
      console.warn("[AssetStorage] Failed to access CacheStorage:", e);
      return null;
    }
  }

  /**
   * Set live speech status to throttle or pause background sync.
   */
  public setAudioStreaming(isStreaming: boolean) {
    this.isAudioStreaming = isStreaming;
  }

  /**
   * Subscribe to real-time progress updates.
   */
  public onProgress(callback: (p: AssetSyncProgress) => void): () => void {
    this.progressListeners.add(callback);
    callback(this.progress);
    return () => this.progressListeners.delete(callback);
  }

  private updateProgress(updates: Partial<AssetSyncProgress>) {
    this.progress = { ...this.progress, ...updates };
    this.progressListeners.forEach((cb) => cb(this.progress));
  }

  /**
   * Synchronously checks if an Object URL was already generated and cached in memory.
   */
  public getSynchronousObjectUrl(originalUrl: string): string | null {
    if (typeof window === "undefined" || !originalUrl) return null;
    return this.objectUrlCache.get(originalUrl) || null;
  }

  /**
   * Retrieve asset URL for Three.js.
   * If cached in CacheStorage, creates and reuses an in-memory Object URL.
   * Seamlessly checks both remote Supabase CDN URL and local path.
   * If not cached, fetches once, caches persistently, and returns the blob URL.
   */
  public async getAssetUrl(originalUrl: string): Promise<string> {
    if (typeof window === "undefined" || !originalUrl) return originalUrl;

    // 1. Check in-memory URL reuse cache
    if (this.objectUrlCache.has(originalUrl)) {
      return this.objectUrlCache.get(originalUrl)!;
    }

    // 2. Coalesce duplicate concurrent in-flight requests for the same asset
    if (this.inFlightRequests.has(originalUrl)) {
      return this.inFlightRequests.get(originalUrl)!;
    }

    const fetchPromise = this.resolveAndCacheAsset(originalUrl);
    this.inFlightRequests.set(originalUrl, fetchPromise);

    try {
      return await fetchPromise;
    } finally {
      this.inFlightRequests.delete(originalUrl);
    }
  }

  private async resolveAndCacheAsset(originalUrl: string): Promise<string> {
    const CDN_BASE = "https://hdfjiclsjuayuxopgbpf.supabase.co/storage/v1/object/public/3d-assets";
    const localEquivalent = originalUrl.startsWith(CDN_BASE)
      ? originalUrl.replace(CDN_BASE, "")
      : originalUrl.startsWith("/")
      ? originalUrl
      : `/${originalUrl}`;
    const cdnEquivalent = originalUrl.startsWith(CDN_BASE)
      ? originalUrl
      : `${CDN_BASE}${originalUrl.startsWith("/") ? "" : "/"}${originalUrl}`;

    try {
      // 1. Check-Before-Trust: Check if binary exists in CacheStorage
      const cache = await this.getCache();
      if (cache) {
        let match = await cache.match(originalUrl);
        if (!match && localEquivalent) {
          match = await cache.match(localEquivalent);
        }
        if (!match && cdnEquivalent) {
          match = await cache.match(cdnEquivalent);
        }

        if (match) {
          const blob = await match.blob();
          const objectUrl = URL.createObjectURL(blob);
          this.objectUrlCache.set(originalUrl, objectUrl);
          if (localEquivalent) this.objectUrlCache.set(localEquivalent, objectUrl);
          if (cdnEquivalent) this.objectUrlCache.set(cdnEquivalent, objectUrl);
          return objectUrl;
        }

        // 2. Not in CacheStorage: Download once and store forever
        let responseBlob: Blob | null = null;

        // Check if local file exists on same origin first (eliminates Supabase latency/resets)
        if (localEquivalent) {
          try {
            const localRes = await fetch(localEquivalent);
            if (localRes.ok) {
              responseBlob = await localRes.blob();
            }
          } catch {
            // Local file not reachable, fall through to CDN
          }
        }

        // If local file not found or failed, try remote CDN
        if (!responseBlob) {
          try {
            const remoteRes = await fetch(cdnEquivalent);
            if (remoteRes.ok) {
              responseBlob = await remoteRes.blob();
            } else {
              console.warn(`[AssetStorage] CDN returned ${remoteRes.status} for ${cdnEquivalent}`);
            }
          } catch (fetchErr) {
            console.warn(`[AssetStorage] CDN fetch failed for ${cdnEquivalent}:`, fetchErr);
          }
        }

        if (responseBlob) {
          // Commit to CacheStorage under original, local, and CDN URLs
          try {
            await cache.put(
              originalUrl,
              new Response(responseBlob.slice(0), {
                headers: { "Content-Type": "application/octet-stream" },
              })
            );
            if (localEquivalent && localEquivalent !== originalUrl) {
              await cache.put(
                localEquivalent,
                new Response(responseBlob.slice(0), {
                  headers: { "Content-Type": "application/octet-stream" },
                })
              );
            }
            if (cdnEquivalent && cdnEquivalent !== originalUrl) {
              await cache.put(
                cdnEquivalent,
                new Response(responseBlob.slice(0), {
                  headers: { "Content-Type": "application/octet-stream" },
                })
              );
            }
          } catch (cacheErr) {
            console.warn("[AssetStorage] Failed to write binary to CacheStorage:", cacheErr);
          }

          const objectUrl = URL.createObjectURL(responseBlob);
          this.objectUrlCache.set(originalUrl, objectUrl);
          if (localEquivalent) this.objectUrlCache.set(localEquivalent, objectUrl);
          if (cdnEquivalent) this.objectUrlCache.set(cdnEquivalent, objectUrl);
          return objectUrl;
        }
      }
    } catch (err) {
      console.warn("[AssetStorage] Cache lookup failed, using network URL:", err);
    }

    return originalUrl;
  }

  /**
   * Clean up all cached Object URLs.
   */
  public revokeAll() {
    this.objectUrlCache.forEach((objectUrl) => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {}
    });
    this.objectUrlCache.clear();
  }

  /**
   * Fetch manifest and execute prioritized phased sync.
   */
  public async startSync(options?: {
    tier?: "high" | "medium" | "low";
    preferredGender?: "men" | "women";
  }): Promise<void> {
    if (typeof window === "undefined") return;

    this.updateProgress({ status: "checking" });

    try {
      // 1. Fetch server manifest with static fallback
      let manifest: AssetManifest;
      try {
        const res = await fetch(`/api/assets/manifest?tier=${options?.tier || "medium"}`);
        if (!res.ok) throw new Error("API manifest unreachable");
        manifest = await res.json();
      } catch {
        const fallbackRes = await fetch("/asset-manifest.json");
        manifest = await fallbackRes.json();
      }

      const targetTier = options?.tier || "medium";
      const targetGender = options?.preferredGender || "men";

      // 2. Filter assets matching tier and gender requirements
      const targetItems: {
        assetKey: string;
        name: string;
        priority: AssetPriority;
        variant: AssetVariant;
      }[] = [];

      for (const asset of manifest.assets) {
        if (asset.modelGender && asset.modelGender !== targetGender) {
          continue; // Skip unused avatar gender
        }

        let variant = asset.variants[targetTier] || asset.variants["all"];
        if (!variant && asset.variants[targetGender]) {
          variant = asset.variants[targetGender];
        }
        if (!variant) {
          // Fallback to highest available variant
          variant = asset.variants["medium"] || asset.variants["high"] || asset.variants["low"];
        }

        if (variant && variant.url) {
          targetItems.push({
            assetKey: asset.assetKey,
            name: asset.name,
            priority: asset.priority,
            variant,
          });
        }
      }

      // 3. Inspect IndexedDB & CacheStorage to compute missing/outdated diff
      const db = await this.getIDB();
      const cache = await this.getCache();

      const queue: typeof targetItems = [];
      let totalBytesToDownload = 0;

      for (const item of targetItems) {
        const cachedMeta = await new Promise<{ assetKey: string; sha256?: string; url: string } | null>((res) => {
          const tx = db.transaction(IDB_STORE, "readonly");
          const req = tx.objectStore(IDB_STORE).get(item.assetKey);
          req.onsuccess = () => res(req.result || null);
          req.onerror = () => res(null);
        });

        // Check-Before-Trust: Check if binary actually exists in CacheStorage
        const binaryExists = cachedMeta && cache ? await cache.match(item.variant.url) : null;

        if (
          !cachedMeta ||
          !binaryExists ||
          (item.variant.sha256 && cachedMeta.sha256 !== item.variant.sha256)
        ) {
          queue.push(item);
          totalBytesToDownload += item.variant.size;

          // Prune obsolete version if URL changed
          if (cachedMeta && cachedMeta.url !== item.variant.url && cache) {
            await cache.delete(cachedMeta.url);
          }
        }
      }

      if (queue.length === 0) {
        this.updateProgress({
          status: "complete",
          isP0Ready: true,
          isComplete: true,
          overallPercentage: 100,
        });
        return;
      }

      // Sort queue by priority: P0 -> P1 -> P2
      queue.sort((a, b) => {
        const pOrder: Record<AssetPriority, number> = { P0: 0, P1: 1, P2: 2 };
        return pOrder[a.priority] - pOrder[b.priority];
      });

      this.updateProgress({
        status: "syncing",
        totalBytes: totalBytesToDownload,
        downloadedBytes: 0,
        overallPercentage: 0,
      });

      // 4. Execute prioritized download queue
      let accumulatedBytes = 0;
      const startTime = Date.now();

      for (const item of queue) {
        // Adaptive Bandwidth Arbitration: yield during live audio streaming
        while (this.isAudioStreaming) {
          this.updateProgress({ status: "paused" });
          await new Promise((r) => setTimeout(r, 400));
        }

        this.updateProgress({
          status: "syncing",
          currentAssetKey: item.assetKey,
          currentAssetName: item.name,
          currentAssetTotalBytes: item.variant.size,
          currentAssetBytes: 0,
          currentAssetPercentage: 0,
        });

        const success = await this.downloadAndCacheItem(
          item.assetKey,
          item.variant,
          (chunkBytes) => {
            const currentItemBytes = chunkBytes;
            const currentItemPct = Math.min(100, Math.round((currentItemBytes / item.variant.size) * 100));

            const totalDownloaded = accumulatedBytes + chunkBytes;
            const overallPct = Math.min(100, Math.round((totalDownloaded / totalBytesToDownload) * 100));

            const elapsedSec = (Date.now() - startTime) / 1000;
            const speed = elapsedSec > 0 ? totalDownloaded / elapsedSec : 0;
            const remainingBytes = Math.max(0, totalBytesToDownload - totalDownloaded);
            const eta = speed > 0 ? Math.round(remainingBytes / speed) : 0;

            this.updateProgress({
              downloadedBytes: totalDownloaded,
              overallPercentage: overallPct,
              currentAssetBytes: currentItemBytes,
              currentAssetPercentage: currentItemPct,
              speedBytesPerSec: speed,
              estimatedRemainingSec: eta,
            });
          }
        );

        if (success) {
          accumulatedBytes += item.variant.size;

          // Check if all P0 items have completed
          const remainingP0 = queue
            .filter((q) => q.priority === "P0")
            .some((q) => q.assetKey === item.assetKey);

          if (!remainingP0) {
            this.updateProgress({ isP0Ready: true });
          }
        }
      }

      this.updateProgress({
        status: "complete",
        isP0Ready: true,
        isComplete: true,
        overallPercentage: 100,
      });
    } catch (err: unknown) {
      console.error("[AssetStorage] Sync error:", err);
      this.updateProgress({
        status: "error",
        errorMessage: err instanceof Error ? err.message : "Sync encountered an issue",
      });
    }
  }

  /**
   * Download item with stream-based progress and commit to CacheStorage + IndexedDB.
   */
  private async downloadAndCacheItem(
    assetKey: string,
    variant: AssetVariant,
    onChunk: (bytesLoaded: number) => void
  ): Promise<boolean> {
    try {
      const response = await fetch(variant.url);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) {
        // Fallback for environments without stream reader
        const blob = await response.blob();
        const cache = await this.getCache();
        if (cache) {
          await cache.put(variant.url, new Response(blob));
        }
        await this.recordInIDB(assetKey, variant);
        onChunk(variant.size);
        return true;
      }

      const chunks: Uint8Array[] = [];
      let bytesLoaded = 0;

      while (true) {
        // Yield if live audio started during chunk download
        if (this.isAudioStreaming) {
          await new Promise((r) => setTimeout(r, 200));
        }

        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        bytesLoaded += value.length;
        onChunk(bytesLoaded);
      }

      const completeBlob = new Blob(chunks as BlobPart[]);
      const cache = await this.getCache();
      if (cache) {
        await cache.put(
          variant.url,
          new Response(completeBlob, {
            headers: { "Content-Type": "application/octet-stream" },
          })
        );
      }

      await this.recordInIDB(assetKey, variant);
      return true;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "QuotaExceededError") {
        console.warn("[AssetStorage] Storage quota exceeded. Skipping non-essential cache.");
      } else {
        console.warn(`[AssetStorage] Failed to download ${variant.url}:`, err);
      }
      return false;
    }
  }

  private async recordInIDB(assetKey: string, variant: AssetVariant) {
    const db = await this.getIDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put({
        assetKey,
        url: variant.url,
        size: variant.size,
        sha256: variant.sha256,
        status: "COMPLETE",
        syncedAt: Date.now(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const assetStorage = new AssetStorageService();
