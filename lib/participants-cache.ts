import type { SessionParticipantRecord, AdmissionStatus } from "@/lib/supabase/types";

// Global in-memory cache surviving during server process lifecycle
// Ensures zero-downtime admission and snapshot reconciliation even before DB table migration
declare global {
  var __classroomParticipantsStore: Map<string, Map<string, SessionParticipantRecord>> | undefined;
}

const store = global.__classroomParticipantsStore ?? new Map<string, Map<string, SessionParticipantRecord>>();
if (process.env.NODE_ENV !== "production") {
  global.__classroomParticipantsStore = store;
}

export function getSessionParticipantsMap(sessionId: string): Map<string, SessionParticipantRecord> {
  let sessionMap = store.get(sessionId);
  if (!sessionMap) {
    sessionMap = new Map<string, SessionParticipantRecord>();
    store.set(sessionId, sessionMap);
  }
  return sessionMap;
}

export function getCachedParticipant(sessionId: string, userId: string): SessionParticipantRecord | undefined {
  return getSessionParticipantsMap(sessionId).get(userId);
}

export function getAllCachedParticipants(sessionId: string): SessionParticipantRecord[] {
  return Array.from(getSessionParticipantsMap(sessionId).values());
}

export function setCachedParticipant(
  sessionId: string,
  record: Partial<SessionParticipantRecord> & { user_id: string }
): SessionParticipantRecord {
  const sessionMap = getSessionParticipantsMap(sessionId);
  const existing = sessionMap.get(record.user_id);
  const now = new Date().toISOString();

  const merged: SessionParticipantRecord = {
    id: existing?.id || record.id || `cache_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    session_id: sessionId,
    user_id: record.user_id,
    user_name: record.user_name || existing?.user_name || "Student",
    role: record.role || existing?.role || "student",
    status: (record.status || existing?.status || "waiting") as AdmissionStatus,
    joined_at: existing?.joined_at || record.joined_at || now,
    admitted_at: record.status === "admitted" ? (record.admitted_at || existing?.admitted_at || now) : (existing?.admitted_at ?? null),
    updated_at: now,
  };

  sessionMap.set(record.user_id, merged);
  return merged;
}

export function admitCachedParticipant(
  sessionId: string,
  targetUserId: string,
  userName?: string
): void {
  const sessionMap = getSessionParticipantsMap(sessionId);
  const now = new Date().toISOString();

  if (targetUserId === "ALL") {
    sessionMap.forEach((p) => {
      if (p.role === "student" && p.status === "waiting") {
        p.status = "admitted";
        p.admitted_at = now;
        p.updated_at = now;
      }
    });
  } else {
    const existing = sessionMap.get(targetUserId);
    if (existing) {
      existing.status = "admitted";
      existing.admitted_at = now;
      existing.updated_at = now;
    } else {
      sessionMap.set(targetUserId, {
        id: `cache_${Date.now()}`,
        session_id: sessionId,
        user_id: targetUserId,
        user_name: userName || "Student",
        role: "student",
        status: "admitted",
        joined_at: now,
        admitted_at: now,
        updated_at: now,
      });
    }
  }
}

export function setCachedStatus(
  sessionId: string,
  targetUserId: string,
  status: AdmissionStatus
): void {
  const sessionMap = getSessionParticipantsMap(sessionId);
  const existing = sessionMap.get(targetUserId);
  const now = new Date().toISOString();

  if (existing) {
    existing.status = status;
    existing.updated_at = now;
  }
}
