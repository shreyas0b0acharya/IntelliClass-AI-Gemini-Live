import * as THREE from "three";

type ArmSide = "left" | "right";
type JointKey =
  | "leftUpperArm"
  | "rightUpperArm"
  | "leftForeArm"
  | "rightForeArm"
  | "leftHand"
  | "rightHand";
type JointMap = Partial<Record<JointKey, THREE.Object3D>>;
type ArmPose = { reach: number; lift: number; outward: number; bend: number };
type NamedBone = { object: THREE.Object3D; normalizedName: string };

const EPSILON = 1e-6;
const GESTURE_CYCLE_SECONDS = 4.65;

function clamp01(v: number): number {
  return THREE.MathUtils.clamp(v, 0, 1);
}

function smoothstep01(v: number): number {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
}

function envelope(phase: number, start: number, duration: number, fade = 0.22): number {
  const elapsed = phase - start;
  if (elapsed <= 0 || elapsed >= duration) return 0;
  return Math.min(smoothstep01(elapsed / fade), smoothstep01((duration - elapsed) / fade));
}

function normalizeBoneName(name: string): string {
  return name.toLowerCase()
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
  return bones.find(({ normalizedName }) => normalizedAliases.some((alias) =>
    normalizedName === alias || normalizedName === `${alias}1` || normalizedName === `${alias}01`,
  ))?.object;
}

function addPose(target: ArmPose, source: Partial<ArmPose>, weight: number): void {
  if (weight <= 0) return;
  target.reach += (source.reach ?? 0) * weight;
  target.lift += (source.lift ?? 0) * weight;
  target.outward += (source.outward ?? 0) * weight;
  target.bend += (source.bend ?? 0) * weight;
}

function newPose(): ArmPose {
  return { reach: 0, lift: 0, outward: 0, bend: 0 };
}

/**
 * Procedural speaking gestures using separate shoulder/elbow/wrist rotations.
 * The elbow pole is mostly backward (behind the forearm) with only a small
 * lateral component. This keeps upper arms close to the torso instead of
 * producing exaggerated outward "chicken wings".
 *
 * Required frame order:
 * 1. removePreviousOffsets()
 * 2. AnimationMixer.update(delta)
 * 3. update(time, delta, isTalking)
 */
export class AvatarHandGestureDriver {
  private root: THREE.Object3D | null = null;
  private joints: JointMap = {};
  private previousBaseQuaternions = new Map<THREE.Object3D, THREE.Quaternion>();
  private nextBoneScanAt = Number.NEGATIVE_INFINITY;
  private talkStartedAt = 0;
  private wasTalking = false;
  private talkingWeight = 0;

  setRoot(root: THREE.Object3D | null): void {
    if (root === this.root) return;
    this.removePreviousOffsets();
    this.root = root;
    this.joints = {};
    this.nextBoneScanAt = Number.NEGATIVE_INFINITY;
    this.talkStartedAt = 0;
    this.wasTalking = false;
    this.talkingWeight = 0;
  }

  /** Restore the animation's exact local quaternions before the mixer advances. */
  removePreviousOffsets(): void {
    for (const [bone, baseQuaternion] of this.previousBaseQuaternions) {
      bone.quaternion.copy(baseQuaternion);
    }
    this.previousBaseQuaternions.clear();
    this.root?.updateMatrixWorld(true);
  }

