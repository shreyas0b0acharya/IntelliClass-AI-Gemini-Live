"use client";
/* eslint-disable react-hooks/immutability */

import { useMemo } from "react";
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
  }, [materials]);
  return (
    <>
      <primitive object={nodes.Hips} />

      {nodes.AvatarBody && (
        <skinnedMesh
          geometry={nodes.AvatarBody.geometry}
          material={materials.AvatarBody}
          skeleton={nodes.AvatarBody.skeleton}
          frustumCulled={false}
        />
      )}

      {nodes.AvatarLeftCornea && (
        <skinnedMesh
          geometry={nodes.AvatarLeftCornea.geometry}
          material={materials.AvatarLeftCornea}
          skeleton={nodes.AvatarLeftCornea.skeleton}
          frustumCulled={false}
        />
      )}

      {nodes.AvatarLeftEyeball && (
        <skinnedMesh
          geometry={nodes.AvatarLeftEyeball.geometry}
          material={materials.AvatarLeftEyeball}
          skeleton={nodes.AvatarLeftEyeball.skeleton}
          frustumCulled={false}
        />
      )}

      {nodes.AvatarRightCornea && (
        <skinnedMesh
          geometry={nodes.AvatarRightCornea.geometry}
          material={materials.AvatarRightCornea}
          skeleton={nodes.AvatarRightCornea.skeleton}
          frustumCulled={false}
        />
      )}

      {nodes.AvatarRightEyeball && (
        <skinnedMesh
          geometry={nodes.AvatarRightEyeball.geometry}
          material={materials.AvatarRightEyeball}
          skeleton={nodes.AvatarRightEyeball.skeleton}
          frustumCulled={false}
        />
      )}

      {nodes.AvatarTeethUpper && (
        <skinnedMesh
          geometry={nodes.AvatarTeethUpper.geometry}
          material={materials.AvatarTeethUpper}
          skeleton={nodes.AvatarTeethUpper.skeleton}
          frustumCulled={false}
        />
      )}

      {nodes.outfit && (
        <skinnedMesh
          geometry={nodes.outfit.geometry}
          material={materials.outfit}
          skeleton={nodes.outfit.skeleton}
          frustumCulled={false}
        />
      )}

      {nodes.outfit_bottom && (
        <skinnedMesh
          geometry={nodes.outfit_bottom.geometry}
          material={materials.outfit_bottom}
          skeleton={nodes.outfit_bottom.skeleton}
          frustumCulled={false}
        />
      )}

      {nodes.outfit_shoes && (
        <skinnedMesh
          geometry={nodes.outfit_shoes.geometry}
          material={materials.outfit_shoes}
          skeleton={nodes.outfit_shoes.skeleton}
          frustumCulled={false}
        />
      )}

      {nodes.outfit_top && (
        <skinnedMesh
          geometry={nodes.outfit_top.geometry}
          material={materials.outfit_top}
          skeleton={nodes.outfit_top.skeleton}
          frustumCulled={false}
        />
      )}

      {nodes.AvatarEyelashes && (
        <skinnedMesh
          name="AvatarEyelashes"
          geometry={nodes.AvatarEyelashes.geometry}
          material={materials.AvatarEyelashes}
          skeleton={nodes.AvatarEyelashes.skeleton}
          morphTargetDictionary={nodes.AvatarEyelashes.morphTargetDictionary}
          morphTargetInfluences={nodes.AvatarEyelashes.morphTargetInfluences}
          frustumCulled={false}
        />
      )}

      {nodes.AvatarHead && (
        <skinnedMesh
          name="AvatarHead"
          geometry={nodes.AvatarHead.geometry}
          material={materials.AvatarHead}
          skeleton={nodes.AvatarHead.skeleton}
          morphTargetDictionary={nodes.AvatarHead.morphTargetDictionary}
          morphTargetInfluences={nodes.AvatarHead.morphTargetInfluences}
          frustumCulled={false}
        />
      )}

      {nodes.AvatarTeethLower && (
        <skinnedMesh
          name="AvatarTeethLower"
          geometry={nodes.AvatarTeethLower.geometry}
          material={materials.AvatarTeethLower}
          skeleton={nodes.AvatarTeethLower.skeleton}
          morphTargetDictionary={nodes.AvatarTeethLower.morphTargetDictionary}
          morphTargetInfluences={nodes.AvatarTeethLower.morphTargetInfluences}
          frustumCulled={false}
        />
      )}
    </>
  );
}

export default AvatarMeshes;
