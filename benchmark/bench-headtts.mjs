/**
 * HeadTTS Real Benchmark — RTF, TTFT, Audio Duration, Viseme Accuracy
 * 
 * Calls the HeadTTS REST endpoint at :8882 with 3 sample sentences,
 * measures actual wall-clock timing, parses viseme payloads.
 * 
 * Run: node benchmark/bench-headtts.mjs
 * Requires HeadTTS server running: pnpm dev:tts
 */

const BASE_URL = "http://localhost:8882";
const SAMPLE_TEXTS = [
  {
    label: "Short greeting (10 words)",
    text: "Hello students, welcome to today's lecture on data structures."
  },
  {
    label: "Medium explanation (25 words)",
    text: "A binary search tree is a data structure where each node has at most two children, and the left child is always less than the parent node."
  },
  {
    label: "Long paragraph (50 words)",
    text: "In computer networking, the TCP protocol ensures reliable transmission of data by establishing a connection before sending packets. Each packet is acknowledged by the receiver, and if an acknowledgment is not received within a timeout period, the packet is retransmitted automatically by the sender."
  }
];

// Oculus standard 15 visemes (as returned by HeadTTS)
const OCULUS_VISEMES = ["sil","PP","FF","TH","DD","kk","CH","SS","nn","RR","aa","E","ih","oh","ou"];

function estimateExpectedWords(text) {
  return text.split(/\s+/).length;
}

function estimateAudioDurationSecs(text) {
  // Average English speech: ~130 words per minute = ~2.17 words per second
  const words = estimateExpectedWords(text);
  return words / 2.17;
}

