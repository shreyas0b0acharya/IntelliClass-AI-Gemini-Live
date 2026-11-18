/**
 * LiveCaptionManager
 *
 * Real-time progressive streaming caption engine for Gemini Live dialogue.
 *
 * Key Design:
 * 1. Progressive Real-time Streaming: Words stream progressively onto the screen
 *    in real time as spoken, with smooth 60ms batching instead of delaying by entire sentences.
 * 2. Clean Sentence Transitions: The active sentence grows word-by-word. When finished
 *    (terminal punctuation [.!?]), it stays cleanly visible until the next sentence begins.
 * 3. Natural Readability Hold: Completed sentences stay visible for 8 seconds after speech
 *    pauses so learners can comfortably read, before gracefully fading.
 * 4. Instant Interruption Flush: Clears immediately when the user or conductor speaks.
 */

export interface LiveCaptionOptions {
  onUpdate: (caption: string) => void;
  sentenceHoldMs?: number;
  maxSentenceChars?: number;
}

export type AudioChunkStartCallback = (scheduledStartSec: number) => void;

export class LiveCaptionManager {
  private currentSentence: string = "";
  private displayCaption: string = "";
  private isSentenceComplete: boolean = false;
  private lastToken: string = "";
  private lastTokenTimestamp: number = 0;

  private renderTimer: NodeJS.Timeout | null = null;
  private holdTimer: NodeJS.Timeout | null = null;

  private readonly onUpdate: (caption: string) => void;
  private readonly sentenceHoldMs: number;
  private readonly maxSentenceChars: number;

  constructor(options: LiveCaptionOptions) {
    this.onUpdate = options.onUpdate;
    this.sentenceHoldMs = options.sentenceHoldMs ?? 8000; // 8s hold for readability
    this.maxSentenceChars = options.maxSentenceChars ?? 140;
  }

  /**
   * Optional audio player sync notification.
   */
  public notifyAudioChunkStart(_audioCtxStartSec: number, _audioCtxCurrentSec: number, _durationSec?: number): void {
    // Kept for interface compatibility with BoundedLiveAudioPlayer
  }

  /**
   * Add incoming streaming token from Gemini Live.
   * Words stream progressively into the active sentence and display immediately.
   */
  public addToken(rawToken: string): void {
    if (!rawToken || !rawToken.trim()) return;

    const now = Date.now();

    // 1. Deduplicate identical tokens arriving within 100ms
    if (rawToken === this.lastToken && now - this.lastTokenTimestamp < 100) {
      return;
    }
    this.lastToken = rawToken;
    this.lastTokenTimestamp = now;

    // Cancel any active hold timer because speech is actively streaming
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }

    // 2. If the previous sentence was completed, start fresh on the next sentence
    if (this.isSentenceComplete) {
      this.currentSentence = "";
      this.isSentenceComplete = false;
    }

    // 3. Clean up spacing and punctuation
    const trimmed = rawToken.trim();
    const isPunctuation = /^[.,!?;:]+$/.test(trimmed);

    if (this.currentSentence.length === 0) {
      this.currentSentence = trimmed;
    } else if (isPunctuation) {
      this.currentSentence = `${this.currentSentence.trimEnd()}${trimmed} `;
    } else {
      this.currentSentence = `${this.currentSentence.trimEnd()} ${trimmed}`;
    }

    // 4. Check for sentence completion (terminal punctuation or max length wrap)
    if (/[.!?]\s*$/.test(this.currentSentence) || this.currentSentence.length >= this.maxSentenceChars) {
      this.isSentenceComplete = true;
    }

    // 5. Progressive rendering: schedule an immediate smooth update (60ms throttle)
    this.scheduleRender();
  }

  private scheduleRender(): void {
    if (this.renderTimer) return;

    this.renderTimer = setTimeout(() => {
      this.renderTimer = null;
      const text = this.currentSentence.trim();
      if (text && text !== this.displayCaption) {
        this.displayCaption = text;
        this.onUpdate(this.displayCaption);
      }
      if (this.isSentenceComplete) {
        this.startHoldTimer();
      }
    }, 60);
  }

  /**
   * Called when model finishes its turn (turnComplete: true)
   */
  public onTurnComplete(): void {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }

    const text = this.currentSentence.trim();
    if (text && text !== this.displayCaption) {
      this.displayCaption = text;
      this.onUpdate(this.displayCaption);
    }

    this.isSentenceComplete = true;
    this.startHoldTimer();
  }

  private startHoldTimer(): void {
    if (this.holdTimer) clearTimeout(this.holdTimer);

    this.holdTimer = setTimeout(() => {
      this.holdTimer = null;
      // Fade out after hold period if no new speech has started
      this.currentSentence = "";
      this.displayCaption = "";
      this.isSentenceComplete = false;
      this.onUpdate("");
    }, this.sentenceHoldMs);
  }

  /**
   * Called when user/student interrupts or turn break occurs.
   * Instantly clears captions.
   */
  public onInterrupted(): void {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    this.currentSentence = "";
    this.displayCaption = "";
    this.isSentenceComplete = false;
    this.lastToken = "";
    this.onUpdate("");
  }

  public destroy(): void {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    this.currentSentence = "";
    this.displayCaption = "";
    this.isSentenceComplete = false;
    this.lastToken = "";
    this.onUpdate("");
  }
}
