import * as THREE from "three";
import {
  KIND_TIMING,
  RAISE_LINGER_MS,
  isStrokeKind,
  type GestureEvent,
  type GestureKind,
  type HandSide,
} from "./gesturePlanner";
import type { SpeechTimeline } from "./speechTimeline";
import type { SpeechLayerData } from "../types/behavior.types";

type JointKey =
  | "leftUpperArm"
  | "rightUpperArm"
  | "leftForeArm"
  | "rightForeArm"
  | "leftHand"
  | "rightHand";
type JointMap = Partial<Record<JointKey, THREE.Object3D>>;
type NamedBone = { object: THREE.Object3D; normalizedName: string };

/**
 * Tunables.
 *
 * The arms REST in whatever pose the animation gives them (hanging relaxed).
 * A gesture lifts a hand from there toward the "speaking pose" in front of the
 * body (unchanged from the earlier versions), performs the stroke around it,
 * and lets the hand sink back to rest.
 */
export const GESTURE_CONFIG = {
  /** Scales how far hands travel from the speaking pose during a gesture (1.2 = default; 1 = subtler). */
  amplitude: 1.2,
  /** Subtle life while a hand is raised (slow drift, finger breathing). */
  idleMotion: 1,
  /** Wrist/forearm roll (palm up / palm down) driven from the geometry of the rig. */
  wristRoll: true,
  /** Finger curl/extension. Disable if a rig's finger bones misbehave. */
  fingers: true,
  /** 0..1: how much of the animation's natural finger spread is closed while a hand is raised. */
  fingerAdduction: 0.55,
  /** Scales the torso turn / lean / shoulder lift that follow the gesturing arms (0 = off). */
  bodyFollow: 1,
};

const EPSILON = 1e-6;
/** Below this raise the arm is left exactly as animated. */
const RAISE_EPS = 2e-3;
const MAX_ROLL_RAD = THREE.MathUtils.degToRad(70);
const MAX_FLEX_RAD = THREE.MathUtils.degToRad(20);

// Channel layout (per hand). f/u/o are fractions of total arm length.
const F = 0; // forward
const U = 1; // up
const O = 2; // outward (away from the body midline)
const B = 3; // extra elbow flexion (shortens shoulder->wrist distance)
const P = 4; // palm orientation: +1 palm up, -1 palm down, 0 = as animated
const K = 5; // wrist flexion
const N = 6; // finger openness: <0 curled, >0 extended
const CHANNELS = 7;

const OMEGA = [9, 11, 9, 8, 8, 18, 7]; // spring stiffness per channel (rad/s)
const CH_MIN = [-0.12, -0.12, -0.12, -0.15, -1, -0.6, -1];
const CH_MAX = [0.28, 0.26, 0.26, 0.45, 1, 1, 1];
/** The hand lifts a touch quicker than it sinks back. */
const RAISE_OMEGA_UP = 9;
const RAISE_OMEGA_DOWN = 7;
/**
 * Lifting a hand from rest to gesture height takes at least this long; the lift starts early
 * enough that the hand is up by the time the stroke lands.
 */
const RISE_MIN_MS = 600;
/** Longest time the lift can start before an event's own start (events are sorted by start). */
const RISE_LEAD_MS = RISE_MIN_MS;
/** Raise at which the elbow flexion has fully changed over from the animation's to the solver's. */
const ELBOW_BLEND_RAISE = 0.35;
/** Integrate at least this often so low frame rates move like high ones. */
const MAX_STEP_SEC = 1 / 55;

type Template = [f: number, u: number, o: number, b: number, p: number, k: number, n: number];

/** How far each gesture kind moves the hand from the speaking pose (lead hand, intensity 1). */
const TEMPLATES: Record<GestureKind, Template> = {
  beat: [0.07, 0.09, 0.0, 0.1, 0.15, 0.35, -0.3],
  emphasis: [0.13, 0.11, 0.03, 0.22, 0.15, 0.3, -0.4],
  present: [0.17, 0.14, 0.08, 0.25, 0.75, 0, 0.2],
  question: [0.19, 0.15, 0.05, 0.25, 0.9, 0, 0.15],
  enumerate: [0.15, 0.16, 0.02, 0.3, 0.1, 0, -0.1],
  contrast: [0.12, 0.12, 0.14, 0.2, 0.55, 0, 0.1],
  inclusive: [0.12, 0.13, 0.18, 0.2, 0.85, 0, 0.2],
  self: [-0.06, 0.03, -0.06, 0.3, -0.2, 0, -0.1],
  negate: [0.08, 0.02, 0.16, 0.15, -0.7, 0, 0.15],
  shrug: [0.05, 0.06, 0.12, 0.3, 0.8, 0, 0.1],
};

const SUPPORT_SCALE = 0.6;

// The speaking pose a raised hand is lifted to — identical numbers to the earlier drivers.
const SPEAKING = { reach: 0.06, lift: 0.02, outward: 0.02, bend: 0.28 };

// Body that follows the arms (radians at full effect).
const BODY_YAW = 0.06;
const BODY_PITCH = 0.028;
/** Clavicle elevation of the side whose hand is up (shoulder girdle rises with the arm). */
const BODY_SHOULDER = 0.06;