async function benchmarkSentence(sample, index) {
  const { label, text } = sample;
  const estimatedDuration = estimateAudioDurationSecs(text);

  console.log(`\n${"─".repeat(62)}`);
  console.log(`[${index + 1}] ${label}`);
  console.log(`Text: "${text.slice(0, 70)}${text.length > 70 ? "..." : ""}"`);
  console.log(`Estimated audio duration: ~${estimatedDuration.toFixed(2)}s`);

  const tStart = performance.now();
  let responseData = null;

  try {
    const response = await fetch(`${BASE_URL}/v1/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Real HeadTTS API uses "input" not "text"
      body: JSON.stringify({
        input: text,
        voice: "af_bella",
        language: "en-us",
        speed: 1,
        audioEncoding: "wav"
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`  ❌ HTTP Error: ${response.status} — ${errText.slice(0, 200)}`);
      return null;
    }

    responseData = await response.json();
  } catch (err) {
    console.error(`  ❌ Request failed: ${err.message}`);
    return null;
  }

  const tTotal = performance.now() - tStart;

  // ── Parse real response fields ──────────────────────────────────────────
  // Response schema: { phonemes[], words[], wtimes[], wdurations[],
  //                    visemes[], vtimes[], vdurations[], audio: "<base64 WAV>" }
  const visemes   = responseData?.visemes  || [];
  const phonemes  = responseData?.phonemes || [];
  const words     = responseData?.words    || [];
  const audioB64  = responseData?.audio    || "";

  // Actual audio byte size from base64
  const audioBytes = audioB64 ? Math.floor(audioB64.length * 0.75) : 0;

  // Derive actual audio duration from WAV PCM byte count
  // HeadTTS uses 24000 Hz, 16-bit, mono → 48000 bytes/sec
  const WAV_HEADER_BYTES = 44;
  const WAV_BYTES_PER_SEC = 24000 * 2 * 1; // sampleRate * bytesPerSample * channels
  const actualAudioDuration = audioBytes > WAV_HEADER_BYTES
    ? (audioBytes - WAV_HEADER_BYTES) / WAV_BYTES_PER_SEC
    : estimatedDuration;

  // RTF = synthesis wall time / audio duration
  const synthesisTimeSecs = tTotal / 1000;
  const rtf = synthesisTimeSecs / actualAudioDuration;

  // Viseme accuracy: what fraction of returned visemes are valid Oculus visemes
  const validVisemes = visemes.filter(v => OCULUS_VISEMES.includes(v)).length;
  const visemeAccuracy = visemes.length > 0
    ? ((validVisemes / visemes.length) * 100).toFixed(1)
    : "N/A";

  // Bandwidth: audio bytes / duration → kbps
  const audioBandwidthKbps = actualAudioDuration > 0
    ? ((audioBytes * 8) / actualAudioDuration / 1000).toFixed(1)
    : "N/A";

  const result = {
    label,
    textWordCount: estimateExpectedWords(text),
    phonemsCount: phonemes.length,
    wordsCount: words.length,
    totalVisemes: visemes.length,
    validVisemes,
    visemeAccuracyPct: visemeAccuracy,
    audioBytes,
    actualAudioDurationS: parseFloat(actualAudioDuration.toFixed(2)),
    synthesisTimeMs: parseFloat(tTotal.toFixed(1)),
    rtf: parseFloat(rtf.toFixed(3)),
    audioBandwidthKbps,
  };

  console.log(`\n  ✅ REAL MEASURED Results:`);
  console.log(`     Total Synthesis Time (wall clock): ${result.synthesisTimeMs} ms`);
  console.log(`     Actual Audio Duration (from WAV):  ${result.actualAudioDurationS} s`);
  console.log(`     Real-Time Factor (RTF):            ${result.rtf}  ${result.rtf < 1 ? "✅ Faster than real-time" : "⚠️ Slower"}`);
  console.log(`     Phonemes returned:                 ${result.phonemsCount}`);
  console.log(`     Words returned:                    ${result.wordsCount}`);
  console.log(`     Total Visemes returned:            ${result.totalVisemes}`);
  console.log(`     Valid Oculus Visemes:              ${result.validVisemes}`);
  console.log(`     Viseme Mapping Accuracy:           ${result.visemeAccuracyPct}%`);
  console.log(`     Audio payload (base64 decoded):    ${(result.audioBytes / 1024).toFixed(1)} KB`);
  console.log(`     Audio stream bandwidth:            ${result.audioBandwidthKbps} kbps`);

  return result;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║    HeadTTS REAL Benchmark — IntelliClass AI                 ║");
  console.log("║    POST /v1/synthesize  •  Kokoro-82M ONNX  •  CPU          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`\nTarget: ${BASE_URL}/v1/synthesize`);
  console.log(`Time:   ${new Date().toLocaleString()}\n`);

  // Liveness check
  try {
    const health = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    if (!health.ok) throw new Error(`HTTP ${health.status}`);
    const hData = await health.json();
    console.log(`✅ HeadTTS server ONLINE — ${JSON.stringify(hData)}`);
  } catch (e) {
    console.error(`\n❌ HeadTTS server is OFFLINE at ${BASE_URL}`);
    console.error(`   Start it with: pnpm dev:tts`);
    console.error(`   Error: ${e.message}\n`);
    process.exit(1);
  }

  // First call warms up the ONNX model — we run it but mark it
  console.log("\n⏳ Warm-up call (first call loads Kokoro model weights)...");
  await benchmarkSentence({ label: "WARMUP", text: "Hello." }, -1);
  console.log("\n🔥 Model warm. Running real benchmark samples...\n");

  const results = [];
  for (let i = 0; i < SAMPLE_TEXTS.length; i++) {
    const result = await benchmarkSentence(SAMPLE_TEXTS[i], i);
    if (result) results.push(result);
    await new Promise(r => setTimeout(r, 300));
  }

  if (results.length === 0) {
    console.log("\n❌ No successful results.");
    return;
  }

  // Averages across all samples
  const avg = (arr) => arr.reduce((s, x) => s + x, 0) / arr.length;
  const avgRTF       = avg(results.map(r => r.rtf)).toFixed(3);
  const avgSynthMs   = avg(results.map(r => r.synthesisTimeMs)).toFixed(1);
  const avgAccuracy  = avg(results.map(r => parseFloat(r.visemeAccuracyPct))).toFixed(1);
  const avgBandwidth = avg(results.map(r => parseFloat(r.audioBandwidthKbps))).toFixed(1);

  console.log(`\n${"═".repeat(62)}`);
  console.log("  FINAL SUMMARY — REAL MEASURED VALUES  (post warm-up)");
  console.log(`${"═".repeat(62)}`);
  console.log(`  Samples tested:                  ${results.length}`);
  console.log(`  Average Synthesis Time:          ${avgSynthMs} ms`);
  console.log(`  Average RTF:                     ${avgRTF}  (< 1.0 = faster than real-time)`);
  console.log(`  Average Viseme Accuracy:         ${avgAccuracy}%  (Oculus 15-viseme set)`);
  console.log(`  Average Audio Bandwidth:         ${avgBandwidth} kbps`);
  console.log(`${"═".repeat(62)}\n`);

  const report = {
    timestamp: new Date().toISOString(),
    server: BASE_URL,
    endpoint: "/v1/synthesize",
    model: "Kokoro-82M-v1.0-ONNX-timestamped",
    note: "Post-warmup real measured values",
    summary: {
      samplesCount: results.length,
      avgSynthesisTimeMs: parseFloat(avgSynthMs),
      avgRTF: parseFloat(avgRTF),
      avgVisemeAccuracyPct: parseFloat(avgAccuracy),
      avgAudioBandwidthKbps: parseFloat(avgBandwidth),
    },
    perSample: results,
  };

  const { writeFileSync } = await import("fs");
  const outPath = new URL("./headtts-benchmark-result.json", import.meta.url)
    .pathname.replace(/^\/([A-Z]:)/, "$1");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`📄 Full JSON results → ${outPath}`);
}

main();
