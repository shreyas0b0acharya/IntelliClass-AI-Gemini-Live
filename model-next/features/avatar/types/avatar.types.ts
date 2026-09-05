import * as THREE from "three";
import { GLTF } from "three-stdlib";
import type { HeadTTSData } from "./lipSync.types";

export interface AvatarProps {
  model?: string;
  animation?: string;
  behaviorState?: "idle" | "listening" | "talking";
  position?: [number, number, number] | THREE.Vector3;
  scale?: number;
  headFollow?: boolean;
  playLipSync?: boolean;
  audioPath?: string;
  lipSyncData?: HeadTTSData;
  onLipSyncEnd?: () => void;
  targetEpochMs?: number;
  sequence?: number;
}

export type AvatarNode = THREE.SkinnedMesh | THREE.Bone;

export type AvatarGLTFResult = GLTF & {
  nodes: {
    AvatarBody?: THREE.SkinnedMesh;
    AvatarLeftCornea?: THREE.SkinnedMesh;
    AvatarLeftEyeball?: THREE.SkinnedMesh;
    AvatarRightCornea?: THREE.SkinnedMesh;
    AvatarRightEyeball?: THREE.SkinnedMesh;
    AvatarTeethUpper?: THREE.SkinnedMesh;

    outfit?: THREE.SkinnedMesh;
    outfit_bottom?: THREE.SkinnedMesh;
    outfit_shoes?: THREE.SkinnedMesh;
    outfit_top?: THREE.SkinnedMesh;

    AvatarEyelashes?: THREE.SkinnedMesh;
    AvatarHead?: THREE.SkinnedMesh;
    AvatarTeethLower?: THREE.SkinnedMesh;

    Hips: THREE.Bone;
    Spine?: THREE.Bone;
    Spine1?: THREE.Bone;
    Spine2?: THREE.Bone;
    LeftShoulder?: THREE.Bone;
    RightShoulder?: THREE.Bone;
    Neck?: THREE.Bone;
    LeftEye?: THREE.Bone;
    RightEye?: THREE.Bone;
    EyeLeft?: THREE.Bone;
    EyeRight?: THREE.Bone;
    Head?: THREE.Bone;
  };

  materials: {
    AvatarBody?: THREE.MeshStandardMaterial;
    AvatarLeftCornea?: THREE.MeshStandardMaterial;
    AvatarLeftEyeball?: THREE.MeshStandardMaterial;
    AvatarRightCornea?: THREE.MeshStandardMaterial;
    AvatarRightEyeball?: THREE.MeshStandardMaterial;
    AvatarTeethUpper?: THREE.MeshStandardMaterial;

    outfit?: THREE.MeshStandardMaterial;
    outfit_bottom?: THREE.MeshStandardMaterial;
    outfit_shoes?: THREE.MeshStandardMaterial;
    outfit_top?: THREE.MeshStandardMaterial;

    AvatarEyelashes?: THREE.MeshStandardMaterial;
    AvatarHead?: THREE.MeshStandardMaterial;
    AvatarTeethLower?: THREE.MeshStandardMaterial;
  };

  animations: THREE.AnimationClip[];
};

export type AvatarModelId = "men-avatarsdk" | "women-avatarsdk";

export interface AvatarModelInfo {
  id: AvatarModelId;
  name: string;
  gender: "male" | "female";
  file: string;
  description: string;
}
