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

export interface ProsodyData {
  emphasis: number; // 0..1 pulse on stressed words (written by the hand gesture driver)
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
  prosody?: ProsodyData;
}
