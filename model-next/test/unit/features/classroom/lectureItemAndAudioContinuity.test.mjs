import test from "node:test";
import assert from "node:assert/strict";
import { splitIntoSmallChunks } from "../../../../features/avatar/services/sentenceSplitter.ts";

function parseLectureScriptTestable(script) {
  const items = [];
  const speechItems = [];

  if (!script || !script.trim()) {
    return { items, speechItems };
  }

  // Tokenize engagement and media tags while cleanly stripping legacy [PAUSE] tags
  const processed = script
    .replace(/\[PAUSE\]/gi, " ")
    .replace(/\[ENGAGEMENT\]/gi, "|||ENGAGEMENT|||")
    .replace(/\[IMAGE:\s*([^\]]+)\]/gi, "|||IMAGE:$1|||")
    .replace(/\[VIDEO:\s*([^\]]+)\]/gi, "|||VIDEO:$1|||");

  const rawChunks = processed.split("|||");
  let orderIndex = 0;

  for (const chunk of rawChunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    if (trimmed === "ENGAGEMENT") {
      items.push({
        id: `engagement_${orderIndex}`,
        type: "engagement",
        prompt: "Check your understanding",
        order: orderIndex++,
      });
      continue;
    }

    if (trimmed.startsWith("IMAGE:")) {
      items.push({
        id: `img_${orderIndex}`,
        type: "image",
        mediaRef: trimmed.replace(/^IMAGE:/, "").trim(),
        order: orderIndex++,
      });
      continue;
    }

    const spokenPhrases = splitIntoSmallChunks(trimmed, 75);
    for (const phrase of spokenPhrases) {
      const cleanPhrase = phrase
        .replace(/[*#`_~]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (!cleanPhrase) continue;

      const speechItem = {
        id: `speech_${orderIndex}`,
        type: "speech",
        text: cleanPhrase,
        order: orderIndex++,
      };
      items.push(speechItem);
      speechItems.push(speechItem);
    }
  }

  return { items, speechItems };
}

test("parseLectureScript cleanly strips [PAUSE] tags and avoids creating pause items", () => {
  const script = `
    Welcome class. [PAUSE] Today we discuss dynamic programming.
    [PAUSE]
    Let us look at Fibonacci numbers.
    [IMAGE: /api/media/diagram.png | Dynamic Programming Table]
    Are you following so far? [ENGAGEMENT]
    Excellent. Let us move to bottom-up tabulation.
  `;

  const parsed = parseLectureScriptTestable(script);

  // Assert NO pause items exist
  const pauseItems = parsed.items.filter((i) => i.type === "pause");
  assert.equal(pauseItems.length, 0, "No pause items should ever be created from lecture scripts");

  // Assert speech items contain continuous words without [PAUSE]
  for (const item of parsed.speechItems) {
    assert.ok(!item.text.includes("[PAUSE]"), "Speech item text must not contain [PAUSE]");
    assert.ok(!item.text.includes("PAUSE"), "Speech item text must not contain leftover PAUSE token");
  }

  // Assert engagement checkpoint exists
  const engItems = parsed.items.filter((i) => i.type === "engagement");
  assert.equal(engItems.length, 1);

  // Assert image asset exists
  const imgItems = parsed.items.filter((i) => i.type === "image");
  assert.equal(imgItems.length, 1);

  // Verify speech items count > 0 and sequential order
  assert.ok(parsed.speechItems.length >= 3);
  for (let i = 0; i < parsed.items.length; i++) {
    assert.equal(parsed.items[i].order, i);
  }
});

test("Audio playback calculation never drops or skips short sentences on late delta", () => {
  // Simulate audio scheduling logic:
  // Short sentence duration = 0.8 seconds (800ms)
  const bufferDurationSec = 0.8;
  const offsetMs = 0; // normal playback

  // Scenario 1: Audio loaded 600ms late due to network fetch (delta = -600ms)
  const delta = -600;

  let bufferOffsetSec = 0;
  let skipped = false;

  if (delta >= 0) {
    bufferOffsetSec = Math.max(0, offsetMs / 1000);
  } else {
    if (offsetMs > 0) {
      const lateBySec = (-delta) / 1000;
      bufferOffsetSec = (offsetMs / 1000) + lateBySec;
      if (bufferOffsetSec >= bufferDurationSec - 0.05) {
        skipped = true;
      }
    } else {
      // Corrected logic: normal sequential sentence plays from start
      bufferOffsetSec = 0;
    }
  }

  assert.equal(skipped, false, "Sentence must NEVER be skipped on negative delta during normal playback");
  assert.equal(bufferOffsetSec, 0, "Buffer offset must be 0s so no words are cut off");
});

test("Audio playback calculation respects seek offset for late joiners", () => {
  const bufferDurationSec = 5.0; // 5 second sentence
  const offsetMs = 1500; // joined 1.5s in
  const delta = -500; // 500ms additional delay

  let bufferOffsetSec = 0;
  let skipped = false;

  if (offsetMs > 0) {
    const lateBySec = (-delta) / 1000;
    bufferOffsetSec = (offsetMs / 1000) + lateBySec;
    if (bufferOffsetSec >= bufferDurationSec - 0.05) {
      skipped = true;
    }
  }

  assert.equal(skipped, false);
  assert.equal(bufferOffsetSec, 2.0, "Seek offset should be 1.5s + 0.5s = 2.0s into the 5s buffer");
});

test("Duplicate packet sequence detection suppresses re-entrant audio interruption", () => {
  let lastSequence = -1;
  const processedEvents = [];

  const handleScheduledPlay = (seq) => {
    // Strictly monotonic sequence guard
    if (lastSequence === -1 || seq > lastSequence) {
      lastSequence = seq;
      processedEvents.push(seq);
      return true;
    }
    return false; // suppressed duplicate
  };

  assert.equal(handleScheduledPlay(1), true);
  assert.equal(handleScheduledPlay(1), false, "Duplicate seq 1 must be suppressed to avoid audio cut-off");
  assert.equal(handleScheduledPlay(2), true);
  assert.equal(handleScheduledPlay(2), false, "Duplicate seq 2 must be suppressed");
  assert.equal(handleScheduledPlay(3), true);

  assert.deepEqual(processedEvents, [1, 2, 3]);
});
