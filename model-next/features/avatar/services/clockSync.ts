// features/avatar/services/clockSync.ts
//
// Client-side SNTP clock synchronization using Cristian's Algorithm with
// statistical outlier rejection and an exponential moving average smoother.
//
// Precision budget:
//   On local WiFi (RTT ≈ 2ms):  offset error ≈ ±1ms.
//   On 4G cellular (RTT ≈ 80ms, asymmetric): offset error ≈ ±40ms worst case.
//   Date.now() Spectre clamping adds ≤ 2ms additional error.
//   All values are within our 350ms scheduling lead-time window.
//
// Do NOT rely on sub-millisecond accuracy. For lecture lip-sync, ±5ms is
// indistinguishable to human perception (JND for audio-visual sync ≈ 80ms).

"use client";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const SNTP_ENDPOINT = "/api/time/sync";
const SNTP_SAMPLES = 5;           // pings per sync cycle (discard hi/lo)
const SNTP_INTERVAL_MS = 30_000;  // re-sync every 30 seconds
const SNTP_EMA_ALPHA = 0.2;       // how quickly we trust new measurements (0=never, 1=always)
const SNTP_TIMEOUT_MS = 5_000;    // per-ping timeout

// ─────────────────────────────────────────────
// Module-level state (singleton)
// ─────────────────────────────────────────────
let smoothedOffsetMs = 0;    // Date.now() + smoothedOffsetMs ≈ true server time
let precisionMs = 999;       // estimated error (starts pessimistic)
let isCalibrated = false;
let syncIntervalId: ReturnType<typeof setInterval> | null = null;

// ─────────────────────────────────────────────
// Single ping — returns offset and RTT or null on failure
// ─────────────────────────────────────────────
async function pingOnce(): Promise<{ offsetMs: number; rttMs: number } | null> {
  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SNTP_TIMEOUT_MS);

    const res = await fetch(SNTP_ENDPOINT, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    const t3 = Date.now();
    clearTimeout(timer);

    if (!res.ok) return null;

    const { serverEpochMs } = (await res.json()) as { serverEpochMs: number };
    const rttMs = t3 - t0;
    // Cristian's: offset = serverTime + RTT/2 - localNow
    const offsetMs = serverEpochMs + rttMs / 2 - t3;
    return { offsetMs, rttMs };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Full sync cycle — SNTP_SAMPLES pings, outlier rejection, EMA update
// ─────────────────────────────────────────────
async function runSyncCycle(): Promise<void> {
  const results: { offsetMs: number; rttMs: number }[] = [];

  for (let i = 0; i < SNTP_SAMPLES; i++) {
    const r = await pingOnce();
    if (r) results.push(r);
    // Small gap between pings to avoid server-side rate limiting
    if (i < SNTP_SAMPLES - 1) await sleep(50);
  }

  if (results.length < 2) {
    console.warn("[ClockSync] Too few successful pings to calibrate. Skipping.");
    return;
  }

  // Sort by RTT, discard highest and lowest to reject outliers
  results.sort((a, b) => a.rttMs - b.rttMs);
  const trimmed = results.length >= 4
    ? results.slice(1, -1)   // discard min+max RTT
    : results;

  const avgOffset = trimmed.reduce((s, r) => s + r.offsetMs, 0) / trimmed.length;
  const avgRtt    = trimmed.reduce((s, r) => s + r.rttMs,    0) / trimmed.length;

  // Exponential moving average so we don't thrash on a single outlier cycle
  if (!isCalibrated) {
    smoothedOffsetMs = avgOffset;
    isCalibrated = true;
  } else {
    smoothedOffsetMs = SNTP_EMA_ALPHA * avgOffset + (1 - SNTP_EMA_ALPHA) * smoothedOffsetMs;
  }

  // Estimated error ≈ half the average RTT of accepted samples
  precisionMs = avgRtt / 2;

  console.log(
    `[ClockSync] Synced: offset=${smoothedOffsetMs.toFixed(1)}ms ` +
    `precision=±${precisionMs.toFixed(1)}ms (${trimmed.length}/${SNTP_SAMPLES} samples)`
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Returns the current synchronized wall-clock time in milliseconds.
 * This is equivalent to Date.now() corrected by the SNTP offset, so it
 * matches the server's time to within ±precisionMs.
 *
 * Safe to call before calibration — returns local Date.now() as fallback.
 */
export function getSynchronizedEpochMs(): number {
  return Date.now() + smoothedOffsetMs;
}

/**
 * Returns the estimated precision (error) of the current clock offset in ms.
 * Starts at 999ms (uncalibrated). After first sync cycle, typically < 5ms on WiFi.
 */
export function getClockPrecision(): number {
  return precisionMs;
}

/**
 * Returns whether at least one sync cycle has completed successfully.
 */
export function isClockCalibrated(): boolean {
  return isCalibrated;
}

/**
 * Starts a background sync loop that re-calibrates every SNTP_INTERVAL_MS.
 * Only one loop runs at a time (singleton). Runs immediately on first call.
 *
 * @returns A teardown function to call on component unmount to stop the loop.
 *
 * @example
 *   useEffect(() => {
 *     const stop = startBackgroundSync();
 *     return () => stop();
 *   }, []);
 */
export function startBackgroundSync(): () => void {
  if (typeof window === "undefined") return () => {};  // SSR guard

  // Singleton: if already running, just return the stop handle
  if (syncIntervalId !== null) {
    return stopBackgroundSync;
  }

  // Kick off immediately (don't wait for first interval tick)
  void runSyncCycle();

  syncIntervalId = setInterval(() => {
    void runSyncCycle();
  }, SNTP_INTERVAL_MS);

  return stopBackgroundSync;
}

/**
 * Stops the background sync loop. Safe to call multiple times.
 */
export function stopBackgroundSync(): void {
  if (syncIntervalId !== null) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
}

/**
 * Force a single sync cycle immediately (e.g. after tab becomes visible
 * again, or after AudioContext.resume() on a backgrounded tab).
 */
export async function syncNow(): Promise<void> {
  await runSyncCycle();
}
