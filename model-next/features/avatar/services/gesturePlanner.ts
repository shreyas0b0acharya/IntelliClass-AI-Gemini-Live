import type { LipSyncData } from "../types/lipSync.types";

/**
 * Speech-aware behaviour planner.
 *
 * Turns a sentence (text + optional word timings from the TTS provider) into a
 * deterministic plan on the *speech clock* (ms since the audio starts;
 * negative = before the audio starts, which is how gestures and expressions get
 * to begin slightly BEFORE the words they belong to):
 *
 *   - `events`: hand/arm gestures (beats, open hands, counting, …)
 *   - `cues`:   face / head / gaze / blink / breath / torso cues
 *
 * Pure TypeScript (no three.js) so it can be unit-tested in isolation.
 *
 * What makes it context aware:
 *  - Stress: content words, longer words, words the TTS actually lengthened,
 *    phrase-final (nuclear) words and an "intensifier" lexicon get beats,
 *    a small nod, a brow flash and a slight lean.
 *  - Phrasing: commas / sentence ends / real silences split the speech into
 *    phrases; blinks and gaze shifts land on those boundaries.
 *  - Semantics: questions, enumerations, contrast, inclusion, self reference,
 *    negation, deixis, uncertainty (shrug), positive and negative wording
 *    (smile / furrow).
 *  - Gesture UNITS: hands rest at the sides by default. A sentence either has
 *    a gesture unit (hand(s) lift, gesture, drop back) or it does not, so the
 *    hands are not held up in front of the body all the time.
 *  - Tempo: fast speech -> quicker, tighter gestures; slow speech -> broader.
 *  - Determinism: seeded from the text, so every classroom participant renders
 *    the same behaviour for the same sentence.
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
  | "negate"
  | "shrug";

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
  /** Envelope support: preparation (lift from rest) begins here. */
  startMs: number;
  /** Envelope support: the hand has fully returned to rest here. */
  endMs: number;
  /** 0..1 */
  intensity: number;
  /** Enumeration index (0,1,2…) — shifts the hand a little for each count. */
  step: number;
  /**
   * How far the hand is lifted from its resting position for this gesture
   * (0 = hanging at the side, 1 = the classic "speaking height" in front).
   */
  level: number;
  /** Per-gesture spatial variation (fractions of arm length): forward, up, outward. */
  jitter: [number, number, number];
}

export type CueKind =
  | "browFlash" // quick brow raise on a stressed word
  | "browRaise" // sustained raise (questions, surprise)
  | "browInner" // inner brows up (uncertainty, concern)
  | "furrow" // brows down + lips pressed (seriousness / negative wording)
  | "smile" // warmth (positive wording, greetings)
  | "nod" // head nod (down-up)
  | "headTilt" // sustained roll tilt
  | "lookAway" // gaze aversion (eyes + head), then return
  | "blink" // request a blink (edge-triggered)
  | "inhale" // request a breath (edge-triggered)
  | "shrug" // shoulders up
  | "lean"; // torso lean (dir > 0 forward, < 0 back)

export interface SpeechCue {
  kind: CueKind;
  /** Onset begins. */
  startMs: number;
  /** Reaches full strength. */
  peakMs: number;
  /** Starts releasing. */
  holdUntilMs: number;
  /** Fully released. */
  endMs: number;
  /** 0..1 */
  intensity: number;
  /** +1 = avatar's left, -1 = avatar's right (asymmetric brows, tilt, gaze). */
  side: 1 | -1;
  /** lean: +forward / -back. */
  dir: number;
  /** lookAway: radians, + = avatar's left. */
  yaw: number;
  /** lookAway: radians, + = up. */
  pitch: number;
}

export interface PlannedWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface GesturePlan {
  events: GestureEvent[]; // sorted by startMs
  cues: SpeechCue[]; // sorted by startMs
  words: PlannedWord[];
  durationMs: number;
  /** 0.8 (slow, broad) .. 1.25 (fast, tight) */
  tempo: number;
  /** longest single event/cue span, used for fast range lookup */
  maxSpanMs: number;
}

export interface PlanOptions {
  text?: string;
  lipSync?: Pick<LipSyncData, "words" | "wtimes" | "wdurations"> | null;
  durationMs?: number;
  dominantHand?: HandSide;
  seed?: number;
}

/** Preparation / retraction time per gesture kind at tempo 1 (ms). */
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
  shrug: { prep: 520, retract: 700 },
};

