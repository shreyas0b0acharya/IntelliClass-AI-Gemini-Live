// features/avatar/services/lipSync.config.ts

export type MouthConfiguration = {
  morph: string | null;
  jawOpen: number;
};

export const HEADTTS_TO_AVATAR: Record<string, MouthConfiguration> = {
  // Silence
  sil: { morph: null, jawOpen: 0 },
  silence: { morph: null, jawOpen: 0 },
  pau: { morph: null, jawOpen: 0 },
  B: { morph: null, jawOpen: 0 },
  sp: { morph: null, jawOpen: 0 },

  // Bilabial (P, B, M) - lips meet, jaw slightly parted
  PP: { morph: "PP", jawOpen: 0.08 },
  pp: { morph: "PP", jawOpen: 0.08 },
  P: { morph: "PP", jawOpen: 0.08 },

  // Labiodental (F, V) - upper teeth touch lower lip
  FF: { morph: "FF", jawOpen: 0.20 },
  ff: { morph: "FF", jawOpen: 0.20 },
  F: { morph: "FF", jawOpen: 0.20 },

  // Dental (TH) - tongue between teeth
  TH: { morph: "TH", jawOpen: 0.26 },
  th: { morph: "TH", jawOpen: 0.26 },

  // Alveolar (D, T, N, L) - tongue to alveolar ridge
  DD: { morph: "DD", jawOpen: 0.28 },
  dd: { morph: "DD", jawOpen: 0.28 },
  D: { morph: "DD", jawOpen: 0.28 },

  // Velar (K, G)
  kk: { morph: "kk", jawOpen: 0.30 },
  KK: { morph: "kk", jawOpen: 0.30 },
  K: { morph: "kk", jawOpen: 0.30 },

  // Palato-alveolar / Affricate (CH, SH, J)
  CH: { morph: "CH", jawOpen: 0.30 },
  ch: { morph: "CH", jawOpen: 0.30 },
  SH: { morph: "CH", jawOpen: 0.30 },
  J: { morph: "CH", jawOpen: 0.30 },

  // Sibilant (S, Z) - teeth lightly together with open jaw
  SS: { morph: "SS", jawOpen: 0.20 },
  ss: { morph: "SS", jawOpen: 0.20 },
  S: { morph: "SS", jawOpen: 0.20 },

  // Nasal / Liquid (N, L)
  nn: { morph: "nn", jawOpen: 0.28 },
  NN: { morph: "nn", jawOpen: 0.28 },
  N: { morph: "nn", jawOpen: 0.28 },

  // Retroflex / Rhotic (R, ER)
  RR: { morph: "RR", jawOpen: 0.32 },
  rr: { morph: "RR", jawOpen: 0.32 },
  R: { morph: "RR", jawOpen: 0.32 },

  // Open Vowel (AH, AA) - maximum jaw drop
  aa: { morph: "aa", jawOpen: 0.75 },
  AA: { morph: "aa", jawOpen: 0.75 },
  A: { morph: "aa", jawOpen: 0.75 },
  a: { morph: "aa", jawOpen: 0.75 },

  // Front Vowel (EH, EY, AE) - wide open smiling vowel
  E: { morph: "E", jawOpen: 0.58 },
  e: { morph: "E", jawOpen: 0.58 },
  EH: { morph: "E", jawOpen: 0.58 },

  // Close Front Vowel (IH, IY)
  ih: { morph: "ih", jawOpen: 0.42 },
  IH: { morph: "ih", jawOpen: 0.42 },
  I: { morph: "ih", jawOpen: 0.42 },
  i: { morph: "ih", jawOpen: 0.42 },

  // Back Rounded Vowel (O, OW, AO) - prominent rounded open jaw
  oh: { morph: "oh", jawOpen: 0.70 },
  OH: { morph: "oh", jawOpen: 0.70 },
  O: { morph: "oh", jawOpen: 0.70 },
  o: { morph: "oh", jawOpen: 0.70 },

  // Close Back Rounded Vowel (U, UW, OO)
  ou: { morph: "ou", jawOpen: 0.42 },
  OU: { morph: "ou", jawOpen: 0.42 },
  U: { morph: "ou", jawOpen: 0.42 },
  u: { morph: "ou", jawOpen: 0.42 },
  W: { morph: "ou", jawOpen: 0.30 },
  w: { morph: "ou", jawOpen: 0.30 },
};

/**
 * Case-insensitive lookup for HeadTTS visemes.
 */
export function getMouthConfig(viseme: string): MouthConfiguration | undefined {
  if (!viseme) return undefined;
  if (HEADTTS_TO_AVATAR[viseme]) {
    return HEADTTS_TO_AVATAR[viseme];
  }
  const stripped = viseme.replace(/^viseme_?/i, "");
  if (HEADTTS_TO_AVATAR[stripped]) return HEADTTS_TO_AVATAR[stripped];
  const upper = stripped.toUpperCase();
  if (HEADTTS_TO_AVATAR[upper]) return HEADTTS_TO_AVATAR[upper];
  const lower = stripped.toLowerCase();
  if (HEADTTS_TO_AVATAR[lower]) return HEADTTS_TO_AVATAR[lower];
  return undefined;
}

/**
 * All 14 visemes available on the Avatar GLB head and teeth models.
 */
export const VISEMES = [
  "PP",
  "FF",
  "TH",
  "DD",
  "kk",
  "CH",
  "SS",
  "nn",
  "RR",
  "aa",
  "ih",
  "E",
  "oh",
  "ou",
] as const;

export const LIP_SYNC_CONFIG = {
  smoothingSpeed: 18,
  visemeIntensity: 0.85,
} as const;
