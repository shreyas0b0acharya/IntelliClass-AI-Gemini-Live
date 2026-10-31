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
  "": { morph: null, jawOpen: 0 },

  // Bilabial (P, B, M) - lips meet, jaw closed to resting
  PP: { morph: "PP", jawOpen: 0.02 },
  pp: { morph: "PP", jawOpen: 0.02 },
  P: { morph: "PP", jawOpen: 0.02 },
  p: { morph: "PP", jawOpen: 0.02 },
  M: { morph: "PP", jawOpen: 0.02 },
  m: { morph: "PP", jawOpen: 0.02 },
  b: { morph: "PP", jawOpen: 0.02 },

  // Labiodental (F, V) - upper teeth lightly touch lower lip
  FF: { morph: "FF", jawOpen: 0.05 },
  ff: { morph: "FF", jawOpen: 0.05 },
  F: { morph: "FF", jawOpen: 0.05 },
  f: { morph: "FF", jawOpen: 0.05 },
  V: { morph: "FF", jawOpen: 0.05 },
  v: { morph: "FF", jawOpen: 0.05 },

  // Dental (TH, DH) - tongue between teeth, subtle opening
  TH: { morph: "TH", jawOpen: 0.08 },
  th: { morph: "TH", jawOpen: 0.08 },
  DH: { morph: "TH", jawOpen: 0.08 },
  dh: { morph: "TH", jawOpen: 0.08 },

  // Alveolar (D, T, N, L) - tongue to alveolar ridge
  DD: { morph: "DD", jawOpen: 0.10 },
  dd: { morph: "DD", jawOpen: 0.10 },
  D: { morph: "DD", jawOpen: 0.10 },
  d: { morph: "DD", jawOpen: 0.10 },
  T: { morph: "DD", jawOpen: 0.10 },
  t: { morph: "DD", jawOpen: 0.10 },

  // Velar (K, G)
  kk: { morph: "kk", jawOpen: 0.11 },
  KK: { morph: "kk", jawOpen: 0.11 },
  K: { morph: "kk", jawOpen: 0.11 },
  k: { morph: "kk", jawOpen: 0.11 },
  G: { morph: "kk", jawOpen: 0.11 },
  g: { morph: "kk", jawOpen: 0.11 },

  // Palato-alveolar / Affricate (CH, SH, J)
  CH: { morph: "CH", jawOpen: 0.11 },
  ch: { morph: "CH", jawOpen: 0.11 },
  SH: { morph: "CH", jawOpen: 0.11 },
  sh: { morph: "CH", jawOpen: 0.11 },
  J: { morph: "CH", jawOpen: 0.11 },
  j: { morph: "CH", jawOpen: 0.11 },
  JH: { morph: "CH", jawOpen: 0.11 },
  jh: { morph: "CH", jawOpen: 0.11 },
  ZH: { morph: "CH", jawOpen: 0.11 },
  zh: { morph: "CH", jawOpen: 0.11 },

  // Sibilant (S, Z) - teeth lightly together with narrow jaw gap
  SS: { morph: "SS", jawOpen: 0.06 },
  ss: { morph: "SS", jawOpen: 0.06 },
  S: { morph: "SS", jawOpen: 0.06 },
  s: { morph: "SS", jawOpen: 0.06 },
  Z: { morph: "SS", jawOpen: 0.06 },
  z: { morph: "SS", jawOpen: 0.06 },

  // Nasal / Liquid (N, L)
  nn: { morph: "nn", jawOpen: 0.09 },
  NN: { morph: "nn", jawOpen: 0.09 },
  N: { morph: "nn", jawOpen: 0.09 },
  n: { morph: "nn", jawOpen: 0.09 },
  L: { morph: "nn", jawOpen: 0.09 },
  l: { morph: "nn", jawOpen: 0.09 },
  NG: { morph: "nn", jawOpen: 0.09 },
  ng: { morph: "nn", jawOpen: 0.09 },

  // Retroflex / Rhotic (R, ER)
  RR: { morph: "RR", jawOpen: 0.12 },
  rr: { morph: "RR", jawOpen: 0.12 },
  R: { morph: "RR", jawOpen: 0.12 },
  r: { morph: "RR", jawOpen: 0.12 },
  ER: { morph: "RR", jawOpen: 0.12 },
  er: { morph: "RR", jawOpen: 0.12 },

  // Open Vowel (AH, AA, AE, AY, AW) - natural conversational jaw drop (max ~0.30)
  aa: { morph: "aa", jawOpen: 0.30 },
  AA: { morph: "aa", jawOpen: 0.30 },
  A: { morph: "aa", jawOpen: 0.30 },
  a: { morph: "aa", jawOpen: 0.30 },
  AH: { morph: "aa", jawOpen: 0.30 },
  ah: { morph: "aa", jawOpen: 0.30 },
  AE: { morph: "aa", jawOpen: 0.28 },
  ae: { morph: "aa", jawOpen: 0.28 },
  AY: { morph: "aa", jawOpen: 0.28 },
  ay: { morph: "aa", jawOpen: 0.28 },
  AW: { morph: "aa", jawOpen: 0.28 },
  aw: { morph: "aa", jawOpen: 0.28 },

  // Front Vowel (EH, EY) - relaxed smiling vowel
  E: { morph: "E", jawOpen: 0.18 },
  e: { morph: "E", jawOpen: 0.18 },
  EH: { morph: "E", jawOpen: 0.18 },
  eh: { morph: "E", jawOpen: 0.18 },
  EY: { morph: "E", jawOpen: 0.18 },
  ey: { morph: "E", jawOpen: 0.18 },

  // Close Front Vowel (IH, IY) - narrow parted teeth
  ih: { morph: "ih", jawOpen: 0.10 },
  IH: { morph: "ih", jawOpen: 0.10 },
  I: { morph: "ih", jawOpen: 0.10 },
  i: { morph: "ih", jawOpen: 0.10 },
  IY: { morph: "ih", jawOpen: 0.10 },
  iy: { morph: "ih", jawOpen: 0.10 },
  Y: { morph: "ih", jawOpen: 0.10 },
  y: { morph: "ih", jawOpen: 0.10 },

  // Back Rounded Vowel (O, OW, AO, OY) - rounded mouth with moderate jaw
  oh: { morph: "oh", jawOpen: 0.22 },
  OH: { morph: "oh", jawOpen: 0.22 },
  O: { morph: "oh", jawOpen: 0.22 },
  o: { morph: "oh", jawOpen: 0.22 },
  OW: { morph: "oh", jawOpen: 0.22 },
  ow: { morph: "oh", jawOpen: 0.22 },
  AO: { morph: "oh", jawOpen: 0.22 },
  ao: { morph: "oh", jawOpen: 0.22 },
  OY: { morph: "oh", jawOpen: 0.22 },
  oy: { morph: "oh", jawOpen: 0.22 },

  // Close Back Rounded Vowel (U, UW, UH, OO, W) - pucker/pursed lips with narrow jaw
  ou: { morph: "ou", jawOpen: 0.12 },
  OU: { morph: "ou", jawOpen: 0.12 },
  U: { morph: "ou", jawOpen: 0.12 },
  u: { morph: "ou", jawOpen: 0.12 },
  UW: { morph: "ou", jawOpen: 0.12 },
  uw: { morph: "ou", jawOpen: 0.12 },
  UH: { morph: "ou", jawOpen: 0.12 },
  uh: { morph: "ou", jawOpen: 0.12 },
  OO: { morph: "ou", jawOpen: 0.12 },
  oo: { morph: "ou", jawOpen: 0.12 },
  W: { morph: "ou", jawOpen: 0.10 },
  w: { morph: "ou", jawOpen: 0.10 },
};