/** After the last gesture of a unit the hand waits briefly, then drops to rest. */
export const RAISE_LINGER_MS = 320;
export const RAISE_FALL_MS = 950;
/** Gestures on the same hand closer than this stay "chained" (hand stays ready between them). */
export const BRIDGE_GAP_MS = 2000;

const STROKE_KINDS: ReadonlySet<GestureKind> = new Set(["beat", "emphasis"]);
export function isStrokeKind(kind: GestureKind): boolean {
  return STROKE_KINDS.has(kind);
}

// ─────────────────────────────────────────────────────────────
// Lexicons (English). Other languages still get timing/punctuation
// driven behaviour; only the semantic triggers are English-specific.
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

const GREETING = set("hello hi hey welcome greetings goodbye bye thanks thank congratulations");
const POSITIVE = set(`great good nice love loved loves excellent awesome wonderful fantastic amazing beautiful perfect easy
  simple fun exciting excited happy glad enjoy interesting brilliant best better success successful powerful helpful
  useful wow cool elegant clever neat delightful lovely`);
const NEGATIVE = set(`problem problems error errors mistake mistakes wrong bad worst difficult hard dangerous danger careful
  warning risk risky avoid fail failure fails failed broken bug bugs crash issue issues trouble unfortunately sadly
  confusing confused tricky painful serious severe`);
const UNCERTAIN = set(`maybe perhaps might possibly probably sometimes depends unsure unclear guess suppose somewhat
  roughly approximately`);
const SURPRISE = set("wow surprisingly suddenly unexpectedly incredible unbelievable remarkably");

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
  return raw
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}']/gu, "")
    .replace(/^'+|'+$/g, "");
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
    base = lip!
      .words!.map((w, i) => ({
        raw: w,
        norm: normalizeWord(w),
        punct: "",
        startMs: lip!.wtimes![i],
        endMs: lip!.wtimes![i] + (lip!.wdurations?.[i] ?? 200),
      }))
      .filter((t) => t.norm.length > 0);
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
        if ((s.kind === "beat" || s.kind === "emphasis") && Math.abs(apex - (s.start + KIND_TIMING[s.kind].prep)) < 560) {
          return false;
        }
      }
    }
    return true;
  }
}

