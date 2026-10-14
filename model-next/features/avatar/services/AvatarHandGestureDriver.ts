import * as THREE from "three";
import {
  isStrokeKind,
  planFallbackGestures,
  type GestureEvent,
  type GestureKind,
  type GesturePlan,
  type HandSide,
} from "./gesturePlanner";

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
 * Tunables. The NEUTRAL speaking pose (where the hands rest while talking) is
 * deliberately unchanged from the previous driver; everything here only
 * controls how far hands travel AWAY from that pose and how they move.
 */
export const GESTURE_CONFIG = {
  /** Scales how far hands travel from the neutral pose (1.2 = default; 1 = subtler). */
  amplitude: 1.2,
  /** Subtle always-on life while talking (hand drift, finger breathing). */
  idleMotion: 1,
  /** Wrist/forearm roll (palm up / palm down) driven from the geometry of the rig. */
  wristRoll: true,
  /** Finger curl/extension. Disable if a rig's finger bones misbehave. */
  fingers: true,
  /** Seconds of silence before the arms are released back to the animation. */
  disengageDelaySec: 1.6,
};

const EPSILON = 1e-6;
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

type Template = [f: number, u: number, o: number, b: number, p: number, k: number, n: number];

/** How far each gesture kind moves the hand from the neutral pose (lead hand, intensity 1). */
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
};

const SUPPORT_SCALE = 0.6;

// Neutral speaking pose — identical numbers to the previous driver so hands rest in the same place.
const NEUTRAL = { reach: 0.06, lift: 0.02, outward: 0.02, bend: 0.28 };

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

// Scratch objects (avoid per-frame allocations).
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();

interface FingerChain {
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
  x: Float64Array;
  v: Float64Array;
  target: Float64Array;
  phase: number;
}

function newHandState(phase: number): HandState {
  return { x: new Float64Array(CHANNELS), v: new Float64Array(CHANNELS), target: new Float64Array(CHANNELS), phase };
}

/**
 * Procedural, speech-aware speaking gestures.
 *
 * Pipeline per frame:
 *   1. A GesturePlan (from gesturePlanner) says which gesture happens when,
 *      on the speech clock — derived from the actual words, pauses and
 *      punctuation of the sentence being spoken.
 *   2. Each active gesture is evaluated with minimum-jerk envelopes
 *      (preparation → stroke → hold → retraction) and summed per hand.
 *   3. The summed targets drive critically-damped springs (frame-rate
 *      independent, no overshoot), so overlapping gestures blend instead of snap.
 *   4. The smoothed pose goes through the same shoulder/elbow/wrist solver as
 *      before: neutral hand position unchanged, gestures are offsets from it.
 *
 * Required frame order:
 *   1. removePreviousOffsets()
 *   2. AnimationMixer.update(delta)
 *   3. update(time, delta, isTalking, speechMs?)
 */
export class AvatarHandGestureDriver {
  private root: THREE.Object3D | null = null;
  private joints: JointMap = {};
  private frames: Partial<Record<HandSide, HandFrame | null>> = {};
  private previousBaseQuaternions = new Map<THREE.Object3D, THREE.Quaternion>();
  private nextBoneScanAt = Number.NEGATIVE_INFINITY;

  private plan: GesturePlan | null = null;
  private planLocalStart = 0;
  private planPending = false;
  /** Once real speech arrived this engagement, never fall back to generic beats in the gaps. */
  private sawRealPlan = false;
  private fallbackPlan: GesturePlan | null = null;
  private fallbackStart = 0;
  private fallbackSeed = 1;

  private lastTalkingAt = Number.NEGATIVE_INFINITY;
  private engage = 0;
  private engageV = 0;
  private hands: Record<HandSide, HandState> = {
    left: newHandState(0.7),
    right: newHandState(2.9),
  };
  private cursor = 0;

  /** 0..1 pulse that peaks on stressed words; consumed by head/brow motion. */
  prosodyEmphasis = 0;

  setRoot(root: THREE.Object3D | null): void {
    if (root === this.root) return;
    this.removePreviousOffsets();
    this.root = root;
    this.joints = {};
    this.frames = {};
    this.nextBoneScanAt = Number.NEGATIVE_INFINITY;
    this.engage = 0;
    this.engageV = 0;
    this.hands = { left: newHandState(0.7), right: newHandState(2.9) };
  }

