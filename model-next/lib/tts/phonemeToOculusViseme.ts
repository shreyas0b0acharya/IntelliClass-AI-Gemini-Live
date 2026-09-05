// model-next/lib/tts/phonemeToOculusViseme.ts
//
// Maps standard phonemes (ARPAbet, IPA, Misaki tokens) to Ready Player Me / Oculus
// visual mouth-shape categories (equivalence classes) available on the 3D avatar head mesh.

export const PHONEME_TO_OCULUS_EQUIVALENCE: Record<string, string | null> = {
  // Silence / Rest
  sil: null,
  sp: null,
  pau: null,
  "": null,
  " ": null,
  $: null,

  // Bilabial (lips pressed: P, B, M) -> PP
  P: "PP",
  B: "PP",
  M: "PP",
  p: "PP",
  b: "PP",
  m: "PP",

  // Labiodental (upper teeth on lower lip: F, V) -> FF
  F: "FF",
  V: "FF",
  f: "FF",
  v: "FF",
  β: "FF",
  ɸ: "FF",
  ʋ: "FF",

  // Dental / Interdental (tongue between teeth: TH, DH) -> TH
  TH: "TH",
  DH: "TH",
  th: "TH",
  dh: "TH",
  θ: "TH",
  ð: "TH",

  // Alveolar Stops & Taps (tongue tip at ridge: T, D) -> DD
  T: "DD",
  D: "DD",
  t: "DD",
  d: "DD",
  ɾ: "DD",
  ʈ: "DD",
  ɖ: "DD",
  ɟ: "DD",
  ʣ: "DD",

  // Alveolar Nasal / Liquid -> nn
  N: "nn",
  NG: "nn",
  NX: "nn",
  n: "nn",
  ng: "nn",
  ŋ: "nn",
  ɳ: "nn",
  ɲ: "nn",
  ɴ: "nn",

  // Velar Plosive (back of tongue to soft palate: K, G) -> kk
  K: "kk",
  G: "kk",
  k: "kk",
  g: "kk",
  c: "kk",
  q: "kk",
  x: "kk",
  ɡ: "kk",

  // Affricate / Palato-Alveolar (pursed lips: CH, JH, SH, ZH) -> CH
  CH: "CH",
  JH: "CH",
  SH: "CH",
  ZH: "CH",
  ch: "CH",
  jh: "CH",
  sh: "CH",
  zh: "CH",
  ʧ: "CH",
  ʤ: "CH",
  ʃ: "CH",
  ʒ: "CH",
  ʨ: "CH",
  ʦ: "CH",
  ʥ: "CH",

  // Sibilant (narrow groove friction: S, Z) -> SS
  S: "SS",
  Z: "SS",
  s: "SS",
  z: "SS",
  ɕ: "SS",
  ç: "SS",
  ʂ: "SS",

  // Rhotic / Liquid / Retroflex (curled/bunched tongue: R, L, ER) -> RR
  // Note: 'L' and 'R' share visual equivalence class 'RR' in standard 14-viseme RPM sets
  R: "RR",
  ER: "RR",
  AXR: "RR",
  r: "RR",
  er: "RR",
  l: "RR",
  L: "RR",
  EL: "RR",
  el: "RR",
  ɹ: "RR",
  ɻ: "RR",
  ʁ: "RR",
  ɽ: "RR",
  ʎ: "RR",
  ɚ: "RR",

  // Open Vowels (jaw dropped: AA, AE, AH, AW, AY) -> aa
  AA: "aa",
  AE: "aa",
  AH: "aa",
  AW: "aa",
  AY: "aa",
  aa: "aa",
  ae: "aa",
  ah: "aa",
  aw: "aa",
  ay: "aa",
  a: "aa",
  ɑ: "aa",
  ɐ: "aa",
  ɒ: "aa",
  æ: "aa",
  ʌ: "aa",

  // Front Mid Vowel (spread lips: EH, EY) -> E
  EH: "E",
  EY: "E",
  AX: "E",
  eh: "E",
  ey: "E",
  ax: "E",
  e: "E",
  E: "E",
  ə: "E",
  ɛ: "E",
  ɜ: "E",
  œ: "E",

  // Close Front Vowel (narrow mouth opening: IH, IY, Y) -> ih
  IH: "ih",
  IY: "ih",
  Y: "ih",
  ih: "ih",
  iy: "ih",
  y: "ih",
  i: "ih",
  I: "ih",
  ɪ: "ih",
  ɨ: "ih",
  ʝ: "ih",
  ᵻ: "ih",

  // Open-Mid Rounded Vowel (rounded: AO, OW, OY) -> oh
  AO: "oh",
  OW: "oh",
  OY: "oh",
  ao: "oh",
  ow: "oh",
  oy: "oh",
  o: "oh",
  O: "oh",
  ɔ: "oh",
  ø: "oh",
  ɤ: "oh",

  // Close Back Rounded Vowel (protruded lips: UH, UW, W) -> ou
  UH: "ou",
  UW: "ou",
  W: "ou",
  uh: "ou",
  uw: "ou",
  w: "ou",
  u: "ou",
  U: "ou",
  ʊ: "ou",
  ɯ: "ou",
  ɰ: "ou",
  ɥ: "ou",
};

/**
 * Translates any raw phoneme token into an Oculus blendshape name or null (silence).
 */
export function phonemeToOculusViseme(phoneme: string): string | null {
  if (!phoneme) return null;
  // Direct match
  if (Object.prototype.hasOwnProperty.call(PHONEME_TO_OCULUS_EQUIVALENCE, phoneme)) {
    return PHONEME_TO_OCULUS_EQUIVALENCE[phoneme];
  }
  // Uppercase match
  const upper = phoneme.toUpperCase();
  if (Object.prototype.hasOwnProperty.call(PHONEME_TO_OCULUS_EQUIVALENCE, upper)) {
    return PHONEME_TO_OCULUS_EQUIVALENCE[upper];
  }
  // Strip stress digits if present (e.g. "AA1" -> "AA", "IH0" -> "IH")
  const stripped = upper.replace(/[0-9]/g, "");
  if (Object.prototype.hasOwnProperty.call(PHONEME_TO_OCULUS_EQUIVALENCE, stripped)) {
    return PHONEME_TO_OCULUS_EQUIVALENCE[stripped];
  }
  return null;
}
