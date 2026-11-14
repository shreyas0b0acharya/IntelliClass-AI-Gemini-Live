import test from "node:test";
import assert from "node:assert/strict";
import { SpeechPreprocessor, SPEECH_PREPROCESSOR_VERSION } from "../../../../lib/tts/SpeechPreprocessor.ts";

test("returns an empty string for empty input", () => {
  assert.equal(SpeechPreprocessor.process(""), "");
});

test("removes common markdown while retaining readable content", () => {
  const result = SpeechPreprocessor.process("# Heading\n**Bold** and `code`");
  assert.match(result, /Heading/);
  assert.match(result, /Bold/);
  assert.match(result, /code/);
  assert.doesNotMatch(result, /\*\*|`|^#/m);
});

test("normalizes common technical terms and complexity notation", () => {
  const result = SpeechPreprocessor.process("PostgreSQL has O(n^2) complexity.");
  assert.match(result.toLowerCase(), /post-gres-q-l/);
  assert.match(result, /O of N squared/);
});

test("supports caller-provided pronunciation overrides", () => {
  assert.equal(
    SpeechPreprocessor.process("Widget works.", { pronunciationOverrides: { Widget: "WID-jit" } }),
    "WID-jit works."
  );
});

test("exposes a positive preprocessor version", () => {
  assert.ok(Number.isInteger(SPEECH_PREPROCESSOR_VERSION));
  assert.ok(SPEECH_PREPROCESSOR_VERSION > 0);
});
