// model-next/features/avatar/services/avatarRegistry.ts
//
// Canonical registry for 3D avatar personas and persona-voice validation.
// Imports from central @/config and re-exports for 100% backward compatibility.

import {
  AVATAR_MODELS,
  DEFAULT_AVATAR_MODEL,
  DEFAULT_FEMALE_AVATAR_MODEL,
  DEFAULT_MALE_AVATAR_MODEL,
  type AvatarModelId,
  type AvatarModelInfo,
} from "@/config";
import type { VoiceGender } from "@/features/classroom/types/speech";

// Re-export for backward compatibility
export { AVATAR_MODELS, DEFAULT_AVATAR_MODEL };
export type { AvatarModelId, AvatarModelInfo };

export function getAvatarMetadata(modelId?: string): AvatarModelInfo {
  const found = AVATAR_MODELS.find((m) => m.id === modelId);
  return found || AVATAR_MODELS[0];
}

/**
 * Resolves the appropriate 3D avatar model for a given session.
 * Explicit avatar selection takes precedence; fallback derives cleanly from voice gender metadata.
 */
export function resolveAvatarModel(
  avatarModel?: string,
  voiceId?: string,
  voiceGender?: VoiceGender
): AvatarModelId {
  if (avatarModel === "women-avatarsdk" || avatarModel === "men-avatarsdk") {
    return avatarModel;
  }

  // Explicit voiceGender metadata from API
  if (voiceGender === "female") return DEFAULT_FEMALE_AVATAR_MODEL;
  if (voiceGender === "male") return DEFAULT_MALE_AVATAR_MODEL;

  return DEFAULT_AVATAR_MODEL;
}

export interface PersonaValidationResult {
  isMatch: boolean;
  warningMessage?: string;
  quickFixAvatarId?: AvatarModelId;
  quickFixVoiceId?: string;
}

/**
 * Validates pairing between a 3D avatar and voice.
 * Unknown voice gender NEVER produces false mismatch warnings.
 */
export function validatePersonaPairing(
  avatarModelId: AvatarModelId,
  voiceGender: VoiceGender,
  voiceName?: string
): PersonaValidationResult {
  if (voiceGender === "unknown") {
    return { isMatch: true };
  }

  const avatarMeta = getAvatarMetadata(avatarModelId);
  if (avatarMeta.gender === voiceGender) {
    return { isMatch: true };
  }

  const oppositeAvatar =
    avatarModelId === "women-avatarsdk"
      ? DEFAULT_MALE_AVATAR_MODEL
      : DEFAULT_FEMALE_AVATAR_MODEL;

  return {
    isMatch: false,
    warningMessage: `Selected 3D avatar is ${avatarMeta.gender === "female" ? "Female" : "Male"} (${avatarMeta.name}), but voice is ${voiceGender === "female" ? "Female" : "Male"} (${voiceName || "selected voice"}).`,
    quickFixAvatarId: oppositeAvatar,
  };
}
