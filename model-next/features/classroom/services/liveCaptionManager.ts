/**
 * LiveCaptionManager
 *
 * Intelligent sentence-buffered accumulator and audio-synchronized caption driver
 * for streaming Gemini Live transcription tokens.
 *
 * Solves:
 * 1. Rapid 1-word flickering: Accumulates streaming deltas into natural, coherent sentences.
 * 2. Word duplication: Filters out duplicate tokens across outputTranscription and modelTurn.
 * 3. Timing desync: Delays display by ~200ms to align with BoundedLiveAudioPlayer playhead buffer.
 * 4. Premature clearing: Holds completed sentences on screen for 3.2 seconds for natural readability.
 * 5. Instant clean flush on speaker turn interruption.
 */

export interface LiveCaptionOptions {
  onUpdate: (caption: string) => void;
  audioSyncDelayMs?: number;
  sentenceHoldMs?: number;
  maxSentenceChars?: number;
}

export class LiveCaptionManager {
  private activeSentence: string = "";
  private displayCaption: string = "";
  private pendingQueue: { text: string; readyAt: number }[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private holdTimer: NodeJS.Timeout | null = null;

  private lastToken: string = "";
  private lastTokenTimestamp: number = 0;
  private isSentenceComplete: boolean = false;

  private readonly onUpdate: (caption: string) => void;
  private readonly audioSyncDelayMs: number;
  private readonly sentenceHoldMs: number;
  private readonly maxSentenceChars: number;

  constructor(options: LiveCaptionOptions) {
    this.onUpdate = options.onUpdate;
    this.audioSyncDelayMs = options.audioSyncDelayMs ?? 200;
    this.sentenceHoldMs = options.sentenceHoldMs ?? 3200;
    this.maxSentenceChars = options.maxSentenceChars ?? 85;
  }

  /**
   * Add incoming streaming token from Gemini Live.
   */
  public addToken(rawToken: string): void {
    if (!rawToken || !rawToken.trim()) return;

    const now = Date.now();

    // 1. Deduplicate identical tokens arriving within 120ms (e.g. outputTranscription + part.text)
    if (rawToken === this.lastToken && now - this.lastTokenTimestamp < 120) {
      return;
    }
    this.lastToken = rawToken;
    this.lastTokenTimestamp = now;

    // Cancel any active hold/fade timer because new speech is arriving
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }

    // 2. Start a fresh sentence if previous one was finalized by terminal punctuation
    if (this.isSentenceComplete) {
      this.activeSentence = "";
      this.isSentenceComplete = false;
    }

    // 3. Clean up spacing and punctuation
    const trimmed = rawToken.trim();
    const isPunctuation = /^[.,!?;:]+$/.test(trimmed);

    if (this.activeSentence.length === 0) {
      this.activeSentence = trimmed;
    } else if (isPunctuation) {
      this.activeSentence = `${this.activeSentence.trimEnd()}${trimmed} `;
    } else {
      this.activeSentence = `${this.activeSentence.trimEnd()} ${trimmed}`;
    }

    // 4. Check for sentence completion (terminal punctuation or max length wrap)
    if (/[.!?]\s*$/.test(this.activeSentence) || this.activeSentence.length >= this.maxSentenceChars) {
      this.isSentenceComplete = true;
    }

    // 5. Schedule audio-synchronized display
    const snapshot = this.activeSentence;
    this.pendingQueue.push({
      text: snapshot,
      readyAt: now + this.audioSyncDelayMs,
    });

    this.scheduleQueueFlush();
  }

  private scheduleQueueFlush(): void {
    if (this.flushTimer) return;

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.processQueue();
    }, 40);
  }

  private processQueue(): void {
    const now = Date.now();
    let latestReadyText: string | null = null;

    while (this.pendingQueue.length > 0 && this.pendingQueue[0].readyAt <= now) {
      const item = this.pendingQueue.shift();
      if (item) {
        latestReadyText = item.text;
      }
    }

    if (latestReadyText !== null && latestReadyText !== this.displayCaption) {
      this.displayCaption = latestReadyText;
      this.onUpdate(this.displayCaption);
    }

    // If more tokens are pending in future, schedule next check
    if (this.pendingQueue.length > 0) {
      const nextDelay = Math.max(20, this.pendingQueue[0].readyAt - now);
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.processQueue();
      }, nextDelay);
    } else if (this.isSentenceComplete) {
      // All ready tokens flushed and sentence is complete: start hold countdown
      this.startHoldTimer();
    }
  }

  /**
   * Called when model finishes its turn (turnComplete: true)
   */
  public onTurnComplete(): void {
    // Immediately process any remaining queued tokens so full speech is displayed
    if (this.activeSentence && this.activeSentence !== this.displayCaption) {
      this.displayCaption = this.activeSentence;
      this.onUpdate(this.displayCaption);
    }
    this.pendingQueue = [];
    this.isSentenceComplete = true;
    this.startHoldTimer();
  }

  private startHoldTimer(): void {
    if (this.holdTimer) clearTimeout(this.holdTimer);

    this.holdTimer = setTimeout(() => {
      this.holdTimer = null;
      this.displayCaption = "";
      this.activeSentence = "";
      this.isSentenceComplete = false;
      this.onUpdate("");
    }, this.sentenceHoldMs);
  }

  /**
   * Called when student interrupts or lecture is stopped/paused.
   */
  public onInterrupted(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    this.pendingQueue = [];
    this.activeSentence = "";
    this.displayCaption = "";
    this.isSentenceComplete = false;
    this.lastToken = "";
    this.onUpdate("");
  }

  public destroy(): void {
    this.onInterrupted();
  }
}