const AZURE_OCULUS_INDEX_MAP: Record<string, string> = {
  "0": "sil",
  "1": "aa",
  "2": "aa",
  "3": "oh",
  "4": "E",
  "5": "RR",
  "6": "ih",
  "7": "ou",
  "8": "oh",
  "9": "aa",
  "10": "oh",
  "11": "aa",
  "12": "aa",
  "13": "RR",
  "14": "nn",
  "15": "SS",
  "16": "CH",
  "17": "TH",
  "18": "FF",
  "19": "DD",
  "20": "kk",
  "21": "PP",
};

/**
 * Case-insensitive lookup for HeadTTS visemes.
 */
export function getMouthConfig(viseme: string | number): MouthConfiguration | undefined {
  if (viseme === undefined || viseme === null) return undefined;
  const str = String(viseme).trim();
  if (HEADTTS_TO_AVATAR[str]) {
    return HEADTTS_TO_AVATAR[str];
  }
  if (AZURE_OCULUS_INDEX_MAP[str]) {
    return HEADTTS_TO_AVATAR[AZURE_OCULUS_INDEX_MAP[str]];
  }
  const stripped = str.replace(/^viseme_?/i, "");
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
  smoothingSpeed: 16,
  visemeIntensity: 0.75,
  maxJawSpeech: 0.32,
  attackMultiplier: 1.35,
  releaseMultiplier: 0.75,
} as const;
