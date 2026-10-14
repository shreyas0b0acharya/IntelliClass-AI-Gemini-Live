import type { LipSyncData } from "../types/lipSync.types";

/**
 * Speech-aware gesture planner.
 *
 * Turns a sentence (text + optional word timings from the TTS provider) into a
 * deterministic timeline of gesture events on the *speech clock* (ms since the
 * audio starts; negative = before the audio starts, which is how gestures get
 * to begin slightly BEFORE the words they belong to).
 *
 * Pure TypeScript (no three.js) so it can be unit-tested in isolation.
 *
 * What makes it context aware:
 *  - Stress: content words, longer words, words the TTS actually lengthened,
 *    phrase-final (nuclear) words and an "intensifier" lexicon get beats.
 *  - Phrasing: commas / sentence ends / real silences between words split the
 *    speech into phrases; long phrases get a sustained open-hand gesture.
 *  - Semantics: questions (palm-up), enumerations (first/second/next),
 *    contrast (but/however), inclusion (we/everyone), self reference (I/my),
 *    negation (no/never/not) and deixis (here/look/for example).
 *  - Tempo: fast speech -> quicker, smaller gestures; slow speech -> broader.
 *  - Determinism: seeded from the text, so every classroom participant renders
 *    the same gestures for the same sentence.
 */

export type GestureKind =
  | "beat"
  | "emphasis"
  | "present"
  | "question"
  | "enumerate"
  | "contrast"
  | "inclusive"
  | "self"
  | "negate";

export type HandSide = "left" | "right";

export interface GestureEvent {
  kind: GestureKind;
  hand: HandSide;
  /** "lead" = the hand that carries the meaning, "support" = echoing hand. */
  role: "lead" | "support";
  /** Moment the stroke lands (ms, speech clock). */
  apexMs: number;
  /** Hold-type gestures stay up until here (>= apexMs). Beats: == apexMs. */
  holdUntilMs: number;
  /** Envelope support: preparation begins here. */
  startMs: number;
  /** Envelope support: retraction finishes here. */
  endMs: number;
  /** 0..1 */
  intensity: number;
  /** Enumeration index (0,1,2…) — shifts the hand a little for each count. */
  step: number;
}

export interface PlannedWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface GesturePlan {
  events: GestureEvent[]; // sorted by startMs
  words: PlannedWord[];
  durationMs: number;
  /** 0.8 (slow, broad) .. 1.25 (fast, tight) */
  tempo: number;
  /** longest single event span, used for fast range lookup */
  maxSpanMs: number;
}

export interface PlanOptions {
  text?: string;
  lipSync?: Pick<LipSyncData, "words" | "wtimes" | "wdurations"> | null;
  durationMs?: number;
  dominantHand?: HandSide;
  seed?: number;
}

/** Preparation / retraction time per gesture kind at tempo 1. */
export const KIND_TIMING: Record<GestureKind, { prep: number; retract: number }> = {
  beat: { prep: 340, retract: 520 },
  emphasis: { prep: 420, retract: 680 },
  present: { prep: 520, retract: 640 },
  question: { prep: 520, retract: 700 },
  enumerate: { prep: 420, retract: 560 },
  contrast: { prep: 420, retract: 600 },
  inclusive: { prep: 520, retract: 700 },
  self: { prep: 380, retract: 560 },
  negate: { prep: 300, retract: 480 },
};

const STROKE_KINDS: ReadonlySet<GestureKind> = new Set(["beat", "emphasis"]);
export function isStrokeKind(kind: GestureKind): boolean {
  return STROKE_KINDS.has(kind);
}

// ─────────────────────────────────────────────────────────────
// Lexicons (English). Other languages still get timing/punctuation
// driven beats; only the semantic triggers are English-specific.
// ─────────────────────────────────────────────────────────────
const set = (s: string) => new Set(s.split(/\s+/).filter(Boolean));

const STOP = set(`a an the and or but if of to in on at by for with from as is are was were be been being am
  it its this that these those there here i you he she we they me him her us them my your his our their
  do does did have has had will would can could should shall may might not no so than then too very just
  also into about over under up down out off again more most some any each such own same other what which who
  whom how when where why because while although though until`);

const EMPHASIS = set(`very really extremely incredibly absolutely exactly important critical crucial essential key vital
  must always never only most every biggest main remember note careful huge massive major significant fundamental
  entire whole completely totally actually simply truly`);

