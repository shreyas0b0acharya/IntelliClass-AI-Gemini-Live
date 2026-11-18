// features/avatar/services/clockSync.ts
//
// Pure local epoch provider for 3D avatar animations and lip-sync.
// Real-time voice and streaming are handled natively by Gemini Live & LiveKit.
// No background NTP network polling or /api/time/sync requests needed.

"use client";

/**
 * Returns the current epoch timestamp in milliseconds (Date.now()).
 */
export function getSynchronizedEpochMs(): number {
  return Date.now();
}

/**
 * Precision of the local monotonic clock (always 0ms error for local rendering).
 */
export function getClockPrecision(): number {
  return 0;
}

/**
 * Clock is always calibrated immediately using local system epoch.
 */
export function isClockCalibrated(): boolean {
  return true;
}

/**
 * No-op background sync. Returns cleanup function.
 */
export function startBackgroundSync(): () => void {
  return () => {};
}

/**
 * No-op teardown.
 */
export function stopBackgroundSync(): void {}

/**
 * Instantaneous sync resolution.
 */
export async function syncNow(): Promise<number> {
  return 0;
}
