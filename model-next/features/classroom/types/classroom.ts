import type { LectureItem } from "./lecture-item";
import type { HeadTTSData } from "@/components/LipSync/lipSync.types";

export type SessionStateStatus =
  | "created"
  | "running"
  | "paused"
  | "answering"
  | "ended"
  | "error";

export type ClassroomEvent =
  | {
      type: "PLAY_ITEM";
      itemId: string;
      sequence: number;
      audioPath?: string;
      lipSyncData?: HeadTTSData;
      text?: string;
    }
  | {
      type: "PAUSE";
      sequence: number;
    }
  | {
      type: "RESUME";
      itemId: string;
      sequence: number;
      audioPath?: string;
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
      audioPath?: string;
      lipSyncData?: HeadTTSData;
    }
  | {
      type: "ADMIT_PARTICIPANT";
      targetUserId: string; // specific userId or "ALL"
      sequence: number;
    }
  | {
      type: "DENY_PARTICIPANT";
      targetUserId: string;
      sequence: number;
    }
  | {
      type: "KICK_PARTICIPANT";
      targetUserId: string;
      sequence: number;
    }
  | {
      type: "REQUEST_ADMISSION";
      userId: string;
      userName: string;
      sequence: number;
      requestId?: string;
    }
  | {
      type: "END";
      sequence: number;
      stoppedReason?: string;
    };

export interface ClassroomParticipant {
  userId: string;
  name: string;
  role: "lecturer" | "student";
  joinedAt: string;
  status?: "admitted" | "waiting" | "denied";
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