// Finger curl per joint (radians at open = -1) and joint weights.
const FINGER_CURL = { Index: 0.45, Middle: 0.5, Ring: 0.55, Pinky: 0.6 } as const;
const FINGER_EXTEND = 0.12;
const JOINT_WEIGHT = [0.8, 1.0, 0.7];
type FingerName = keyof typeof FINGER_CURL;
const FINGER_NAMES: FingerName[] = ["Index", "Middle", "Ring", "Pinky"];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function clamp01(v: number): number {
  return THREE.MathUtils.clamp(v, 0, 1);
}

/** Minimum-jerk position profile: zero velocity AND acceleration at both ends. */
function minJerk(x: number): number {
  const t = clamp01(x);
  return t * t * t * (10 - 15 * t + 6 * t * t);
}

function smooth01(x: number): number {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
}

/**
 * How far a gesture has lifted its hand from rest: rises through the
 * preparation, stays up through the hold and a short linger, then sinks back.
 * (The planner makes `endMs` long enough for the whole sinking motion.)
 */
function raiseEnvelope(e: GestureEvent, ms: number): number {
  const rise = Math.max(RISE_MIN_MS, e.apexMs - e.startMs);
  const riseStart = e.apexMs - rise;
  if (ms <= riseStart) return 0;
  if (ms < e.apexMs) return minJerk((ms - riseStart) / rise);
  const fallStart = e.holdUntilMs + RAISE_LINGER_MS;
  if (ms <= fallStart) return 1;
  if (ms >= e.endMs) return 0;
  return 1 - minJerk((ms - fallStart) / Math.max(1, e.endMs - fallStart));
}

