// model-next/lib/tts/g2p.ts
//
// Thin G2PEngine adapter wrapping the 'phonemize' library (v2.0.0).
// Converts words into standard ARPAbet phonetic tokens with high precision.

import { createRequire } from "module";
import type { G2PEngine } from "./g2p.types";

let toARPABETFn: ((text: string) => string) | null = null;

function getToARPABET(): (text: string) => string {
  if (toARPABETFn) return toARPABETFn;

  try {
    const require = createRequire(import.meta.url);
    const mod = require("phonemize");
    toARPABETFn = mod.toARPABET;
    return toARPABETFn!;
  } catch (err) {
    console.error("[G2P] Failed to load phonemize module:", err);
    // Return fallback that passes through basic vowel
    return () => "AH";
  }
}

export class PhonemizeG2PEngine implements G2PEngine {
  phonemize(word: string): string[] {
    const clean = word.trim();
    if (!clean) return [];

    try {
      const fn = getToARPABET();
      const arpabetString = fn(clean);
      if (!arpabetString) return [];

      // Split space-separated ARPAbet tokens and filter empty
      return arpabetString
        .trim()
        .split(/\s+/)
        .filter((token) => token.length > 0);
    } catch (err) {
      console.warn(`[G2P] Error phonemizing word "${clean}":`, err);
      return ["AH"];
    }
  }
}

// Global default G2P engine instance
export const defaultG2PEngine = new PhonemizeG2PEngine();