  /**
   * Give the driver the gesture plan for the sentence that is (about to be)
   * spoken. If update() is fed a synchronized speech clock (speechMs) the plan
   * follows it; otherwise it is timed from the moment it arrives.
   */
  setSpeech(plan: GesturePlan | null): void {
    this.plan = plan;
    this.planPending = plan !== null;
    if (plan) this.sawRealPlan = true;
    this.cursor = 0;
  }

  /** Restore the animation's exact local quaternions before the mixer advances. */
  removePreviousOffsets(): void {
    for (const [bone, baseQuaternion] of this.previousBaseQuaternions) {
      bone.quaternion.copy(baseQuaternion);
    }
    this.previousBaseQuaternions.clear();
  }

  update(time: number, delta: number, isTalking: boolean, speechMs?: number): void {
    const root = this.root;
    if (!root) return;

    root.updateMatrixWorld(true);
    if (time >= this.nextBoneScanAt) this.resolveBones(time);

    const dt = Math.min(Math.max(delta, 0), 0.1);

    // ── Engagement: arms come up when speech starts, linger through short silences ──
    if (isTalking) {
      if (this.engage < 0.01 && time - this.lastTalkingAt > GESTURE_CONFIG.disengageDelaySec) {
        this.fallbackStart = time;
        this.fallbackPlan = null;
        this.fallbackSeed += 7919;
      }
      this.lastTalkingAt = time;
    }
    if (this.planPending) {
      this.planLocalStart = time;
      this.planPending = false;
    }
    const engaged = time - this.lastTalkingAt < GESTURE_CONFIG.disengageDelaySec;
    this.stepEngage(engaged ? 1 : 0, engaged ? 4.2 : 2.6, dt);

    if (this.engage < 0.002 && !engaged) {
      this.engage = 0;
      this.engageV = 0;
      this.prosodyEmphasis = 0;
      this.sawRealPlan = false;
      for (const hand of ["left", "right"] as const) {
        this.hands[hand].x.fill(0);
        this.hands[hand].v.fill(0);
      }
      return;
    }

    // ── Pick the plan and the position on its clock ──
    let plan = this.plan;
    let ms = 0;
    let useEvents = true;
    if (plan) {
      ms = speechMs !== undefined ? speechMs : (time - this.planLocalStart) * 1000;
    } else if (this.sawRealPlan || !isTalking) {
      // Gap between sentences (or silence): hands rest at the neutral pose, no invented gestures.
      useEvents = false;
    } else {
      if (!this.fallbackPlan || (time - this.fallbackStart) * 1000 > this.fallbackPlan.durationMs - 5000) {
        this.fallbackPlan = planFallbackGestures(60000, this.fallbackSeed);
        this.fallbackStart = time;
      }
      plan = this.fallbackPlan;
      ms = (time - this.fallbackStart) * 1000;
    }

    // ── Evaluate gestures into per-hand targets ──
    const left = this.hands.left;
    const right = this.hands.right;
    left.target.fill(0);
    right.target.fill(0);
    let emphasis = 0;

    const events = useEvents && plan ? plan.events : [];
    const lo = ms - (plan?.maxSpanMs ?? 0);
    // Binary search for the first event that could still be active.
    let a = 0;
    let b = events.length;
    while (a < b) {
      const mid = (a + b) >> 1;
      if (events[mid].startMs < lo) a = mid + 1;
      else b = mid;
    }
    for (let i = a; i < events.length; i++) {
      const e = events[i];
      if (e.startMs > ms) break;
      if (ms > e.endMs) continue;
      const st = e.hand === "left" ? left.target : right.target;
      this.evalEvent(e, ms, st);
      if (e.role === "lead" && isStrokeKind(e.kind)) {
        const d = (ms - e.apexMs) / 110;
        emphasis = Math.max(emphasis, e.intensity * Math.exp(-d * d));
      }
    }
    this.prosodyEmphasis = emphasis * this.engage;

    // ── Idle life + spring integration ──
    const idle = GESTURE_CONFIG.idleMotion * this.engage;
    for (const side of ["left", "right"] as const) {
      const h = this.hands[side];
      const ph = h.phase;
      h.target[F] += idle * (0.010 * Math.sin(time * 0.91 + ph) + 0.005 * Math.sin(time * 2.3 + ph * 2.1));
      h.target[U] += idle * (0.012 * Math.sin(time * 0.67 + ph * 1.7) + 0.005 * Math.sin(time * 1.9 + ph));
      h.target[O] += idle * 0.008 * Math.sin(time * 0.53 + ph * 0.6);
      h.target[K] += idle * 0.06 * Math.sin(time * 1.1 + ph * 1.3);
      h.target[N] += idle * 0.08 * Math.sin(time * 0.43 + ph);
      for (let c = 0; c < CHANNELS; c++) {
        h.target[c] = THREE.MathUtils.clamp(h.target[c], CH_MIN[c], CH_MAX[c]);
        const retracting = c <= B && Math.abs(h.target[c]) < Math.abs(h.x[c]);
        this.stepSpring(h, c, OMEGA[c] * (retracting ? 0.7 : 1), dt);
      }
    }

    // ── Apply ──
    const axes = this.getAvatarAxes();
    this.applyArm("left", left, -1, axes.forward, axes.up);
    this.applyArm("right", right, 1, axes.forward, axes.up);
  }

