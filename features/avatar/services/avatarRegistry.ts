// model-next/features/avatar/services/avatarRegistry.ts
//
// Canonical registry for 3D avatar personas and persona-voice validation.
// Imports from central @/config and re-exports for 100% backward compatibility.

import {
  AVATAR_MODELS,
  DEFAULT_AVATAR_MODEL,
  DEFAULT_FEMALE_AVATAR_MODEL,
  DEFAULT_MALE_AVATAR_MODEL,
  DEFAULT_MALE_VOICE_ID,
  DEFAULT_FEMALE_VOICE_ID,
  type AvatarModelId,
  type AvatarModelInfo,
} from "@/config";
import type { VoiceGender } from "@/features/classroom/types/speech";

// Re-export for backward compatibility
export { AVATAR_MODELS, DEFAULT_AVATAR_MODEL, DEFAULT_FEMALE_AVATAR_MODEL, DEFAULT_MALE_AVATAR_MODEL };
export type { AvatarModelId, AvatarModelInfo };

export function getAvatarMetadata(modelId?: string): AvatarModelInfo {
  const found = AVATAR_MODELS.find((m) => m.id === modelId);
  return found || AVATAR_MODELS[0];
}

/**
 * Returns the gender of a voice by id or voice name.
 */
export function getVoiceGender(voiceId?: string): "female" | "male" {
  if (!voiceId) return "male";
  const vid = voiceId.toLowerCase();
  if (
    vid.includes("aoede") ||
    vid.includes("kore") ||
    vid.includes("bella") ||
    vid.includes("clara") ||
    vid.includes("female") ||
    vid.includes("sarah") ||
    vid.includes("nicole") ||
    vid.includes("sky") ||
    vid.includes("alice") ||
    vid.includes("emma") ||
    vid.startsWith("af_") ||
    vid.startsWith("bf_")
  ) {
    return "female";
  }
  return "male";
}

export interface StrictPersona {
  avatarModel: AvatarModelId;
  voiceId: string;
  gender: "female" | "male";
}

/**
 * Strictly enforces alignment between 3D avatar model and Gemini Live voice.
 * Absolute rule: NEVER pair a male 3D avatar with a female voice, or a female 3D avatar with a male voice.
 */
export function enforcePersonaConsistency(
  avatarModel?: string,
  voiceId?: string
): StrictPersona {
  const isExplicitFemaleAvatar =
    avatarModel === "women-avatarsdk" ||
    avatarModel?.toLowerCase().includes("women") ||
    avatarModel?.toLowerCase().includes("clara") ||
    avatarModel?.toLowerCase().includes("female");

  const isExplicitMaleAvatar =
    avatarModel === "men-avatarsdk" ||
    avatarModel?.toLowerCase().includes("men") ||
    avatarModel?.toLowerCase().includes("arthur") ||
    avatarModel?.toLowerCase().includes("male");

  let gender: "female" | "male" = "male";

  if (isExplicitFemaleAvatar) {
    gender = "female";
  } else if (isExplicitMaleAvatar) {
    gender = "male";
  } else if (voiceId) {
    gender = getVoiceGender(voiceId);
  } else {
    // Default system avatar is male (Prof. Arthur)
    gender = "male";
  }

  const finalAvatarModel: AvatarModelId =
    gender === "female" ? DEFAULT_FEMALE_AVATAR_MODEL : DEFAULT_MALE_AVATAR_MODEL;

  let finalVoiceId = voiceId || (gender === "female" ? DEFAULT_FEMALE_VOICE_ID : DEFAULT_MALE_VOICE_ID);
  const voiceGender = getVoiceGender(finalVoiceId);

  // If the voice gender contradicts the avatar gender, strictly override it to the matching gender default
  if (gender === "female" && voiceGender !== "female") {
    finalVoiceId = DEFAULT_FEMALE_VOICE_ID;
  } else if (gender === "male" && voiceGender !== "male") {
    finalVoiceId = DEFAULT_MALE_VOICE_ID;
  }

  return {
    avatarModel: finalAvatarModel,
    voiceId: finalVoiceId,
    gender,
  };
}

/**
 * Resolves the appropriate 3D avatar model for a given session.
 * Always returns a valid AvatarModelId consistent with voice gender.
 */
export function resolveAvatarModel(
  avatarModel?: string,
  voiceId?: string,
  voiceGender?: VoiceGender
): AvatarModelId {
  const fallbackVoice = voiceGender === "female" ? DEFAULT_FEMALE_VOICE_ID : DEFAULT_MALE_VOICE_ID;
  return enforcePersonaConsistency(avatarModel, voiceId || fallbackVoice).avatarModel;
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
