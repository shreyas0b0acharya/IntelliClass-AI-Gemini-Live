import * as THREE from "three";

export type BehaviorState = "idle" | "listening" | "talking";

export interface BreathingData {
  chestExpansion: number; // 0..1 smoothed expansion (y/z translations)
  shoulderLift: number;   // 0..1 smoothed lift
  neckNod: number;        // subtle nod coupling on neck
  phase: number;          // 0..1 current cycle progress
  stage: "inhale" | "holdIn" | "exhale" | "holdOut";
}

export interface BlinkData {
  isBlinking: boolean;
  blinkProgress: number;  // 0 (open) to 1 (fully closed)
}

export interface GazeData {
  target: THREE.Vector2;  // x: yaw (left/right), y: pitch (up/down)
  current: THREE.Vector2; // current smoothed gaze
  isHoldingForBlink: boolean;
  lastSaccadeTime: number;
}

export interface HeadData {
  target: THREE.Vector3;  // pitch X, yaw Y, roll Z
  current: THREE.Vector3; // smoothed current posture
  speed: number;          // transition speed factor
  drift: THREE.Vector3;   // continuous living organic micro-tone
}

export interface EyebrowMorphData {
  browInnerUp: number;
  browOuterUpLeft: number;
  browOuterUpRight: number;
  browDownLeft: number;
  browDownRight: number;
}

export interface CheekMorphData {
  cheekSquintLeft: number;
  cheekSquintRight: number;
  noseSneerLeft: number;
  noseSneerRight: number;
  cheekPuff: number;
}

export interface MouthCornerMorphData {
  mouthSmileLeft: number;
  mouthSmileRight: number;
  mouthDimpleLeft: number;
  mouthDimpleRight: number;
  mouthPressLeft: number;
  mouthPressRight: number;
  mouthStretchLeft: number;
  mouthStretchRight: number;
}

export interface NostrilMorphData {
  noseSneerLeft: number;
  noseSneerRight: number;
}

export interface LipMorphData {
  mouthPressLeft: number;
  mouthPressRight: number;
  mouthRollLower: number;
  mouthRollUpper: number;
  mouthClose: number;
  mouthPucker: number;
}

/**
 * Context-driven layer written by the speech behaviour driver (from what is
 * actually being said) and ADDED on top of the random "living" behaviour by the
 * face / head / eye / breathing components. All values are smoothed.
 */
export interface SpeechLayerData {
  /** 0..1 — how much the avatar is currently "in speech". */
  active: number;

  // Face morph additions (0..1)
  browInnerUp: number;
  browOuterUpLeft: number;
  browOuterUpRight: number;
  browDownLeft: number;
  browDownRight: number;
  smileLeft: number;
  smileRight: number;
  cheekSquintLeft: number;
  cheekSquintRight: number;
  mouthPress: number;
  mouthFrown: number;
  eyeWide: number;
  eyeSquint: number;

  // Head & eyes (radians). Yaw: + = avatar's left. Pitch: head + = down, gaze + = up. Roll: + = tilt to avatar's right.
  headPitch: number;
  headYaw: number;
  headRoll: number;
  gazeYaw: number;
  gazePitch: number;

  // Body (radians). Cues (lean, shrug) write torsoPitch / shoulderLift (both shoulders); the arm
  // driver adds the part that follows the gesturing arms: torsoYaw (+ = turn toward avatar's
  // left) and a little extra forward lean. The torso values are applied by the head/spine
  // component; the shoulder lift is applied by the arm driver.
  torsoPitch: number;
  torsoYaw: number;
  shoulderLift: number;

  // Edge-triggered requests: the consumer acts when the counter changes.
  blinkRequest: number;
  inhaleRequest: number;
  /** Suggested length of the exhale that follows an inhale request (seconds). */
  exhaleSec: number;
}

export function createSpeechLayer(): SpeechLayerData {
  return {
    active: 0,
    browInnerUp: 0,
    browOuterUpLeft: 0,
    browOuterUpRight: 0,
    browDownLeft: 0,
    browDownRight: 0,
    smileLeft: 0,
    smileRight: 0,
    cheekSquintLeft: 0,
    cheekSquintRight: 0,
    mouthPress: 0,
    mouthFrown: 0,
    eyeWide: 0,
    eyeSquint: 0,
    headPitch: 0,
    headYaw: 0,
    headRoll: 0,
    gazeYaw: 0,
    gazePitch: 0,
    torsoPitch: 0,
    torsoYaw: 0,
    shoulderLift: 0,
    blinkRequest: 0,
    inhaleRequest: 0,
    exhaleSec: 2.4,
  };
}

export interface BehaviorStore {
  state: BehaviorState;
  breathing: BreathingData;
  blink: BlinkData;
  gaze: GazeData;
  head: HeadData;
  eyebrows: EyebrowMorphData;
  cheeks: CheekMorphData;
  mouthCorners: MouthCornerMorphData;
  nostrils: NostrilMorphData;
  lips: LipMorphData;
  speech?: SpeechLayerData;
}
