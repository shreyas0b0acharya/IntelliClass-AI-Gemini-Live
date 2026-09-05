// model-next/lib/tts/ElevenLabsAlignmentToVisemeAdapter.ts
//
// Converts ElevenLabs character-level alignment timestamps into canonically formatted
// Oculus blendshapes (LipSyncData) using pluggable G2P phonemization and proportional
// duration allocation. Strictly enforces audio duration bounds.

import type { LipSyncData } from "@/features/avatar";
import type { G2PEngine } from "./g2p.types";
import { defaultG2PEngine } from "./g2p";
import { phonemeToOculusViseme } from "./phonemeToOculusViseme";

export const TIMING_ALGORITHM_VERSION = 1;
export const VISEME_MAPPING_VERSION = 1;

export interface ElevenLabsAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

interface WordToken {
  word: string;
  startMs: number;
  endMs: number;
  durationMs: number;
}

/**
 * Phonetic duration weights based on acoustic phonetics.
 * Vowels and continuous sounds carry longer duration in natural speech than plosives.
 */
function getPhoneticWeight(phoneme: string): number {
  const p = phoneme.toUpperCase().replace(/[0-9]/g, "");
  // Vowels & Diphthongs
  if (
    [
      "AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY", "IH", "IY", "OW", "OY", "UH", "UW",
    ].includes(p)
  ) {
    return 1.5;
  }
  // Fricatives & Affricates
  if (["S", "Z", "SH", "ZH", "F", "V", "TH", "DH", "CH", "JH"].includes(p)) {
    return 1.1;
  }
  // Liquids & Nasals
  if (["M", "N", "NG", "L", "R", "W", "Y"].includes(p)) {
    return 1.0;
  }
  // Plosives & Stops (short bursts)
  if (["P", "B", "T", "D", "K", "G"].includes(p)) {
    return 0.75;
  }
  return 1.0;
}

export class ElevenLabsAlignmentToVisemeAdapter {
  /**
   * Convert ElevenLabs character alignment data to canonical LipSyncData.
   *
   * @param alignment Raw alignment object from ElevenLabs API response
   * @param audioDurationMs Total duration of the audio buffer in milliseconds
   * @param g2p Optional custom G2PEngine implementation
   */
  static async convert(
    alignment: ElevenLabsAlignment,
    audioDurationMs: number,
    g2p: G2PEngine = defaultG2PEngine
  ): Promise<LipSyncData> {
    const chars = alignment?.characters || [];
    const starts = alignment?.character_start_times_seconds || [];
    const ends = alignment?.character_end_times_seconds || [];

    if (chars.length === 0 || starts.length === 0 || ends.length === 0) {
      return {
        visemes: [],
        vtimes: [],
        vdurations: [],
        words: [],
        wtimes: [],
        wdurations: [],
      };
    }

    // ── 1. Segment characters into words and detect inter-word pauses ─────
    const words: WordToken[] = [];
    let currentLetters: string[] = [];
    let wordStartMs = 0;
    let wordEndMs = 0;

    const n = Math.min(chars.length, starts.length, ends.length);

    for (let i = 0; i < n; i++) {
      const char = chars[i];
      const startMs = Math.round(starts[i] * 1000);
      const endMs = Math.round(ends[i] * 1000);

      const isWordChar = /[a-zA-Z0-9']/.test(char);

      if (isWordChar) {
        if (currentLetters.length === 0) {
          wordStartMs = startMs;
        }
        currentLetters.push(char);
        wordEndMs = endMs;
      } else {
        // Delimiter or whitespace encountered
        if (currentLetters.length > 0) {
          const w = currentLetters.join("");
          const dur = Math.max(20, wordEndMs - wordStartMs);
          words.push({ word: w, startMs: wordStartMs, endMs: wordEndMs, durationMs: dur });
          currentLetters = [];
        }
      }
    }

    // Flush any trailing word
    if (currentLetters.length > 0) {
      const w = currentLetters.join("");
      const dur = Math.max(20, wordEndMs - wordStartMs);
      words.push({ word: w, startMs: wordStartMs, endMs: wordEndMs, durationMs: dur });
    }

    // ── 2. Phonemize words and allocate timing ────────────────────────────
    const rawVisemes: string[] = [];
    const rawVtimes: number[] = [];
    const rawVdurations: number[] = [];

    const wordStrings: string[] = [];
    const wordTimes: number[] = [];
    const wordDurations: number[] = [];

    let lastTimelineEndMs = 0;

    for (const w of words) {
      // Check for inter-word silence gap
      if (w.startMs - lastTimelineEndMs >= 60) {
        rawVisemes.push("sil");
        rawVtimes.push(lastTimelineEndMs);
        rawVdurations.push(w.startMs - lastTimelineEndMs);
      }

      wordStrings.push(w.word);
      wordTimes.push(w.startMs);
      wordDurations.push(w.durationMs);

      // G2P lookup for phonemes
      const phonemes = await Promise.resolve(g2p.phonemize(w.word));
      if (phonemes.length === 0) {
        // Fallback to neutral vowel
        rawVisemes.push("aa");
        rawVtimes.push(w.startMs);
        rawVdurations.push(w.durationMs);
        lastTimelineEndMs = w.endMs;
        continue;
      }

      // Calculate relative duration per phoneme
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

    // ── 3. Smoothing & Invariant Bounds Enforcement ───────────────────────
    // Invariant 1: 0 <= start < start + dur <= audioDurationMs
    // Invariant 2: lastVisemeEnd <= audioDurationMs
    // Merge consecutive identical visemes and sub-25ms frames
    const finalVisemes: string[] = [];
    const finalVtimes: number[] = [];
    const finalVdurations: number[] = [];

    for (let i = 0; i < rawVisemes.length; i++) {
      let v = rawVisemes[i];
      let t = rawVtimes[i];
      let d = rawVdurations[i];

      // Clamp to audio duration
      if (t >= audioDurationMs) break;
      if (t + d > audioDurationMs) {
        d = Math.max(10, audioDurationMs - t);
      }

      // Merge identical consecutive visemes
      if (finalVisemes.length > 0 && finalVisemes[finalVisemes.length - 1] === v) {
        const prevIdx = finalVisemes.length - 1;
        finalVdurations[prevIdx] = Math.min(
          audioDurationMs - finalVtimes[prevIdx],
          finalVdurations[prevIdx] + d
        );
      } else {
        // Merge sub-25ms events into previous viseme unless it's the first
        if (d < 25 && finalVisemes.length > 0) {
          const prevIdx = finalVisemes.length - 1;
          finalVdurations[prevIdx] = Math.min(
            audioDurationMs - finalVtimes[prevIdx],
            finalVdurations[prevIdx] + d
          );
        } else {
          finalVisemes.push(v);
          finalVtimes.push(t);
          finalVdurations.push(d);
        }
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
}
