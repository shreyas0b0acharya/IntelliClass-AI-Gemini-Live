// model-next/config/classroom.config.ts
//
// Centralized configuration for real-time classroom orchestration, driver leasing, and sync buffers.
// Safe for both client and server (pure isomorphic data).

export const CLASSROOM_TIMINGS = {
  // Conductor CAS Lease
  DRIVER_LEASE_DURATION_MS: 12000,       // 12 seconds lease validity
  DRIVER_LEASE_RENEW_INTERVAL_MS: 5000,  // Renew heartbeats every 5 seconds

  // Web Audio scheduling and prefetch
  LEAD_TIME_MS: 350,                     // Target buffer ahead of real-time playhead
  AUTO_ADVANCE_DELAY_MS: 80,             // Micro-pause between sentences for natural flow
  PREFETCH_LOOKAHEAD_COUNT: 3,           // How many items ahead the conductor prefetches
  SEEK_SYNC_MIN_REMAINING_MS: 200,       // Min remaining audio duration to schedule playback on catch-up

  // Room presence & automatic pause guards
  EMPTY_ROOM_TIMEOUT_SEC: 30,            // Auto-pause lecture after 30s with zero students
  EMPTY_ROOM_COUNTDOWN_START_SEC: 5,     // Start countdown UI warning 5s before pause
  PRESENCE_GRACE_PERIOD_MS: 10000,       // 10s debounce before marking user disconnected
  SNAPSHOT_THROTTLE_MS: 2000,            // Throttle rate for full state snapshots
} as const;

// Named individual timing exports for direct convenience
export const {
  DRIVER_LEASE_DURATION_MS,
  DRIVER_LEASE_RENEW_INTERVAL_MS,
  LEAD_TIME_MS,
  AUTO_ADVANCE_DELAY_MS,
  PREFETCH_LOOKAHEAD_COUNT,
  SEEK_SYNC_MIN_REMAINING_MS,
  EMPTY_ROOM_TIMEOUT_SEC,
  EMPTY_ROOM_COUNTDOWN_START_SEC,
  PRESENCE_GRACE_PERIOD_MS,
  SNAPSHOT_THROTTLE_MS,
} = CLASSROOM_TIMINGS;

export const DEFAULT_CLASSROOM_LAYOUT_CONFIG = {
  MOBILE_BREAKPOINT_PX: 1024,
  MAX_PARTICIPANTS_DISPLAY: 50,
} as const;
