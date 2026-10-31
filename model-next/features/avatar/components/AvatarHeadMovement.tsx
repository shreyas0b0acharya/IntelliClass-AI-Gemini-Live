"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useAvatarBehavior } from "./AvatarBehaviorContext";

interface AvatarHeadMovementProps {
  head?: THREE.Bone | THREE.Object3D;
  neck?: THREE.Bone | THREE.Object3D;
  spine2?: THREE.Bone | THREE.Object3D;
  spine1?: THREE.Bone | THREE.Object3D;
  spine?: THREE.Bone | THREE.Object3D;
  leftEye?: THREE.Bone | THREE.Object3D;
  rightEye?: THREE.Bone | THREE.Object3D;
  headFollow?: boolean;
  isAnimated?: boolean;
  maxYawDeg?: number;      // Maximum natural turn angle left/right (default: 65 deg)
  maxPitchUpDeg?: number;  // Maximum look up angle (default: 25 deg)
  maxPitchDownDeg?: number;// Maximum look down angle (default: 20 deg)
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Biomechanical recruitment thresholds (radians)
const T_CHEST_START = THREE.MathUtils.degToRad(20); // Spine2 stays 0 until 20 deg
const T_CHEST_FULL = THREE.MathUtils.degToRad(42); // Spine2 reaches full contribution by 42 deg
const T_SPINE_START = THREE.MathUtils.degToRad(38); // Lower spine stays 0 until 38 deg
const T_SPINE_FULL = THREE.MathUtils.degToRad(60); // Lower spine reaches full contribution by 60 deg

const T_PITCH_CHEST_START = THREE.MathUtils.degToRad(14); // Chest pitch stays 0 until 14 deg

// Reusable vectors to avoid per-frame GC allocations
const _anchorWorldPos = new THREE.Vector3();
const _lEyePos = new THREE.Vector3();
const _rEyePos = new THREE.Vector3();
const _camPos = new THREE.Vector3();

export function AvatarHeadMovement({
  head,
  neck,
  spine2,
  spine1,
  spine,
  leftEye,
  rightEye,
  headFollow = true,
  isAnimated = false,
  maxYawDeg = 65,
  maxPitchUpDeg = 25,
  maxPitchDownDeg = 20,
}: AvatarHeadMovementProps) {
  const behaviorRef = useAvatarBehavior();
  const headRef = useRef<THREE.Bone | THREE.Object3D | undefined>(head);
  const neckRef = useRef<THREE.Bone | THREE.Object3D | undefined>(neck);
  const spine2Ref = useRef<THREE.Bone | THREE.Object3D | undefined>(spine2);
  const spine1Ref = useRef<THREE.Bone | THREE.Object3D | undefined>(spine1);
  const spineRef = useRef<THREE.Bone | THREE.Object3D | undefined>(spine);
  const leftEyeRef = useRef<THREE.Bone | THREE.Object3D | undefined>(leftEye);
  const rightEyeRef = useRef<THREE.Bone | THREE.Object3D | undefined>(rightEye);

  const baseHeadRot = useRef<THREE.Euler | null>(null);
  const baseNeckRot = useRef<THREE.Euler | null>(null);
  const baseSpine2Rot = useRef<THREE.Euler | null>(null);
  const baseSpine1Rot = useRef<THREE.Euler | null>(null);
  const baseSpineRot = useRef<THREE.Euler | null>(null);

  // Progressive hierarchical follow states (Spine -> Spine1 -> Spine2 -> Neck -> Head)
  const spineYaw = useRef(0);
  const spinePitch = useRef(0);
  const spineRoll = useRef(0);

  const spine1Yaw = useRef(0);
  const spine1Pitch = useRef(0);
  const spine1Roll = useRef(0);

  const spine2Yaw = useRef(0);
  const spine2Pitch = useRef(0);
  const spine2Roll = useRef(0);

  const neckYaw = useRef(0);
  const neckPitch = useRef(0);
  const neckRoll = useRef(0);

  const headYaw = useRef(0);
  const headPitch = useRef(0);
  const headRoll = useRef(0);

  useEffect(() => {
    headRef.current = head;
    if (head) baseHeadRot.current = head.rotation.clone();
  }, [head]);

  useEffect(() => {
    neckRef.current = neck;
    if (neck) baseNeckRot.current = neck.rotation.clone();
  }, [neck]);

  useEffect(() => {
    spine2Ref.current = spine2;
    if (spine2) baseSpine2Rot.current = spine2.rotation.clone();
  }, [spine2]);

  useEffect(() => {
    spine1Ref.current = spine1;
    if (spine1) baseSpine1Rot.current = spine1.rotation.clone();
  }, [spine1]);

  useEffect(() => {
    spineRef.current = spine;
    if (spine) baseSpineRot.current = spine.rotation.clone();
  }, [spine]);

  useEffect(() => {
    leftEyeRef.current = leftEye;
  }, [leftEye]);

  useEffect(() => {
    rightEyeRef.current = rightEye;
  }, [rightEye]);

  useFrame((state, delta) => {
    const hBone = headRef.current;
    const nBone = neckRef.current;
    const s2Bone = spine2Ref.current;
    const s1Bone = spine1Ref.current;
    const sBone = spineRef.current;
    const lEye = leftEyeRef.current;
    const rEye = rightEyeRef.current;

    if (!hBone && !nBone && !s2Bone) return;

    const safeDelta = Math.min(delta, 0.1);

    let targetCamYaw = 0;
    let targetCamPitch = 0;

    if (headFollow) {
      // Compute true face/eye focal anchor in world space
      if (lEye && rEye) {
        lEye.getWorldPosition(_lEyePos);
        rEye.getWorldPosition(_rEyePos);
        _anchorWorldPos.addVectors(_lEyePos, _rEyePos).multiplyScalar(0.5);
      } else if (hBone) {
        hBone.getWorldPosition(_anchorWorldPos);
        // Adjust head bone pivot (base of skull) to face/eye height and forward position
        _anchorWorldPos.y += 0.08;
        _anchorWorldPos.z += 0.06;
      } else if (s2Bone) {
        s2Bone.getWorldPosition(_anchorWorldPos);
        _anchorWorldPos.y += 0.35;
      }

      _camPos.copy(state.camera.position);

      const dx = _camPos.x - _anchorWorldPos.x;
      const dy = _camPos.y - _anchorWorldPos.y;
      const dz = _camPos.z - _anchorWorldPos.z;

      // Compute raw yaw & pitch towards camera
      const rawYaw = Math.atan2(dx, dz);
      const distXZ = Math.sqrt(dx * dx + dz * dz);
      const rawPitch = -Math.atan2(dy, Math.max(distXZ, 0.001));

      // Clamp yaw and pitch to natural human range of motion
      const maxYawRad = THREE.MathUtils.degToRad(maxYawDeg);
      const minPitchRad = -THREE.MathUtils.degToRad(maxPitchUpDeg);
      const maxPitchRad = THREE.MathUtils.degToRad(maxPitchDownDeg);

      targetCamYaw = THREE.MathUtils.clamp(rawYaw, -maxYawRad, maxYawRad);
      targetCamPitch = THREE.MathUtils.clamp(rawPitch, minPitchRad, maxPitchRad);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // REALISTIC BIOMECHANICAL RECRUITMENT ZONES:
    // - Small angles (<= 20°): Spine is 100% still. Only Head & Neck turn.
    // - Moderate angles (20°-38°): Upper chest (Spine2) smoothly engages.
    // - Large angles (> 38°): Mid/Lower spine smoothly recruits to avoid neck strain.
    // ═════════════════════════════════════════════════════════════════════════
    const absYaw = Math.abs(targetCamYaw);
    const signYaw = Math.sign(targetCamYaw);

    // Spine2 (Chest) recruitment: 0 below 20 deg
    const rSpine2 = smoothstep(T_CHEST_START, T_CHEST_FULL, absYaw);
    const excessChestYaw = Math.max(0, absYaw - T_CHEST_START);
    const targetSpine2Yaw = signYaw * rSpine2 * Math.min(excessChestYaw * 0.45, THREE.MathUtils.degToRad(14));

    // Spine & Spine1 (Lower/Mid Torso) recruitment: 0 below 38 deg
    const rSpine = smoothstep(T_SPINE_START, T_SPINE_FULL, absYaw);
    const excessSpineYaw = Math.max(0, absYaw - T_SPINE_START);
    const targetSpine1Yaw = signYaw * rSpine * Math.min(excessSpineYaw * 0.30, THREE.MathUtils.degToRad(8));
    const targetSpineYaw = signYaw * rSpine * Math.min(excessSpineYaw * 0.20, THREE.MathUtils.degToRad(6));

    // Remaining yaw is shared by Cervical Neck (~42%) and Head (~58%)
    const torsoTotalYaw = targetSpineYaw + targetSpine1Yaw + targetSpine2Yaw;
    const remainingYaw = targetCamYaw - torsoTotalYaw;
    const targetNeckYaw = remainingYaw * 0.42;
    const targetHeadYaw = remainingYaw * 0.58;

    // Pitch (Up/Down) Recruitment: Only head/neck for small nods, chest assists for large tilts
    const absPitch = Math.abs(targetCamPitch);
    const signPitch = Math.sign(targetCamPitch);
    const rPitchChest = smoothstep(T_PITCH_CHEST_START, THREE.MathUtils.degToRad(25), absPitch);
    const excessChestPitch = Math.max(0, absPitch - T_PITCH_CHEST_START);
    const targetSpine2Pitch = signPitch * rPitchChest * excessChestPitch * 0.25;
    const remainingPitch = targetCamPitch - targetSpine2Pitch;
    const targetNeckPitch = remainingPitch * 0.38;
    const targetHeadPitch = remainingPitch * 0.62;

    // Subtle natural body and head roll with turn
    const targetSpineRoll = targetSpineYaw * -0.04;
    const targetSpine1Roll = targetSpine1Yaw * -0.05;
    const targetSpine2Roll = targetSpine2Yaw * -0.06;
    const targetNeckRoll = targetNeckYaw * -0.06;
    const targetHeadRoll = targetHeadYaw * -0.08;

    // Progressive Inertial Damping Speeds:
    // Head moves fastest, Neck follows, Chest glides, Lower Spine has natural physical weight
    const kHead = 1 - Math.exp(-8.5 * safeDelta);
    const kNeck = 1 - Math.exp(-7.0 * safeDelta);
    const kSpine2 = 1 - Math.exp(-5.0 * safeDelta);
    const kSpine1 = 1 - Math.exp(-4.0 * safeDelta);
    const kSpine = 1 - Math.exp(-3.2 * safeDelta);

    spineYaw.current = THREE.MathUtils.lerp(spineYaw.current, targetSpineYaw, kSpine);
    spinePitch.current = THREE.MathUtils.lerp(spinePitch.current, 0, kSpine);
    spineRoll.current = THREE.MathUtils.lerp(spineRoll.current, targetSpineRoll, kSpine);

    spine1Yaw.current = THREE.MathUtils.lerp(spine1Yaw.current, targetSpine1Yaw, kSpine1);
    spine1Pitch.current = THREE.MathUtils.lerp(spine1Pitch.current, 0, kSpine1);
    spine1Roll.current = THREE.MathUtils.lerp(spine1Roll.current, targetSpine1Roll, kSpine1);

    spine2Yaw.current = THREE.MathUtils.lerp(spine2Yaw.current, targetSpine2Yaw, kSpine2);
    spine2Pitch.current = THREE.MathUtils.lerp(spine2Pitch.current, targetSpine2Pitch, kSpine2);
    spine2Roll.current = THREE.MathUtils.lerp(spine2Roll.current, targetSpine2Roll, kSpine2);

    neckYaw.current = THREE.MathUtils.lerp(neckYaw.current, targetNeckYaw, kNeck);
    neckPitch.current = THREE.MathUtils.lerp(neckPitch.current, targetNeckPitch, kNeck);
    neckRoll.current = THREE.MathUtils.lerp(neckRoll.current, targetNeckRoll, kNeck);

    headYaw.current = THREE.MathUtils.lerp(headYaw.current, targetHeadYaw, kHead);
    headPitch.current = THREE.MathUtils.lerp(headPitch.current, targetHeadPitch, kHead);
    headRoll.current = THREE.MathUtils.lerp(headRoll.current, targetHeadRoll, kHead);

    const b = behaviorRef.current;
    const posture = b.head.current;
    const drift = b.head.drift;
    const breathNod = b.breathing.neckNod;
    // Context-driven layer (nods on stressed words, tilts on questions, glances away, lean and
    // turn that follow the gesturing arms). Already smoothed; added on top of everything else.
    const speech = b.speech;
    const spPitch = speech?.headPitch ?? 0;
    const spYaw = speech?.headYaw ?? 0;
    const spRoll = speech?.headRoll ?? 0;
    const torsoPitch = speech?.torsoPitch ?? 0;
    const torsoYaw = speech?.torsoYaw ?? 0;

    // When headFollow is active, keep wandering posture subtle so head stays focused on user
    const pWeight = headFollow ? 0.25 : 0.85;

    // Apply to bones with seamless blending of living micro-movements (layering on top of FBX animations):
    if (sBone) {
      const baseRot = !isAnimated && baseSpineRot.current ? baseSpineRot.current : null;
      sBone.rotation.x = (baseRot ? baseRot.x : sBone.rotation.x) + spinePitch.current + torsoPitch * 0.2;
      sBone.rotation.y = (baseRot ? baseRot.y : sBone.rotation.y) + spineYaw.current + torsoYaw * 0.2;
      sBone.rotation.z = (baseRot ? baseRot.z : sBone.rotation.z) + spineRoll.current;
    }

    if (s1Bone) {
      const baseRot = !isAnimated && baseSpine1Rot.current ? baseSpine1Rot.current : null;
      s1Bone.rotation.x = (baseRot ? baseRot.x : s1Bone.rotation.x) + spine1Pitch.current + torsoPitch * 0.35;
      s1Bone.rotation.y = (baseRot ? baseRot.y : s1Bone.rotation.y) + spine1Yaw.current + torsoYaw * 0.35;
      s1Bone.rotation.z = (baseRot ? baseRot.z : s1Bone.rotation.z) + spine1Roll.current;
    }

    if (s2Bone) {
      const baseRot = !isAnimated && baseSpine2Rot.current ? baseSpine2Rot.current : null;
      s2Bone.rotation.x = (baseRot ? baseRot.x : s2Bone.rotation.x) + spine2Pitch.current + drift.x * 0.25 + torsoPitch * 0.45;
      s2Bone.rotation.y = (baseRot ? baseRot.y : s2Bone.rotation.y) + spine2Yaw.current + drift.y * 0.25 + torsoYaw * 0.45;
      s2Bone.rotation.z = (baseRot ? baseRot.z : s2Bone.rotation.z) + spine2Roll.current + drift.z * 0.25;
    }

    if (nBone) {
      const baseRot = !isAnimated && baseNeckRot.current ? baseNeckRot.current : null;
      nBone.rotation.x = (baseRot ? baseRot.x : nBone.rotation.x) + neckPitch.current + posture.x * 0.35 * pWeight + drift.x * 0.5 + breathNod + spPitch * 0.35;
      nBone.rotation.y = (baseRot ? baseRot.y : nBone.rotation.y) + neckYaw.current + posture.y * 0.35 * pWeight + drift.y * 0.5 + spYaw * 0.4;
      nBone.rotation.z = (baseRot ? baseRot.z : nBone.rotation.z) + neckRoll.current + posture.z * 0.35 * pWeight + drift.z * 0.5 + spRoll * 0.4;
    }

    if (hBone) {
      const baseRot = !isAnimated && baseHeadRot.current ? baseHeadRot.current : null;
      hBone.rotation.x = (baseRot ? baseRot.x : hBone.rotation.x) + headPitch.current + posture.x * 0.65 * pWeight + drift.x * 0.75 + spPitch * 0.65;
      hBone.rotation.y = (baseRot ? baseRot.y : hBone.rotation.y) + headYaw.current + posture.y * 0.65 * pWeight + drift.y * 0.75 + spYaw * 0.6;
      hBone.rotation.z = (baseRot ? baseRot.z : hBone.rotation.z) + headRoll.current + posture.z * 0.65 * pWeight + drift.z * 0.75 + spRoll * 0.6;
    }
  });

  return null;
}

export default AvatarHeadMovement;
