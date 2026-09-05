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
      type: "SCHEDULED_PLAY";
      sequence: number;        // monotonic, gapless — THE critical sync field
      stateVersion?: number;
      driverLeaseVersion?: number;
      executionId?: string;
      itemId: string;
      targetEpochMs: number;   // synchronized epoch when audio starts on ALL devices
      leadTimeMs: number;      // scheduling lead window used (for diagnostics/logging)
      audioUrl: string;        // absolute path to the .wav served by /api/media/audio
      durationMs: number;      // expected audio duration for prefetch-next-item timing
      lipSyncData: HeadTTSData; // viseme timestamps relative to audio start (ms)
      text: string;            // subtitle text for this segment
      media?: {
        type: "image" | "video";
        url: string;
        label?: string;
      };
    }
  | {
      type: "MEDIA_PROJECT";
      sequence: number;
      stateVersion?: number;
      driverLeaseVersion?: number;
      media: {
        type: "image" | "video";
        url: string;
        label?: string;
      };
    }
  | {
      type: "MEDIA_DISMISS";
      sequence: number;
      stateVersion?: number;
      driverLeaseVersion?: number;
    }
  | {
      type: "SEEK_SYNC";
      sequence: number;
      stateVersion?: number;
      driverLeaseVersion?: number;
      executionId?: string;
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
      driverLeaseVersion?: number;
    }
  | {
      type: "RESUME";
      sequence: number;
      stateVersion?: number;
      driverLeaseVersion?: number;
      executionId?: string;
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
      driverLeaseVersion?: number;
      executionId?: string;
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
      driverLeaseVersion?: number;
    }
  | {
      type: "DENY_PARTICIPANT";
      targetUserId: string;
      sequence: number;
      stateVersion?: number;
      driverLeaseVersion?: number;
    }
  | {
      type: "KICK_PARTICIPANT";
      targetUserId: string;
      sequence: number;
      stateVersion?: number;
      driverLeaseVersion?: number;
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
      driverLeaseVersion?: number;
      stoppedReason?: string;
    }
  | {
      // Broadcast by the lecturer when restarting an ended/paused session from scratch.
      // MUST bypass all sequence guards on the receiver side so stale lastSeqRef
      // values from the previous run never block item 0 from playing.
      type: "RESTART";
      sequence: 0; // always 0 — indicates a full counter reset
      stateVersion?: number;
      driverLeaseVersion?: number;
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
