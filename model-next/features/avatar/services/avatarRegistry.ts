// model-next/features/avatar/services/avatarRegistry.ts
//
// Canonical registry for 3D avatar personas and persona-voice validation.

import type { AvatarModelId, AvatarModelInfo } from "../types/avatar.types";
import type { VoiceGender } from "@/features/classroom/types/speech";

export const AVATAR_MODELS: AvatarModelInfo[] = [
  {
    id: "men-avatarsdk",
    name: "Prof. Arthur",
    gender: "male",
    file: "men-avatarsdk",
    description: "Photorealistic male professor avatar with formal academic attire.",
  },
  {
    id: "women-avatarsdk",
    name: "Dr. Clara",
    gender: "female",
    file: "women-avatarsdk",
    description: "Photorealistic female lecturer avatar with articulate facial blendshapes.",
  },
];

export const DEFAULT_AVATAR_MODEL: AvatarModelId = "men-avatarsdk";

export function getAvatarMetadata(modelId?: string): AvatarModelInfo {
  const found = AVATAR_MODELS.find((m) => m.id === modelId);
  return found || AVATAR_MODELS[0];
}

/**
 * Resolves the appropriate 3D avatar model for a given session.
 * Fallback derives directly from voice gender so female voices never map to men-avatarsdk.
 */
export function resolveAvatarModel(
  avatarModel?: string,
  voiceId?: string,
  voiceGender?: VoiceGender
): AvatarModelId {
  if (avatarModel === "women-avatarsdk" || avatarModel === "men-avatarsdk") {
    return avatarModel;
  }

  // If explicit voiceGender passed
  if (voiceGender === "female") return "women-avatarsdk";
  if (voiceGender === "male") return "men-avatarsdk";

  // Check voiceId naming convention if gender unknown
  if (voiceId) {
    const v = voiceId.toLowerCase();
    const knownFemale = [
      "af_",
      "female",
      "bella",
      "sarah",
      "alice",
      "sia",
      "jessica",
      "matilda",
      "rachel",
      "laura",
      "freya",
      "exavitqu4vr4xnsdxmal", // Sarah
      "xb7hh8msujpsbsdyk0k2", // Alice
      "cgSgspJ2msm6clMCkdW9".toLowerCase(), // Jessica
      "xrexe9ykig1wjnnlvkgx", // Matilda
      "21m00tcm4tlvdq8ikwam", // Rachel
      "fgy2whr4bwhkzg8x6d8f", // Laura
    ];
    if (knownFemale.some((needle) => v.startsWith(needle) || v.includes(needle))) {
      return "women-avatarsdk";
    }
  }

  return "men-avatarsdk";
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

  const oppositeAvatar = avatarModelId === "women-avatarsdk" ? "men-avatarsdk" : "women-avatarsdk";
  const oppMeta = getAvatarMetadata(oppositeAvatar);

  return {
    isMatch: false,
    warningMessage: `Selected 3D avatar is ${avatarMeta.gender === "female" ? "Female" : "Male"} (${avatarMeta.name}), but voice is ${voiceGender === "female" ? "Female" : "Male"} (${voiceName || "selected voice"}).`,
    quickFixAvatarId: oppositeAvatar,
  };
}
