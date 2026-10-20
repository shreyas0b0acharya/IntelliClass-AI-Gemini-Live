import type { SpeechLayerData } from "../types/behavior.types";
import type { SpeechTimeline, TimelineCue } from "./speechTimeline";

/**
 * Evaluates the cue part of the speech timeline (brows, smile, nods, tilts,
 * gaze shifts, blinks, breath, lean, shrug) into the smoothed `SpeechLayerData`
 * that the face / head / eye components add on top of the random "living"
 * behaviour. Every channel goes through a critically damped spring, so cues
 * that overlap blend instead of snapping.
 */

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Minimum-jerk profile: zero velocity and acceleration at both ends. */
function minJerk(x: number): number {
  const t = clamp01(x);
  return t * t * t * (10 - 15 * t + 6 * t * t);
}

function cueEnvelope(c: TimelineCue, t: number): number {
  if (t <= c.startMs || t >= c.endMs) return 0;
  if (t < c.peakMs) return minJerk((t - c.startMs) / Math.max(1, c.peakMs - c.startMs));
  if (t <= c.holdUntilMs) return 1;
  return 1 - minJerk((t - c.holdUntilMs) / Math.max(1, c.endMs - c.holdUntilMs));
}

/** Scalar critically damped spring. */
class Spring {
  x = 0;
  v = 0;
  step(target: number, omega: number, dt: number): number {
    const d = this.x - target;
    const e = Math.exp(-omega * dt);
    const t = (this.v + omega * d) * dt;
    this.x = target + (d + t) * e;
    this.v = (this.v - omega * t) * e;
    return this.x;
  }
  reset(): void {
    this.x = 0;
    this.v = 0;
  }
}

const FACE_OMEGA = 11;

export class SpeechExpression {
  private talking = new Spring();

  private browInner = new Spring();
  private browOuterL = new Spring();
  private browOuterR = new Spring();
  private browDownL = new Spring();
  private browDownR = new Spring();
  private smileL = new Spring();
  private smileR = new Spring();
  private cheekL = new Spring();
  private cheekR = new Spring();
  private press = new Spring();
  private frown = new Spring();
  private wide = new Spring();
  private squint = new Spring();

  private headPitch = new Spring();
  private headYaw = new Spring();
  private headRoll = new Spring();
  private gazeYaw = new Spring();
  private gazePitch = new Spring();
  private torsoPitch = new Spring();
  private shoulder = new Spring();

  private blinkCount = 0;
  private inhaleCount = 0;