  update(time: number, delta: number, isTalking: boolean): void {
    const root = this.root;
    if (!root) return;

    root.updateMatrixWorld(true);
    if (time >= this.nextBoneScanAt) this.resolveBones(time);

    if (isTalking && !this.wasTalking) this.talkStartedAt = time;
    this.wasTalking = isTalking;

    const safeDelta = Math.min(Math.max(delta, 0), 0.1);
    const blend = 1 - Math.exp(-7.5 * safeDelta);
    this.talkingWeight = THREE.MathUtils.lerp(this.talkingWeight, isTalking ? 1 : 0, blend);

    if (this.talkingWeight < 0.002) {
      if (!isTalking) this.talkStartedAt = time;
      return;
    }

    const elapsed = Math.max(0, time - this.talkStartedAt);
    const cycleIndex = Math.floor(elapsed / GESTURE_CYCLE_SECONDS);
    const phase = elapsed % GESTURE_CYCLE_SECONDS;
    const explain = envelope(phase, 0.20, 1.12, 0.24) * this.talkingWeight;
    const emphasis = envelope(phase, 1.58, 0.82, 0.18) * this.talkingWeight;
    const presenting = envelope(phase, 2.78, 1.08, 0.24) * this.talkingWeight;

    const left = newPose();
    const right = newPose();
    const sway = Math.sin(time * 1.35) * 0.012;

    // Neutral speaking pose: elbows relax down; hands stay near the torso.
    left.reach = 0.06 + sway;
    right.reach = 0.06 - sway;
    left.lift = 0.02;
    right.lift = 0.02;
    left.outward = 0.02;
    right.outward = 0.02;
    left.bend = 0.28;
    right.bend = 0.28;

    // Both hands move forward slightly while explaining.
    const explanation: Partial<ArmPose> = {
      reach: 0.24,
      lift: 0.25,
      outward: 0.035,
      bend: 0.55,
    };
    addPose(left, explanation, explain);
    addPose(right, explanation, explain);

    // Alternate subtle emphasis rather than lifting both elbows sideways.
    const leadingSide: ArmSide = cycleIndex % 2 === 0 ? "right" : "left";
    const leading: Partial<ArmPose> = {
      reach: 0.31,
      lift: 0.28,
      outward: 0.055,
      bend: 0.68,
    };
    const supporting: Partial<ArmPose> = {
      reach: 0.09,
      lift: 0.08,
      outward: 0.02,
      bend: 0.34,
    };
    addPose(leadingSide === "left" ? left : right, leading, emphasis);
    addPose(leadingSide === "left" ? right : left, supporting, emphasis);

    // A restrained presenting gesture with just one hand leading.
    const presentingLead: Partial<ArmPose> = {
      reach: 0.27,
      lift: 0.20,
      outward: 0.07,
      bend: 0.60,
    };
    const presentingSupport: Partial<ArmPose> = {
      reach: 0.07,
      lift: 0.05,
      outward: 0.02,
      bend: 0.32,
    };
    addPose(leadingSide === "left" ? left : right, presentingLead, presenting);
    addPose(leadingSide === "left" ? right : left, presentingSupport, presenting);

    const axes = this.getAvatarAxes();
    this.applyArmPose("left", left, -1, axes.forward, axes.right, axes.up);
    this.applyArmPose("right", right, 1, axes.forward, axes.right, axes.up);
  }

  dispose(): void {
    this.removePreviousOffsets();
    this.root = null;
    this.joints = {};
    this.wasTalking = false;
    this.talkingWeight = 0;
  }

  private resolveBones(time: number): void {
    this.nextBoneScanAt = time + 1.5;
    const root = this.root;
    if (!root) return;

    root.updateMatrixWorld(true);
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
  }

  private getAvatarAxes(): { forward: THREE.Vector3; right: THREE.Vector3; up: THREE.Vector3 } {
    const q = this.root?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
    return {
      forward: new THREE.Vector3(0, 0, 1).applyQuaternion(q).normalize(),
      right: new THREE.Vector3(1, 0, 0).applyQuaternion(q).normalize(),
      up: new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize(),
    };
  }

