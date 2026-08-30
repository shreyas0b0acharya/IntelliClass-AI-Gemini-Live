// features/classroom/types/classroom.ts
//
// IMPORTANT: PLAY_ITEM has been removed in favour of SCHEDULED_PLAY.
// This is an atomic-deploy change — all clients in this monorepo are served
// from the same Next.js deployment. There is no external consumer of the
// Supabase broadcast channel, so no staggered migration is needed.
// TypeScript will catch any missed call sites at `pnpm typecheck`.

import type { LectureItem } from "./lecture-item";
import type { HeadTTSData } from "@/features/avatar";

export type SessionStateStatus =
  | "created"
  | "running"
  | "paused"
  | "answering"
  | "ended"
  | "error";

export type ClassroomEvent =
  // ─── Lecture flow ──────────────────────────────────────────────────────
  | {
      /**
       * Primary lecture playback event. Replaces the old PLAY_ITEM.
       *
       * targetEpochMs is a synchronized wall-clock timestamp (ms) computed by
       * the driver as: getSynchronizedEpochMs() + LEAD_TIME_MS (≈350ms).
       * Every device decodes audio and calls:
       *   source.start(ctx.currentTime + (targetEpochMs - getSynchronizedEpochMs()) / 1000)
       * making audio start on the EXACT same hardware millisecond everywhere.
       *
       * sequence is monotonically increasing. Clients detect gaps:
       *   received 41, then 43 → 42 is missing
       *   → audio.stop(), resetMorphs(), accept 43 cleanly
       */
      type: "SCHEDULED_PLAY";
      sequence: number;        // monotonic, gapless — THE critical sync field
      stateVersion?: number;
      itemId: string;
      targetEpochMs: number;   // synchronized epoch when audio starts on ALL devices
      leadTimeMs: number;      // scheduling lead window used (for diagnostics/logging)
      audioUrl: string;        // absolute path to the .wav served by /api/media/audio
      durationMs: number;      // expected audio duration for prefetch-next-item timing
      lipSyncData: HeadTTSData; // viseme timestamps relative to audio start (ms)
      text: string;            // subtitle text for this segment
    }
  | {
      /**
       * Sent when a student joins an already-running session mid-sentence.
       * Includes a seekOffsetMs so the new client starts the audio at the
       * correct position instead of from the beginning.
       *
       * Handler must also set lastSeqRef.current = event.sequence.
       */
      type: "SEEK_SYNC";
      sequence: number;
      stateVersion?: number;
      itemId: string;
      targetEpochMs: number;   // original scheduled start epoch of this sentence
      durationMs: number;
      audioUrl: string;
      lipSyncData: HeadTTSData;
      text: string;
    }
  | {
      type: "PAUSE";
      sequence: number;
      stateVersion?: number;
    }
  | {
      type: "RESUME";
      sequence: number;
      stateVersion?: number;
      itemId: string;
      targetEpochMs?: number;
      audioUrl?: string;
      lipSyncData?: HeadTTSData;
      text?: string;
    }
  | {
      type: "INTERRUPT";
      interruptionId: string;
      questionId?: string;
      studentName: string;
      question: string;
      answer: string;
      resumeFromItemId: string;
      sequence: number;
      stateVersion?: number;
      targetEpochMs?: number;
      audioUrl?: string;
      lipSyncData?: HeadTTSData;
    }
  // ─── Participant management ────────────────────────────────────────────
  | {
      type: "ADMIT_PARTICIPANT";
      targetUserId: string; // specific userId or "ALL"
      sequence: number;
      stateVersion?: number;
    }
  | {
      type: "DENY_PARTICIPANT";
      targetUserId: string;
      sequence: number;
      stateVersion?: number;
    }
  | {
      type: "KICK_PARTICIPANT";
      targetUserId: string;
      sequence: number;
      stateVersion?: number;
    }
  | {
      type: "REQUEST_ADMISSION";
      userId: string;
      userName: string;
      sequence: number;
      stateVersion?: number;
      requestId?: string;
    }
  | {
      type: "END";
      sequence: number;
      stateVersion?: number;
      stoppedReason?: string;
    };

export type AdmissionStatus = "waiting" | "admitted" | "denied" | "left";
export type ConnectionStatus = "online" | "reconnecting" | "offline";

export interface ClassroomParticipant {
  userId: string;
  name: string;
  role: "lecturer" | "student";
  joinedAt: string;
  admittedAt?: string | null;
  status: AdmissionStatus;
  connectionStatus?: ConnectionStatus;
  connectionCount?: number;
}

export interface InterruptionItem {
  id: string;
  type: "question_answer";
  studentName: string;
  question: string;
  answer: string;
  resumeFromItemId: string;
}

export type QueueItem =
  | {
      type: "lecture";
      item: LectureItem;
    }
  | {
      type: "interruption";
      item: InterruptionItem;
    };
