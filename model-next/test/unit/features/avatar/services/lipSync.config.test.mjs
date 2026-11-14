import test from "node:test";
import assert from "node:assert/strict";
import { getMouthConfig, VISEMES, LIP_SYNC_CONFIG } from "../../../../../features/avatar/services/lipSync.config.ts";

test("resolves direct and case-insensitive viseme names", () => {
  assert.equal(getMouthConfig("PP")?.morph, "PP");
  assert.equal(getMouthConfig("pp")?.morph, "PP");
  assert.equal(getMouthConfig("viseme_PP")?.morph, "PP");
});

test("resolves supported numeric Azure viseme identifiers", () => {
  assert.ok(getMouthConfig(0));
  assert.ok(getMouthConfig("0"));
});

test("returns undefined for missing or unknown visemes", () => {
  assert.equal(getMouthConfig(null), undefined);
  assert.equal(getMouthConfig(undefined), undefined);
  assert.equal(getMouthConfig("unknown-viseme"), undefined);
});

test("exposes the expected avatar viseme catalog and bounded smoothing settings", () => {
  assert.equal(VISEMES.length, 14);
  assert.ok(LIP_SYNC_CONFIG.smoothingSpeed > 0);
  assert.ok(LIP_SYNC_CONFIG.visemeIntensity >= 0 && LIP_SYNC_CONFIG.visemeIntensity <= 1);
});
