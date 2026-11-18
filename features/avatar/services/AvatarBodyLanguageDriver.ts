import type { Object3D } from "three";
import { planFallbackGestures, type GesturePlan } from "./gesturePlanner";
import { SpeechTimeline } from "./speechTimeline";
import { SpeechExpression } from "./speechExpression";
import { AvatarHandGestureDriver } from "./AvatarHandGestureDriver";
import type { SpeechLayerData } from "../types/behavior.types";

/**
 * One object that owns the whole "what the avatar does while it speaks" stack:
 *
 *   gesture plans  ->  SpeechTimeline (absolute clock)
 *                          |-> SpeechExpression: face / head / gaze / blink / breath / torso cues
 *                          |-> AvatarHandGestureDriver: arms, hands, fingers, shoulders
 *
 * The face, head, eye and breathing components read the resulting
 * `SpeechLayerData` and add it on top of their own random "living" behaviour.
 *
 * All times are milliseconds on ONE clock chosen by the caller (the app uses the
 * synchronized epoch so every classroom participant sees the same behaviour).
 *
 * Required frame order:
 *   1. removePreviousOffsets()
 *   2. AnimationMixer.update(delta)
 *   3. update(time, delta, nowMs, isTalking, layer)
 */
export class AvatarBodyLanguageDriver {
  readonly timeline = new SpeechTimeline();
  private readonly expression = new SpeechExpression();
  private readonly hands: AvatarHandGestureDriver;

  /** A plan whose audio start time is unknown: it starts when the avatar starts talking. */
  private pending: { plan: GesturePlan; createdMs: number } | null = null;
  /** Latest plan, so a clip that is simply played again (same text, no new start time) gets its gestures again. */
  private lastPlan: GesturePlan | null = null;
  private lastPlanHadStart = false;
  private wasTalking = false;
  private fallbackActive = false;
  private fallbackEndMs = Number.NEGATIVE_INFINITY;
  private fallbackSeed = 1;
  private quietMs = 0;

  constructor() {
    this.hands = new AvatarHandGestureDriver(this.timeline);
  }

  setRoot(root: Object3D | null): void {
    this.hands.setRoot(root);
  }

  /** Restore the animation's exact bone rotations before the mixer advances. */
  removePreviousOffsets(): void {
    this.hands.removePreviousOffsets();
  }

  /** How far a hand is lifted from rest right now (0..1). Exposed for debugging and tests. */
  getRaise(side: "left" | "right"): number {
    return this.hands.getRaise(side);
  }

  /**
   * A sentence is about to be spoken. `audioStartMs` is when its audio starts on the caller's
   * clock; if unknown the plan starts the moment the avatar next starts talking.
   */
  speak(plan: GesturePlan, audioStartMs: number | undefined, nowMs: number): void {
    this.lastPlan = plan;
    if (audioStartMs !== undefined && Number.isFinite(audioStartMs) && audioStartMs > 0) {
      this.lastPlanHadStart = true;
      this.pending = null;
      this.timeline.addPlan(plan, audioStartMs, true);
    } else {
      this.lastPlanHadStart = false;
      this.pending = { plan, createdMs: nowMs };
    }
  }

  update(time: number, delta: number, nowMs: number, isTalking: boolean, layer: SpeechLayerData): void {
    const dt = Math.min(Math.max(delta, 0), 0.1);
    const tl = this.timeline;

    if (isTalking) this.quietMs = 0;
    else this.quietMs += dt * 1000;

    // The same clip played again without a new start time: replay its gestures from the top.
    const startedTalking = isTalking && !this.wasTalking;
    this.wasTalking = isTalking;
    if (
      startedTalking &&
      !this.pending &&
      this.lastPlan &&
      !this.lastPlanHadStart &&
      nowMs > tl.speechEndMs + 300
    ) {
      this.pending = { plan: this.lastPlan, createdMs: nowMs };
    }

    // A plan without a known audio start begins when talking begins.
    if (this.pending) {
      if (isTalking) {
        tl.addPlan(this.pending.plan, nowMs - 60, true);
        this.pending = null;
      } else if (nowMs - this.pending.createdMs > 12000) {
        this.pending = null;
      }
    }

    // Interrupted / stopped speaking: when quiet for > 250ms, truncate upcoming gestures so arms return to rest pose
    if (!isTalking && this.quietMs > 250) {
      if (tl.events.length > 0) {
        tl.truncate(nowMs);
      }
      this.fallbackActive = false;
    } else if (this.quietMs > 600 && nowMs > tl.speechStartMs + 300 && nowMs < tl.speechEndMs) {
      tl.truncate(nowMs);
    }

    // Talking with no text or word timings (a bare audio preview): loose generic gesture units.
    if (isTalking && !tl.sawRealPlan && !this.pending) {
      if (!this.fallbackActive || nowMs > this.fallbackEndMs - 5000) {
        this.fallbackSeed += 7919;
        tl.addPlan(planFallbackGestures(45000, this.fallbackSeed), nowMs, false);
        this.fallbackActive = true;
        this.fallbackEndMs = nowMs + 45000;
      }
    } else if (this.fallbackActive && (tl.sawRealPlan || this.quietMs > 300)) {
      // Purge any lingering fallback events so they never trap arms in raised pose
      tl.events = tl.events.filter((e) => !e.isFallback);
      tl.cues = tl.cues.filter((c) => !c.isFallback);
      this.fallbackActive = false;
    }

    tl.prune(nowMs);
    this.expression.update(tl, nowMs, dt, isTalking, layer);
    this.hands.update(time, delta, nowMs, isTalking, layer);
  }

  dispose(): void {
    this.hands.dispose();
    this.expression.reset();
    this.timeline.clear();
    this.pending = null;
    this.lastPlan = null;
    this.wasTalking = false;
    this.fallbackActive = false;
  }
}