/** How high a hand is lifted for each kind of gesture (1 = classic speaking height). */
function levelFor(kind: GestureKind, intensity: number): number {
  const i = clamp(intensity, 0, 1);
  switch (kind) {
    case "beat":
      return 0.55 + 0.2 * i;
    case "emphasis":
      return 0.8 + 0.15 * i;
    case "present":
      return 0.75 + 0.15 * i;
    case "question":
      return 0.9;
    case "enumerate":
      return 0.85;
    case "contrast":
      return 0.8;
    case "inclusive":
      return 0.9;
    case "self":
      return 0.6;
    case "negate":
      return 0.7;
    case "shrug":
      return 0.65;
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
    return { events: [], cues: [], words: [], durationMs: opts.durationMs ?? 0, tempo: 1, maxSpanMs: 0 };
  }

  scoreStress(tokens);

  const seed = opts.seed ?? hashString(opts.text ?? tokens.map((t) => t.raw).join(" "));
  const rng = mulberry32(seed);
  const medianWord = median(tokens.map((t) => t.endMs - t.startMs));
  const tempo = clamp(medianWord / 300, 0.8, 1.25);
  const speechEnd = tokens[tokens.length - 1].endMs;
  const occ = new Occupancy();
  const events: GestureEvent[] = [];
  const cues: SpeechCue[] = [];
  let lastHand: HandSide = other;
  const randSide = (): 1 | -1 => (rng() < 0.5 ? -1 : 1);

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
    const coreEnd = hold + retract;
    if (!occ.canPlace(hand, kind, start, coreEnd, apex)) return false;
    occ.add(hand, { start, end: coreEnd, kind });
    const inten = clamp(intensity, 0.2, 1);
    events.push({
      kind,
      hand,
      role,
      apexMs: apex,
      holdUntilMs: hold,
      startMs: start,
      endMs: hold + Math.max(retract, RAISE_LINGER_MS + RAISE_FALL_MS),
      intensity: inten,
      step,
      level: clamp(levelFor(kind, inten) * (role === "support" ? 0.92 : 1), 0.3, 1),
      jitter: [(rng() - 0.5) * 0.05, (rng() - 0.5) * 0.05, (rng() - 0.5) * 0.06],
    });
    if (role === "lead") lastHand = hand;
    return true;
  };

  // Apex lands just as the stressed syllable begins (gestures lead speech slightly).
  const apexOf = (t: Token) => t.startMs + Math.min(70, (t.endMs - t.startMs) * 0.25) - 40;

  const phraseRange = new Map<number, { first: number; last: number }>();
  const sentenceRange = new Map<number, { first: number; last: number }>();
  tokens.forEach((t, i) => {
    const r = phraseRange.get(t.phrase);
    if (!r) phraseRange.set(t.phrase, { first: i, last: i });
    else r.last = i;
    const s = sentenceRange.get(t.sentence);
    if (!s) sentenceRange.set(t.sentence, { first: i, last: i });
    else s.last = i;
  });

  const sentenceIsQuestion = (sIdx: number): boolean => {
    const r = sentenceRange.get(sIdx);
    return !!r && /\?/.test(tokens[r.last].punct);
  };

  const hasSemantic = new Set<number>();

  // ── Pass 1: semantic gestures ───────────────────────────────
  const lastSemanticAt: Partial<Record<GestureKind, number>> = {};
  let lastAnySemantic = -1e9;
  let enumStep = -1;
  let enumSentence = -1;

  const cooldownOk = (kind: GestureKind, at: number, same = 1800, any = 700): boolean =>
    at - (lastSemanticAt[kind] ?? -1e9) >= same && at - lastAnySemantic >= any;
  const markSemantic = (kind: GestureKind, at: number, sentence: number) => {
    lastSemanticAt[kind] = at;
    lastAnySemantic = at;
    hasSemantic.add(sentence);
  };

  const pickHand = (preferDominant = 0.65): HandSide => {
    let h: HandSide = rng() < preferDominant ? dominant : other;
    if (h === lastHand && rng() < 0.35) h = h === "left" ? "right" : "left";
    return h;
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
    if (place("question", hand, "lead", apex, lastTok.endMs - 80, 0.75 + rng() * 0.2) && rng() < 0.3) {
      place("question", hand === "left" ? "right" : "left", "support", apex, lastTok.endMs - 80, 0.55, 0, 70);
    }
    markSemantic("question", apex, sIdx);
  }

  tokens.forEach((t) => {
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
        if (place("enumerate", dominant, "lead", apex, hold, 0.8, Math.min(enumStep, 4))) {
          markSemantic("enumerate", apex, t.sentence);
        }
      }
      return;
    }

    // Contrast — one hand then the other: "on one side… but on the other".
    if (CONTRAST.has(norm) && cooldownOk("contrast", apex, 2200, 800)) {
      const a = place("contrast", dominant, "lead", apex - 60, apex + 380, 0.75, 0);
      const b = place("contrast", other, "lead", apex + 420, Math.min(phraseEnd, apex + 1500), 0.75, 1);
      if (a || b) markSemantic("contrast", apex, t.sentence);
      return;
    }

    // Uncertainty — shoulders and open palms ("maybe", "it depends").
    if (UNCERTAIN.has(norm) && cooldownOk("shrug", apex, 4000, 900) && rng() < 0.6) {
      const hold = Math.min(phraseEnd, apex + 1100);
      const ok = place("shrug", dominant, "lead", apex, hold, 0.7);
      if (ok) {
        place("shrug", other, "lead", apex, hold, 0.7, 0, 40);
        markSemantic("shrug", apex, t.sentence);
      }
      return;
    }

    // Inclusion — both hands open outward.
    if (INCLUSIVE.has(norm) && cooldownOk("inclusive", apex, 3500, 900) && rng() < 0.55) {
      const hold = Math.min(phraseEnd, apex + 900);
      const ok = place("inclusive", dominant, "lead", apex, hold, 0.7 + rng() * 0.2);
      if (ok) {
        place("inclusive", other, "lead", apex, hold, 0.7, 0, 35);
        markSemantic("inclusive", apex, t.sentence);
      }
      return;
    }

    // Negation — flat palm-down sweep.
    if (NEGATE.has(norm) && cooldownOk("negate", apex, 2500, 700) && rng() < 0.7) {
      if (place("negate", pickHand(0.7), "lead", apex, apex + 260, 0.75)) markSemantic("negate", apex, t.sentence);
      return;
    }

    // Self reference — hand drifts toward the chest.
    if (SELF.has(norm) && cooldownOk("self", apex, 6000, 900) && rng() < 0.35) {
      if (place("self", dominant, "lead", apex, apex + 500, 0.7)) markSemantic("self", apex, t.sentence);
      return;
    }

    // Deixis / presenting — open palm toward the audience.
    if (DEIXIS.has(norm) && cooldownOk("present", apex, 3000, 800) && rng() < 0.6) {
      const hold = Math.min(phraseEnd, apex + 1500);
      const hand = pickHand(0.7);
      const ok = place("present", hand, "lead", apex, hold, 0.7 + rng() * 0.2);
      if (ok) {
        if (rng() < 0.3) place("present", hand === "left" ? "right" : "left", "support", apex, hold, 0.5, 0, 80);
        markSemantic("present", apex, t.sentence);
      }
    }
  });

  // ── Gesture units: which sentences get hands up at all ───────
  // Hands rest at the sides by default. A sentence either contains a gesture
  // unit (lift → gesture → drop) or it does not. Longer sentences are more
  // likely to; sentences with a semantic gesture always do.
  type Mode = "dominant" | "other" | "both";
  const sentenceMode = new Map<number, { active: boolean; mode: Mode }>();
  for (const [sIdx, range] of sentenceRange) {
    const nWords = range.last - range.first + 1;
    const pActive = nWords <= 3 ? 0.3 : clamp(0.35 + 0.05 * nWords, 0.35, 0.85);
    const active = hasSemantic.has(sIdx) || rng() < pActive;
    const r = rng();
    const mode: Mode = r < 0.68 ? "dominant" : r < 0.83 ? "other" : "both";
    sentenceMode.set(sIdx, { active, mode });
  }

  const handForSentence = (sIdx: number): HandSide => {
    const m = sentenceMode.get(sIdx)!;
    if (m.mode === "dominant") return rng() < 0.85 ? dominant : other;
    if (m.mode === "other") return rng() < 0.85 ? other : dominant;
    return lastHand === "left" ? "right" : "left";
  };

  // ── Pass 2: open-hand explaining gestures on long phrases ────
  for (const [, range] of phraseRange) {
    const first = tokens[range.first];
    const last = tokens[range.last];
    const sm = sentenceMode.get(first.sentence);
    if (!sm?.active) continue;
    const count = range.last - range.first + 1;
    const dur = last.endMs - first.startMs;
    if (count < 6 && dur < 1700) continue;
    if (rng() > 0.55) continue;
    const apex = first.startMs + Math.min(260, dur * 0.2);
    const hold = Math.min(last.endMs - 150, apex + 2400);
    if (hold - apex < 500) continue;
    const hand = handForSentence(first.sentence);
    if (place("present", hand, "lead", apex, hold, 0.45 + rng() * 0.25) && rng() < 0.3) {
      place("present", hand === "left" ? "right" : "left", "support", apex, hold, 0.4, 0, 90);
    }
  }

  // ── Pass 3: beats on stressed words ─────────────────────────
  for (const [, range] of phraseRange) {
    const sm = sentenceMode.get(tokens[range.first].sentence);
    if (!sm?.active) continue;
    const idxs: number[] = [];
    for (let i = range.first; i <= range.last; i++) idxs.push(i);
    const count = idxs.length;
    const phraseGate = count <= 2 ? 0.4 : count <= 5 ? 0.75 : 0.9;
    if (rng() > phraseGate) continue;
    const maxBeats = count <= 5 ? 1 : count <= 9 ? 2 : 3;

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
      const hand = handForSentence(t.sentence);
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

  // ─────────────────────────────────────────────────────────────
  // Cues: face, head, gaze, blink, breath, torso
  // ─────────────────────────────────────────────────────────────
  const lastCue: Partial<Record<CueKind, number>> = {};
  const addCue = (
    kind: CueKind,
    onset: number,
    attack: number,
    hold: number,
    release: number,
    intensity: number,
    extra: Partial<Pick<SpeechCue, "side" | "dir" | "yaw" | "pitch">> = {},
    minGap = 0,
  ): boolean => {
    if (onset - (lastCue[kind] ?? -1e9) < minGap) return false;
    lastCue[kind] = onset;
    cues.push({
      kind,
      startMs: onset,
      peakMs: onset + attack,
      holdUntilMs: onset + attack + hold,
      endMs: onset + attack + hold + release,
      intensity: clamp(intensity, 0, 1),
      side: extra.side ?? 1,
      dir: extra.dir ?? 0,
      yaw: extra.yaw ?? 0,
      pitch: extra.pitch ?? 0,
    });
    return true;
  };

  for (const [sIdx, range] of sentenceRange) {
    const first = tokens[range.first];
    const last = tokens[range.last];
    const nWords = range.last - range.first + 1;
    const question = sentenceIsQuestion(sIdx);
    const exclaim = /!/.test(last.punct);

    // Breath before a sentence of any length.
    if (nWords >= 5) addCue("inhale", first.startMs - 380, 0, 0, 0, 1);

    // Speakers look away as they start a thought and come back to the listener at the end.
    if (nWords >= 6 && !question && rng() < 0.38) {
      const firstPhrase = phraseRange.get(first.phrase)!;
      const away = clamp(tokens[firstPhrase.last].endMs - first.startMs, 700, 1700);
      const side = randSide();
      const up = rng() < 0.6;
      const yaw = side * (0.18 + rng() * 0.12);
      const pitch = up ? 0.04 + rng() * 0.06 : -(0.05 + rng() * 0.04);
      if (addCue("lookAway", first.startMs - 120, 130, away, 200, 0.8 + rng() * 0.2, { side, yaw, pitch }, 2500)) {
        addCue("blink", first.startMs - 120 + 130 + away + 40, 0, 0, 0, 1, {}, 800);
      }
    }

    // Statement ends: a small nod of finality. Question ends: raised brows + tilt while waiting.
    if (!question && nWords >= 4 && rng() < 0.3) {
      addCue("nod", last.startMs - 40, 140, 70, 320, 0.4 + rng() * 0.3, {}, 900);
    }
    if (question) {
      let from = range.last;
      for (let i = range.last; i >= range.first && range.last - i < 8; i--) {
        from = i;
        if (QUESTION_WORDS.has(tokens[i].norm) && range.last - i <= 6) break;
      }
      const onset = tokens[from].startMs - 200;
      const hold = last.endMs + 250 - (onset + 250);
      addCue("browRaise", onset, 250, Math.max(300, hold), 500, 0.6 + rng() * 0.3, { side: randSide() }, 1500);
      if (rng() < 0.6) addCue("headTilt", onset + 50, 350, Math.max(300, hold - 100), 600, 0.5 + rng() * 0.4, { side: randSide() }, 2500);
      addCue("lean", onset, 400, Math.max(300, hold - 150), 700, 0.5, { dir: 1 }, 1200);
      addCue("blink", last.endMs + 120, 0, 0, 0, 1, {}, 800);
    }
    if (exclaim) addCue("browFlash", last.startMs - 220, 180, 160, 500, 0.7, {}, 1400);
  }

  tokens.forEach((t, i) => {
    const next = tokens[i + 1];
    const phr = phraseRange.get(t.phrase)!;
    const phraseEnd = tokens[phr.last].endMs;

    // Blinks land on phrase boundaries and real pauses.
    const endsPhrase = /[,;:.!?—–…]/.test(t.punct) || t.gapAfterMs >= 260;
    if (endsPhrase && next && rng() < 0.4) {
      addCue("blink", t.endMs + 80, 0, 0, 0, 1, {}, 1800);
    }

    // Pauses mid-sentence read as thinking: glance away, then back.
    if (next && t.gapAfterMs >= 550 && !/[.!?]/.test(t.punct) && rng() < 0.55) {
      const side = randSide();
      const dur = clamp(t.gapAfterMs + 120, 500, 1400);
      if (addCue("lookAway", t.endMs - 40, 130, dur, 200, 0.7, { side, yaw: side * (0.16 + rng() * 0.1), pitch: 0.05 + rng() * 0.05 }, 2500)) {
        addCue("blink", t.endMs - 40 + 130 + dur + 30, 0, 0, 0, 1, {}, 800);
      }
    }

    const apex = apexOf(t);
    const norm = t.norm;

    // Warm wording.
    if (GREETING.has(norm)) {
      addCue("smile", t.startMs - 300, 220, Math.min(2200, phraseEnd - t.startMs + 300), 800, 0.85, {}, 2500);
      addCue("nod", t.startMs - 60, 160, 80, 380, 0.7, {}, 900);
    } else if (POSITIVE.has(norm)) {
      addCue("smile", t.startMs - 250, 220, Math.min(2200, Math.max(700, phraseEnd - t.startMs)), 800, 0.5 + rng() * 0.25, {}, 2000);
      if (rng() < 0.35) addCue("browFlash", apex - 200, 170, 120, 420, 0.4, {}, 1400);
    }

    // Serious / negative wording.
    if (NEGATIVE.has(norm)) {
      addCue("furrow", t.startMs - 160, 220, Math.min(1800, Math.max(600, phraseEnd - t.startMs)), 650, 0.5 + rng() * 0.25, {}, 2000);
      addCue("lean", t.startMs - 200, 350, 500, 700, 0.35, { dir: 1 }, 1200);
    }

    // Uncertainty.
    if (UNCERTAIN.has(norm)) {
      addCue("browInner", t.startMs - 200, 240, Math.min(1400, Math.max(500, phraseEnd - t.startMs)), 500, 0.6, {}, 1800);
      if (rng() < 0.7) addCue("headTilt", t.startMs - 100, 300, 800, 600, 0.6, { side: randSide() }, 2500);
      addCue("shrug", t.startMs - 150, 260, 600, 600, 0.7, {}, 3000);
      addCue("lean", t.startMs - 150, 350, 500, 700, 0.3, { dir: -1 }, 1200);
    }

    // Surprise.
    if (SURPRISE.has(norm)) {
      addCue("browRaise", t.startMs - 220, 180, Math.min(900, Math.max(400, t.endMs - t.startMs + 200)), 500, 0.85, { side: 1 }, 1800);
    }
  });

  // Cues that ride on the gestures: nods, brow flashes and a lean on stressed beats.
  for (const e of events) {
    if (e.role !== "lead") continue;
    if (e.kind === "emphasis") {
      if (rng() < 0.65) addCue("nod", e.apexMs - 130, 150, 70, 360, 0.55 + 0.4 * e.intensity, {}, 900);
      if (rng() < 0.5) addCue("browFlash", e.apexMs - 200, 170, 140, 480, 0.55 + 0.3 * e.intensity, {}, 1400);
      if (rng() < 0.5) addCue("lean", e.apexMs - 300, 300, 250, 700, 0.4 + 0.3 * e.intensity, { dir: 1 }, 1200);
    } else if (e.kind === "beat") {
      if (rng() < 0.3) addCue("nod", e.apexMs - 120, 140, 60, 320, 0.3 + 0.3 * e.intensity, {}, 900);
      if (rng() < 0.2) addCue("browFlash", e.apexMs - 190, 160, 100, 420, 0.35, {}, 1400);
    } else if (e.kind === "enumerate") {
      addCue("nod", e.apexMs - 120, 140, 60, 320, 0.4, {}, 700);
    }
  }

  events.sort((a, b) => a.startMs - b.startMs);
  cues.sort((a, b) => a.startMs - b.startMs);

  const maxSpanMs = Math.max(
    events.reduce((m, e) => Math.max(m, e.endMs - e.startMs), 0),
    cues.reduce((m, c) => Math.max(m, c.endMs - c.startMs), 0),
  );

  return {
    events,
    cues,
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
    // Gesture units with real rests in between: 1–3 gestures, then a pause.
    const unit = 1 + Math.floor(rng() * 3);
    const unitHand: HandSide = rng() < 0.65 ? "right" : "left";
    for (let k = 0; k < unit && t < durationMs; k++) {
      const r = rng();
      const kind: GestureKind = r < 0.55 ? "beat" : r < 0.8 ? "present" : "emphasis";
      let hand: HandSide = rng() < 0.85 ? unitHand : unitHand === "left" ? "right" : "left";
      if (hand === lastHand && rng() < 0.2) hand = hand === "left" ? "right" : "left";
      const timing = KIND_TIMING[kind];
      const hold = kind === "present" ? t + 700 + rng() * 900 : t;
      const start = t - timing.prep;
      const coreEnd = hold + timing.retract;
      if (occ.canPlace(hand, kind, start, coreEnd, t)) {
        occ.add(hand, { start, end: coreEnd, kind });
        const intensity = 0.4 + rng() * 0.45;
        events.push({
          kind,
          hand,
          role: "lead",
          apexMs: t,
          holdUntilMs: hold,
          startMs: start,
          endMs: hold + Math.max(timing.retract, RAISE_LINGER_MS + RAISE_FALL_MS),
          intensity,
          step: 0,
          level: clamp(levelFor(kind, intensity), 0.3, 1),
          jitter: [(rng() - 0.5) * 0.05, (rng() - 0.5) * 0.05, (rng() - 0.5) * 0.06],
        });
        lastHand = hand;
      }
      t += 700 + rng() * 900;
    }
    t += 1800 + rng() * 2600; // hands rest between units
  }
  events.sort((a, b) => a.startMs - b.startMs);
  return {
    events,
    cues: [],
    words: [],
    durationMs,
    tempo: 1,
    maxSpanMs: events.reduce((m, e) => Math.max(m, e.endMs - e.startMs), 0),
  };
}
