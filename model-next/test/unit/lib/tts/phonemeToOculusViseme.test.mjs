import test from "node:test";
import assert from "node:assert/strict";
import { phonemeToOculusViseme, PHONEME_TO_OCULUS_EQUIVALENCE } from "../../../../lib/tts/phonemeToOculusViseme.ts";

test("maps equivalent phonemes to the same viseme", () => {
  assert.equal(phonemeToOculusViseme("P"), "PP");
  assert.equal(phonemeToOculusViseme("b"), "PP");
  assert.equal(phonemeToOculusViseme("SH"), "CH");
});

test("handles stress digits and case-insensitive phonemes", () => {
  assert.equal(phonemeToOculusViseme("aa1"), phonemeToOculusViseme("AA"));
  assert.equal(phonemeToOculusViseme("ih0"), phonemeToOculusViseme("IH"));
});

test("returns null for silence and unknown input", () => {
  assert.equal(phonemeToOculusViseme("sil"), null);
  assert.equal(phonemeToOculusViseme(""), null);
  assert.equal(phonemeToOculusViseme("not-a-phoneme"), null);
});

test("mapping contains only string or null outputs", () => {
  for (const value of Object.values(PHONEME_TO_OCULUS_EQUIVALENCE)) {
    assert.ok(value === null || typeof value === "string");
  }
});
