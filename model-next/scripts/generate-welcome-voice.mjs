import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Load phonemize for G2P
const { toARPABET } = require("phonemize");

// ── 1. Read environment variables from .env.local ──
const envLocalPath = path.resolve(__dirname, "../.env.local");
let apiKey = process.env.ELEVENLABS_API_KEY;

if (!apiKey && fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("ELEVENLABS_API_KEY=")) {
      apiKey = trimmed.split("=")[1]?.trim();
      break;
    }
  }
}

if (!apiKey) {
  console.error("❌ ELEVENLABS_API_KEY not found in process.env or .env.local");
  process.exit(1);
}

// Ensure public/audio directory exists
const outputDir = path.resolve(__dirname, "../public/audio");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// ── 2. Oculus Viseme Mapping & Phonetic Weights ──
const PHONEME_TO_OCULUS_EQUIVALENCE = {
  sil: null, sp: null, pau: null, "": null, " ": null,
  P: "PP", B: "PP", M: "PP", p: "PP", b: "PP", m: "PP",
  F: "FF", V: "FF", f: "FF", v: "FF",
  TH: "TH", DH: "TH", th: "TH", dh: "TH",
  T: "DD", D: "DD", t: "DD", d: "DD",
  N: "nn", NG: "nn", NX: "nn", n: "nn", ng: "nn",
  S: "SS", Z: "SS", s: "SS", z: "SS",
  CH: "CH", JH: "CH", SH: "CH", ZH: "CH", ch: "CH", jh: "CH", sh: "CH", zh: "CH",
  K: "kk", G: "kk", k: "kk", g: "kk",
  R: "RR", ER: "RR", AXR: "RR", r: "RR", er: "RR",
  L: "nn", l: "nn",
  W: "U", w: "U",
  Y: "I", y: "I",
  AA: "aa", AH: "aa", AO: "aa", AW: "aa", AY: "aa",
  aa: "aa", ah: "aa", ao: "aa", aw: "aa", ay: "aa",
  EH: "E", EY: "E", AE: "E", eh: "E", ey: "E", ae: "E",
  IH: "I", IY: "I", ih: "I", iy: "I",
  OW: "O", OY: "O", ow: "O", oy: "O",
  UH: "U", UW: "U", uh: "U", uw: "U",
};

function phonemeToOculusViseme(ph) {
  const clean = ph.toUpperCase().replace(/[0-9]/g, "");
  return PHONEME_TO_OCULUS_EQUIVALENCE[clean] || PHONEME_TO_OCULUS_EQUIVALENCE[ph] || "sil";
}

function getPhoneticWeight(ph) {
  const p = ph.toUpperCase().replace(/[0-9]/g, "");
  if (["AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY", "IH", "IY", "OW", "OY", "UH", "UW"].includes(p)) return 1.5;
  if (["S", "Z", "SH", "ZH", "F", "V", "TH", "DH", "CH", "JH"].includes(p)) return 1.1;
  if (["M", "N", "NG", "L", "R", "W", "Y"].includes(p)) return 1.0;
  if (["P", "B", "T", "D", "K", "G"].includes(p)) return 0.75;
  return 1.0;
}

