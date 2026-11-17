// model-next/config/session.config.ts
//
// Centralized schema policy, allowed update fields, and lifecycle constants for sessions.
// Safe for both client and server (pure isomorphic data).

/**
 * Fields that configure the 3D avatar persona, vocal identity, and speech pacing
 */
export const PERSONA_CONFIG_FIELDS = [
  "avatar_model",
  "voice_id",
  "speech_speed",
  "tts_provider",
] as const;

export type PersonaConfigField = (typeof PERSONA_CONFIG_FIELDS)[number];

/**
 * Whitelist of allowed fields for PATCH /api/classroom/[sessionId] updates
 */
export const SESSION_ALLOWED_UPDATE_FIELDS = [
  "status",
  "current_item_id",
  "current_sentence_index",
  "sequence",
  "stopped_reason",
  "script",
  "topic",
  "voice_id",
  "avatar_model",
  "speech_speed",
  "tts_provider",
  "active_driver_tab_id",
  "driver_lease_expires_at",
  "driver_lease_version",
  "target_epoch_ms",
  "duration_ms",
  "roadmap",
  "current_topic_id",
  "covered_topic_ids",
  "live_resumption_handle",
  "live_session_stats",
] as const;

export type SessionAllowedUpdateField = (typeof SESSION_ALLOWED_UPDATE_FIELDS)[number];

/**
 * Numeric integer fields that require rounding and NaN protection
 */
export const SESSION_INTEGER_FIELDS = new Set<string>([
  "current_sentence_index",
  "sequence",
  "driver_lease_version",
  "target_epoch_ms",
  "duration_ms",
]);

export const DEFAULT_SESSION_STATUS = "created";
