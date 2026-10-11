"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { AvatarBehaviorContext } from "./AvatarBehaviorContext";
import type { BehaviorState, BehaviorStore } from "../types/behavior.types";

interface AvatarBehaviorControllerProps {
  behaviorState?: BehaviorState;
  isSpeaking?: boolean;
  children: React.ReactNode;
}

export function AvatarBehaviorController({
  behaviorState = "idle",
  isSpeaking = false,
  children,
}: AvatarBehaviorControllerProps) {
  // Initial mode for the store. The live mode is resolved inside useFrame so a
  // tiny gap between sentence audio chunks does not reset conversational motion.
  const initialMode: BehaviorState = isSpeaking ? "talking" : behaviorState;
  const lastSpeakingAt = useRef(Number.NEGATIVE_INFINITY);

  // Central Behavior Store Ref
  const store = useRef<BehaviorStore>({
    state: initialMode,
    breathing: {
      chestExpansion: 0,
      shoulderLift: 0,
      neckNod: 0,
      phase: 0,
      stage: "inhale",
    },
    blink: {
      isBlinking: false,
      blinkProgress: 0,
    },
    gaze: {
      target: new THREE.Vector2(0, 0),
      current: new THREE.Vector2(0, 0),
      isHoldingForBlink: false,
      lastSaccadeTime: 0,
    },
    head: {
      target: new THREE.Vector3(0, 0, 0),
      current: new THREE.Vector3(0, 0, 0),
      speed: 2.0,
      drift: new THREE.Vector3(0, 0, 0),
    },
    eyebrows: {
      browInnerUp: 0,
      browOuterUpLeft: 0,
      browOuterUpRight: 0,
      browDownLeft: 0,
      browDownRight: 0,
    },
    cheeks: {
      cheekSquintLeft: 0,
      cheekSquintRight: 0,
      noseSneerLeft: 0,
      noseSneerRight: 0,
      cheekPuff: 0,
    },
    mouthCorners: {
      mouthSmileLeft: 0,
      mouthSmileRight: 0,
      mouthDimpleLeft: 0,
      mouthDimpleRight: 0,
      mouthPressLeft: 0,
      mouthPressRight: 0,
      mouthStretchLeft: 0,
      mouthStretchRight: 0,
    },
    nostrils: {
      noseSneerLeft: 0,
      noseSneerRight: 0,
    },
    lips: {
      mouthPressLeft: 0,
      mouthPressRight: 0,
      mouthRollLower: 0,
      mouthRollUpper: 0,
      mouthClose: 0,
      mouthPucker: 0,
    },
  });

  // ─────────────────────────────────────────────────────────────
  // TIMING & SCHEDULING STATE (Internal Clocks)
  // ─────────────────────────────────────────────────────────────

  // Breathing cycle parameters (dynamically re-randomized each breath)
  const breathTimer = useRef(0);
  const breathParams = useRef({
    inhale: 1.8,
    holdIn: 0.15,
    exhale: 2.1,
    holdOut: 0.2,
    amplitude: 1.0,
    totalCycle: 4.25,
  });

  // Blink state machine
  const nextBlinkAt = useRef(2.5);
  const blinkPhase = useRef<"idle" | "closing" | "opening">("idle");
  const blinkStartTime = useRef(0);
  const isDoubleBlink = useRef(false);

  // Gaze & Eye-Head Coupling
  const nextGazeAt = useRef(1.2);
  const pendingHeadFollow = useRef<{
    target: THREE.Vector3;
    triggerAt: number;
    speed: number;
  } | null>(null);

  // Posture Shift Timer (Independent large posture realignment)
  const nextPostureShiftAt = useRef(8.0);

  // Staggered Facial Expression Event Schedulers (Rule 1: Never all at once)
  const lastExpressionAt = useRef(0);
  const nextEyebrowAt = useRef(4.0);
  const eyebrowResetAt = useRef(0);

  const nextCheekAt = useRef(6.0);
  const cheekResetAt = useRef(0);

  const nextMouthCornerAt = useRef(5.0);
  const mouthCornerResetAt = useRef(0);

  const nextNostrilAt = useRef(7.0);
  const nostrilResetAt = useRef(0);

  const nextLipAt = useRef(8.0);
  const lipResetAt = useRef(0);

  // ─────────────────────────────────────────────────────────────
  // CENTRAL FRAME UPDATE LOOP
  // ─────────────────────────────────────────────────────────────
  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const safeDelta = Math.min(delta, 0.1);
    const s = store.current;

    if (isSpeaking) lastSpeakingAt.current = t;
    const withinSpeechBoundaryGrace = t - lastSpeakingAt.current < 0.35;
    const currentMode: BehaviorState =
      isSpeaking || withinSpeechBoundaryGrace ? "talking" : behaviorState;
    s.state = currentMode;

    // ═════════════════════════════════════════════════════════════
    // 1. BREATHING ENGINE (Rule 4: Variable Non-Sine Human Rhythm)
    // ═════════════════════════════════════════════════════════════
    breathTimer.current += safeDelta;
    const bp = breathParams.current;

    if (breathTimer.current >= bp.totalCycle) {
      breathTimer.current = 0;
      // Generate next human breath variations based on current mode
      const baseInhale = currentMode === "talking" ? 1.4 : currentMode === "listening" ? 1.7 : 1.9;
      const baseExhale = currentMode === "talking" ? 1.6 : currentMode === "listening" ? 2.0 : 2.2;

      const inhale = THREE.MathUtils.randFloat(baseInhale - 0.2, baseInhale + 0.25);
      const holdIn = THREE.MathUtils.randFloat(0.08, 0.18);
      const exhale = THREE.MathUtils.randFloat(baseExhale - 0.2, baseExhale + 0.3);
      const holdOut = THREE.MathUtils.randFloat(0.12, 0.28);
      const amplitude = THREE.MathUtils.randFloat(0.88, 1.12);

      breathParams.current = {
        inhale,
        holdIn,
        exhale,
        holdOut,
        amplitude,
        totalCycle: inhale + holdIn + exhale + holdOut,
      };
    }

    const bTime = breathTimer.current;
    let breathValue = 0;

    if (bTime < bp.inhale) {
      s.breathing.stage = "inhale";
      const progress = bTime / bp.inhale;
      // Smooth ease-in-out cubic curve on inhale
      breathValue = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    } else if (bTime < bp.inhale + bp.holdIn) {
      s.breathing.stage = "holdIn";
      breathValue = 1.0;
    } else if (bTime < bp.inhale + bp.holdIn + bp.exhale) {
      s.breathing.stage = "exhale";
      const progress = (bTime - bp.inhale - bp.holdIn) / bp.exhale;
      // Smooth quadratic decay on exhale
      breathValue = Math.cos(progress * Math.PI * 0.5);
    } else {
      s.breathing.stage = "holdOut";
      breathValue = 0;
    }

    breathValue *= bp.amplitude;
    s.breathing.phase = bTime / bp.totalCycle;
    s.breathing.chestExpansion = THREE.MathUtils.lerp(s.breathing.chestExpansion, breathValue, 1 - Math.exp(-10 * safeDelta));
    s.breathing.shoulderLift = THREE.MathUtils.lerp(s.breathing.shoulderLift, breathValue, 1 - Math.exp(-8 * safeDelta));
    s.breathing.neckNod = (s.breathing.chestExpansion - 0.5) * 0.0035;

    // ═════════════════════════════════════════════════════════════
    // 2. BLINK STATE MACHINE & GAZE INTERACTION (Rule 3)
    // ═════════════════════════════════════════════════════════════
    if (blinkPhase.current === "idle" && t >= nextBlinkAt.current) {
      blinkPhase.current = "closing";
      blinkStartTime.current = t;
      isDoubleBlink.current = Math.random() < 0.16; // 16% chance of natural double blink
    }

    if (blinkPhase.current === "closing") {
      const elapsed = t - blinkStartTime.current;
      const closeDuration = 0.065; // ~65ms to shut eyelid
      const progress = Math.min(1.0, elapsed / closeDuration);
      s.blink.blinkProgress = progress;
      s.blink.isBlinking = true;

      if (progress >= 1.0) {
        blinkPhase.current = "opening";
        blinkStartTime.current = t;
      }
    } else if (blinkPhase.current === "opening") {
      const elapsed = t - blinkStartTime.current;
      const openDuration = 0.090; // ~90ms to reopen
      const progress = 1.0 - Math.min(1.0, elapsed / openDuration);
      s.blink.blinkProgress = progress;

      if (progress <= 0.0) {
        s.blink.isBlinking = false;
        if (isDoubleBlink.current) {
          isDoubleBlink.current = false;
          // Trigger rapid second blink in 80ms
          nextBlinkAt.current = t + 0.08;
        } else {
          // Schedule next normal blink window (based on mode)
          const interval = currentMode === "talking"
            ? THREE.MathUtils.randFloat(2.0, 4.2)
            : currentMode === "listening"
            ? THREE.MathUtils.randFloat(2.5, 5.0)
            : THREE.MathUtils.randFloat(3.2, 6.0);
          nextBlinkAt.current = t + interval;
        }
        blinkPhase.current = "idle";
      }
    }

    // Gaze is held / dampened during peak eyelid closure so eyes don't dart invisibly (Rule 3)
    s.gaze.isHoldingForBlink = s.blink.blinkProgress > 0.25;

    // ═════════════════════════════════════════════════════════════
    // 3. GAZE & EYE → HEAD COUPLING (Rule 2)
    // ═════════════════════════════════════════════════════════════
    if (t >= nextGazeAt.current) {
      const rand = Math.random();

      let targetYaw = 0;
      let targetPitch = 0;

      if (currentMode === "listening") {
        // LISTENING: 85% eye contact directly forward with viewer
        if (rand < 0.85) {
          targetYaw = THREE.MathUtils.randFloatSpread(0.04);
          targetPitch = THREE.MathUtils.randFloatSpread(0.03);
        } else {
          // 15% slight attentive glance
          const sign = Math.random() < 0.5 ? 1 : -1;
          targetYaw = THREE.MathUtils.randFloat(0.06, 0.12) * sign;
          targetPitch = THREE.MathUtils.randFloat(-0.02, 0.04);
        }
      } else if (currentMode === "talking") {
        // TALKING: 75% viewer engagement, 25% expressive glances
        if (rand < 0.75) {
          targetYaw = THREE.MathUtils.randFloatSpread(0.06);
          targetPitch = THREE.MathUtils.randFloatSpread(0.04);
        } else {
          const sign = Math.random() < 0.5 ? 1 : -1;
          targetYaw = THREE.MathUtils.randFloat(0.08, 0.14) * sign;
          targetPitch = THREE.MathUtils.randFloat(-0.03, 0.03);
        }
      } else {
        // IDLE_CALM: 65% direct center contact, 35% gentle living glances
        if (rand < 0.65) {
          targetYaw = THREE.MathUtils.randFloatSpread(0.04);
          targetPitch = THREE.MathUtils.randFloatSpread(0.03);
        } else {
          const sign = Math.random() < 0.5 ? 1 : -1;
          targetYaw = THREE.MathUtils.randFloat(0.08, 0.15) * sign;
          targetPitch = THREE.MathUtils.randFloat(-0.04, 0.04);
        }
      }

      s.gaze.target.set(targetYaw, targetPitch);
      s.gaze.lastSaccadeTime = t;

      // Eye → Head Coupling: Subtle head follow-up with 120ms–240ms delay (Rule 2)
      const headDelay = THREE.MathUtils.randFloat(0.12, 0.24);
      const headFollowYaw = targetYaw * 0.22;
      const headFollowPitch = targetPitch * 0.18;
      const headFollowRoll = targetYaw * -0.08;

      pendingHeadFollow.current = {
        target: new THREE.Vector3(headFollowPitch, headFollowYaw, headFollowRoll),
        triggerAt: t + headDelay,
        speed: THREE.MathUtils.randFloat(1.8, 2.6),
      };

      const gazeDwell = targetYaw === 0 && targetPitch === 0
        ? THREE.MathUtils.randFloat(2.5, 4.5)
        : THREE.MathUtils.randFloat(1.6, 3.2);

      nextGazeAt.current = t + gazeDwell;
    }

    // Apply pending head follow-up after the 120–240ms delay
    if (pendingHeadFollow.current && t >= pendingHeadFollow.current.triggerAt) {
      s.head.target.copy(pendingHeadFollow.current.target);
      s.head.speed = pendingHeadFollow.current.speed;
      pendingHeadFollow.current = null;
    }

    // Smooth gaze interpolation (held during blink closure)
    const gazeSpeed = s.gaze.isHoldingForBlink ? 3.0 : 18.0;
    const gazeSmoothing = 1 - Math.exp(-gazeSpeed * safeDelta);
    s.gaze.current.lerp(s.gaze.target, gazeSmoothing);

    // ═════════════════════════════════════════════════════════════
    // 4. HEAD POSTURE & CONTINUOUS LIVING DRIFT
    // ═════════════════════════════════════════════════════════════
    // Independent posture realignments (every 15–28s)
    if (t >= nextPostureShiftAt.current) {
      const isListening = currentMode === "listening";
      const sign = Math.random() < 0.5 ? 1 : -1;

      if (isListening) {
        // Attentive listener head tilt + slight nod
        s.head.target.set(
          THREE.MathUtils.randFloat(-0.03, 0.02),
          THREE.MathUtils.randFloat(0.02, 0.06) * sign,
          THREE.MathUtils.randFloat(0.025, 0.045) * sign
        );
      } else {
        // Subtle organic posture shift
        s.head.target.set(
          THREE.MathUtils.randFloatSpread(0.04),
          THREE.MathUtils.randFloatSpread(0.06),
          THREE.MathUtils.randFloatSpread(0.03)
        );
      }

      s.head.speed = THREE.MathUtils.randFloat(1.6, 2.4);
      nextPostureShiftAt.current = t + THREE.MathUtils.randFloat(15.0, 28.0);
    }

    // Head smooth gliding interpolation
    const headEase = 1 - Math.exp(-s.head.speed * safeDelta);
    s.head.current.lerp(s.head.target, headEase);

    // Continuous harmonic organic micro-tone (Prosodic conversational gestures when speaking, living drift when idle)
    if (currentMode === "talking") {
      // Conversational Speech Rhythm & Prosodic Head Motion (Nods, Accents & Tilts)
      const speechNod = Math.sin(t * 3.8) * 0.016 + Math.sin(t * 1.9 + 0.6) * 0.012 + Math.sin(t * 5.4 + 1.2) * 0.006;
      const speechYaw = Math.sin(t * 1.4 + 1.2) * 0.014 + Math.sin(t * 2.8 + 2.1) * 0.007;
      const speechRoll = Math.sin(t * 1.7 + 2.4) * 0.015 + Math.cos(t * 3.2) * 0.008;

      s.head.drift.set(speechNod, speechYaw, speechRoll);
    } else {
      // Calm living drift for idle & listening
      s.head.drift.set(
        Math.sin(t * 1.83 + 0.4) * 0.0035 + Math.sin(t * 3.71 + 1.2) * 0.0015,
        Math.sin(t * 1.47 + 1.9) * 0.0040 + Math.sin(t * 3.19 + 0.7) * 0.0018,
        Math.sin(t * 1.62 + 2.8) * 0.0025
      );
    }

    // ═════════════════════════════════════════════════════════════
    // 5. STAGGERED FACIAL MICRO-EXPRESSIONS (Rule 1 & Rule 5)
    // ═════════════════════════════════════════════════════════════
    const minGapBetweenExpressions = currentMode === "talking" ? 0.4 : 1.0;

    // A. EYEBROWS (Conversational emphasis during speech)
    if (t >= nextEyebrowAt.current && t - lastExpressionAt.current >= minGapBetweenExpressions) {
      lastExpressionAt.current = t;
      const rand = Math.random();
      const next = { browInnerUp: 0, browOuterUpLeft: 0, browOuterUpRight: 0, browDownLeft: 0, browDownRight: 0 };

      if (currentMode === "talking") {
        // Highly expressive speech emphasis: frequent brow raises & asymmetric conversational accents
        if (rand < 0.45) {
          next.browInnerUp = THREE.MathUtils.randFloat(0.18, 0.28);
          next.browOuterUpLeft = THREE.MathUtils.randFloat(0.08, 0.16);
          next.browOuterUpRight = THREE.MathUtils.randFloat(0.08, 0.16);
        } else if (rand < 0.80) {
          // Asymmetric conversational brow raise
          const isLeft = Math.random() < 0.5;
          if (isLeft) {
            next.browOuterUpLeft = THREE.MathUtils.randFloat(0.20, 0.32);
            next.browInnerUp = THREE.MathUtils.randFloat(0.10, 0.18);
          } else {
            next.browOuterUpRight = THREE.MathUtils.randFloat(0.20, 0.32);
            next.browInnerUp = THREE.MathUtils.randFloat(0.10, 0.18);
          }
        } else {
          // Subtle conversational focus furrow
          next.browDownLeft = THREE.MathUtils.randFloat(0.08, 0.14);
          next.browDownRight = THREE.MathUtils.randFloat(0.08, 0.14);
        }

        s.eyebrows = next;
        const hold = THREE.MathUtils.randFloat(0.8, 1.6);
        eyebrowResetAt.current = t + hold;
        nextEyebrowAt.current = t + THREE.MathUtils.randFloat(1.8, 3.8);
      } else if (currentMode === "listening") {
        // Inquisitive attentive single brow lift or subtle inner lift
        if (rand < 0.50) {
          const isLeft = Math.random() < 0.5;
          if (isLeft) next.browOuterUpLeft = THREE.MathUtils.randFloat(0.09, 0.14);
          else next.browOuterUpRight = THREE.MathUtils.randFloat(0.09, 0.14);
        } else {
          next.browInnerUp = THREE.MathUtils.randFloat(0.08, 0.12);
        }

        s.eyebrows = next;
        const hold = THREE.MathUtils.randFloat(0.6, 1.2);
        eyebrowResetAt.current = t + hold;
        nextEyebrowAt.current = t + THREE.MathUtils.randFloat(4.0, 8.0);
      } else {
        // Idle: Subtle single-side twitch or gentle furrow
        if (rand < 0.50) {
          const isLeft = Math.random() < 0.5;
          if (isLeft) next.browOuterUpLeft = THREE.MathUtils.randFloat(0.07, 0.12);
          else next.browOuterUpRight = THREE.MathUtils.randFloat(0.07, 0.12);
        } else {
          const isLeft = Math.random() < 0.5;
          if (isLeft) next.browDownLeft = THREE.MathUtils.randFloat(0.05, 0.09);
          else next.browDownRight = THREE.MathUtils.randFloat(0.05, 0.09);
        }

        s.eyebrows = next;
        const hold = THREE.MathUtils.randFloat(0.6, 1.2);
        eyebrowResetAt.current = t + hold;
        nextEyebrowAt.current = t + THREE.MathUtils.randFloat(6.0, 14.0);
      }
    }

    if (eyebrowResetAt.current > 0 && t >= eyebrowResetAt.current) {
      s.eyebrows = { browInnerUp: 0, browOuterUpLeft: 0, browOuterUpRight: 0, browDownLeft: 0, browDownRight: 0 };
      eyebrowResetAt.current = 0;
    }

    // B. CHEEKS (Warm conversational cheek engagement during speech)
    if (t >= nextCheekAt.current && t - lastExpressionAt.current >= minGapBetweenExpressions) {
      lastExpressionAt.current = t;
      const rand = Math.random();
      const next = { cheekSquintLeft: 0, cheekSquintRight: 0, noseSneerLeft: 0, noseSneerRight: 0, cheekPuff: 0 };

      if (currentMode === "talking") {
        next.cheekSquintLeft = THREE.MathUtils.randFloat(0.08, 0.16);
        next.cheekSquintRight = THREE.MathUtils.randFloat(0.08, 0.16);
        s.cheeks = next;
        const hold = THREE.MathUtils.randFloat(1.0, 2.0);
        cheekResetAt.current = t + hold;
        nextCheekAt.current = t + THREE.MathUtils.randFloat(3.5, 7.0);
      } else {
        if (rand < 0.40) {
          next.cheekSquintLeft = THREE.MathUtils.randFloat(0.12, 0.18);
          next.noseSneerLeft = THREE.MathUtils.randFloat(0.05, 0.09);
        } else if (rand < 0.80) {
          next.cheekSquintRight = THREE.MathUtils.randFloat(0.12, 0.18);
          next.noseSneerRight = THREE.MathUtils.randFloat(0.05, 0.09);
        } else {
          next.cheekPuff = THREE.MathUtils.randFloat(0.08, 0.13);
        }

        s.cheeks = next;
        const hold = THREE.MathUtils.randFloat(0.7, 1.3);
        cheekResetAt.current = t + hold;
        nextCheekAt.current = t + THREE.MathUtils.randFloat(8.0, 18.0);
      }
    }

    if (cheekResetAt.current > 0 && t >= cheekResetAt.current) {
      s.cheeks = { cheekSquintLeft: 0, cheekSquintRight: 0, noseSneerLeft: 0, noseSneerRight: 0, cheekPuff: 0 };
      cheekResetAt.current = 0;
    }

    // C. MOUTH CORNERS
    if (t >= nextMouthCornerAt.current && t - lastExpressionAt.current >= minGapBetweenExpressions) {
      lastExpressionAt.current = t;
      const rand = Math.random();
      const next = {
        mouthSmileLeft: 0, mouthSmileRight: 0, mouthDimpleLeft: 0, mouthDimpleRight: 0,
        mouthPressLeft: 0, mouthPressRight: 0, mouthStretchLeft: 0, mouthStretchRight: 0,
      };

      if (rand < 0.50) {
        const isLeft = Math.random() < 0.5;
        if (isLeft) {
          next.mouthSmileLeft = THREE.MathUtils.randFloat(0.08, 0.14);
          next.mouthDimpleLeft = THREE.MathUtils.randFloat(0.04, 0.07);
        } else {
          next.mouthSmileRight = THREE.MathUtils.randFloat(0.08, 0.14);
          next.mouthDimpleRight = THREE.MathUtils.randFloat(0.04, 0.07);
        }
      } else {
        const isLeft = Math.random() < 0.5;
        if (isLeft) next.mouthDimpleLeft = THREE.MathUtils.randFloat(0.06, 0.12);
        else next.mouthDimpleRight = THREE.MathUtils.randFloat(0.06, 0.12);
      }

      s.mouthCorners = next;
      const hold = THREE.MathUtils.randFloat(0.6, 1.2);
      mouthCornerResetAt.current = t + hold;
      nextMouthCornerAt.current = t + THREE.MathUtils.randFloat(7.0, 16.0);
    }

    if (mouthCornerResetAt.current > 0 && t >= mouthCornerResetAt.current) {
      s.mouthCorners = {
        mouthSmileLeft: 0, mouthSmileRight: 0, mouthDimpleLeft: 0, mouthDimpleRight: 0,
        mouthPressLeft: 0, mouthPressRight: 0, mouthStretchLeft: 0, mouthStretchRight: 0,
      };
      mouthCornerResetAt.current = 0;
    }

    // D. NOSTRILS
    if (t >= nextNostrilAt.current && t - lastExpressionAt.current >= minGapBetweenExpressions) {
      lastExpressionAt.current = t;
      const rand = Math.random();
      const next = { noseSneerLeft: 0, noseSneerRight: 0 };

      if (rand < 0.50) {
        const flare = THREE.MathUtils.randFloat(0.08, 0.15);
        next.noseSneerLeft = flare;
        next.noseSneerRight = flare;
      } else {
        const isLeft = Math.random() < 0.5;
        if (isLeft) next.noseSneerLeft = THREE.MathUtils.randFloat(0.07, 0.13);
        else next.noseSneerRight = THREE.MathUtils.randFloat(0.07, 0.13);
      }

      s.nostrils = next;
      const hold = THREE.MathUtils.randFloat(0.5, 1.0);
      nostrilResetAt.current = t + hold;
      nextNostrilAt.current = t + THREE.MathUtils.randFloat(6.0, 13.0);
    }

    if (nostrilResetAt.current > 0 && t >= nostrilResetAt.current) {
      s.nostrils = { noseSneerLeft: 0, noseSneerRight: 0 };
      nostrilResetAt.current = 0;
    }

    // E. LIPS
    if (t >= nextLipAt.current && t - lastExpressionAt.current >= minGapBetweenExpressions) {
      lastExpressionAt.current = t;
      const rand = Math.random();
      const next = {
        mouthPressLeft: 0, mouthPressRight: 0, mouthRollLower: 0,
        mouthRollUpper: 0, mouthClose: 0, mouthPucker: 0,
      };

      if (rand < 0.40) {
        const press = THREE.MathUtils.randFloat(0.08, 0.14);
        next.mouthPressLeft = press;
        next.mouthPressRight = press;
      } else if (rand < 0.70) {
        next.mouthRollLower = THREE.MathUtils.randFloat(0.06, 0.11);
      } else {
        next.mouthPucker = THREE.MathUtils.randFloat(0.05, 0.09);
      }

      s.lips = next;
      const hold = THREE.MathUtils.randFloat(0.7, 1.3);
      lipResetAt.current = t + hold;
      nextLipAt.current = t + THREE.MathUtils.randFloat(7.0, 15.0);
    }

    if (lipResetAt.current > 0 && t >= lipResetAt.current) {
      s.lips = {
        mouthPressLeft: 0, mouthPressRight: 0, mouthRollLower: 0,
        mouthRollUpper: 0, mouthClose: 0, mouthPucker: 0,
      };
      lipResetAt.current = 0;
    }
  });

  return (
    <AvatarBehaviorContext.Provider value={store}>
      {children}
    </AvatarBehaviorContext.Provider>
  );
}
