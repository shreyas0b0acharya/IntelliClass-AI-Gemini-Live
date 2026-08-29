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

  // Bilabial (P, B, M)
  PP: { morph: "PP", jawOpen: 0.04 },
  pp: { morph: "PP", jawOpen: 0.04 },
  P: { morph: "PP", jawOpen: 0.04 },

  // Labiodental (F, V)
  FF: { morph: "FF", jawOpen: 0.08 },
  ff: { morph: "FF", jawOpen: 0.08 },
  F: { morph: "FF", jawOpen: 0.08 },

  // Dental (TH)
  TH: { morph: "TH", jawOpen: 0.12 },
  th: { morph: "TH", jawOpen: 0.12 },

  // Alveolar (D, T, N, L)
  DD: { morph: "DD", jawOpen: 0.14 },
  dd: { morph: "DD", jawOpen: 0.14 },
  D: { morph: "DD", jawOpen: 0.14 },

  // Velar (K, G)
  kk: { morph: "kk", jawOpen: 0.15 },
  KK: { morph: "kk", jawOpen: 0.15 },
  K: { morph: "kk", jawOpen: 0.15 },

  // Palato-alveolar / Affricate (CH, SH, J)
  CH: { morph: "CH", jawOpen: 0.16 },
  ch: { morph: "CH", jawOpen: 0.16 },
  SH: { morph: "CH", jawOpen: 0.16 },
  J: { morph: "CH", jawOpen: 0.16 },

  // Sibilant (S, Z)
  SS: { morph: "SS", jawOpen: 0.10 },
  ss: { morph: "SS", jawOpen: 0.10 },
  S: { morph: "SS", jawOpen: 0.10 },

  // Nasal / Liquid (N, L)
  nn: { morph: "nn", jawOpen: 0.14 },
  NN: { morph: "nn", jawOpen: 0.14 },
  N: { morph: "nn", jawOpen: 0.14 },

  // Retroflex / Rhotic (R, ER)
  RR: { morph: "RR", jawOpen: 0.18 },
  rr: { morph: "RR", jawOpen: 0.18 },
  R: { morph: "RR", jawOpen: 0.18 },

  // Open Vowel (AH, AA)
  aa: { morph: "aa", jawOpen: 0.55 },
  AA: { morph: "aa", jawOpen: 0.55 },
  A: { morph: "aa", jawOpen: 0.55 },
  a: { morph: "aa", jawOpen: 0.55 },

  // Front Vowel (EH, EY, AE)
  E: { morph: "E", jawOpen: 0.30 },
  e: { morph: "E", jawOpen: 0.30 },
  EH: { morph: "E", jawOpen: 0.30 },

  // Close Front Vowel (IH, IY)
  ih: { morph: "ih", jawOpen: 0.25 },
  IH: { morph: "ih", jawOpen: 0.25 },
  I: { morph: "ih", jawOpen: 0.25 },
  i: { morph: "ih", jawOpen: 0.25 },

  // Back Rounded Vowel (O, OW, AO)
  oh: { morph: "oh", jawOpen: 0.45 },
  OH: { morph: "oh", jawOpen: 0.45 },
  O: { morph: "oh", jawOpen: 0.45 },
  o: { morph: "oh", jawOpen: 0.45 },

  // Close Back Rounded Vowel (U, UW, OO)
  ou: { morph: "ou", jawOpen: 0.25 },
  OU: { morph: "ou", jawOpen: 0.25 },
  U: { morph: "ou", jawOpen: 0.25 },
  u: { morph: "ou", jawOpen: 0.25 },
  W: { morph: "ou", jawOpen: 0.18 },
  w: { morph: "ou", jawOpen: 0.18 },
};

/**
 * Case-insensitive lookup for HeadTTS visemes.
 */
export function getMouthConfig(viseme: string): MouthConfiguration | undefined {
  if (HEADTTS_TO_AVATAR[viseme]) {
    return HEADTTS_TO_AVATAR[viseme];
  }
  const upper = viseme.toUpperCase();
  if (HEADTTS_TO_AVATAR[upper]) return HEADTTS_TO_AVATAR[upper];
  const lower = viseme.toLowerCase();
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
