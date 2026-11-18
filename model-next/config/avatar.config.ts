// model-next/config/avatar.config.ts
//
// Centralized configuration for 3D avatar personas, 3D asset paths, and camera presets.
// Safe for both client and server (pure isomorphic data, no secrets or React hooks).

export type AvatarModelId = "men-avatarsdk" | "women-avatarsdk";

export interface AvatarModelInfo {
  id: AvatarModelId;
  name: string;
  gender: "male" | "female";
  file: string;
  description: string;
}

/**
 * Production 3D avatar personas
 */
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
export const DEFAULT_MALE_AVATAR_MODEL: AvatarModelId = "men-avatarsdk";
export const DEFAULT_FEMALE_AVATAR_MODEL: AvatarModelId = "women-avatarsdk";

/**
 * Supabase Storage CDN base for 3D assets
 * Kept for optional remote distribution; local public assets are primary for fast, resilient serving.
 */
const SUPABASE_BASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ougxttjcgonjgstksham.supabase.co";

export const SUPABASE_3D_ASSETS_CDN = `${SUPABASE_BASE_URL}/storage/v1/object/public/3d-assets`;

/**
 * 3D Model file paths (Local public bundle primary for 100% offline & LAN mobile reliability)
 */
export const AVATAR_MODEL_PATHS: Record<AvatarModelId, string> = {
  "men-avatarsdk": "/models/men-avatarsdk.glb",
  "women-avatarsdk": "/models/women-avatarsdk.glb",
};

export const CLASSROOM_STAGE_MODEL_PATH = "/models/CLASSROOM.glb";
export const CLASSROOM_STAGE_MODEL_LOW_PATH = "/models/CLASSROOM-low.glb";
export const STANDING_CHALKBOARD_MODEL_PATH = "/models/standing_chalkboard.glb";
export const STAGE_BACKDROP_TEXTURE_PATH = "/textures/Blackboard-Stage-Wall.png";

/**
 * Resolves classroom model path according to hardware/LOD tier
 */
export function getClassroomModelPath(tier?: "low" | "medium" | "high"): string {
  if (tier === "low") {
    return CLASSROOM_STAGE_MODEL_LOW_PATH;
  }
  return CLASSROOM_STAGE_MODEL_PATH;
}

/**
 * Static Three.js Camera & Viewport Presets
 */
export const CLASSROOM_STAGE_CAMERA = {
  position: [-0.03, 1.539, 0.768] as [number, number, number],
  target: [0, 1.55, -3.8] as [number, number, number],
  fov: 42,
  near: 0.01,
  far: 50,
  minDistance: 0.4,
  maxDistance: 4.5,
} as const;

export const STUDIO_PREVIEW_CAMERA = {
  position: [0, 1.48, -2.1] as [number, number, number],
  target: [0, 1.45, 0] as [number, number, number],
  fov: 38,
  near: 0.1,
  far: 50,
} as const;

/**
 * Human-friendly persona name presets for settings & script generation
 */
export const MALE_MODEL_PRESETS: string[] = [
  "Prof. Arthur",
  "Prof. Alexander",
  "Prof. Sharma",
  "Prof. David",
  "Dr. Julian",
];

export const FEMALE_MODEL_PRESETS: string[] = [
  "Dr. Clara",
  "Dr. Sophia",
  "Prof. Bella",
  "Dr. Elena",
  "Prof. Evelyn",
];
