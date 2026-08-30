"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type {
  ClassroomEvent,
  ClassroomParticipant,
  AdmissionStatus,
} from "../types/classroom";
import { toast } from "sonner";

interface UseClassroomSyncOptions {
  sessionId: string;
  userId?: string;
  userName?: string;
  role?: "lecturer" | "student";
  onEvent: (event: ClassroomEvent) => void;
  onStudentCountChange?: (count: number) => void;
  onKicked?: () => void;
}

export function useClassroomSync({
  sessionId,
  userId,
  userName = "Anonymous",
  role = "student",
  onEvent,
  onStudentCountChange,
  onKicked,
}: UseClassroomSyncOptions) {
  const isLecturer = role === "lecturer";
  const broadcastChannelRef = useRef<RealtimeChannel | null>(null);
  const isChannelSubscribedRef = useRef<boolean>(false);
  const lastSequenceRef = useRef<number>(-1);
  const stateVersionRef = useRef<number>(0);

  // Authoritative DB participants roster
  const dbParticipantsRef = useRef<Map<string, ClassroomParticipant>>(new Map());

  // In-memory toast suppression guard: tracks students known to be admitted
  const admittedStudentIdsRef = useRef<Set<string>>(new Set());

  // In-memory de-duplication guard: tracks students who have an active/recent toast in waiting cycle
  const promptedStudentIdsRef = useRef<Set<string>>(new Set());

  // Presentation grace period tracking for presence offline transitions (10 seconds)
  const presenceLastSeenRef = useRef<Map<string, number>>(new Map());

  // Active toast tracking to prevent duplicate admission prompt popups
  const activePromptToastIdsRef = useRef<Map<string, string | number>>(new Map());

  const [myAdmissionStatus, setMyAdmissionStatus] = useState<AdmissionStatus>(() =>
    isLecturer ? "admitted" : "waiting"
  );
  const [activeStudentCount, setActiveStudentCount] = useState<number>(0);
  const [activeLecturerCount, setActiveLecturerCount] = useState<number>(0);
  const [participants, setParticipants] = useState<ClassroomParticipant[]>([]);
  const [isDriver, setIsDriver] = useState<boolean>(isLecturer);

  // Stable refs for callbacks and dynamic user info to prevent stale closures
  const onEventRef = useRef(onEvent);
  const onStudentCountChangeRef = useRef(onStudentCountChange);
  const onKickedRef = useRef(onKicked);
  const myUserIdRef = useRef<string | undefined>(userId);
  const myUserNameRef = useRef<string>(userName);
  const roleRef = useRef<string>(role);
  const isLecturerRef = useRef<boolean>(isLecturer);
  const myAdmissionStatusRef = useRef<AdmissionStatus>(myAdmissionStatus);
  const pendingEventQueueRef = useRef<ClassroomEvent[]>([]);

  // Function refs
  const fetchSnapshotRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const showLecturerAdmissionToastRef = useRef<(studentId: string, studentName: string) => void>(() => {});
  const admitParticipantRef = useRef<(targetUserId: string) => Promise<void>>(() => Promise.resolve());
  const denyParticipantRef = useRef<(targetUserId: string) => Promise<void>>(() => Promise.resolve());
  const kickParticipantRef = useRef<(targetUserId: string) => Promise<void>>(() => Promise.resolve());

  // ── 1. SNAPSHOT RECONCILIATION ─────────────────────────────────────────────
  const fetchSnapshot = useCallback(async () => {
    if (!sessionId || !userId) return;

    try {
      const res = await fetch(`/api/classroom/${sessionId}/snapshot`);
      if (!res.ok) return;

      const data = await res.json();
      if (!data) return;

      if (typeof data.stateVersion === "number") {
        stateVersionRef.current = data.stateVersion;
      }

      if (data.myStatus) {
        setMyAdmissionStatus(data.myStatus as AdmissionStatus);
        if (data.myStatus === "denied") {
          onKickedRef.current?.();
        }
      }

      if (Array.isArray(data.participants)) {
        const newMap = new Map<string, ClassroomParticipant>();
        data.participants.forEach((p: ClassroomParticipant) => {
          if (p && p.userId) {
            newMap.set(p.userId, {
              userId: p.userId,
              name: p.name || "Student",
              role: p.role,
              status: p.status,
              joinedAt: p.joinedAt,
              admittedAt: p.admittedAt,
            });

            // Seed admitted set from authoritative snapshot
            if (p.status === "admitted") {
              admittedStudentIdsRef.current.add(p.userId);
              promptedStudentIdsRef.current.delete(p.userId);
            } else if (p.status === "denied") {
              admittedStudentIdsRef.current.delete(p.userId);
            }
          }
        });
        dbParticipantsRef.current = newMap;
      }
    } catch (err) {
      console.warn("[ClassroomSync] Error fetching snapshot:", err);
    }
  }, [sessionId, userId]);

  // ── 2. BROADCAST REALTIME EVENT ───────────────────────────────────────────
  const broadcastEvent = useCallback(
    (event: ClassroomEvent) => {
      if (!broadcastChannelRef.current) return;

      if (!isChannelSubscribedRef.current) {
        pendingEventQueueRef.current.push(event);
        return;
      }

      // Students can only broadcast INTERRUPT and REQUEST_ADMISSION
      if (
        !isLecturerRef.current &&
        event.type !== "INTERRUPT" &&
        event.type !== "REQUEST_ADMISSION" &&
        !isDriver
      ) {
        return;
      }

      lastSequenceRef.current = Math.max(lastSequenceRef.current, event.sequence);

      try {
        broadcastChannelRef.current.send({
          type: "broadcast",
          event: "classroom-action",
          payload: {
            ...event,
            stateVersion: stateVersionRef.current,
          },
        });
      } catch (e) {
        console.warn("[Realtime] broadcast send error:", e);
      }
    },
    [isDriver]
  );

  // ── 3. LECTURER ACTIONS (Admit, Deny, Kick) ────────────────────────────────
  const admitParticipant = useCallback(
    async (targetUserId: string) => {
      if (!isLecturerRef.current) return;

      // Optimistically update in-memory guard & state
      if (targetUserId === "ALL") {
        dbParticipantsRef.current.forEach((p, uid) => {
          if (p.role === "student" && p.status === "waiting") {
            admittedStudentIdsRef.current.add(uid);
            promptedStudentIdsRef.current.delete(uid);
          }
        });
        activePromptToastIdsRef.current.forEach((tId) => toast.dismiss(tId));
        activePromptToastIdsRef.current.clear();
      } else {
        admittedStudentIdsRef.current.add(targetUserId);
        promptedStudentIdsRef.current.delete(targetUserId);
        if (activePromptToastIdsRef.current.has(targetUserId)) {
          const toastId = activePromptToastIdsRef.current.get(targetUserId);
          if (toastId) toast.dismiss(toastId);
          activePromptToastIdsRef.current.delete(targetUserId);
        }
      }

      setParticipants((prev) =>
        prev.map((p) =>
          targetUserId === "ALL" || p.userId === targetUserId
            ? { ...p, status: "admitted" }
            : p
        )
      );

      try {
        const res = await fetch(`/api/classroom/${sessionId}/participants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "admit", targetUserId }),
        });

        if (!res.ok) throw new Error(`HTTP error ${res.status}`);

        const data = await res.json();
        const committedVersion =
          typeof data?.stateVersion === "number"
            ? data.stateVersion
            : ++stateVersionRef.current;
        stateVersionRef.current = committedVersion;

        lastSequenceRef.current++;
        broadcastEvent({
          type: "ADMIT_PARTICIPANT",
          targetUserId,
          sequence: lastSequenceRef.current,
          stateVersion: committedVersion,
        });

        toast.success(
          targetUserId === "ALL"
            ? "All students admitted."
            : "Student admitted to lecture."
        );
      } catch (err) {
        console.error("[ClassroomSync] admitParticipant error:", err);
        // Rollback optimistic admission guard on failure
        if (targetUserId !== "ALL") {
          admittedStudentIdsRef.current.delete(targetUserId);
        }
        toast.error("Failed to admit student. Please try again.");
      }
    },
    [sessionId, broadcastEvent]
  );

  const denyParticipant = useCallback(
    async (targetUserId: string) => {
      if (!isLecturerRef.current) return;

      // Symmetric eviction on denial
      admittedStudentIdsRef.current.delete(targetUserId);
      promptedStudentIdsRef.current.delete(targetUserId);

      if (activePromptToastIdsRef.current.has(targetUserId)) {
        const toastId = activePromptToastIdsRef.current.get(targetUserId);
        if (toastId) toast.dismiss(toastId);
        activePromptToastIdsRef.current.delete(targetUserId);
      }

      setParticipants((prev) =>
        prev.map((p) =>
          p.userId === targetUserId ? { ...p, status: "denied" } : p
        )
      );

      try {
        const res = await fetch(`/api/classroom/${sessionId}/participants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "deny", targetUserId }),
        });

        if (!res.ok) throw new Error(`HTTP error ${res.status}`);

        const data = await res.json();
        const committedVersion =
          typeof data?.stateVersion === "number"
            ? data.stateVersion
            : ++stateVersionRef.current;
        stateVersionRef.current = committedVersion;

        lastSequenceRef.current++;
        broadcastEvent({
          type: "DENY_PARTICIPANT",
          targetUserId,
          sequence: lastSequenceRef.current,
          stateVersion: committedVersion,
        });

        toast.info("Student admission declined.");
      } catch (err) {
        console.error("[ClassroomSync] denyParticipant error:", err);
      }
    },
    [sessionId, broadcastEvent]
  );

  const kickParticipant = useCallback(
    async (targetUserId: string) => {
      if (!isLecturerRef.current) return;

      // Symmetric eviction on kick
      admittedStudentIdsRef.current.delete(targetUserId);
      promptedStudentIdsRef.current.delete(targetUserId);

      setParticipants((prev) =>
        prev.map((p) =>
          p.userId === targetUserId ? { ...p, status: "denied" } : p
        )
      );

      try {
        const res = await fetch(`/api/classroom/${sessionId}/participants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "kick", targetUserId }),
        });

        if (!res.ok) throw new Error(`HTTP error ${res.status}`);

        const data = await res.json();
        const committedVersion =
          typeof data?.stateVersion === "number"
            ? data.stateVersion
            : ++stateVersionRef.current;
        stateVersionRef.current = committedVersion;

        lastSequenceRef.current++;
        broadcastEvent({
          type: "KICK_PARTICIPANT",
          targetUserId,
          sequence: lastSequenceRef.current,
          stateVersion: committedVersion,
        });

        toast.info("Removed student from session.");
      } catch (err) {
        console.error("[ClassroomSync] kickParticipant error:", err);
      }
    },
    [sessionId, broadcastEvent]
  );

  const admitAllParticipants = useCallback(() => {
    admitParticipant("ALL");
  }, [admitParticipant]);

  // ── 4. STUDENT RE-KNOCK / RE-REQUEST ACTION ────────────────────────────────
  const requestRejoin = useCallback(async () => {
    if (isLecturerRef.current || !userId) return;

    try {
      const res = await fetch(`/api/classroom/${sessionId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "re_request",
          userName: myUserNameRef.current,
        }),
      });

      if (res.status === 429) {
        const data = await res.json();
        toast.warning(data.error || "Please wait before requesting admission again.");
        return;
      }

      if (!res.ok) {
        toast.error("Failed to submit join request. Please try again.");
        return;
      }

      setMyAdmissionStatus("waiting");

      lastSequenceRef.current++;
      broadcastEvent({
        type: "REQUEST_ADMISSION",
        userId,
        userName: myUserNameRef.current,
        sequence: lastSequenceRef.current,
        requestId: Date.now().toString(),
      });

      if (broadcastChannelRef.current && isChannelSubscribedRef.current) {
        broadcastChannelRef.current.track({
          userId,
          name: myUserNameRef.current,
          role: "student",
          joinedAt: new Date().toISOString(),
          status: "waiting",
        });
      }

      toast.info("Join request sent to the instructor.");
    } catch (err) {
      console.error("[ClassroomSync] requestRejoin error:", err);
    }
  }, [sessionId, userId, broadcastEvent]);

  // ── 5. HELPER: LECTURER ADMISSION PROMPT TOAST ─────────────────────────────
  const showLecturerAdmissionToast = useCallback(
    (studentId: string, studentName: string) => {
      if (!isLecturerRef.current) return;

      // 1. In-memory local admitted guard
      if (admittedStudentIdsRef.current.has(studentId)) return;

      // 2. In-memory de-duplication guard (already prompted in current waiting cycle)
      if (promptedStudentIdsRef.current.has(studentId)) return;

      // 3. Authoritative DB participant check
      const dbRecord = dbParticipantsRef.current.get(studentId);
      if (dbRecord && dbRecord.status === "admitted") {
        admittedStudentIdsRef.current.add(studentId);
        return;
      }
      if (dbRecord && dbRecord.status === "denied") return;
      if (activePromptToastIdsRef.current.has(studentId)) return;

      promptedStudentIdsRef.current.add(studentId);

      const toastId = toast.info(
        `🎓 ${studentName || "A student"} wants to join the lecture`,
        {
          description: `Request received • ${new Date().toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}`,
          duration: 20000,
          onDismiss: () => {
            activePromptToastIdsRef.current.delete(studentId);
          },
          action: {
            label: "Accept",
            onClick: () => admitParticipantRef.current?.(studentId),
          },
          cancel: {
            label: "Decline",
            onClick: () => denyParticipantRef.current?.(studentId),
          },
        }
      );

      activePromptToastIdsRef.current.set(studentId, toastId);
    },
    []
  );

  // Synchronize dynamic function/state refs on every render
  useEffect(() => {
    onEventRef.current = onEvent;
    onStudentCountChangeRef.current = onStudentCountChange;
    onKickedRef.current = onKicked;
    myUserIdRef.current = userId;
    myUserNameRef.current = userName;
    roleRef.current = role;
    isLecturerRef.current = isLecturer;
    myAdmissionStatusRef.current = myAdmissionStatus;
    fetchSnapshotRef.current = fetchSnapshot;
    showLecturerAdmissionToastRef.current = showLecturerAdmissionToast;
    admitParticipantRef.current = admitParticipant;
    denyParticipantRef.current = denyParticipant;
    kickParticipantRef.current = kickParticipant;
  });

  // ── 6. INITIAL JOIN REGISTRATION & SNAPSHOT BOOTSTRAP ──────────────────────
  useEffect(() => {
    if (!sessionId || !userId) return;

    let mounted = true;

    async function initializeSession() {
      try {
        const joinRes = await fetch(`/api/classroom/${sessionId}/participants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "join", userName }),
        });

        if (joinRes.ok) {
          const joinData = await joinRes.json();
          if (mounted && joinData?.status) {
            setMyAdmissionStatus(joinData.status as AdmissionStatus);
          }
        }

        if (mounted) {
          await fetchSnapshotRef.current();
        }
      } catch (err) {
        console.warn("[ClassroomSync] Initialization join error:", err);
      }
    }

    initializeSession();

    return () => {
      mounted = false;
    };
  }, [sessionId, userId, userName]);

  // ── 7. ADAPTIVE WAITING ROOM RECONCILIATION & VISIBILITY LISTENERS ─────────
  useEffect(() => {
    if (myAdmissionStatus !== "waiting" || !sessionId || !userId) return;

    const interval = setInterval(() => {
      fetchSnapshotRef.current?.();
    }, 8000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchSnapshotRef.current?.();
      }
    };

    const handleWindowFocus = () => {
      fetchSnapshotRef.current?.();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [myAdmissionStatus, sessionId, userId]);

  // ── 8. IN-PLACE PRESENCE RE-TRACKING (Zero WebSocket Churn) ───────────────
  useEffect(() => {
    if (
      isChannelSubscribedRef.current &&
      broadcastChannelRef.current &&
      userId
    ) {
      broadcastChannelRef.current
        .track({
          userId,
          name: myUserNameRef.current,
          role: roleRef.current as "lecturer" | "student",
          joinedAt: new Date().toISOString(),
          status: myAdmissionStatus,
        })
        .catch(() => {});
    }
  }, [myAdmissionStatus, userId]);

  // ── 9. SUPABASE REALTIME CHANNEL SUBSCRIPTION & PRESENCE ───────────────────
  useEffect(() => {
    if (!sessionId || !userId) return;

    lastSequenceRef.current = -1;

    const channel = supabase.channel(`classroom:${sessionId}`, {
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: userId },
      },
    });

    // Handle broadcast actions
    channel.on("broadcast", { event: "classroom-action" }, async (payload) => {
      const event = payload.payload as ClassroomEvent;
      if (!event || typeof event.type !== "string") return;

      // Version Gap Detection: if event version jumped by more than 1, pull fresh snapshot
      if (
        typeof event.stateVersion === "number" &&
        event.stateVersion > stateVersionRef.current + 1
      ) {
        fetchSnapshotRef.current?.();
      }

      if (typeof event.stateVersion === "number") {
        stateVersionRef.current = Math.max(
          stateVersionRef.current,
          event.stateVersion
        );
      }

      // Self-echo guard for lecturer audio events
      if (
        isLecturerRef.current &&
        (event.type === "SCHEDULED_PLAY" || event.type === "SEEK_SYNC")
      ) {
        return;
      }

      // Handle admission broadcast events
      if (event.type === "ADMIT_PARTICIPANT") {
        if (event.targetUserId === "ALL") {
          dbParticipantsRef.current.forEach((p, uid) => {
            if (p.role === "student") {
              admittedStudentIdsRef.current.add(uid);
              promptedStudentIdsRef.current.delete(uid);
            }
          });
          if (userId && !isLecturerRef.current) {
            setMyAdmissionStatus("admitted");
            toast.success("🎓 You have been admitted to the live lecture!");
          }
        } else if (event.targetUserId) {
          admittedStudentIdsRef.current.add(event.targetUserId);
          promptedStudentIdsRef.current.delete(event.targetUserId);
          if (event.targetUserId === userId) {
            setMyAdmissionStatus("admitted");
            toast.success("🎓 You have been admitted to the live lecture!");
          }
        }
      } else if (
        event.type === "DENY_PARTICIPANT" ||
        event.type === "KICK_PARTICIPANT"
      ) {
        if (event.targetUserId) {
          admittedStudentIdsRef.current.delete(event.targetUserId);
          promptedStudentIdsRef.current.delete(event.targetUserId);
        }
        if (event.targetUserId === userId) {
          try {
            const meRes = await fetch(
              `/api/classroom/${sessionId}/participants?me=true`
            );
            const meData = await meRes.json();
            if (meData?.status === "denied") {
              setMyAdmissionStatus("denied");
              toast.error(
                event.type === "KICK_PARTICIPANT"
                  ? "⚠️ You have been removed from this lecture session by the instructor."
                  : "Admission request was declined by the lecturer."
              );
              onKickedRef.current?.();
            }
          } catch {
            setMyAdmissionStatus("denied");
            onKickedRef.current?.();
          }
        }
      } else if (event.type === "REQUEST_ADMISSION") {
        if (event.userId) {
          // Symmetric eviction on explicit re-knock
          admittedStudentIdsRef.current.delete(event.userId);
          promptedStudentIdsRef.current.delete(event.userId);

          if (isLecturerRef.current) {
            showLecturerAdmissionToastRef.current?.(
              event.userId,
              event.userName || "Student"
            );
          }
        }
      }

      // Sequence check & drop out-of-order packets (except interactive types)
      if (
        typeof event.sequence === "number" &&
        event.sequence <= lastSequenceRef.current &&
        event.type !== "INTERRUPT" &&
        event.type !== "ADMIT_PARTICIPANT" &&
        event.type !== "DENY_PARTICIPANT" &&
        event.type !== "KICK_PARTICIPANT" &&
        event.type !== "REQUEST_ADMISSION"
      ) {
        return;
      }

      if (typeof event.sequence === "number") {
        lastSequenceRef.current = event.sequence;
      }
      onEventRef.current?.(event);
    });

    // Update Presence & Merge with Authoritative DB State
    const updatePresenceState = () => {
      const presenceState = channel.presenceState<ClassroomParticipant>();
      const onlineUserMap = new Map<
        string,
        { count: number; presence: ClassroomParticipant }
      >();
      const now = Date.now();

      Object.values(presenceState).forEach((presences) => {
        presences.forEach((p) => {
          if (p && p.userId) {
            presenceLastSeenRef.current.set(p.userId, now);
            const existing = onlineUserMap.get(p.userId);
            if (existing) {
              existing.count++;
            } else {
              onlineUserMap.set(p.userId, { count: 1, presence: p });
            }
          }
        });
      });

      // Merge DB participants with presence status
      const mergedRoster: ClassroomParticipant[] = [];
      const seenUserIds = new Set<string>();

      // 1. Process DB participants
      dbParticipantsRef.current.forEach((dbP, pUserId) => {
        seenUserIds.add(pUserId);
        const onlineEntry = onlineUserMap.get(pUserId);
        const lastSeen = presenceLastSeenRef.current.get(pUserId) || 0;
        const isOnline =
          Boolean(onlineEntry) || now - lastSeen < 10000; // 10s presentation grace period

        mergedRoster.push({
          ...dbP,
          connectionStatus: isOnline ? "online" : "offline",
          connectionCount: onlineEntry?.count || 0,
        });
      });

      // 2. Process any newly joined presence not yet in DB snapshot
      onlineUserMap.forEach(({ count, presence }, pUserId) => {
        if (!seenUserIds.has(pUserId)) {
          seenUserIds.add(pUserId);
          mergedRoster.push({
            ...presence,
            status: presence.status || "waiting",
            connectionStatus: "online",
            connectionCount: count,
          });
        }
      });

      setParticipants(mergedRoster);

      const admittedStudents = mergedRoster.filter(
        (u) => u.role === "student" && u.status === "admitted"
      );
      const lecturerCount = mergedRoster.filter(
        (u) => u.role === "lecturer"
      ).length;

      setActiveStudentCount(admittedStudents.length);
      setActiveLecturerCount(lecturerCount);
      onStudentCountChangeRef.current?.(admittedStudents.length);

      // Autonomous Driver Election
      if (isLecturerRef.current) {
        setIsDriver(true);
      } else {
        const sortedStudents = admittedStudents.sort((a, b) =>
          (a.joinedAt || "").localeCompare(b.joinedAt || "")
        );

        const electedDriverId = sortedStudents[0]?.userId;
        const amIElected = Boolean(userId && electedDriverId === userId);
        setIsDriver(amIElected);
      }
    };

    channel.on("presence", { event: "sync" }, updatePresenceState);
    channel.on("presence", { event: "join" }, ({ newPresences }) => {
      updatePresenceState();
      if (Array.isArray(newPresences)) {
        (newPresences as unknown as ClassroomParticipant[]).forEach((p) => {
          if (!p || !p.userId) return;
          const isSelf =
            p.userId === userId || p.userId === myUserIdRef.current;
          if (isSelf) return;

          const isKnownAdmitted =
            admittedStudentIdsRef.current.has(p.userId) ||
            dbParticipantsRef.current.get(p.userId)?.status === "admitted" ||
            p.status === "admitted";
          const isDenied =
            dbParticipantsRef.current.get(p.userId)?.status === "denied" ||
            p.status === "denied";

          if (
            isLecturerRef.current &&
            p.role === "student" &&
            !isKnownAdmitted &&
            !isDenied
          ) {
            showLecturerAdmissionToastRef.current?.(
              p.userId,
              p.name || "A student"
            );
          }
        });
      }
    });
    channel.on("presence", { event: "leave" }, updatePresenceState);

    // Channel subscription & Reconnection Listener
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        isChannelSubscribedRef.current = true;

        // Reconcile snapshot on every fresh subscription / reconnect
        await fetchSnapshotRef.current?.();

        await channel.track({
          userId,
          name: myUserNameRef.current,
          role: roleRef.current as "lecturer" | "student",
          joinedAt: new Date().toISOString(),
          status: myAdmissionStatusRef.current,
        });

        // Flush any queued events
        if (pendingEventQueueRef.current.length > 0) {
          const queuedEvents = [...pendingEventQueueRef.current];
          pendingEventQueueRef.current = [];
          for (const ev of queuedEvents) {
            try {
              channel.send({
                type: "broadcast",
                event: "classroom-action",
                payload: ev,
              });
            } catch (err) {
              console.warn("[Realtime] Failed to flush queued event:", err);
            }
          }
        }
      }
    });

    broadcastChannelRef.current = channel;

    return () => {
      isChannelSubscribedRef.current = false;
      pendingEventQueueRef.current = [];
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
      broadcastChannelRef.current = null;
    };
  }, [sessionId, userId]);

  return {
    broadcastEvent,
    activeStudentCount,
    activeLecturerCount,
    participants,
    myAdmissionStatus,
    isDriver,
    admitParticipant,
    denyParticipant,
    kickParticipant,
    admitAllParticipants,
    requestRejoin,
    fetchSnapshot,
  };
}
