// model-next/lib/tts/g2p.types.ts

export interface PhonemeTiming {
  phoneme: string;
  startMs: number;
  durationMs: number;
}

export interface G2PEngine {
  /**
   * Translates an individual word into an ordered sequence of phonemes (ARPAbet/IPA).
   * Supports dictionary lookup, academic acronyms, and rule-based fallback.
   */
  phonemize(word: string, context?: string): Promise<string[]> | string[];
}
