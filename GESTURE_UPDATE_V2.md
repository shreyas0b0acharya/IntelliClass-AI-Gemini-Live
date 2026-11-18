# Avatar body language, update 2

Unzip over your project root (same folder layout as `model-next/`). No new packages, no config changes.
This builds on the earlier gesture update: `Experience.tsx`, `LandingHeroAvatarStage.tsx`, `avatar.types.ts`,
`AvatarStage.tsx` and the classroom `page.tsx` are unchanged and are not in this zip.

## What you will see

- **Hands rest down.** Between gestures the arms stay exactly as the animation plays them (relaxed, hanging).
  A hand lifts to the same speaking pose as before only when a gesture happens, then sinks back.
  Gestures chain, so a hand stays up through a run of related phrases and drops during pauses and
  quieter sentences. Each hand lifts on its own.
- **Smoother motion.** Lifts take at least 0.6 s with minimum-jerk easing. The elbow, palm turn and fingers
  ease in with the lift, so nothing pops when a gesture starts or ends. Frame-rate independent.
- **Whole body follows the words** (same text = same behaviour for everyone in the classroom):
  - brows lift on stressed words and questions, a furrow on "but / however / careful", a smile on
    greetings and thanks, eyes widen slightly on surprise
  - nods on agreement, head tilts on questions, a shrug on "maybe / depends / not sure"
  - the eyes glance away while thinking and the head follows a beat later; blinks land on phrase breaks
  - a breath in before each sentence, a long exhale while it is spoken
  - the torso turns toward the gesturing side and leans in a little; the shoulder of a raised arm rises
  - the random "living" blinks, glances and brow flicks back off while real speech is active

## Files

New: `AvatarBodyLanguageDriver.ts`, `speechExpression.ts`, `speechTimeline.ts`, `AvatarSpeechFace.tsx`.
Changed: `AvatarHandGestureDriver.ts`, `gesturePlanner.ts`, `behavior.types.ts`, `Avatar.tsx`,
`AvatarAnimations.tsx`, `AvatarBehaviorController.tsx`, `AvatarHeadMovement.tsx`, `AvatarEyeMovement.tsx`,
`AvatarEyebrows.tsx`, `AvatarCheeks.tsx`, `AvatarMouthCorners.tsx`, `AvatarLips.tsx`, `AvatarBreathing.tsx`.

## Tuning

`GESTURE_CONFIG` at the top of `services/AvatarHandGestureDriver.ts`:
`amplitude` (hand travel, 1.2), `bodyFollow` (torso and shoulder follow, 0 turns it off), `fingerAdduction`,
`idleMotion`, `fingers` (false if a rig's finger bones misbehave).
How often hands lift: `pActive` in `planGestures` and `levelFor` (how high) in `services/gesturePlanner.ts`.

## Notes

- Checked with 81 automated tests on a Mixamo-style test skeleton plus `tsc` and ESLint (no errors).
  Your real avatar files were not in the zip, so please judge the final look on the actual avatar.
- Semantic cues (questions, contrast, thanks, hedges) are English-only; other languages still get
  rhythm-based gestures, blinks and breaths.
- `eyeWide*`, `eyeSquint*` and `mouthFrown*` morphs are skipped if a model does not have them.
- The shoulder lift expects clavicle bones named like `LeftShoulder` / `RightShoulder`.
