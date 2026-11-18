"use client";
/* eslint-disable react-hooks/immutability */

import { useMemo } from "react";
import * as THREE from "three";
import type { AvatarGLTFResult } from "../types/avatar.types";

interface AvatarMeshesProps {
  nodes: AvatarGLTFResult["nodes"];
  materials: AvatarGLTFResult["materials"];
}

export function AvatarMeshes({
  nodes,
  materials,
}: AvatarMeshesProps) {
  // Ensure cornea, eyeball, and eyelash materials have proper non-metallic dielectric properties across all devices
  useMemo(() => {
    if (materials.AvatarEyelashes) {
      materials.AvatarEyelashes.metalness = 0.0;
      materials.AvatarEyelashes.roughness = 0.95;
      materials.AvatarEyelashes.envMapIntensity = 0.0;
      materials.AvatarEyelashes.color.setHex(0x1a1a1a);
    }
    if (materials.AvatarLeftCornea) {
      materials.AvatarLeftCornea.metalness = 0.0;
      materials.AvatarLeftCornea.roughness = 0.15;
      materials.AvatarLeftCornea.envMapIntensity = 0.3;
      materials.AvatarLeftCornea.transparent = true;
      materials.AvatarLeftCornea.depthWrite = false;
      materials.AvatarLeftCornea.depthTest = true;
      materials.AvatarLeftCornea.opacity = 1.0;
    }
    if (materials.AvatarRightCornea) {
      materials.AvatarRightCornea.metalness = 0.0;
      materials.AvatarRightCornea.roughness = 0.15;
      materials.AvatarRightCornea.envMapIntensity = 0.3;
      materials.AvatarRightCornea.transparent = true;
      materials.AvatarRightCornea.depthWrite = false;
      materials.AvatarRightCornea.depthTest = true;
      materials.AvatarRightCornea.opacity = 1.0;
    }
    if (materials.AvatarLeftEyeball) {
      materials.AvatarLeftEyeball.metalness = 0.0;
      materials.AvatarLeftEyeball.roughness = 0.2;
      materials.AvatarLeftEyeball.envMapIntensity = 0.3;
    }
    if (materials.AvatarRightEyeball) {
      materials.AvatarRightEyeball.metalness = 0.0;
      materials.AvatarRightEyeball.roughness = 0.2;
      materials.AvatarRightEyeball.envMapIntensity = 0.3;
    }
    if (nodes.AvatarHead) nodes.AvatarHead.frustumCulled = false;
    if (nodes.AvatarTeethLower) nodes.AvatarTeethLower.frustumCulled = false;
    if (nodes.AvatarTeethUpper) nodes.AvatarTeethUpper.frustumCulled = false;
    if (nodes.AvatarEyelashes) nodes.AvatarEyelashes.frustumCulled = false;
  }, [materials, nodes]);

  const wolf3d = nodes as unknown as Record<string, THREE.Object3D | undefined>;

  return (
    <>
      <primitive object={nodes.Hips} />

      {nodes.AvatarBody && <primitive object={nodes.AvatarBody} />}
      {nodes.AvatarLeftCornea && <primitive object={nodes.AvatarLeftCornea} />}
      {nodes.AvatarLeftEyeball && <primitive object={nodes.AvatarLeftEyeball} />}
      {nodes.AvatarRightCornea && <primitive object={nodes.AvatarRightCornea} />}
      {nodes.AvatarRightEyeball && <primitive object={nodes.AvatarRightEyeball} />}
      {nodes.AvatarTeethUpper && <primitive object={nodes.AvatarTeethUpper} />}
      {nodes.outfit && <primitive object={nodes.outfit} />}
      {nodes.outfit_bottom && <primitive object={nodes.outfit_bottom} />}
      {nodes.outfit_shoes && <primitive object={nodes.outfit_shoes} />}
      {nodes.outfit_top && <primitive object={nodes.outfit_top} />}
      {nodes.AvatarEyelashes && <primitive object={nodes.AvatarEyelashes} />}
      {nodes.AvatarHead && <primitive object={nodes.AvatarHead} />}
      {nodes.AvatarTeethLower && <primitive object={nodes.AvatarTeethLower} />}

      {/* ReadyPlayerMe / Wolf3D fallback */}
      {wolf3d.Wolf3D_Body && <primitive object={wolf3d.Wolf3D_Body} />}
      {wolf3d.Wolf3D_Glasses && <primitive object={wolf3d.Wolf3D_Glasses} />}
      {wolf3d.Wolf3D_Hair && <primitive object={wolf3d.Wolf3D_Hair} />}
      {wolf3d.Wolf3D_Head && <primitive object={wolf3d.Wolf3D_Head} />}
      {wolf3d.Wolf3D_Teeth && <primitive object={wolf3d.Wolf3D_Teeth} />}
      {wolf3d.Wolf3D_Outfit_Top && <primitive object={wolf3d.Wolf3D_Outfit_Top} />}
      {wolf3d.Wolf3D_Outfit_Bottom && <primitive object={wolf3d.Wolf3D_Outfit_Bottom} />}
      {wolf3d.Wolf3D_Outfit_Footwear && <primitive object={wolf3d.Wolf3D_Outfit_Footwear} />}
    </>
  );
}

export default AvatarMeshes;
