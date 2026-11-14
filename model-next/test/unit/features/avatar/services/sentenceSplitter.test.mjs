import test from "node:test";
import assert from "node:assert/strict";
import { splitIntoSmallChunks, splitIntoSentences } from "../../../../../features/avatar/services/sentenceSplitter.ts";

test("returns no chunks for empty or whitespace-only input", () => {
  assert.deepEqual(splitIntoSmallChunks(""), []);
  assert.deepEqual(splitIntoSmallChunks("   "), []);
});

test("splits at sentence boundaries and retains punctuation", () => {
  assert.deepEqual(splitIntoSmallChunks("This is a first sentence that is sufficiently long. This is a second sentence that is also sufficiently long."), ["This is a first sentence that is sufficiently long.", "This is a second sentence that is also sufficiently long."]);
});

test("combines short segments without exceeding the configured limit", () => {
  const chunks = splitIntoSmallChunks("One. Two. Three.", 9);
  assert.deepEqual(chunks, ["One. Two.", "Three."]);
  assert.ok(chunks.every((chunk) => chunk.length <= 9));
});

test("keeps long individual segments intact and exposes the legacy alias", () => {
  const input = "A sentence that is longer than the configured maximum.";
  assert.deepEqual(splitIntoSmallChunks(input, 10), [input]);
  assert.deepEqual(splitIntoSentences("Hello."), splitIntoSmallChunks("Hello."));
});