  dispose(): void {
    this.removePreviousOffsets();
    this.root = null;
    this.joints = {};
    this.frames = {};
    this.engage = 0;
    this.engageV = 0;
    this.plan = null;
  }

  // ───────────────────────────────────────────────────────────
  // Gesture evaluation
  // ───────────────────────────────────────────────────────────
  private evalEvent(e: GestureEvent, ms: number, out: Float64Array): void {
    const tpl = TEMPLATES[e.kind];
    const scale = e.intensity * (e.role === "support" ? SUPPORT_SCALE : 1);
    const prep = Math.max(120, e.apexMs - e.startMs);
    const retract = Math.max(200, e.endMs - e.holdUntilMs);

    if (isStrokeKind(e.kind)) {
      // Beat / emphasis: lift in preparation, snap down on the stressed syllable, settle.
      const u = (ms - e.apexMs) / 1000;
      const prepS = prep / 1000;
      const retractS = retract / 1000;
      let lift = 0;
      if (u >= -prepS) {
        if (u < -0.04) lift = minJerk((u + prepS) / (prepS - 0.04));
        else if (u < 0.09) lift = 1 - 1.35 * minJerk((u + 0.04) / 0.13);
        else lift = -0.35 * (1 - minJerk((u - 0.09) / Math.max(0.1, retractS - 0.09)));
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

    // Hold-type gesture: rise (minimum-jerk) → hold with a slow living wobble → retract.
    let env: number;
    if (ms < e.apexMs) env = minJerk((ms - e.startMs) / prep);
    else if (ms <= e.holdUntilMs) env = 1;
    else env = 1 - minJerk((ms - e.holdUntilMs) / retract);

    let live = 1;
    if (ms >= e.apexMs && ms <= e.holdUntilMs) {
      const held = (ms - e.apexMs) / 1000;
      live = 1 + 0.06 * Math.sin(held * 2.1 + e.apexMs * 0.001) * minJerk(held / 0.4);
    }
    const k = env * scale * live;
    const step = e.step;
    out[F] += tpl[0] * k;
    out[U] += (tpl[1] + (e.kind === "enumerate" ? step * 0.02 : 0)) * k;
    out[O] += (tpl[2] + (e.kind === "enumerate" ? step * 0.025 : 0)) * k;
    out[B] += tpl[3] * k;
    out[P] += tpl[4] * k;
    out[K] += tpl[5] * k;
    out[N] += tpl[6] * k;
  }

  private stepSpring(h: HandState, c: number, omega: number, dt: number): void {
    const d = h.x[c] - h.target[c];
    const e = Math.exp(-omega * dt);
    const t = (h.v[c] + omega * d) * dt;
    h.x[c] = h.target[c] + (d + t) * e;
    h.v[c] = (h.v[c] - omega * t) * e;
  }

  /** Critically damped spring on the engagement weight (smooth S-curve, no overshoot). */
  private stepEngage(target: number, omega: number, dt: number): void {
    const d = this.engage - target;
    const e = Math.exp(-omega * dt);
    const t = (this.engageV + omega * d) * dt;
    this.engage = THREE.MathUtils.clamp(target + (d + t) * e, 0, 1);
    this.engageV = (this.engageV - omega * t) * e;
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
        if (chain.length === 3) fingers.push({ bones: chain, axisLocal: [], curl: FINGER_CURL[name] });
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
    const upperArm = this.joints[`${side}UpperArm` as JointKey];
    const foreArm = this.joints[`${side}ForeArm` as JointKey];
    const hand = this.joints[`${side}Hand` as JointKey];
    const root = this.root;
    if (!root || !upperArm || !foreArm || !hand) return;

    const amp = GESTURE_CONFIG.amplitude;
    const w = this.engage;

    const shoulder = upperArm.getWorldPosition(new THREE.Vector3());
    const elbow = foreArm.getWorldPosition(new THREE.Vector3());
    const wrist = hand.getWorldPosition(new THREE.Vector3());
    const upperLength = shoulder.distanceTo(elbow);
    const foreLength = elbow.distanceTo(wrist);
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
    const maxReach = totalLength * 0.995;

    // 1) Neutral speaking pose — same formula and numbers as before.
    const neutralDir = shoulder.clone()
      .addScaledVector(forward, totalLength * (0.45 + NEUTRAL.reach * 0.1))
      .addScaledVector(up, totalLength * (-0.36 + NEUTRAL.lift * 0.08))
      .addScaledVector(outward, totalLength * (0.018 + NEUTRAL.outward * 0.035))
      .sub(shoulder)
      .normalize();
    const neutralRadius = THREE.MathUtils.clamp(totalLength * (0.72 - 0.07 * NEUTRAL.bend), minReach, maxReach);
    const target = shoulder.clone().addScaledVector(neutralDir, neutralRadius);

    // 2) Gesture offsets from the neutral pose (fractions of arm length).
    target
      .addScaledVector(forward, state.x[F] * amp * totalLength)
      .addScaledVector(up, state.x[U] * amp * totalLength)
      .addScaledVector(outward, state.x[O] * amp * totalLength);
    const toTarget = target.sub(shoulder);
    const dist = THREE.MathUtils.clamp(toTarget.length() * (1 - 0.08 * state.x[B] * amp), minReach, maxReach);
    const solvedWristTarget = shoulder.clone().addScaledVector(toTarget.normalize(), dist);

    // 3) Blend from the animation's own wrist to the solved one by engagement.
    const blendedWrist = wrist.clone().lerp(solvedWristTarget, w);
    const toWrist = blendedWrist.clone().sub(shoulder);
    const distance = toWrist.length();
    if (distance < EPSILON) return;

    const reachDistance = THREE.MathUtils.clamp(distance, minReach, maxReach);
    const reachDirection = toWrist.normalize();
    const reachableWrist = shoulder.clone().addScaledVector(reachDirection, reachDistance);

    const along = THREE.MathUtils.clamp(
      (upperLength * upperLength - foreLength * foreLength + reachDistance * reachDistance) / (2 * reachDistance),
      0,
      upperLength,
    );
    const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));

    // Elbow pole: mostly behind the forearm with a small outward bias (no "chicken wings").
    const poleReference = forward.clone().multiplyScalar(-0.84).addScaledVector(outward, 0.16);
    const pole = poleReference.clone().addScaledVector(reachDirection, -poleReference.dot(reachDirection));
    if (pole.lengthSq() < EPSILON) {
      pole.copy(forward).negate();
      pole.addScaledVector(reachDirection, -pole.dot(reachDirection));
    }
    if (pole.lengthSq() < EPSILON) return;
    if (pole.dot(forward.clone().negate()) < 0) pole.negate();
    pole.normalize();

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

    // 4) Hand: palm roll, wrist flexion, finger curl — scaled by engagement.
    const frame = this.frames[side];
    if (!frame) return;
    this.applyHand(frame, state, foreArm, hand, up, w);
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

    // Finger curl/extension — local rotations, no matrix traversal.
    const open = state.x[N] * weight;
    if (GESTURE_CONFIG.fingers && Math.abs(open) > 0.005) {
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
