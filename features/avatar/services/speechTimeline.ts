import {
  RAISE_FALL_MS,
  RAISE_LINGER_MS,
  type GestureEvent,
  type GesturePlan,
  type SpeechCue,
} from "./gesturePlanner";

/**
 * Rolling timeline of everything the avatar is about to do / is doing, in one
 * absolute clock (ms). Each spoken sentence arrives as its own plan; adding it
 * here converts the plan's speech-clock times to the absolute clock, so
 * gestures and expressions from one sentence flow into the next instead of
 * being cut off at the sentence boundary.
 */

export interface TimelineEvent extends GestureEvent {
  /** Which plan this event came from (lets a re-timed plan replace its old copy). */
  planId: number;
  isFallback?: boolean;
}

export interface TimelineCue extends SpeechCue {
  /** Edge-triggered cues (blink, inhale) fire once. */
  fired: boolean;
  planId: number;
  isFallback?: boolean;
}

export class SpeechTimeline {
  events: TimelineEvent[] = [];
  cues: TimelineCue[] = [];
  /** Absolute time the most recent plan's speech starts / ends. */
  speechStartMs = Number.NEGATIVE_INFINITY;
  speechEndMs = Number.NEGATIVE_INFINITY;
  /** True once a plan built from real text/timings has arrived. */
  sawRealPlan = false;
  /** Seconds of speech in the latest plan (breath planning). */
  lastPlanSeconds = 0;

  private nextPlanId = 1;
  private lastPlan: GesturePlan | null = null;
  private lastPlanId = 0;
  private startBeforeLast = Number.NEGATIVE_INFINITY;
  private endBeforeLast = Number.NEGATIVE_INFINITY;

  /**
   * Add a sentence. `baseMs` is the absolute time at which the plan's own clock
   * reads 0 (the moment its audio starts). Adding the same plan object again
   * (for example because its start time was corrected) replaces the old copy.
   */
  addPlan(plan: GesturePlan, baseMs: number, real = true): void {
    if (plan === this.lastPlan) {
      this.events = this.events.filter((e) => e.planId !== this.lastPlanId);
      this.cues = this.cues.filter((c) => c.planId !== this.lastPlanId);
      this.speechStartMs = this.startBeforeLast;
      this.speechEndMs = this.endBeforeLast;
    }

    // When a real speech plan arrives, immediately purge any fallback gestures
    if (real) {
      this.events = this.events.filter((e) => !e.isFallback);
      this.cues = this.cues.filter((c) => !c.isFallback);
      this.sawRealPlan = true;
    }

    // A new sentence starting while the old one was still being spoken means the old
    // one was interrupted: drop its upcoming gestures instead of letting them play on.
    if (this.speechEndMs > baseMs + 150) this.truncate(baseMs);

    const planId = this.nextPlanId++;
    for (const e of plan.events) {
      this.events.push({
        ...e,
        apexMs: e.apexMs + baseMs,
        holdUntilMs: e.holdUntilMs + baseMs,
        startMs: e.startMs + baseMs,
        endMs: e.endMs + baseMs,
        planId,
        isFallback: !real,
      });
    }
    for (const c of plan.cues) {
      this.cues.push({
        ...c,
        startMs: c.startMs + baseMs,
        peakMs: c.peakMs + baseMs,
        holdUntilMs: c.holdUntilMs + baseMs,
        endMs: c.endMs + baseMs,
        fired: false,
        planId,
        isFallback: !real,
      });
    }
    this.events.sort((a, b) => a.startMs - b.startMs);
    this.cues.sort((a, b) => a.startMs - b.startMs);

    this.startBeforeLast = this.speechStartMs;
    this.endBeforeLast = this.speechEndMs;
    const first = plan.words[0]?.startMs ?? 0;
    this.speechStartMs = baseMs + first;
    this.speechEndMs = baseMs + Math.max(plan.durationMs, plan.words[plan.words.length - 1]?.endMs ?? 0);
    this.lastPlanSeconds = Math.max(0, (this.speechEndMs - this.speechStartMs) / 1000);
    this.lastPlan = plan;
    this.lastPlanId = planId;
  }

  /** Stop everything that has not started yet and let what is running release. */
  truncate(atMs: number): void {
    const keptEvents: TimelineEvent[] = [];
    for (const e of this.events) {
      if (e.startMs >= atMs || e.apexMs > atMs) continue;
      if (e.holdUntilMs > atMs) {
        e.holdUntilMs = atMs;
        e.endMs = Math.min(e.endMs, atMs + RAISE_LINGER_MS + RAISE_FALL_MS);
      }
      keptEvents.push(e);
    }
    this.events = keptEvents;

    const keptCues: TimelineCue[] = [];
    for (const c of this.cues) {
      if (c.startMs > atMs) continue;
      if (c.holdUntilMs > atMs) {
        const release = c.endMs - c.holdUntilMs;
        c.holdUntilMs = Math.max(atMs, c.peakMs);
        c.endMs = c.holdUntilMs + release;
      }
      keptCues.push(c);
    }
    this.cues = keptCues;
    if (this.speechEndMs > atMs) this.speechEndMs = atMs;
  }

  /** Drop things that finished a while ago. */
  prune(nowMs: number): void {
    if (this.events.length) this.events = this.events.filter((e) => e.endMs > nowMs - 300);
    if (this.cues.length) this.cues = this.cues.filter((c) => c.endMs > nowMs - 300);
    // Forget "real speech" a few seconds after it ended so a later bare-audio preview can use the fallback.
    if (this.sawRealPlan && nowMs > this.speechEndMs + 4000 && !this.events.length && !this.cues.length) {
      this.sawRealPlan = false;
    }
  }

  clear(): void {
    this.events = [];
    this.cues = [];
    this.speechStartMs = Number.NEGATIVE_INFINITY;
    this.speechEndMs = Number.NEGATIVE_INFINITY;
    this.startBeforeLast = Number.NEGATIVE_INFINITY;
    this.endBeforeLast = Number.NEGATIVE_INFINITY;
    this.lastPlan = null;
    this.sawRealPlan = false;
  }
}
