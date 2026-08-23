"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useAvatarBehavior } from "./AvatarBehaviorContext";

interface AvatarEyeMovementProps {
    leftEye?: THREE.Bone | THREE.Object3D;
    rightEye?: THREE.Bone | THREE.Object3D;
    head?: THREE.Bone | THREE.Object3D;
    headFollow?: boolean;
    maxGazeYawDeg?: number;   // Maximum eye rotation left/right (natural range: 7 deg)
    maxGazePitchDeg?: number; // Maximum eye rotation up/down (natural range: 5 deg)
}

const _lEyeWorldPos = new THREE.Vector3();
const _rEyeWorldPos = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _dirWorldL = new THREE.Vector3();
const _dirWorldR = new THREE.Vector3();
const _dirLocalL = new THREE.Vector3();
const _dirLocalR = new THREE.Vector3();
const _parentQuatL = new THREE.Quaternion();
const _parentQuatR = new THREE.Quaternion();
const _invParentQuatL = new THREE.Quaternion();
const _invParentQuatR = new THREE.Quaternion();

export default function AvatarEyeMovement({
    leftEye,
    rightEye,
    head,
    headFollow = true,
    maxGazeYawDeg = 7,
    maxGazePitchDeg = 5,
}: AvatarEyeMovementProps) {
    const behaviorRef = useAvatarBehavior();
    const leftEyeRef = useRef<THREE.Bone | THREE.Object3D | undefined>(leftEye);
    const rightEyeRef = useRef<THREE.Bone | THREE.Object3D | undefined>(rightEye);
    const headRef = useRef<THREE.Bone | THREE.Object3D | undefined>(head);

    const baseLeftRot = useRef<THREE.Euler | null>(null);
    const baseRightRot = useRef<THREE.Euler | null>(null);

    const currentGazeYawL = useRef(0);
    const currentGazePitchL = useRef(0);
    const currentGazeYawR = useRef(0);
    const currentGazePitchR = useRef(0);

    useEffect(() => {
        leftEyeRef.current = leftEye;
        if (leftEye) {
            baseLeftRot.current = leftEye.rotation.clone();
        }
    }, [leftEye]);

    useEffect(() => {
        rightEyeRef.current = rightEye;
        if (rightEye) {
            baseRightRot.current = rightEye.rotation.clone();
        }
    }, [rightEye]);

    useEffect(() => {
        headRef.current = head;
    }, [head]);

    useFrame((state, delta) => {
        const lEye = leftEyeRef.current;
        const rEye = rightEyeRef.current;
        const hBone = headRef.current;

        if (!lEye && !rEye) return;

        // Ensure base rotations are captured
        if (lEye && !baseLeftRot.current) {
            baseLeftRot.current = lEye.rotation.clone();
        }
        if (rEye && !baseRightRot.current) {
            baseRightRot.current = rEye.rotation.clone();
        }

        const safeDelta = Math.min(delta, 0.1);
        _camPos.copy(state.camera.position);

        let targetGazeYawL = 0;
        let targetGazePitchL = 0;
        let targetGazeYawR = 0;
        let targetGazePitchR = 0;

        const maxYawRad = THREE.MathUtils.degToRad(maxGazeYawDeg);
        const maxPitchRad = THREE.MathUtils.degToRad(maxGazePitchDeg);

        if (headFollow) {
            // 1. LEFT EYE: Compute sightline to camera in head space with convergence
            if (lEye) {
                const parentL = lEye.parent || hBone;
                if (parentL) {
                    parentL.updateWorldMatrix(true, false);
                    lEye.getWorldPosition(_lEyeWorldPos);
                    _dirWorldL.subVectors(_camPos, _lEyeWorldPos).normalize();

                    parentL.getWorldQuaternion(_parentQuatL);
                    _invParentQuatL.copy(_parentQuatL).invert();
                    _dirLocalL.copy(_dirWorldL).applyQuaternion(_invParentQuatL);

                    const rawYawL = Math.atan2(_dirLocalL.x, _dirLocalL.z);
                    const distXZ_L = Math.sqrt(_dirLocalL.x * _dirLocalL.x + _dirLocalL.z * _dirLocalL.z);
                    const rawPitchL = Math.atan2(_dirLocalL.y, distXZ_L);

                    targetGazeYawL = THREE.MathUtils.clamp(rawYawL, -maxYawRad, maxYawRad);
                    targetGazePitchL = THREE.MathUtils.clamp(rawPitchL, -maxPitchRad, maxPitchRad);
                }
            }

            // 2. RIGHT EYE: Compute sightline to camera in head space with convergence
            if (rEye) {
                const parentR = rEye.parent || hBone;
                if (parentR) {
                    parentR.updateWorldMatrix(true, false);
                    rEye.getWorldPosition(_rEyeWorldPos);
                    _dirWorldR.subVectors(_camPos, _rEyeWorldPos).normalize();

                    parentR.getWorldQuaternion(_parentQuatR);
                    _invParentQuatR.copy(_parentQuatR).invert();
                    _dirLocalR.copy(_dirWorldR).applyQuaternion(_invParentQuatR);

                    const rawYawR = Math.atan2(_dirLocalR.x, _dirLocalR.z);
                    const distXZ_R = Math.sqrt(_dirLocalR.x * _dirLocalR.x + _dirLocalR.z * _dirLocalR.z);
                    const rawPitchR = Math.atan2(_dirLocalR.y, distXZ_R);

                    targetGazeYawR = THREE.MathUtils.clamp(rawYawR, -maxYawRad, maxYawRad);
                    targetGazePitchR = THREE.MathUtils.clamp(rawPitchR, -maxPitchRad, maxPitchRad);
                }
            }

            // If only one eye exists, mirror its angles
            if (!lEye && rEye) {
                targetGazeYawL = targetGazeYawR;
                targetGazePitchL = targetGazePitchR;
            } else if (!rEye && lEye) {
                targetGazeYawR = targetGazeYawL;
                targetGazePitchR = targetGazePitchL;
            }
        }

        // Add subtle organic micro-saccades and blinking dampener
        const behaviorGaze = behaviorRef.current.gaze;
        const microGaze = behaviorGaze.current;
        const isBlinking = behaviorRef.current.blink.isBlinking;

        // Micro-saccade influence (scaled to gentle living ocular tremor)
        const microWeight = isBlinking ? 0.0 : 0.04;
        const finalTargetYawL = targetGazeYawL + microGaze.x * microWeight;
        const finalTargetPitchL = targetGazePitchL + microGaze.y * microWeight;

        const finalTargetYawR = targetGazeYawR + microGaze.x * microWeight;
        const finalTargetPitchR = targetGazePitchR + microGaze.y * microWeight;

        // Smooth ocular transition
        const eyeSpeed = isBlinking ? 6.0 : 15.0;
        const smoothFactor = 1 - Math.exp(-eyeSpeed * safeDelta);

        currentGazeYawL.current = THREE.MathUtils.lerp(currentGazeYawL.current, finalTargetYawL, smoothFactor);
        currentGazePitchL.current = THREE.MathUtils.lerp(currentGazePitchL.current, finalTargetPitchL, smoothFactor);

        currentGazeYawR.current = THREE.MathUtils.lerp(currentGazeYawR.current, finalTargetYawR, smoothFactor);
        currentGazePitchR.current = THREE.MathUtils.lerp(currentGazePitchR.current, finalTargetPitchR, smoothFactor);

        // Apply rotation to LeftEye and RightEye bones directly
        if (lEye && baseLeftRot.current) {
            lEye.rotation.x = baseLeftRot.current.x - currentGazePitchL.current;
            lEye.rotation.y = baseLeftRot.current.y + currentGazeYawL.current;
        }

        if (rEye && baseRightRot.current) {
            rEye.rotation.x = baseRightRot.current.x - currentGazePitchR.current;
            rEye.rotation.y = baseRightRot.current.y + currentGazeYawR.current;
        }
    });

    return null;
}