const ENUM_ORDINAL: Record<string, number> = {
  first: 0, firstly: 0, second: 1, secondly: 1, third: 2, thirdly: 2, fourth: 3, fourthly: 3, fifth: 4,
};
const ENUM_NEXT = set("next another additionally furthermore moreover");
const ENUM_LAST = set("finally lastly");
const CONTRAST = set("but however although though whereas instead rather unlike yet nevertheless nonetheless");
const INCLUSIVE = set("we us our ours everyone everybody together all let's lets");
const SELF = set("i i'm i'll i've i'd me my mine myself");
const NEGATE = set("no not never don't doesn't didn't can't cannot won't isn't aren't nothing none without nobody neither nor");
const DEIXIS = set("here this these look see notice consider imagine example instance show watch observe check");
const QUESTION_WORDS = set("what why how who whom whose which when where do does did can could would should is are will");

// ─────────────────────────────────────────────────────────────
// Small utilities
// ─────────────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function estimateSyllables(norm: string): number {
  if (!norm) return 1;
  if (/^[0-9]+$/.test(norm)) return Math.max(1, Math.ceil(norm.length / 1.5));
  if (/[^\u0000-ɏ]/.test(norm)) return Math.max(1, Math.round(norm.length / 2.6)); // non-latin script
  let w = norm.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const m = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}

function normalizeWord(raw: string): string {
  return raw.toLowerCase().replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N}']/gu, "").replace(/^'+|'+$/g, "");
}

// ─────────────────────────────────────────────────────────────
// Tokens
// ─────────────────────────────────────────────────────────────
interface Token {
  raw: string;
  norm: string;
  punct: string; // trailing punctuation
  startMs: number;
  endMs: number;
  syll: number;
  sentence: number;
  phrase: number;
  gapAfterMs: number;
  stress: number;
}