  private applyArmPose(
    side: ArmSide,
    pose: ArmPose,
    sideSign: -1 | 1,
    forward: THREE.Vector3,
    right: THREE.Vector3,
    up: THREE.Vector3,
  ): void {
    const upperArm = this.joints[`${side}UpperArm` as JointKey];
    const foreArm = this.joints[`${side}ForeArm` as JointKey];
    const hand = this.joints[`${side}Hand` as JointKey];
    const root = this.root;
    if (!root || !upperArm || !foreArm || !hand) return;

    root.updateMatrixWorld(true);
    const shoulder = upperArm.getWorldPosition(new THREE.Vector3());
    const elbow = foreArm.getWorldPosition(new THREE.Vector3());
    const wrist = hand.getWorldPosition(new THREE.Vector3());
    const upperLength = shoulder.distanceTo(elbow);
    const foreLength = elbow.distanceTo(wrist);
    const totalLength = upperLength + foreLength;
    if (upperLength < EPSILON || foreLength < EPSILON || totalLength < EPSILON) return;

    // Determine the arm's true lateral side from shoulder spacing, not a bone-local axis.
    const otherShoulderBone = this.joints[side === "left" ? "rightUpperArm" : "leftUpperArm"];
    let outward = otherShoulderBone
      ? shoulder.clone().sub(otherShoulderBone.getWorldPosition(new THREE.Vector3()))
      : right.clone().multiplyScalar(sideSign);
    outward.addScaledVector(up, -outward.dot(up));
    if (outward.lengthSq() < EPSILON) outward.copy(right).multiplyScalar(sideSign);
    outward.normalize();

    // The hands reach forward and slightly upward, but do not travel far sideways.
    // That removes the wide-arm pose seen in the previous screenshot.
    const wristTarget = shoulder.clone()
      .addScaledVector(forward, totalLength * (0.45 + pose.reach * 0.10))
      .addScaledVector(up, totalLength * (-0.36 + pose.lift * 0.08))
      .addScaledVector(outward, totalLength * (0.018 + pose.outward * 0.035));

    const targetOffset = wristTarget.clone().sub(shoulder);
    if (targetOffset.lengthSq() < EPSILON) return;

    const minReach = Math.abs(upperLength - foreLength) + totalLength * 0.01;
    const maxReach = totalLength * 0.995;
    // Control flexion by setting a comfortable shoulder-to-wrist distance.
    // A smaller radius bends the elbow more; the target direction still points
    // forward and down so the hands don't collapse toward the stomach.
    const preferredRadius = totalLength * (0.72 - 0.07 * clamp01(pose.bend));
    const targetRadius = THREE.MathUtils.clamp(preferredRadius, minReach, maxReach);
    const solvedWristTarget = shoulder.clone().addScaledVector(
      targetOffset.normalize(),
      targetRadius,
    );

    const blendedWrist = wrist.clone().lerp(solvedWristTarget, this.talkingWeight);
    const toWrist = blendedWrist.clone().sub(shoulder);
    const distance = toWrist.length();
    if (distance < EPSILON) return;

    const reachDistance = THREE.MathUtils.clamp(distance, minReach, maxReach);
    const reachDirection = toWrist.normalize();
    const reachableWrist = shoulder.clone().addScaledVector(reachDirection, reachDistance);

    // Solve the shoulder/elbow/wrist triangle with the law of cosines.
    const along = THREE.MathUtils.clamp(
      (upperLength * upperLength - foreLength * foreLength + reachDistance * reachDistance) / (2 * reachDistance),
      0,
      upperLength,
    );
    const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));

    // Elbow pole points mostly BACK from the wrist's direction, with a small
    // outward bias. It is deliberately NOT a pure lateral pole: that caused
    // the elbows to flare horizontally away from the torso.
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

    // Rotate upper arm and forearm separately. Each rotation is a world-space
    // delta converted through its parent's quaternion, so local axes can vary.
    this.rotateSegmentToward(upperArm, foreArm, desiredElbow);
    root.updateMatrixWorld(true);

    const actualElbow = foreArm.getWorldPosition(new THREE.Vector3());
    const actualWrist = hand.getWorldPosition(new THREE.Vector3());
    const currentForearm = actualWrist.sub(actualElbow);
    const desiredForearm = reachableWrist.clone().sub(actualElbow);
    if (currentForearm.lengthSq() > EPSILON && desiredForearm.lengthSq() > EPSILON) {
      this.applyWorldDelta(
        foreArm,
        new THREE.Quaternion().setFromUnitVectors(currentForearm.normalize(), desiredForearm.normalize()),
      );
    }
  }

  private rotateSegmentToward(
    bone: THREE.Object3D,
    childJoint: THREE.Object3D,
    desiredChildPosition: THREE.Vector3,
  ): void {
    const root = this.root;
    if (!root) return;
    root.updateMatrixWorld(true);
    const start = bone.getWorldPosition(new THREE.Vector3());
    const currentEnd = childJoint.getWorldPosition(new THREE.Vector3());
    const currentDirection = currentEnd.sub(start);
    const desiredDirection = desiredChildPosition.clone().sub(start);
    if (currentDirection.lengthSq() < EPSILON || desiredDirection.lengthSq() < EPSILON) return;
    this.applyWorldDelta(
      bone,
      new THREE.Quaternion().setFromUnitVectors(currentDirection.normalize(), desiredDirection.normalize()),
    );
  }

  private applyWorldDelta(bone: THREE.Object3D, worldDelta: THREE.Quaternion): void {
    const root = this.root;
    if (!root) return;

    if (!this.previousBaseQuaternions.has(bone)) {
      this.previousBaseQuaternions.set(bone, bone.quaternion.clone());
    }

    root.updateMatrixWorld(true);
    const currentWorld = bone.getWorldQuaternion(new THREE.Quaternion());
    const desiredWorld = worldDelta.clone().multiply(currentWorld).normalize();
    if (bone.parent) {
      const parentWorld = bone.parent.getWorldQuaternion(new THREE.Quaternion());
      bone.quaternion.copy(parentWorld.invert().multiply(desiredWorld).normalize());
    } else {
      bone.quaternion.copy(desiredWorld);
    }
    root.updateMatrixWorld(true);
  }
}
