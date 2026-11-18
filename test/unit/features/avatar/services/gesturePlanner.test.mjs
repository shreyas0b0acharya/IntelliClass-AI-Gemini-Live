import test from "node:test";
import assert from "node:assert/strict";
import { planGestures, planFallbackGestures } from "../../../../../features/avatar/services/gesturePlanner.ts";

test("returns an empty, valid plan for empty speech", () => {
  const plan = planGestures({ text: "", durationMs: 0 });
  assert.deepEqual(plan.events, []);
  assert.deepEqual(plan.cues, []);
  assert.equal(plan.durationMs, 0);
});

test("produces deterministic plans for identical text and seed", () => {
  const options = { text: "First, understand the key concept. Then compare the result.", seed: 42 };
  assert.deepEqual(planGestures(options), planGestures(options));
});

test("keeps generated event timing ordered and intensities bounded", () => {
  const plan = planGestures({ text: "First, understand the key concept. Then compare the result.", seed: 7 });
  for (const event of plan.events) {
    assert.ok(event.startMs <= event.apexMs);
    assert.ok(event.apexMs <= event.endMs);
    assert.ok(event.intensity >= 0 && event.intensity <= 1);
  }
});

test("fallback plans are deterministic and respect duration bounds", () => {
  const first = planFallbackGestures(8000, 123);
  const second = planFallbackGestures(8000, 123);
  assert.deepEqual(first, second);
  assert.ok(first.events.every((event) => event.startMs < 8000));
});