  update(timeline: SpeechTimeline, nowMs: number, dt: number, isTalking: boolean, out: SpeechLayerData): void {
    const tw = this.talking.step(isTalking ? 1 : 0, isTalking ? 4 : 2.5, dt);

    let browInner = 0;
    let outerL = 0;
    let outerR = 0;
    let downL = 0;
    let downR = 0;
    let smileL = 0;
    let smileR = 0;
    let cheekL = 0;
    let cheekR = 0;
    let press = 0;
    let frown = 0;
    let wide = 0;
    let squint = 0;
    let headPitch = 0;
    let headYaw = 0;
    let headRoll = 0;
    let gazeYaw = 0;
    let gazePitch = 0;
    let torsoPitch = 0;
    let shoulder = 0;

    // A warm, friendly resting expression while talking.
    smileL = smileR = 0.06 * tw;
    cheekL = cheekR = 0.03 * tw;

    for (const c of timeline.cues) {
      if (c.startMs > nowMs + 50) continue; // cues are sorted by start; nothing later is active yet
      if (c.kind === "blink" || c.kind === "inhale") {
        if (!c.fired && nowMs >= c.startMs) {
          c.fired = true;
          if (nowMs - c.startMs < 700) {
            if (c.kind === "blink") this.blinkCount++;
            else {
              this.inhaleCount++;
              out.exhaleSec = Math.min(5, Math.max(1.8, timeline.lastPlanSeconds * 0.85));
            }
          }
        }
        continue;
      }
      const e = cueEnvelope(c, nowMs) * c.intensity;
      if (e <= 0) continue;

      switch (c.kind) {
        case "browFlash":
          outerL = Math.max(outerL, 0.32 * e);
          outerR = Math.max(outerR, 0.32 * e);
          browInner = Math.max(browInner, 0.2 * e);
          wide = Math.max(wide, 0.1 * e);
          break;
        case "browRaise": {
          const strong = 0.28 * e;
          const soft = 0.16 * e;
          outerL = Math.max(outerL, c.side > 0 ? strong : soft);
          outerR = Math.max(outerR, c.side > 0 ? soft : strong);
          browInner = Math.max(browInner, 0.22 * e);
          wide = Math.max(wide, 0.1 * e);
          break;
        }
        case "browInner":
          browInner = Math.max(browInner, 0.38 * e);
          frown = Math.max(frown, 0.1 * e);
          break;
        case "furrow":
          downL = Math.max(downL, 0.36 * e);
          downR = Math.max(downR, 0.36 * e);
          press = Math.max(press, 0.14 * e);
          squint = Math.max(squint, 0.12 * e);
          break;
        case "smile":
          smileL = Math.max(smileL, 0.52 * e);
          smileR = Math.max(smileR, 0.52 * e);
          cheekL = Math.max(cheekL, 0.3 * e);
          cheekR = Math.max(cheekR, 0.3 * e);
          squint = Math.max(squint, 0.1 * e);
          break;
        case "nod":
          headPitch += 0.09 * e;
          break;
        case "headTilt":
          headRoll += -c.side * 0.09 * e;
          break;
        case "lookAway": {
          // Eyes jump first, the head follows a beat later and only part of the way.
          const eHead = cueEnvelope(c, nowMs - 140) * c.intensity;
          gazeYaw += c.yaw * e;
          gazePitch += c.pitch * e;
          headYaw += c.yaw * 0.5 * eHead;
          headPitch += -c.pitch * 0.5 * eHead;
          break;
        }
        case "shrug":
          // Clavicle elevation (radians): ~0.2 lifts the shoulder tip about 2.5 cm on an adult rig.
          shoulder += 0.2 * e;
          break;
        case "lean":
          torsoPitch += c.dir * 0.05 * e;
          break;
        default:
          break;
      }
    }

    const f = FACE_OMEGA;
    out.active = tw;
    out.browInnerUp = this.browInner.step(Math.min(1, browInner), f, dt);
    out.browOuterUpLeft = this.browOuterL.step(Math.min(1, outerL), f, dt);
    out.browOuterUpRight = this.browOuterR.step(Math.min(1, outerR), f, dt);
    out.browDownLeft = this.browDownL.step(Math.min(1, downL), f, dt);
    out.browDownRight = this.browDownR.step(Math.min(1, downR), f, dt);
    out.smileLeft = this.smileL.step(Math.min(1, smileL), f * 0.8, dt);
    out.smileRight = this.smileR.step(Math.min(1, smileR), f * 0.8, dt);
    out.cheekSquintLeft = this.cheekL.step(Math.min(1, cheekL), f * 0.8, dt);
    out.cheekSquintRight = this.cheekR.step(Math.min(1, cheekR), f * 0.8, dt);
    out.mouthPress = this.press.step(Math.min(1, press), f, dt);
    out.mouthFrown = this.frown.step(Math.min(1, frown), f, dt);
    out.eyeWide = this.wide.step(Math.min(1, wide), f, dt);
    out.eyeSquint = this.squint.step(Math.min(1, squint), f, dt);

    out.headPitch = this.headPitch.step(headPitch, 14, dt);
    out.headYaw = this.headYaw.step(headYaw, 9, dt);
    out.headRoll = this.headRoll.step(headRoll, 7, dt);
    // Eyes are smoothed again by the eye component; a light spring here keeps saccades from being instantaneous.
    out.gazeYaw = this.gazeYaw.step(gazeYaw, 32, dt);
    out.gazePitch = this.gazePitch.step(gazePitch, 32, dt);
    out.torsoPitch = this.torsoPitch.step(torsoPitch, 6, dt);
    out.shoulderLift = this.shoulder.step(shoulder, 8, dt);

    out.blinkRequest = this.blinkCount;
    out.inhaleRequest = this.inhaleCount;
  }

  reset(): void {
    for (const s of Object.values(this) as unknown[]) {
      if (s instanceof Spring) s.reset();
    }
  }
}