function convertAlignmentToVisemes(alignment, audioDurationMs) {
  const chars = alignment?.characters || [];
  const starts = alignment?.character_start_times_seconds || [];
  const ends = alignment?.character_end_times_seconds || [];

  const words = [];
  let currentLetters = [];
  let wordStartMs = 0;
  let wordEndMs = 0;
  const n = Math.min(chars.length, starts.length, ends.length);

  for (let i = 0; i < n; i++) {
    const char = chars[i];
    const startMs = Math.round(starts[i] * 1000);
    const endMs = Math.round(ends[i] * 1000);
    const isWordChar = /[a-zA-Z0-9']/.test(char);

    if (isWordChar) {
      if (currentLetters.length === 0) wordStartMs = startMs;
      currentLetters.push(char);
      wordEndMs = endMs;
    } else {
      if (currentLetters.length > 0) {
        const w = currentLetters.join("");
        words.push({ word: w, startMs: wordStartMs, endMs: wordEndMs, durationMs: Math.max(20, wordEndMs - wordStartMs) });
        currentLetters = [];
      }
    }
  }

  if (currentLetters.length > 0) {
    const w = currentLetters.join("");
    words.push({ word: w, startMs: wordStartMs, endMs: wordEndMs, durationMs: Math.max(20, wordEndMs - wordStartMs) });
  }

  const rawVisemes = [];
  const rawVtimes = [];
  const rawVdurations = [];
  const wordStrings = [];
  const wordTimes = [];
  const wordDurations = [];
  let lastTimelineEndMs = 0;

  for (const w of words) {
    if (w.startMs - lastTimelineEndMs >= 60) {
      rawVisemes.push("sil");
      rawVtimes.push(lastTimelineEndMs);
      rawVdurations.push(w.startMs - lastTimelineEndMs);
    }

    wordStrings.push(w.word);
    wordTimes.push(w.startMs);
    wordDurations.push(w.durationMs);

    let phonemes = [];
    try {
      const arpabetStr = toARPABET(w.word);
      if (arpabetStr) {
        phonemes = arpabetStr.trim().split(/\s+/).filter(Boolean);
      }
    } catch {
      phonemes = ["AH"];
    }

    if (phonemes.length === 0) {
      rawVisemes.push("aa");
      rawVtimes.push(w.startMs);
      rawVdurations.push(w.durationMs);
      lastTimelineEndMs = w.endMs;
      continue;
    }

    const weights = phonemes.map(getPhoneticWeight);
    const totalWeight = weights.reduce((acc, wt) => acc + wt, 0);
    let currentPhonemeStart = w.startMs;

    for (let i = 0; i < phonemes.length; i++) {
      const ph = phonemes[i];
      const isLast = i === phonemes.length - 1;
      const dur = isLast
        ? Math.max(20, w.endMs - currentPhonemeStart)
        : Math.max(20, Math.round(w.durationMs * (weights[i] / totalWeight)));

      const viseme = phonemeToOculusViseme(ph) || "sil";
      rawVisemes.push(viseme);
      rawVtimes.push(currentPhonemeStart);
      rawVdurations.push(dur);
      currentPhonemeStart += dur;
    }

    lastTimelineEndMs = w.endMs;
  }

  // Smoothing & bounds clamping
  const finalVisemes = [];
  const finalVtimes = [];
  const finalVdurations = [];

  for (let i = 0; i < rawVisemes.length; i++) {
    let v = rawVisemes[i];
    let t = rawVtimes[i];
    let d = rawVdurations[i];

    if (t >= audioDurationMs) break;
    if (t + d > audioDurationMs) d = Math.max(10, audioDurationMs - t);

    const prevIdx = finalVisemes.length - 1;
    if (prevIdx >= 0 && finalVisemes[prevIdx] === v) {
      finalVdurations[prevIdx] += d;
    } else {
      finalVisemes.push(v);
      finalVtimes.push(t);
      finalVdurations.push(d);
    }
  }

  return {
    visemes: finalVisemes,
    vtimes: finalVtimes,
    vdurations: finalVdurations,
    words: wordStrings,
    wtimes: wordTimes,
    wdurations: wordDurations,
  };
}

// ── 3. Personas to generate ──
const PERSONAS = [
  {
    id: "female",
    name: "Dr. Clara",
    voiceId: "EXAVITQu4vr4xnSDxMaL", // Sarah (deterministic female voice)
    text: "Welcome to IntelliClass AI. I am Dr. Clara, your autonomous AI professor. Explore textbooks turned into live interactive 3D lectures.",
    mp3File: "welcome-female.mp3",
    jsonFile: "welcome-female.json",
  },
  {
    id: "male",
    name: "Prof. Arthur",
    voiceId: "JBFqnCBsd6RMkjVDRZzb", // George (deterministic male voice)
    text: "Welcome to IntelliClass AI. I am Professor Arthur, your autonomous AI lecturer. Explore textbooks turned into live interactive 3D lectures.",
    mp3File: "welcome-male.mp3",
    jsonFile: "welcome-male.json",
  },
];

async function generatePersona(persona) {
  console.log(`\n🎙️ Generating static welcome voice for ${persona.name} (${persona.voiceId})...`);
  console.log(`   Text: "${persona.text}"`);

  const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
    persona.voiceId
  )}/with-timestamps?output_format=mp3_44100_128`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text: persona.text,
      model_id: "eleven_flash_v2_5",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true,
        speed: 1.0,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs request failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  if (!data.audio_base64 || !data.alignment) {
    throw new Error("ElevenLabs returned invalid response missing audio_base64 or alignment.");
  }

  const audioBuffer = Buffer.from(data.audio_base64, "base64");
  const alignment = data.alignment;

  let durationMs = 0;
  if (alignment.character_end_times_seconds && alignment.character_end_times_seconds.length > 0) {
    const maxSec = Math.max(...alignment.character_end_times_seconds);
    durationMs = Math.round(maxSec * 1000);
  }

  console.log(`   Audio duration: ${durationMs}ms (${(durationMs / 1000).toFixed(2)}s)`);

  // Convert to canonical Oculus 15-viseme timeline
  const lipSyncData = convertAlignmentToVisemes(alignment, durationMs);
  console.log(`   Derived ${lipSyncData.visemes.length} Oculus visemes from ${alignment.characters.length} characters.`);

  // Write MP3
  const mp3Path = path.join(outputDir, persona.mp3File);
  fs.writeFileSync(mp3Path, audioBuffer);
  console.log(`   ✅ Saved MP3: ${mp3Path} (${audioBuffer.length} bytes)`);

  // Write JSON
  const jsonPath = path.join(outputDir, persona.jsonFile);
  fs.writeFileSync(jsonPath, JSON.stringify(lipSyncData, null, 2), "utf-8");
  console.log(`   ✅ Saved JSON: ${jsonPath}`);
}

async function main() {
  console.log("=================================================");
  console.log("IntelliClass AI — One-Time ElevenLabs Voice Asset Generator");
  console.log("=================================================");

  for (const persona of PERSONAS) {
    await generatePersona(persona);
  }

  console.log("\n🎉 All static welcome voice and viseme assets successfully generated!");
}

main().catch((err) => {
  console.error("❌ Generation failed:", err);
  process.exit(1);
});
