"use client";

import type { AvatarGLTFResult } from "../types/avatar.types";

interface AvatarMeshesProps {
  nodes: AvatarGLTFResult["nodes"];
  materials: AvatarGLTFResult["materials"];
}

export function AvatarMeshes({
  nodes,
  materials,
}: AvatarMeshesProps) {
  return (
    <>
      <primitive object={nodes.Hips} />

      {nodes.AvatarBody && (
        <skinnedMesh
          geometry={nodes.AvatarBody.geometry}
          material={materials.AvatarBody}
          skeleton={nodes.AvatarBody.skeleton}
        />
      )}

      {nodes.AvatarLeftCornea && (
        <skinnedMesh
          geometry={nodes.AvatarLeftCornea.geometry}
          material={materials.AvatarLeftCornea}
          skeleton={nodes.AvatarLeftCornea.skeleton}
        />
      )}

      {nodes.AvatarLeftEyeball && (
        <skinnedMesh
          geometry={nodes.AvatarLeftEyeball.geometry}
          material={materials.AvatarLeftEyeball}
          skeleton={nodes.AvatarLeftEyeball.skeleton}
        />
      )}

      {nodes.AvatarRightCornea && (
        <skinnedMesh
          geometry={nodes.AvatarRightCornea.geometry}
          material={materials.AvatarRightCornea}
          skeleton={nodes.AvatarRightCornea.skeleton}
        />
      )}

      {nodes.AvatarRightEyeball && (
        <skinnedMesh
          geometry={nodes.AvatarRightEyeball.geometry}
          material={materials.AvatarRightEyeball}
          skeleton={nodes.AvatarRightEyeball.skeleton}
        />
      )}

      {nodes.AvatarTeethUpper && (
        <skinnedMesh
          geometry={nodes.AvatarTeethUpper.geometry}
          material={materials.AvatarTeethUpper}
          skeleton={nodes.AvatarTeethUpper.skeleton}
        />
      )}

      {nodes.outfit && (
        <skinnedMesh
          geometry={nodes.outfit.geometry}
          material={materials.outfit}
          skeleton={nodes.outfit.skeleton}
        />
      )}

      {nodes.outfit_bottom && (
        <skinnedMesh
          geometry={nodes.outfit_bottom.geometry}
          material={materials.outfit_bottom}
          skeleton={nodes.outfit_bottom.skeleton}
        />
      )}

      {nodes.outfit_shoes && (
        <skinnedMesh
          geometry={nodes.outfit_shoes.geometry}
          material={materials.outfit_shoes}
          skeleton={nodes.outfit_shoes.skeleton}
        />
      )}

      {nodes.outfit_top && (
        <skinnedMesh
          geometry={nodes.outfit_top.geometry}
          material={materials.outfit_top}
          skeleton={nodes.outfit_top.skeleton}
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
        />
      )}
    </>
  );
}

export default AvatarMeshes;
