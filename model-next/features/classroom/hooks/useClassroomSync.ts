"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { ClassroomEvent, ClassroomParticipant } from "../types/classroom";
import { toast } from "sonner";

interface UseClassroomSyncOptions {
  sessionId: string;
  userId?: string;
  userName?: string;
  role?: "lecturer" | "student";
  onEvent: (event: ClassroomEvent) => void;
  onStudentCountChange?: (count: number) => void;
}

export function useClassroomSync({
  sessionId,
  userId,
  userName = "Anonymous",
  role = "student",
  onEvent,
  onStudentCountChange,
}: UseClassroomSyncOptions) {
  const isLecturer = role === "lecturer";
  const broadcastChannelRef = useRef<RealtimeChannel | null>(null);
  const isChannelSubscribedRef = useRef<boolean>(false);
  const lastSequenceRef = useRef<number>(-1);

  // Check initial admission status for students based on session storage
  const checkInitialAdmission = (): "admitted" | "waiting" | "denied" => {
    if (isLecturer) return "admitted";
    if (typeof window !== "undefined" && sessionId) {
      const stored = window.sessionStorage.getItem(`intelliclass_admitted_${sessionId}`);
      if (stored === "true") return "admitted";
      if (stored === "kicked" || stored === "denied") return "denied";
    }
    return "waiting";
  };

  const [myAdmissionStatus, setMyAdmissionStatus] = useState<"admitted" | "waiting" | "denied">(
    checkInitialAdmission
  );

  const [activeStudentCount, setActiveStudentCount] = useState<number>(0);
  const [activeLecturerCount, setActiveLecturerCount] = useState<number>(0);
  const [participants, setParticipants] = useState<ClassroomParticipant[]>([]);
  const [isDriver, setIsDriver] = useState<boolean>(isLecturer);

  // Lecturer: persistent set of admitted student IDs and kicked student IDs
  const admittedStudentIdsRef = useRef<Set<string>>(new Set());
  const kickedStudentIdsRef = useRef<Set<string>>(new Set());

  // Active toast tracking to prevent duplicate admission prompt popups
  const activePromptToastIdsRef = useRef<Map<string, string | number>>(new Map());

  // Load previously admitted and kicked students for this session
  useEffect(() => {
    if (typeof window !== "undefined" && sessionId) {
      try {
        const rawAdmitted = window.sessionStorage.getItem(`intelliclass_accepted_students_${sessionId}`);
        if (rawAdmitted) {
          const parsed = JSON.parse(rawAdmitted);
          if (Array.isArray(parsed)) admittedStudentIdsRef.current = new Set(parsed);
        }
        const rawKicked = window.sessionStorage.getItem(`intelliclass_kicked_students_${sessionId}`);
        if (rawKicked) {
          const parsed = JSON.parse(rawKicked);
          if (Array.isArray(parsed)) kickedStudentIdsRef.current = new Set(parsed);
        }
      } catch {}
    }
  }, [sessionId]);

  const saveStorageState = () => {
    if (typeof window !== "undefined" && sessionId) {
      try {
        window.sessionStorage.setItem(
          `intelliclass_accepted_students_${sessionId}`,
          JSON.stringify(Array.from(admittedStudentIdsRef.current))
        );
        window.sessionStorage.setItem(
          `intelliclass_kicked_students_${sessionId}`,
          JSON.stringify(Array.from(kickedStudentIdsRef.current))
        );
      } catch {}
    }
  };

  // Stable refs for callbacks and dynamic user info
  const onEventRef = useRef(onEvent);
  const onStudentCountChangeRef = useRef(onStudentCountChange);
  const myUserIdRef = useRef<string | undefined>(userId);
  const myUserNameRef = useRef<string>(userName);
  const roleRef = useRef<string>(role);
  const isLecturerRef = useRef<boolean>(isLecturer);

  useEffect(() => {
    onEventRef.current = onEvent;
    onStudentCountChangeRef.current = onStudentCountChange;
    myUserIdRef.current = userId;
    myUserNameRef.current = userName;
    roleRef.current = role;
    isLecturerRef.current = isLecturer;
  });

  // Broadcast an event to all room participants
  const broadcastEvent = useCallback(
    (event: ClassroomEvent) => {
      if (!broadcastChannelRef.current) return;

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
          payload: event,
        });
      } catch (e) {
        console.warn("[Realtime] broadcast send error:", e);
      }
    },
    [isDriver]
  );

  // Lecturer Action: Admit / Accept student
  const admitParticipant = useCallback(
    (targetUserId: string) => {
      if (!isLecturerRef.current) return;
      lastSequenceRef.current++;
      broadcastEvent({
        type: "ADMIT_PARTICIPANT",
        targetUserId,
        sequence: lastSequenceRef.current,
      });

      if (targetUserId === "ALL") {
        participants.forEach((p) => {
          if (p.userId) {
            admittedStudentIdsRef.current.add(p.userId);
            kickedStudentIdsRef.current.delete(p.userId);
          }
        });
      } else {
        admittedStudentIdsRef.current.add(targetUserId);
        kickedStudentIdsRef.current.delete(targetUserId);
      }
      saveStorageState();

      // Dismiss any active join prompt toast for this student
      if (activePromptToastIdsRef.current.has(targetUserId)) {
        const toastId = activePromptToastIdsRef.current.get(targetUserId);
        if (toastId) toast.dismiss(toastId);
        activePromptToastIdsRef.current.delete(targetUserId);
      }

      // Optimistically update local participant status
      setParticipants((prev) =>
        prev.map((p) =>
          targetUserId === "ALL" || p.userId === targetUserId
            ? { ...p, status: "admitted" }
            : p
        )
      );

      // Refresh presence track to broadcast admitted status
      if (broadcastChannelRef.current && isChannelSubscribedRef.current) {
        broadcastChannelRef.current.track({
          userId: myUserIdRef.current,
          name: myUserNameRef.current,
          role: "lecturer",
          joinedAt: new Date().toISOString(),
          status: "admitted",
        });
      }

      toast.success(targetUserId === "ALL" ? "All students admitted." : "Student admitted to lecture.");
    },
    [broadcastEvent, participants]
  );

  // Lecturer Action: Deny / Reject student
  const denyParticipant = useCallback(
    (targetUserId: string) => {
      if (!isLecturerRef.current) return;
      lastSequenceRef.current++;
      broadcastEvent({
        type: "DENY_PARTICIPANT",
        targetUserId,
        sequence: lastSequenceRef.current,
      });

      admittedStudentIdsRef.current.delete(targetUserId);
      kickedStudentIdsRef.current.add(targetUserId);
      saveStorageState();

      if (activePromptToastIdsRef.current.has(targetUserId)) {
        const toastId = activePromptToastIdsRef.current.get(targetUserId);
        if (toastId) toast.dismiss(toastId);
        activePromptToastIdsRef.current.delete(targetUserId);
      }

      setParticipants((prev) =>
        prev.map((p) => (p.userId === targetUserId ? { ...p, status: "denied" } : p))
      );
      toast.info("Student admission declined.");
    },
    [broadcastEvent]
  );

  // Lecturer Action: Kick / Remove student from lecture
  const kickParticipant = useCallback(
    (targetUserId: string) => {
      if (!isLecturerRef.current) return;
      lastSequenceRef.current++;
      broadcastEvent({
        type: "KICK_PARTICIPANT",
        targetUserId,
        sequence: lastSequenceRef.current,
      });

      admittedStudentIdsRef.current.delete(targetUserId);
      kickedStudentIdsRef.current.add(targetUserId);
      saveStorageState();

      setParticipants((prev) =>
        prev.map((p) => (p.userId === targetUserId ? { ...p, status: "denied" } : p))
      );
      toast.info("Removed student from session.");
    },
    [broadcastEvent]
  );

  // Lecturer Action: Admit All
  const admitAllParticipants = useCallback(() => {
    admitParticipant("ALL");
  }, [admitParticipant]);

  // Student Action: Request Re-join after being kicked / denied
  const requestRejoin = useCallback(() => {
    if (isLecturerRef.current || !userId) return;

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(`intelliclass_admitted_${sessionId}`);
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
  }, [sessionId, userId, broadcastEvent]);

  // Helper to show admission request toast to lecturer without duplicates
  const showLecturerAdmissionToast = useCallback(
    (studentId: string, studentName: string) => {
      if (!isLecturerRef.current) return;
      if (admittedStudentIdsRef.current.has(studentId)) return;
      if (activePromptToastIdsRef.current.has(studentId)) return;

      const toastId = toast.info(`🎓 ${studentName || "A student"} wants to join the lecture`, {
        description: `Request received • ${new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
        duration: 20000,
        onDismiss: () => {
          activePromptToastIdsRef.current.delete(studentId);
        },
        action: {
          label: "Accept",
          onClick: () => admitParticipant(studentId),
        },
        cancel: {
          label: "Decline",
          onClick: () => denyParticipant(studentId),
        },
      });

      activePromptToastIdsRef.current.set(studentId, toastId);
    },
    [admitParticipant, denyParticipant]
  );

  useEffect(() => {
    if (!sessionId || !userId) return;

    const channel = supabase.channel(`classroom:${sessionId}`, {
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: userId },
      },
    });

    // 1. Listen for broadcast actions
    channel.on("broadcast", { event: "classroom-action" }, (payload) => {
      const event = payload.payload as ClassroomEvent;
      if (!event || typeof event.type !== "string") return;

      // Handle admission broadcast events
      if (event.type === "ADMIT_PARTICIPANT") {
        if (event.targetUserId === "ALL" || event.targetUserId === userId) {
          setMyAdmissionStatus("admitted");
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(`intelliclass_admitted_${sessionId}`, "true");
          }
          toast.success("🎓 You have been admitted to the live lecture!");
          if (isChannelSubscribedRef.current) {
            channel.track({
              userId,
              name: myUserNameRef.current,
              role: roleRef.current as "lecturer" | "student",
              joinedAt: new Date().toISOString(),
              status: "admitted",
            });
          }
        }
      } else if (event.type === "DENY_PARTICIPANT" || event.type === "KICK_PARTICIPANT") {
        if (event.targetUserId === userId) {
          setMyAdmissionStatus("denied");
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(`intelliclass_admitted_${sessionId}`, "kicked");
          }
          toast.error(
            event.type === "KICK_PARTICIPANT"
              ? "⚠️ You have been removed from this lecture session by the instructor."
              : "Admission request was declined by the lecturer."
          );
          if (isChannelSubscribedRef.current) {
            channel.track({
              userId,
              name: myUserNameRef.current,
              role: "student",
              joinedAt: new Date().toISOString(),
              status: "denied",
            });
          }
        }
      } else if (event.type === "REQUEST_ADMISSION") {
        if (isLecturerRef.current && event.userId) {
          showLecturerAdmissionToast(event.userId, event.userName);
        }
      }

      // Drop out-of-order packets (except INTERRUPT and ADMISSION/KICK/REQUEST)
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

    // 2. Track & Sync Presence
    const updatePresenceState = () => {
      const state = channel.presenceState<ClassroomParticipant>();
      const seen = new Set<string>();
      const userList: ClassroomParticipant[] = [];

      Object.values(state).forEach((presences) => {
        presences.forEach((p) => {
          if (p && p.userId && !seen.has(p.userId)) {
            seen.add(p.userId);

            let calculatedStatus = p.status || "waiting";
            if (p.role === "lecturer") {
              calculatedStatus = "admitted";
            } else if (kickedStudentIdsRef.current.has(p.userId)) {
              calculatedStatus = "denied";
            } else if (admittedStudentIdsRef.current.has(p.userId) || p.status === "admitted") {
              calculatedStatus = "admitted";
            }

            userList.push({
              ...p,
              status: calculatedStatus,
            });
          }
        });
      });

      setParticipants(userList);

      // Student Admission State Sync from Presence
      if (!isLecturerRef.current && userId) {
        const myPresence = userList.find((p) => p.userId === userId);
        const stored = typeof window !== "undefined" ? window.sessionStorage.getItem(`intelliclass_admitted_${sessionId}`) : null;
        if (myPresence?.status === "admitted" || stored === "true") {
          setMyAdmissionStatus("admitted");
        } else if (myPresence?.status === "denied" || stored === "kicked" || stored === "denied") {
          setMyAdmissionStatus("denied");
        }
      }

      const admittedStudents = userList.filter((u) => u.role === "student" && u.status === "admitted");
      const lecturerCount = userList.filter((u) => u.role === "lecturer").length;

      setActiveStudentCount(admittedStudents.length);
      setActiveLecturerCount(lecturerCount);
      onStudentCountChangeRef.current?.(admittedStudents.length);

      // Autonomous Driver Election
      if (isLecturerRef.current) {
        setIsDriver(true);
      } else {
        const sortedStudents = admittedStudents
          .sort((a, b) => (a.joinedAt || "").localeCompare(b.joinedAt || ""));

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
            p.userId === userId ||
            p.userId === myUserIdRef.current ||
            (p.name === myUserNameRef.current && p.role === roleRef.current);

          if (isSelf) return;

          const isKnownAdmitted = admittedStudentIdsRef.current.has(p.userId) || p.status === "admitted";
          const isKicked = kickedStudentIdsRef.current.has(p.userId) || p.status === "denied";

          // ONLY trigger admission request toast if the student is genuinely waiting and NOT admitted
          if (isLecturerRef.current && p.role === "student" && !isKnownAdmitted && !isKicked) {
            showLecturerAdmissionToast(p.userId, p.name || "A student");
          }
        });
      }
    });

    channel.on("presence", { event: "leave" }, () => {
      updatePresenceState();
    });

    // Initial presence track
    const storedStatus = typeof window !== "undefined" ? window.sessionStorage.getItem(`intelliclass_admitted_${sessionId}`) : null;
    let initialStatus: "admitted" | "waiting" | "denied" = isLecturerRef.current ? "admitted" : "waiting";
    if (!isLecturerRef.current) {
      if (storedStatus === "true") initialStatus = "admitted";
      else if (storedStatus === "kicked" || storedStatus === "denied") initialStatus = "denied";
    }

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        isChannelSubscribedRef.current = true;
        await channel.track({
          userId,
          name: myUserNameRef.current,
          role: roleRef.current as "lecturer" | "student",
          joinedAt: new Date().toISOString(),
          status: initialStatus,
        });
      }
    });

    broadcastChannelRef.current = channel;

    return () => {
      isChannelSubscribedRef.current = false;
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
      broadcastChannelRef.current = null;
    };
  }, [sessionId, userId, showLecturerAdmissionToast]);

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
  };
}