function normalizeBoneName(name: string): string {
  return name
    .toLowerCase()
    .replace(/mixamorig/g, "")
    .replace(/armature/g, "")
    .replace(/skeleton/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function isBone(object: THREE.Object3D): boolean {
  return (object as THREE.Bone).isBone === true || object.type === "Bone";
}

function findBone(bones: NamedBone[], aliases: string[]): THREE.Object3D | undefined {
  const normalizedAliases = aliases.map(normalizeBoneName);
  return bones.find(({ normalizedName }) =>
    normalizedAliases.some(
      (alias) => normalizedName === alias || normalizedName === `${alias}1` || normalizedName === `${alias}01`,
    ),
  )?.object;
}

function fingerAliases(side: HandSide, finger: FingerName, index: number): string[] {
  const S = side === "left" ? "Left" : "Right";
  const s = side === "left" ? "L" : "R";
  return [
    `${S}Hand${finger}${index}`,
    `${finger}${index}_${s}`,
    `${S}${finger}${index}`,
    `J_Bip_${s}_${finger}${index}`,
    `${s}Hand${finger}${index}`,
  ];
}

// Scratch objects (avoid per-frame allocations in the finger code).
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();

interface FingerChain {
  name: FingerName;
  bones: THREE.Object3D[];
  axisLocal: THREE.Vector3[];
  curl: number;
}

interface HandFrame {
  index1: THREE.Object3D;
  middle1: THREE.Object3D;
  pinky1: THREE.Object3D;
  /** +1 / -1: rotating about (pinky→index axis * sign) curls toward the palm. */
  curlSign: 1 | -1;
  fingers: FingerChain[];
}

interface HandState {
  /** Gesture offsets from the speaking pose (channels F..N), smoothed. */
  x: Float64Array;
  v: Float64Array;
  target: Float64Array;
  /** 0 = hand at rest as animated, 1 = hand at the speaking pose. */
  raise: number;
  raiseV: number;
  phase: number;
}

function newHandState(phase: number): HandState {
  return {
    x: new Float64Array(CHANNELS),
    v: new Float64Array(CHANNELS),
    target: new Float64Array(CHANNELS),
    raise: 0,
    raiseV: 0,
    phase,
  };
}

/** Exact critically damped spring step (frame-rate independent, no overshoot). */
function springStep(x: number, v: number, target: number, omega: number, dt: number): [number, number] {
  const d = x - target;
  const e = Math.exp(-omega * dt);
  const t = (v + omega * d) * dt;
  return [target + (d + t) * e, (v - omega * t) * e];
}

/**
 * Procedural, speech-aware arm and hand gestures.
 *
 *   1. The shared SpeechTimeline says which gesture happens when (derived from
 *      the words, pauses and punctuation of what is being spoken).
 *   2. Each active gesture gives a RAISE (how far the hand has left its rest
 *      pose) and a set of offsets around the speaking pose (reach, height,
 *      palm turn, wrist, fingers). Both go through critically damped springs,
 *      so overlapping gestures blend instead of snap.
 *   3. The hand target runs from the animation's own wrist (rest) to the
 *      speaking pose as the raise goes 0→1; an analytic two-bone solver puts
 *      the arm there. The elbow direction starts as the animation's own and
 *      eases into the standard "elbow back and down" one, so nothing pops when
 *      a gesture begins or ends.
 *   4. The body follows the arms a little: torso turn and lean and shoulder
 *      elevation are written to the speech layer for the head/breathing
 *      components to apply.
 *
 * Required frame order:
 *   1. removePreviousOffsets()
 *   2. AnimationMixer.update(delta)
 *   3. update(time, delta, nowMs, layer)
 */
export class AvatarHandGestureDriver {
  private root: THREE.Object3D | null = null;
  private joints: JointMap = {};
  private clavicles: Partial<Record<HandSide, THREE.Object3D>> = {};
  private frames: Partial<Record<HandSide, HandFrame | null>> = {};
  private previousBaseQuaternions = new Map<THREE.Object3D, THREE.Quaternion>();
  private nextBoneScanAt = Number.NEGATIVE_INFINITY;
  private hands: Record<HandSide, HandState> = {
    left: newHandState(0.7),
    right: newHandState(2.9),
  };

  constructor(private readonly timeline: SpeechTimeline) {}

  /** Current raise of a hand (0 = resting as animated, 1 = at the speaking pose). */
  getRaise(side: HandSide): number {
    return this.hands[side].raise;
  }

  setRoot(root: THREE.Object3D | null): void {
    if (root === this.root) return;
    this.removePreviousOffsets();
    this.root = root;
    this.joints = {};
    this.clavicles = {};
    this.frames = {};
    this.nextBoneScanAt = Number.NEGATIVE_INFINITY;
    this.hands = { left: newHandState(0.7), right: newHandState(2.9) };
  }

  /** Restore the animation's exact local quaternions before the mixer advances. */
  removePreviousOffsets(): void {
    for (const [bone, baseQuaternion] of this.previousBaseQuaternions) {
      bone.quaternion.copy(baseQuaternion);
    }
    this.previousBaseQuaternions.clear();
  }

  update(time: number, delta: number, nowMs: number, isTalking: boolean, layer: SpeechLayerData | null): void {
    const root = this.root;
    if (!root) return;
    const dt = Math.min(Math.max(delta, 0), 0.1);

    // ── Gesture targets + springs, sub-stepped so a slow frame rate moves like a fast one ──
    const steps = Math.min(8, Math.max(1, Math.ceil(dt / MAX_STEP_SEC)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const back = (steps - 1 - i) * h;
      this.integrate(time - back, nowMs - back * 1000, h, isTalking);
    }

    const left = this.hands.left;
    const right = this.hands.right;

    // ── Apply to the skeleton (arms at rest are left exactly as animated) ──
    // Shoulders first (shrug cue + the shoulder of a raised arm rises a little); the arms are then
    // solved from the lifted shoulder, so hands rise with it.
    const bodyScale = GESTURE_CONFIG.bodyFollow;
    const shrug = layer ? layer.shoulderLift : 0;
    const liftLeft = shrug + BODY_SHOULDER * bodyScale * smooth01(left.raise);
    const liftRight = shrug + BODY_SHOULDER * bodyScale * smooth01(right.raise);
    const anyRaised = left.raise > 0 || right.raise > 0;
    const anyShoulder = liftLeft > 1e-3 || liftRight > 1e-3;
    if (anyRaised || anyShoulder) {
      root.updateMatrixWorld(true);
      if (time >= this.nextBoneScanAt) this.resolveBones(time);
      const axes = this.getAvatarAxes();
      if (anyShoulder) this.liftShoulders(liftLeft, liftRight, axes.forward);
      if (anyRaised) {
        this.applyArm("left", left, -1, axes.forward, axes.up);
        this.applyArm("right", right, 1, axes.forward, axes.up);
      }
    }

    this.writeBody(layer);
  }

  dispose(): void {
    this.removePreviousOffsets();
    this.root = null;
    this.joints = {};
    this.clavicles = {};
    this.frames = {};
    this.hands = { left: newHandState(0.7), right: newHandState(2.9) };
  }

  /** One integration step: read the timeline at `nowMs`, update raise and offset springs by `dt`. */
  private integrate(time: number, nowMs: number, dt: number, isTalking: boolean): void {
    const left = this.hands.left;
    const right = this.hands.right;
    left.target.fill(0);
    right.target.fill(0);
    let leftRaise = 0;
    let rightRaise = 0;

    if (isTalking) {
      for (const e of this.timeline.events) {
        if (e.startMs - RISE_LEAD_MS > nowMs) break; // sorted by start
        if (nowMs > e.endMs) continue;
        const env = raiseEnvelope(e, nowMs);
        if (env <= 0) continue;
        const level = e.level * env;
        if (e.hand === "left") {
          if (level > leftRaise) leftRaise = level;
          this.evalEvent(e, nowMs, left.target, env);
        } else {
          if (level > rightRaise) rightRaise = level;
          this.evalEvent(e, nowMs, right.target, env);
        }
      }
    }

    for (const side of ["left", "right"] as const) {
      const h = this.hands[side];
      const raiseTarget = isTalking ? clamp01(side === "left" ? leftRaise : rightRaise) : 0;

      const [r, rv] = springStep(
        h.raise,
        h.raiseV,
        raiseTarget,
        raiseTarget > h.raise ? RAISE_OMEGA_UP : RAISE_OMEGA_DOWN,
        dt,
      );
      h.raise = r;
      h.raiseV = rv;
      if (h.raise < RAISE_EPS && raiseTarget === 0) {
        h.raise = 0;
        h.raiseV = 0;
      }

      // A little life while the hand is up: slow drift and finger breathing.
      const idle = GESTURE_CONFIG.idleMotion * smooth01(h.raise / 0.5);
      const ph = h.phase;
      h.target[F] += idle * (0.01 * Math.sin(time * 0.91 + ph) + 0.005 * Math.sin(time * 2.3 + ph * 2.1));
      h.target[U] += idle * (0.012 * Math.sin(time * 0.67 + ph * 1.7) + 0.005 * Math.sin(time * 1.9 + ph));
      h.target[O] += idle * 0.008 * Math.sin(time * 0.53 + ph * 0.6);
      h.target[K] += idle * 0.06 * Math.sin(time * 1.1 + ph * 1.3);
      h.target[N] += idle * 0.08 * Math.sin(time * 0.43 + ph);

      for (let c = 0; c < CHANNELS; c++) {
        h.target[c] = THREE.MathUtils.clamp(h.target[c], CH_MIN[c], CH_MAX[c]);
        const retracting = c <= B && Math.abs(h.target[c]) < Math.abs(h.x[c]);
        const [x, v] = springStep(h.x[c], h.v[c], h.target[c], OMEGA[c] * (retracting ? 0.7 : 1), dt);
        h.x[c] = x;
        h.v[c] = v;
      }
    }
  }

  // ───────────────────────────────────────────────────────────
  // Gesture evaluation
  // ───────────────────────────────────────────────────────────
  /** `env` = this event's raise envelope (0..1), used to fade its spatial variation in and out. */
  private evalEvent(e: GestureEvent, ms: number, out: Float64Array, env: number): void {
    const tpl = TEMPLATES[e.kind];
    const scale = e.intensity * (e.role === "support" ? SUPPORT_SCALE : 1);
    const timing = KIND_TIMING[e.kind];
    const prep = Math.max(120, e.apexMs - e.startMs);

    // Where in the gesture space this particular gesture happens (follows the raise).
    out[F] += e.jitter[0] * env;
    out[U] += e.jitter[1] * env;
    out[O] += e.jitter[2] * env;

    if (isStrokeKind(e.kind)) {
      // Beat / emphasis: lift in preparation, snap down on the stressed syllable, settle.
      const u = (ms - e.apexMs) / 1000;
      const prepS = prep / 1000;
      const settleS = Math.max(0.2, timing.retract / 1000);
      let lift = 0;
      if (u >= -prepS) {
        if (u < -0.04) lift = minJerk((u + prepS) / (prepS - 0.04));
        else if (u < 0.09) lift = 1 - 1.35 * minJerk((u + 0.04) / 0.13);
        else lift = -0.35 * (1 - minJerk((u - 0.09) / Math.max(0.1, settleS - 0.09)));
      }
      let push = 0;
      if (u >= -0.25 && u < 0) push = minJerk((u + 0.25) / 0.25);
      else if (u >= 0 && u < 0.38) push = 1 - minJerk(u / 0.38);
      let flick = 0;
      if (u >= -0.06 && u < 0.02) flick = minJerk((u + 0.06) / 0.08);
      else if (u >= 0.02 && u < 0.32) flick = 1 - minJerk((u - 0.02) / 0.3);

      out[F] += tpl[0] * push * scale;
      out[U] += tpl[1] * lift * scale;
      out[O] += tpl[2] * push * scale;
      out[B] += tpl[3] * push * scale;
      out[P] += tpl[4] * push * scale;
      out[K] += tpl[5] * flick * scale;
      out[N] += tpl[6] * flick * scale;
      return;
    }

    // Hold-type gesture: rise (minimum-jerk) → hold with a slow living wobble → release.
    let k: number;
    if (ms < e.apexMs) k = minJerk((ms - e.startMs) / prep);
    else if (ms <= e.holdUntilMs) k = 1;
    else k = 1 - minJerk((ms - e.holdUntilMs) / Math.max(200, timing.retract));

    let live = 1;
    if (ms >= e.apexMs && ms <= e.holdUntilMs) {
      const held = (ms - e.apexMs) / 1000;
      live = 1 + 0.06 * Math.sin(held * 2.1 + (e.apexMs % 6283) * 0.001) * minJerk(held / 0.4);
    }
    const g = k * scale * live;
    const step = e.step;
    out[F] += tpl[0] * g;
    out[U] += (tpl[1] + (e.kind === "enumerate" ? step * 0.02 : 0)) * g;
    out[O] += (tpl[2] + (e.kind === "enumerate" ? step * 0.025 : 0)) * g;
    out[B] += tpl[3] * g;
    out[P] += tpl[4] * g;
    out[K] += tpl[5] * g;
    out[N] += tpl[6] * g;
  }

  /**
   * Torso motion that goes with the arms: turn toward the gesturing side and lean in a little.
   * Written to the speech layer; the spine component applies it after the arms are solved, so
   * the hands travel with the body.
   */
  private writeBody(layer: SpeechLayerData | null): void {
    if (!layer) return;
    const k = GESTURE_CONFIG.bodyFollow;
    const l = this.hands.left;
    const r = this.hands.right;
    if (k <= 0 || (l.raise <= 0 && r.raise <= 0)) {
      layer.torsoYaw = 0;
      return;
    }
    const activity = (h: HandState) => h.raise * (0.5 + 1.7 * THREE.MathUtils.clamp(h.x[F] + Math.max(0, h.x[O]), 0, 0.3));
    const reach = (h: HandState) => h.raise * clamp01(h.x[F] / 0.2);
    // Turning right (negative yaw) when the right hand gestures, left when the left one does.
    layer.torsoYaw = BODY_YAW * k * (activity(l) - activity(r));
    layer.torsoPitch += BODY_PITCH * k * Math.max(reach(l), reach(r));
  }

  /**
   * Raise the clavicles about the avatar's forward axis (left up = +, right up = −). The upper
   * arm is counter-rotated so it keeps its world orientation: the shoulder joint rises and the
   * arm still hangs, instead of the whole arm swinging out like a pendulum.
   */
  private liftShoulders(left: number, right: number, forward: THREE.Vector3): void {
    this.liftShoulder("left", left, forward);
    this.liftShoulder("right", right, forward);
  }

  private liftShoulder(side: HandSide, amount: number, forward: THREE.Vector3): void {
    const clavicle = this.clavicles[side];
    const upperArm = this.joints[`${side}UpperArm` as JointKey];
    if (!clavicle || amount <= 1e-3) return;
    const q = new THREE.Quaternion().setFromAxisAngle(forward, side === "left" ? amount : -amount);
    this.applyWorldDelta(clavicle, q);
    if (upperArm) this.applyWorldDelta(upperArm, q.clone().invert());
  }

  // ───────────────────────────────────────────────────────────
  // Rig access
  // ───────────────────────────────────────────────────────────
  private resolveBones(time: number): void {
    const root = this.root;
    if (!root) return;
    const complete =
      this.joints.leftUpperArm &&
      this.joints.rightUpperArm &&
      this.joints.leftForeArm &&
      this.joints.rightForeArm &&
      this.joints.leftHand &&
      this.joints.rightHand;
    // Skeletons don't change after load: once everything is found, stop scanning.
    this.nextBoneScanAt = complete ? Number.POSITIVE_INFINITY : time + 1.5;
    if (complete) return;

    const bones: NamedBone[] = [];
    root.traverse((object) => {
      if (isBone(object)) bones.push({ object, normalizedName: normalizeBoneName(object.name) });
    });

    this.joints = {
      leftUpperArm: findBone(bones, ["LeftArm", "LeftUpperArm", "Arm_L", "UpperArm_L", "UpperArmLeft", "LUpperArm", "J_Bip_L_UpperArm"]),
      rightUpperArm: findBone(bones, ["RightArm", "RightUpperArm", "Arm_R", "UpperArm_R", "UpperArmRight", "RUpperArm", "J_Bip_R_UpperArm"]),
      leftForeArm: findBone(bones, ["LeftForeArm", "LeftForearm", "LeftLowerArm", "ForeArm_L", "LowerArm_L", "ForeArmLeft", "LForeArm", "LForearm", "J_Bip_L_LowerArm"]),
      rightForeArm: findBone(bones, ["RightForeArm", "RightForearm", "RightLowerArm", "ForeArm_R", "LowerArm_R", "ForeArmRight", "RForeArm", "RForearm", "J_Bip_R_LowerArm"]),
      leftHand: findBone(bones, ["LeftHand", "Hand_L", "LeftWrist", "HandLeft", "LHand", "Wrist_L", "J_Bip_L_Hand"]),
      rightHand: findBone(bones, ["RightHand", "Hand_R", "RightWrist", "HandRight", "RHand", "Wrist_R", "J_Bip_R_Hand"]),
    };

    this.clavicles = {
      left: findBone(bones, ["LeftShoulder", "LeftClavicle", "Shoulder_L", "Clavicle_L", "ShoulderLeft", "LShoulder", "LClavicle", "J_Bip_L_Shoulder"]),
      right: findBone(bones, ["RightShoulder", "RightClavicle", "Shoulder_R", "Clavicle_R", "ShoulderRight", "RShoulder", "RClavicle", "J_Bip_R_Shoulder"]),
    };

    this.frames = {};
    for (const side of ["left", "right"] as const) {
      const index1 = findBone(bones, fingerAliases(side, "Index", 1));
      const middle1 = findBone(bones, fingerAliases(side, "Middle", 1));
      const pinky1 = findBone(bones, fingerAliases(side, "Pinky", 1));
      const hand = this.joints[`${side}Hand` as JointKey];
      if (!hand || !index1 || !middle1 || !pinky1) {
        this.frames[side] = null;
        continue;
      }
      const fingers: FingerChain[] = [];
      for (const name of FINGER_NAMES) {
        const chain: THREE.Object3D[] = [];
        for (let j = 1; j <= 3; j++) {
          const bone = findBone(bones, fingerAliases(side, name, j));
          if (bone) chain.push(bone);
        }
        if (chain.length === 3) fingers.push({ name, bones: chain, axisLocal: [], curl: FINGER_CURL[name] });
      }
      this.frames[side] = {
        index1,
        middle1,
        pinky1,
        curlSign: side === "right" ? 1 : -1,
        fingers,
      };
    }
    this.calibrateFingers();
  }

  /**
   * The finger hinge axis is the knuckle line (pinky → index). Express it in
   * every phalanx's local frame once, so curling later is a cheap local
   * rotation that works regardless of how the rig's bones are oriented.
   */
  private calibrateFingers(): void {
    for (const side of ["left", "right"] as const) {
      const frame = this.frames[side];
      const hand = this.joints[`${side}Hand` as JointKey];
      if (!frame || !hand) continue;
      hand.updateWorldMatrix(true, true);
      const across = this.knuckleAxis(frame, _v1);
      for (const finger of frame.fingers) {
        finger.axisLocal = finger.bones.map((bone) => {
          bone.getWorldQuaternion(_q1);
          return across.clone().applyQuaternion(_q1.invert()).normalize();
        });
      }
    }
  }

  /** Unit vector pinky→index in world space. */
  private knuckleAxis(frame: HandFrame, out: THREE.Vector3): THREE.Vector3 {
    frame.pinky1.getWorldPosition(_v2);
    frame.index1.getWorldPosition(_v3);
    return out.copy(_v3).sub(_v2).normalize();
  }

  /**
   * Palm normal (pointing out of the palm) from hand chirality alone:
   * right hand n = across × fingers, left hand n = fingers × across.
   * Independent of the pose the animation happens to be in.
   */
  private palmNormal(frame: HandFrame, hand: THREE.Object3D, out: THREE.Vector3): THREE.Vector3 {
    const across = this.knuckleAxis(frame, _v1);
    hand.getWorldPosition(_v2);
    frame.middle1.getWorldPosition(_v3);
    const fingers = _v3.sub(_v2).normalize();
    if (frame.curlSign === 1) out.crossVectors(across, fingers);
    else out.crossVectors(fingers, across);
    return out.normalize();
  }

  private getAvatarAxes(): { forward: THREE.Vector3; up: THREE.Vector3 } {
    const q = this.root?.getWorldQuaternion(_q2) ?? _q2.identity();
    return {
      forward: new THREE.Vector3(0, 0, 1).applyQuaternion(q).normalize(),
      up: new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize(),
    };
  }

  // ───────────────────────────────────────────────────────────
  // Arm solve (shoulder → elbow → wrist), then hand + fingers
  // ───────────────────────────────────────────────────────────
  private applyArm(
    side: HandSide,
    state: HandState,
    sideSign: -1 | 1,
    forward: THREE.Vector3,
    up: THREE.Vector3,
  ): void {
    const raise = Math.min(state.raise, 1);
    if (raise < RAISE_EPS) return;

    const upperArm = this.joints[`${side}UpperArm` as JointKey];
    const foreArm = this.joints[`${side}ForeArm` as JointKey];
    const hand = this.joints[`${side}Hand` as JointKey];
    const root = this.root;
    if (!root || !upperArm || !foreArm || !hand) return;

    const amp = GESTURE_CONFIG.amplitude;
    // Offsets, palm turn, wrist and fingers fade in over the first half of the lift.
    const presence = smooth01(raise / 0.5);

    const shoulder = upperArm.getWorldPosition(new THREE.Vector3());
    const elbowAnim = foreArm.getWorldPosition(new THREE.Vector3());
    const wristAnim = hand.getWorldPosition(new THREE.Vector3());
    const upperLength = shoulder.distanceTo(elbowAnim);
    const foreLength = elbowAnim.distanceTo(wristAnim);
    const totalLength = upperLength + foreLength;
    if (upperLength < EPSILON || foreLength < EPSILON || totalLength < EPSILON) return;

    // True lateral side of this arm from shoulder spacing, not a bone-local axis.
    const otherShoulderBone = this.joints[side === "left" ? "rightUpperArm" : "leftUpperArm"];
    const outward = otherShoulderBone
      ? shoulder.clone().sub(otherShoulderBone.getWorldPosition(new THREE.Vector3()))
      : new THREE.Vector3(1, 0, 0).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(sideSign);
    outward.addScaledVector(up, -outward.dot(up));
    if (outward.lengthSq() < EPSILON) outward.set(sideSign, 0, 0);
    outward.normalize();

    const minReach = Math.abs(upperLength - foreLength) + totalLength * 0.01;
    const maxReach = totalLength * 0.9995;

    // 1) The speaking pose (same formula and numbers as the earlier drivers).
    const speakingDir = shoulder.clone()
      .addScaledVector(forward, totalLength * (0.45 + SPEAKING.reach * 0.1))
      .addScaledVector(up, totalLength * (-0.36 + SPEAKING.lift * 0.08))
      .addScaledVector(outward, totalLength * (0.018 + SPEAKING.outward * 0.035))
      .sub(shoulder)
      .normalize();
    const speakingRadius = THREE.MathUtils.clamp(totalLength * (0.72 - 0.07 * SPEAKING.bend), minReach, maxReach);
    const speaking = shoulder.clone().addScaledVector(speakingDir, speakingRadius);

    // 2) Wrist target: from where the animation has the hand (rest) toward the speaking pose,
    //    plus this gesture's offsets (fractions of arm length).
    const target = wristAnim.clone().lerp(speaking, raise);
    target
      .addScaledVector(forward, state.x[F] * amp * totalLength * presence)
      .addScaledVector(up, state.x[U] * amp * totalLength * presence)
      .addScaledVector(outward, state.x[O] * amp * totalLength * presence);
    const toTarget = target.sub(shoulder);
    const ikDistance = THREE.MathUtils.clamp(
      toTarget.length() * (1 - 0.08 * state.x[B] * amp * presence),
      minReach,
      maxReach,
    );
    // A (nearly) straight rest arm needs a soft start: the elbow bulge grows as the square root of
    // how much the shoulder-wrist distance shrinks, so a hand moving along a straight line from rest
    // would kick the elbow out in the first few frames of every lift. For such arms the distance
    // eases from the animation's own to the solver's (the hand first swings along an arc, then comes
    // in), reaching the solver's by `ELBOW_BLEND_RAISE`. Relaxed (bent) arms are solved directly.
    const restDistance = THREE.MathUtils.clamp(wristAnim.distanceTo(shoulder), minReach, totalLength);
    const straightness = smooth01((restDistance / totalLength - 0.995) / 0.005);
    const blend = THREE.MathUtils.lerp(1, minJerk(raise / ELBOW_BLEND_RAISE), straightness);
    const distance = THREE.MathUtils.lerp(restDistance, ikDistance, blend);
    const reachDirection = toTarget.normalize();
    const reachableWrist = shoulder.clone().addScaledVector(reachDirection, distance);

    const along = THREE.MathUtils.clamp(
      (upperLength * upperLength - foreLength * foreLength + distance * distance) / (2 * distance),
      0,
      upperLength,
    );
    const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));

    // 3) Elbow direction. Standard: behind the forearm with a small outward bias (no "chicken
    //    wings"). It starts as the animation's own elbow direction and eases into the standard
    //    one, so the arm does not jump when a gesture begins.
    const poleReference = forward.clone().multiplyScalar(-0.84).addScaledVector(outward, 0.16);
    const standardPole = poleReference.clone().addScaledVector(reachDirection, -poleReference.dot(reachDirection));
    if (standardPole.lengthSq() < EPSILON) {
      standardPole.copy(forward).negate();
      standardPole.addScaledVector(reachDirection, -standardPole.dot(reachDirection));
    }
    if (standardPole.lengthSq() < EPSILON) return;
    if (standardPole.dot(forward.clone().negate()) < 0) standardPole.negate();
    standardPole.normalize();

    const pole = standardPole.clone();
    const animDirection = wristAnim.clone().sub(shoulder).normalize();
    const animElbow = elbowAnim.clone().sub(shoulder);
    const animBulge = animElbow.addScaledVector(animDirection, -animElbow.dot(animDirection));
    if (animBulge.length() > totalLength * 1e-3) {
      animBulge.normalize();
      animBulge.addScaledVector(reachDirection, -animBulge.dot(reachDirection));
      if (animBulge.lengthSq() > 1e-4) {
        animBulge.normalize();
        pole.copy(animBulge).lerp(standardPole, smooth01(raise / 0.35));
        if (pole.lengthSq() < 1e-6) pole.copy(standardPole);
        pole.normalize();
      }
    }

    const desiredElbow = shoulder.clone()
      .addScaledVector(reachDirection, along)
      .addScaledVector(pole, height);

    this.rotateSegmentToward(upperArm, foreArm, desiredElbow);

    const actualElbow = foreArm.getWorldPosition(new THREE.Vector3());
    const actualWrist = hand.getWorldPosition(new THREE.Vector3());
    const currentForearm = actualWrist.clone().sub(actualElbow);
    const desiredForearm = reachableWrist.clone().sub(actualElbow);
    if (currentForearm.lengthSq() > EPSILON && desiredForearm.lengthSq() > EPSILON) {
      this.applyWorldDelta(
        foreArm,
        new THREE.Quaternion().setFromUnitVectors(currentForearm.normalize(), desiredForearm.normalize()),
      );
    }

    // 4) Hand: palm roll, wrist flexion, finger spread and curl — scaled by presence.
    const frame = this.frames[side];
    if (!frame) return;
    this.applyHand(frame, state, foreArm, hand, up, presence);
  }

  private applyHand(
    frame: HandFrame,
    state: HandState,
    foreArm: THREE.Object3D,
    hand: THREE.Object3D,
    up: THREE.Vector3,
    weight: number,
  ): void {
    // Palm roll about the forearm axis, shared between forearm and hand to avoid a twisted wrist.
    const palm = state.x[P] * weight;
    if (GESTURE_CONFIG.wristRoll && Math.abs(palm) > 0.01) {
      const elbowPos = foreArm.getWorldPosition(new THREE.Vector3());
      const wristPos = hand.getWorldPosition(new THREE.Vector3());
      const axis = wristPos.sub(elbowPos);
      if (axis.lengthSq() > EPSILON) {
        axis.normalize();
        const n = this.palmNormal(frame, hand, new THREE.Vector3());
        const nProj = n.addScaledVector(axis, -n.dot(axis));
        const upProj = up.clone().addScaledVector(axis, -up.dot(axis));
        if (nProj.lengthSq() > 0.01 && upProj.lengthSq() > 0.04) {
          nProj.normalize();
          upProj.normalize();
          const dest = palm > 0 ? upProj : upProj.clone().negate();
          const cross = new THREE.Vector3().crossVectors(nProj, dest);
          const full = Math.atan2(axis.dot(cross), nProj.dot(dest));
          const roll = THREE.MathUtils.clamp(full * Math.min(1, Math.abs(palm)), -MAX_ROLL_RAD, MAX_ROLL_RAD);
          const half = new THREE.Quaternion().setFromAxisAngle(axis, roll * 0.5);
          this.applyWorldDelta(foreArm, half);
          this.applyWorldDelta(hand, half);
        }
      }
    }

    // Wrist flexion toward the palm (hinge = knuckle line).
    const flex = THREE.MathUtils.clamp(state.x[K] * weight, -0.6, 1) * MAX_FLEX_RAD;
    if (Math.abs(flex) > 1e-4) {
      hand.updateWorldMatrix(true, true);
      const axis = this.knuckleAxis(frame, new THREE.Vector3()).multiplyScalar(frame.curlSign);
      this.applyWorldDelta(hand, new THREE.Quaternion().setFromAxisAngle(axis, flex));
    }

    if (!GESTURE_CONFIG.fingers) return;

    // Close the animation's natural finger fan a little: a relaxed raised hand has its fingers
    // close together, not splayed.
    this.adductFingers(frame, hand, GESTURE_CONFIG.fingerAdduction * weight);

    // Finger curl/extension — local rotations, no matrix traversal.
    const open = state.x[N] * weight;
    if (Math.abs(open) > 0.005) {
      for (const finger of frame.fingers) {
        for (let j = 0; j < 3; j++) {
          const bone = finger.bones[j];
          const axis = finger.axisLocal[j];
          if (!axis) continue;
          const angle = (open < 0 ? -open * finger.curl : -open * FINGER_EXTEND) * JOINT_WEIGHT[j];
          if (!this.previousBaseQuaternions.has(bone)) this.previousBaseQuaternions.set(bone, bone.quaternion.clone());
          _q1.setFromAxisAngle(_v1.copy(axis).multiplyScalar(frame.curlSign), angle);
          bone.quaternion.multiply(_q1);
        }
      }
      hand.updateMatrixWorld(true);
    }
  }

  /**
   * Measure how far each finger fans away from the middle finger (in the plane
   * of the palm) and rotate its base joint back toward it by `strength`.
   * Self-limiting: if the animation's fingers are already together nothing moves.
   */
  private adductFingers(frame: HandFrame, hand: THREE.Object3D, strength: number): void {
    if (strength < 0.01) return;
    const middle = frame.fingers.find((f) => f.name === "Middle");
    if (!middle) return;

    hand.updateWorldMatrix(true, true);
    const n = this.palmNormal(frame, hand, new THREE.Vector3());
    const dm = this.fingerDirectionOnPalm(middle, n, new THREE.Vector3());
    if (dm.lengthSq() < 0.5) return;

    const dir = new THREE.Vector3();
    const cross = new THREE.Vector3();
    for (const finger of frame.fingers) {
      if (finger === middle) continue;
      if (this.fingerDirectionOnPalm(finger, n, dir).lengthSq() < 0.5) continue;
      cross.crossVectors(dm, dir);
      const angle = Math.atan2(n.dot(cross), dm.dot(dir));
      const correction = -angle * strength;
      if (Math.abs(correction) < 1e-4) continue;
      this.applyWorldDelta(finger.bones[0], _q1.setFromAxisAngle(n, correction).clone());
    }
  }

  /** Direction of a finger's first phalanx projected into the palm plane (unit, or ~zero if degenerate). */
  private fingerDirectionOnPalm(finger: FingerChain, palmNormal: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    finger.bones[0].getWorldPosition(_v3);
    finger.bones[1].getWorldPosition(_v4);
    out.copy(_v4).sub(_v3);
    out.addScaledVector(palmNormal, -out.dot(palmNormal));
    const len = out.length();
    if (len < EPSILON) return out.set(0, 0, 0);
    return out.divideScalar(len);
  }

  private rotateSegmentToward(
    bone: THREE.Object3D,
    childJoint: THREE.Object3D,
    desiredChildPosition: THREE.Vector3,
  ): void {
    const start = bone.getWorldPosition(new THREE.Vector3());
    const currentDirection = childJoint.getWorldPosition(new THREE.Vector3()).sub(start);
    const desiredDirection = desiredChildPosition.clone().sub(start);
    if (currentDirection.lengthSq() < EPSILON || desiredDirection.lengthSq() < EPSILON) return;
    this.applyWorldDelta(
      bone,
      new THREE.Quaternion().setFromUnitVectors(currentDirection.normalize(), desiredDirection.normalize()),
    );
  }

  private applyWorldDelta(bone: THREE.Object3D, worldDelta: THREE.Quaternion): void {
    if (!this.previousBaseQuaternions.has(bone)) {
      this.previousBaseQuaternions.set(bone, bone.quaternion.clone());
    }

    const currentWorld = bone.getWorldQuaternion(new THREE.Quaternion());
    const desiredWorld = worldDelta.clone().multiply(currentWorld).normalize();
    if (bone.parent) {
      const parentWorld = bone.parent.getWorldQuaternion(new THREE.Quaternion());
      bone.quaternion.copy(parentWorld.invert().multiply(desiredWorld).normalize());
    } else {
      bone.quaternion.copy(desiredWorld);
    }
    // Parent matrices are already valid; only this bone's subtree changed.
    bone.updateMatrixWorld(true);
  }
}