function tokenizeText(text: string): { raw: string; norm: string; punct: string }[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((raw) => {
      const punct = raw.match(/[,;:.!?…—–]+["')\]]*$/)?.[0] ?? "";
      return { raw, norm: normalizeWord(raw), punct: punct.replace(/["')\]]/g, "") };
    })
    .filter((t) => t.norm.length > 0);
}

function alignTimings(
  textTokens: { raw: string; norm: string; punct: string }[],
  words: string[],
  starts: number[],
  durs: number[],
): { startMs: number; endMs: number }[] {
  const n = textTokens.length;
  const out: ({ startMs: number; endMs: number } | null)[] = new Array(n).fill(null);
  const lipNorm = words.map(normalizeWord);

  let j = 0;
  let matched = 0;
  for (let i = 0; i < n; i++) {
    for (let k = j; k < Math.min(lipNorm.length, j + 4); k++) {
      if (lipNorm[k] && lipNorm[k] === textTokens[i].norm) {
        out[i] = { startMs: starts[k], endMs: starts[k] + (durs[k] ?? 0) };
        j = k + 1;
        matched++;
        break;
      }
    }
  }

  if (matched < n * 0.4) {
    // Alignment is unreliable (different tokenisation) — map by relative index.
    const ln = lipNorm.length;
    return textTokens.map((_, i) => {
      const k = Math.min(ln - 1, Math.round((i * (ln - 1)) / Math.max(1, n - 1)));
      return { startMs: starts[k], endMs: starts[k] + (durs[k] ?? 0) };
    });
  }

  // Interpolate unmatched tokens between their matched neighbours.
  const firstStart = starts[0] ?? 0;
  const lastEnd = (starts[starts.length - 1] ?? 0) + (durs[durs.length - 1] ?? 0);
  let i = 0;
  while (i < n) {
    if (out[i]) {
      i++;
      continue;
    }
    const a = i;
    while (i < n && !out[i]) i++;
    const prevEnd = a > 0 ? out[a - 1]!.endMs : firstStart;
    const nextStart = i < n ? out[i]!.startMs : lastEnd;
    const count = i - a;
    const slot = Math.max(0, nextStart - prevEnd) / count;
    for (let q = 0; q < count; q++) {
      out[a + q] = { startMs: prevEnd + q * slot, endMs: prevEnd + (q + 1) * slot * 0.9 };
    }
  }
  return out as { startMs: number; endMs: number }[];
}

function estimateTimings(
  tokens: { norm: string; punct: string }[],
  durationMs?: number,
): { startMs: number; endMs: number }[] {
  const weights = tokens.map((t) => estimateSyllables(t.norm) * 190 + 70);
  const pauses: number[] = tokens.map((t) => (/[.!?…]/.test(t.punct) ? 380 : /[,;:—–]/.test(t.punct) ? 200 : 0));
  let total = weights.reduce((a, b) => a + b, 0) + pauses.reduce((a, b) => a + b, 0);
  const scale = durationMs && durationMs > 0 ? durationMs / total : 1;
  total *= scale;
  let t = 0;
  return tokens.map((_, i) => {
    const start = t;
    const end = start + weights[i] * scale;
    t = end + pauses[i] * scale;
    return { startMs: start, endMs: end };
  });
}

function buildTokens(opts: PlanOptions): Token[] {
  const lip = opts.lipSync;
  const lipWords = lip?.words?.filter((w) => normalizeWord(w).length > 0) ?? [];
  const hasLip = !!lip && !!lip.words && !!lip.wtimes && lipWords.length > 0 && lip.words.length === lip.wtimes.length;

  let base: { raw: string; norm: string; punct: string; startMs: number; endMs: number }[] = [];

  if (opts.text && opts.text.trim()) {
    const tt = tokenizeText(opts.text);
    if (hasLip) {
      const timings = alignTimings(tt, lip!.words!, lip!.wtimes!, lip!.wdurations ?? []);
      base = tt.map((t, i) => ({ ...t, ...timings[i] }));
    } else {
      const timings = estimateTimings(tt, opts.durationMs);
      base = tt.map((t, i) => ({ ...t, ...timings[i] }));
    }
  } else if (hasLip) {
    base = lip!.words!.map((w, i) => ({
      raw: w,
      norm: normalizeWord(w),
      punct: "",
      startMs: lip!.wtimes![i],
      endMs: lip!.wtimes![i] + (lip!.wdurations?.[i] ?? 200),
    })).filter((t) => t.norm.length > 0);
  }

  const tokens: Token[] = base.map((b) => ({
    ...b,
    syll: estimateSyllables(b.norm),
    sentence: 0,
    phrase: 0,
    gapAfterMs: 0,
    stress: 0,
  }));

  let sentence = 0;
  let phrase = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = tokens[i + 1];
    t.gapAfterMs = next ? Math.max(0, next.startMs - t.endMs) : 1000;
    t.sentence = sentence;
    t.phrase = phrase;
    const endsSentence = /[.!?…]/.test(t.punct);
    const endsPhrase = endsSentence || /[,;:—–]/.test(t.punct) || t.gapAfterMs >= 260;
    if (endsSentence) sentence++;
    if (endsPhrase) phrase++;
  }
  return tokens;
}

// ─────────────────────────────────────────────────────────────
// Stress model
// ─────────────────────────────────────────────────────────────
function scoreStress(tokens: Token[]): void {
  const perSyll = tokens.map((t) => (t.endMs - t.startMs) / t.syll).filter((v) => v > 0);
  const med = median(perSyll) || 200;

  // Last content word in each phrase gets the nuclear accent.
  const lastContent = new Map<number, number>();
  const firstContent = new Map<number, number>();
  tokens.forEach((t, i) => {
    if (!STOP.has(t.norm)) {
      lastContent.set(t.phrase, i);
      if (!firstContent.has(t.phrase)) firstContent.set(t.phrase, i);
    }
  });

  tokens.forEach((t, i) => {
    let s = 0;
    const content = !STOP.has(t.norm);
    s += content ? 0.45 : -0.4;
    s += 0.15 * Math.min(t.syll - 1, 2);
    const ratio = (t.endMs - t.startMs) / t.syll / med;
    s += 0.5 * clamp((ratio - 1) / 0.6, 0, 1); // TTS lengthened this word
    if (EMPHASIS.has(t.norm)) s += 0.8;
    if (/^[0-9]+$/.test(t.norm)) s += 0.3;
    if (/[A-Z]/.test(t.raw.slice(1)) || (i > 0 && /^[A-Z]/.test(t.raw) && tokens[i - 1].sentence === t.sentence)) s += 0.2;
    if (lastContent.get(t.phrase) === i) s += 0.5;
    if (firstContent.get(t.phrase) === i) s += 0.1;
    if (t.gapAfterMs >= 180 || /[,;:]/.test(t.punct)) s += 0.15;
    t.stress = s;
  });
}

// ─────────────────────────────────────────────────────────────
// Occupancy (which hand is busy when)
// ─────────────────────────────────────────────────────────────
interface Slot {
  start: number;
  end: number;
  kind: GestureKind;
}

class Occupancy {
  private slots: Record<HandSide, Slot[]> = { left: [], right: [] };

  add(hand: HandSide, slot: Slot): void {
    this.slots[hand].push(slot);
  }

  /** Can an event of this kind occupy [start,end] on this hand? */
  canPlace(hand: HandSide, kind: GestureKind, start: number, end: number, apex: number): boolean {
    for (const s of this.slots[hand]) {
      const overlap = start < s.end - 60 && end > s.start + 60;
      if (!overlap) continue;
      if (kind === "beat" && (s.kind === "present" || s.kind === "inclusive")) {
        // A beat may pulse on top of an open-hand hold, but not within another beat's window.
        continue;
      }
      return false;
    }
    // Beats keep a minimum spacing between strokes on one hand.
    if (kind === "beat" || kind === "emphasis") {
      for (const s of this.slots[hand]) {
        if ((s.kind === "beat" || s.kind === "emphasis") && Math.abs(apex - (s.start + KIND_TIMING[s.kind].prep)) < 480) {
          return false;
        }
      }
    }
    return true;
  }
}

// ─────────────────────────────────────────────────────────────
// Planner
// ─────────────────────────────────────────────────────────────
export function planGestures(opts: PlanOptions): GesturePlan {
  const dominant: HandSide = opts.dominantHand ?? "right";
  const other: HandSide = dominant === "right" ? "left" : "right";
  const tokens = buildTokens(opts);

  if (!tokens.length) {
    return { events: [], words: [], durationMs: opts.durationMs ?? 0, tempo: 1, maxSpanMs: 0 };
  }

  scoreStress(tokens);

  const seed = opts.seed ?? hashString(opts.text ?? tokens.map((t) => t.raw).join(" "));
  const rng = mulberry32(seed);
  const medianWord = median(tokens.map((t) => t.endMs - t.startMs));
  const tempo = clamp(medianWord / 300, 0.8, 1.25);
  const speechEnd = tokens[tokens.length - 1].endMs;
  const occ = new Occupancy();
  const events: GestureEvent[] = [];
  let lastHand: HandSide = other;

  const pickHand = (preferDominant = 0.65): HandSide => {
    let h: HandSide = rng() < preferDominant ? dominant : other;
    if (h === lastHand && rng() < 0.35) h = h === "left" ? "right" : "left";
    return h;
  };

  const timing = (kind: GestureKind) => {
    const k = KIND_TIMING[kind];
    return { prep: k.prep * tempo, retract: k.retract * tempo };
  };

  const place = (
    kind: GestureKind,
    hand: HandSide,
    role: "lead" | "support",
    apexMs: number,
    holdUntilMs: number,
    intensity: number,
    step = 0,
    lagMs = 0,
  ): boolean => {
    const { prep, retract } = timing(kind);
    const apex = apexMs + lagMs;
    const hold = Math.max(apex, holdUntilMs + lagMs);
    const start = apex - prep;
    const end = hold + retract;
    if (!occ.canPlace(hand, kind, start, end, apex)) return false;
    occ.add(hand, { start, end, kind });
    events.push({
      kind,
      hand,
      role,
      apexMs: apex,
      holdUntilMs: hold,
      startMs: start,
      endMs: end,
      intensity: clamp(intensity, 0.2, 1),
      step,
    });
    if (role === "lead") lastHand = hand;
    return true;
  };

  // Apex lands just as the stressed syllable begins (gestures lead speech slightly).
  const apexOf = (t: Token) => t.startMs + Math.min(70, (t.endMs - t.startMs) * 0.25) - 40;

  const phraseRange = new Map<number, { first: number; last: number }>();
  tokens.forEach((t, i) => {
    const r = phraseRange.get(t.phrase);
    if (!r) phraseRange.set(t.phrase, { first: i, last: i });
    else r.last = i;
  });

  const sentenceRange = new Map<number, { first: number; last: number }>();
  tokens.forEach((t, i) => {
    const r = sentenceRange.get(t.sentence);
    if (!r) sentenceRange.set(t.sentence, { first: i, last: i });
    else r.last = i;
  });

  // ── Pass 1: semantic triggers ───────────────────────────────
  const lastSemanticAt: Partial<Record<GestureKind, number>> = {};
  let lastAnySemantic = -1e9;
  let enumStep = -1;
  let enumSentence = -1;

  const cooldownOk = (kind: GestureKind, at: number, same = 1800, any = 700): boolean =>
    at - (lastSemanticAt[kind] ?? -1e9) >= same && at - lastAnySemantic >= any;
  const markSemantic = (kind: GestureKind, at: number) => {
    lastSemanticAt[kind] = at;
    lastAnySemantic = at;
  };

  // Questions: palm-up through the question clause.
  for (const [sIdx, range] of sentenceRange) {
    const lastTok = tokens[range.last];
    if (!/\?/.test(lastTok.punct)) continue;
    let from = range.last;
    for (let i = range.last; i >= range.first && range.last - i < 8; i--) {
      from = i;
      if (QUESTION_WORDS.has(tokens[i].norm) && range.last - i <= 6) break;
      if (/[,;:]/.test(tokens[i - 1]?.punct ?? "")) break;
    }
    const apex = apexOf(tokens[from]);
    const hand = pickHand(0.7);
    if (
      place("question", hand, "lead", apex, lastTok.endMs - 80, 0.75 + rng() * 0.2) &&
      rng() < 0.3
    ) {
      place("question", hand === "left" ? "right" : "left", "support", apex, lastTok.endMs - 80, 0.55, 0, 70);
    }
    markSemantic("question", apex);
    void sIdx;
  }

  tokens.forEach((t, i) => {
    const apex = apexOf(t);
    const phr = phraseRange.get(t.phrase)!;
    const phraseEnd = tokens[phr.last].endMs;
    const norm = t.norm;

    // Enumerations
    if (norm in ENUM_ORDINAL || ENUM_NEXT.has(norm) || ENUM_LAST.has(norm)) {
      if (enumSentence >= 0 && t.sentence - enumSentence > 2) enumStep = -1;
      if (norm in ENUM_ORDINAL) enumStep = ENUM_ORDINAL[norm];
      else enumStep += 1;
      enumSentence = t.sentence;
      if (cooldownOk("enumerate", apex, 900, 500)) {
        const hold = Math.min(phraseEnd, apex + 1400);
        if (place("enumerate", dominant, "lead", apex, hold, 0.8, Math.min(enumStep, 4))) markSemantic("enumerate", apex);
      }
      return;
    }

    // Contrast — one hand then the other: "on one side… but on the other".
    if (CONTRAST.has(norm) && cooldownOk("contrast", apex, 2200, 800)) {
      const a = place("contrast", dominant, "lead", apex - 60, apex + 380, 0.75, 0);
      const b = place("contrast", other, "lead", apex + 420, Math.min(phraseEnd, apex + 1500), 0.75, 1);
      if (a || b) markSemantic("contrast", apex);
      return;
    }

    // Inclusion — both hands open outward.
    if (INCLUSIVE.has(norm) && cooldownOk("inclusive", apex, 3500, 900) && rng() < 0.55) {
      const hold = Math.min(phraseEnd, apex + 900);
      const ok = place("inclusive", dominant, "lead", apex, hold, 0.7 + rng() * 0.2);
      if (ok) {
        place("inclusive", other, "lead", apex, hold, 0.7, 0, 35);
        markSemantic("inclusive", apex);
      }
      return;
    }

    // Negation — flat palm-down sweep.
    if (NEGATE.has(norm) && cooldownOk("negate", apex, 2500, 700) && rng() < 0.7) {
      if (place("negate", pickHand(0.7), "lead", apex, apex + 260, 0.75)) markSemantic("negate", apex);
      return;
    }

    // Self reference — hand drifts toward the chest.
    if (SELF.has(norm) && cooldownOk("self", apex, 6000, 900) && rng() < 0.35) {
      if (place("self", dominant, "lead", apex, apex + 500, 0.7)) markSemantic("self", apex);
      return;
    }

    // Deixis / presenting — open palm toward the audience.
    if (DEIXIS.has(norm) && cooldownOk("present", apex, 3000, 800) && rng() < 0.6) {
      const hold = Math.min(phraseEnd, apex + 1500);
      const hand = pickHand(0.7);
      const ok = place("present", hand, "lead", apex, hold, 0.7 + rng() * 0.2);
      if (ok) {
        if (rng() < 0.3) place("present", hand === "left" ? "right" : "left", "support", apex, hold, 0.5, 0, 80);
        markSemantic("present", apex);
      }
    }
  });

  // ── Pass 2: open-hand explaining gestures on long phrases ────
  for (const [, range] of phraseRange) {
    const first = tokens[range.first];
    const last = tokens[range.last];
    const count = range.last - range.first + 1;
    const dur = last.endMs - first.startMs;
    if (count < 6 && dur < 1700) continue;
    if (rng() > 0.6) continue;
    const apex = first.startMs + Math.min(260, dur * 0.2);
    const hold = Math.min(last.endMs - 150, apex + 2400);
    if (hold - apex < 500) continue;
    const hand = pickHand(0.6);
    if (place("present", hand, "lead", apex, hold, 0.45 + rng() * 0.25) && rng() < 0.35) {
      place("present", hand === "left" ? "right" : "left", "support", apex, hold, 0.4, 0, 90);
    }
  }

  // ── Pass 3: beats on stressed words ─────────────────────────
  for (const [, range] of phraseRange) {
    const idxs: number[] = [];
    for (let i = range.first; i <= range.last; i++) idxs.push(i);
    const count = idxs.length;
    const phraseGate = count <= 2 ? 0.35 : count <= 5 ? 0.78 : 0.92;
    if (rng() > phraseGate) continue;
    const maxBeats = count <= 2 ? 1 : count <= 5 ? 1 : count <= 9 ? 2 : 3;

    const ranked = idxs
      .filter((i) => tokens[i].stress >= (count <= 3 ? 0.4 : 0.55))
      .sort((a, b) => tokens[b].stress - tokens[a].stress);

    let used = 0;
    const placedApex: number[] = [];
    for (const i of ranked) {
      if (used >= maxBeats) break;
      const t = tokens[i];
      const apex = apexOf(t);
      if (placedApex.some((a) => Math.abs(a - apex) < 650)) continue;
      const strong = t.stress >= 1.4;
      const intensity = clamp(0.5 + 0.4 * (t.stress / 1.6) + (rng() - 0.5) * 0.2, 0.35, 1);
      const hand = pickHand(0.62);
      let ok: boolean;
      if (strong && rng() < 0.6) {
        ok = place("emphasis", hand, "lead", apex, apex, intensity);
        if (ok) place("emphasis", hand === "left" ? "right" : "left", "support", apex, apex, intensity * 0.6, 0, 70 + rng() * 40);
      } else {
        ok = place("beat", hand, "lead", apex, apex, intensity);
        if (!ok) ok = place("beat", hand === "left" ? "right" : "left", "lead", apex, apex, intensity * 0.8);
      }
      if (ok) {
        used++;
        placedApex.push(apex);
      }
    }
  }

  events.sort((a, b) => a.startMs - b.startMs);
  const maxSpanMs = events.reduce((m, e) => Math.max(m, e.endMs - e.startMs), 0);

  return {
    events,
    words: tokens.map((t) => ({ text: t.raw, startMs: t.startMs, endMs: t.endMs })),
    durationMs: Math.max(opts.durationMs ?? 0, speechEnd),
    tempo,
    maxSpanMs,
  };
}

/**
 * Fallback for when the avatar talks without any text or word timings
 * (e.g. a bare audio preview): a loose, varied rhythm of beats and open-hand
 * phrases so the hands still never loop mechanically.
 */
export function planFallbackGestures(durationMs = 60000, seed = 1234): GesturePlan {
  const rng = mulberry32(seed);
  const occ = new Occupancy();
  const events: GestureEvent[] = [];
  let t = 400;
  let lastHand: HandSide = "left";
  while (t < durationMs) {
    const r = rng();
    const kind: GestureKind = r < 0.55 ? "beat" : r < 0.8 ? "present" : "emphasis";
    let hand: HandSide = rng() < 0.62 ? "right" : "left";
    if (hand === lastHand && rng() < 0.4) hand = hand === "left" ? "right" : "left";
    const timing = KIND_TIMING[kind];
    const hold = kind === "present" ? t + 700 + rng() * 900 : t;
    const start = t - timing.prep;
    const end = hold + timing.retract;
    if (occ.canPlace(hand, kind, start, end, t)) {
      occ.add(hand, { start, end, kind });
      events.push({
        kind,
        hand,
        role: "lead",
        apexMs: t,
        holdUntilMs: hold,
        startMs: start,
        endMs: end,
        intensity: 0.4 + rng() * 0.45,
        step: 0,
      });
      lastHand = hand;
    }
    t += 650 + rng() * 1500;
  }
  events.sort((a, b) => a.startMs - b.startMs);
  return {
    events,
    words: [],
    durationMs,
    tempo: 1,
    maxSpanMs: events.reduce((m, e) => Math.max(m, e.endMs - e.startMs), 0),
  };
}
