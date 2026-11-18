import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SessionParticipantRecord, AdmissionStatus } from "@/lib/supabase/types";

import {
  getCachedParticipant,
  getAllCachedParticipants,
  setCachedParticipant,
  admitCachedParticipant,
  setCachedStatus,
} from "@/lib/participants-cache";

// Helper to atomically bump state_version on the session in PostgreSQL
async function bumpStateVersion(
  admin: ReturnType<typeof createAdminClient>,
  sessionId: string
): Promise<number> {
  try {
    const { data: currentSession } = await admin
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    const nextVersion = (Number(currentSession?.state_version) || 0) + 1;

    await admin
      .from("sessions")
      .update({ state_version: nextVersion, updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    return nextVersion;
  } catch (err) {
    console.warn("[bumpStateVersion] warning:", err);
    return Date.now();
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { user } = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const isMeOnly = searchParams.get("me") === "true";

    const { data: session } = await admin
      .from("sessions")
      .select("created_by")
      .eq("id", sessionId)
      .single();

    const isLecturer = session?.created_by === user.id;

    if (isMeOnly) {
      if (isLecturer) {
        return NextResponse.json({
          status: "admitted" as AdmissionStatus,
          role: "lecturer",
          userId: user.id,
        });
      }

      let myStatus: AdmissionStatus = "waiting";
      let admittedAt: string | null | undefined = null;

      try {
        const { data: myRecord, error: myError } = await admin
          .from("session_participants")
          .select("*")
          .eq("session_id", sessionId)
          .eq("user_id", user.id)
          .single();

        if (!myError && myRecord) {
          myStatus = myRecord.status as AdmissionStatus;
          admittedAt = myRecord.admitted_at;
        } else {
          const cached = getCachedParticipant(sessionId, user.id);
          if (cached) {
            myStatus = cached.status;
            admittedAt = cached.admitted_at;
          }
        }
      } catch {
        const cached = getCachedParticipant(sessionId, user.id);
        if (cached) {
          myStatus = cached.status;
          admittedAt = cached.admitted_at;
        }
      }

      return NextResponse.json({
        status: myStatus,
        role: "student",
        userId: user.id,
        admittedAt,
      });
    }

    // Fetch full roster with RLS rules & in-memory cache merge
    let participants: SessionParticipantRecord[] = [];
    try {
      const { data: partData, error: partError } = await admin
        .from("session_participants")
        .select("*")
        .eq("session_id", sessionId);

      if (!partError && Array.isArray(partData)) {
        participants = partData as SessionParticipantRecord[];
      } else {
        participants = getAllCachedParticipants(sessionId);
      }
    } catch {
      participants = getAllCachedParticipants(sessionId);
    }

    // Merge cached updates if any record is ahead in cache
    const cachedList = getAllCachedParticipants(sessionId);
    const mergedMap = new Map<string, SessionParticipantRecord>();
    participants.forEach((p) => mergedMap.set(p.user_id, p));
    cachedList.forEach((cp) => {
      const existing = mergedMap.get(cp.user_id);
      if (!existing || cp.status === "admitted") {
        mergedMap.set(cp.user_id, { ...(existing || {}), ...cp });
      }
    });

    const allParticipants = Array.from(mergedMap.values());
    const myRecord = allParticipants.find((p) => p.user_id === user.id);
    const myStatus = isLecturer ? "admitted" : (myRecord?.status || "waiting");

    let visible = allParticipants;
    if (!isLecturer) {
      if (myStatus === "admitted") {
        visible = allParticipants.filter((p) => p.status === "admitted" || p.user_id === user.id);
      } else if (myRecord) {
        visible = [myRecord];
      } else {
        visible = [];
      }
    }

    return NextResponse.json({
      participants: visible.map((p) => ({
        userId: p.user_id,
        name: p.user_name,
        role: p.role,
        status: p.status,
        joinedAt: p.joined_at,
        admittedAt: p.admitted_at,
      })),
      myStatus,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { user } = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // 2. Fetch session and verify ownership
    const { data: session, error: sessionError } = await admin
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const isLecturer = session.created_by === user.id;
    const body = await request.json().catch(() => ({}));
    const { action, targetUserId, userName } = body as {
      action: "join" | "re_request" | "admit" | "deny" | "kick" | "leave";
      targetUserId?: string;
      userName?: string;
    };

    const resolvedUserName =
      userName ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Student";

    // ── ACTION: JOIN (Knock / Check Admission) ────────────────────────────────
    if (action === "join") {
      if (isLecturer) {
        setCachedParticipant(sessionId, {
          user_id: user.id,
          user_name: resolvedUserName,
          role: "lecturer",
          status: "admitted",
        });

        try {
          await admin.from("session_participants").upsert(
            {
              session_id: sessionId,
              user_id: user.id,
              user_name: resolvedUserName,
              role: "lecturer",
              status: "admitted",
              joined_at: new Date().toISOString(),
              admitted_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "session_id,user_id" }
          );
        } catch (e) {
          console.warn("[participants] DB upsert lecturer warning:", e);
        }

        return NextResponse.json({
          status: "admitted" as AdmissionStatus,
          role: "lecturer",
          stateVersion: Number(session.state_version) || 0,
        });
      }

      // Check in-memory cache first: if already admitted, preserve admission
      const cached = getCachedParticipant(sessionId, user.id);
      if (cached && cached.status === "admitted") {
        return NextResponse.json({
          status: "admitted" as AdmissionStatus,
          role: "student",
          stateVersion: Number(session.state_version) || 0,
        });
      }

      // Check Direct Student Group Access (cohort membership)
      let hasDirectGroupAccess = false;
      const assignedGroupIds: string[] = [
        ...(Array.isArray(session.assigned_group_ids) ? session.assigned_group_ids : []),
      ];

      if (session.course_id) {
        try {
          const { data: courseData } = await admin
            .from("courses")
            .select("assigned_group_ids")
            .eq("id", session.course_id)
            .single();
          if (courseData && Array.isArray(courseData.assigned_group_ids)) {
            assignedGroupIds.push(...courseData.assigned_group_ids);
          }
        } catch {
          // ignore course lookup error
        }
      }

      if (assignedGroupIds.length > 0 && user.email) {
        try {
          const { data: matchedMember } = await admin
            .from("student_group_members")
            .select("id")
            .in("group_id", assignedGroupIds)
            .ilike("student_email", user.email.toLowerCase())
            .limit(1)
            .maybeSingle();

          if (matchedMember) {
            hasDirectGroupAccess = true;
          }
        } catch (groupCheckErr) {
          console.warn("[participants] Group direct access check warning:", groupCheckErr);
        }
      }

      // If student belongs to an assigned group, admit directly!
      if (hasDirectGroupAccess) {
        const nowIso = new Date().toISOString();
        setCachedParticipant(sessionId, {
          user_id: user.id,
          user_name: resolvedUserName,
          role: "student",
          status: "admitted",
          joined_at: nowIso,
          admitted_at: nowIso,
        });

        try {
          await admin.from("session_participants").upsert(
            {
              session_id: sessionId,
              user_id: user.id,
              user_name: resolvedUserName,
              role: "student",
              status: "admitted",
              joined_at: nowIso,
              admitted_at: nowIso,
              updated_at: nowIso,
            },
            { onConflict: "session_id,user_id" }
          );
        } catch (dbUpsertErr) {
          console.warn("[participants] Direct admission upsert error:", dbUpsertErr);
        }

        return NextResponse.json({
          status: "admitted" as AdmissionStatus,
          role: "student",
          directAccess: true,
          stateVersion: Number(session.state_version) || 0,
        });
      }

      // Check existing student record in PostgreSQL
      try {
        const { data: existing } = await admin
          .from("session_participants")
          .select("*")
          .eq("session_id", sessionId)
          .eq("user_id", user.id)
          .single();

        if (existing) {
          setCachedParticipant(sessionId, existing);

          if (existing.status === "admitted") {
            return NextResponse.json({
              status: "admitted" as AdmissionStatus,
              role: "student",
              stateVersion: Number(session.state_version) || 0,
            });
          }
          if (existing.status === "denied") {
            return NextResponse.json(
              {
                error: "Admission was denied by the lecturer. You may request to re-join after the cooldown.",
                status: "denied" as AdmissionStatus,
                updatedAt: existing.updated_at,
              },
              { status: 403 }
            );
          }
          if (existing.status === "left") {
            setCachedParticipant(sessionId, {
              user_id: user.id,
              user_name: resolvedUserName,
              status: "waiting",
            });

            await admin
              .from("session_participants")
              .update({
                status: "waiting",
                joined_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("session_id", sessionId)
              .eq("user_id", user.id);

            const newVersion = await bumpStateVersion(admin, sessionId);
            return NextResponse.json({
              status: "waiting" as AdmissionStatus,
              role: "student",
              stateVersion: newVersion,
            });
          }

          return NextResponse.json({
            status: "waiting" as AdmissionStatus,
            role: "student",
            stateVersion: Number(session.state_version) || 0,
          });
        }
      } catch (err) {
        console.warn("[participants] DB existing student check warning:", err);
      }

      // If already in cache with waiting or denied status
      if (cached) {
        return NextResponse.json({
          status: cached.status,
          role: "student",
          stateVersion: Number(session.state_version) || 0,
        });
      }

      // New student registration -> insert waiting
      setCachedParticipant(sessionId, {
        user_id: user.id,
        user_name: resolvedUserName,
        role: "student",
        status: "waiting",
      });

      try {
        await admin.from("session_participants").insert({
          session_id: sessionId,
          user_id: user.id,
          user_name: resolvedUserName,
          role: "student",
          status: "waiting",
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn("[participants] DB insert student warning:", err);
      }

      const newVersion = await bumpStateVersion(admin, sessionId);
      return NextResponse.json({
        status: "waiting" as AdmissionStatus,
        role: "student",
        stateVersion: newVersion,
      });
    }

    // ── ACTION: RE_REQUEST (Denied student requesting re-entry with 30s cooldown)
    if (action === "re_request") {
      setCachedParticipant(sessionId, {
        user_id: user.id,
        user_name: resolvedUserName,
        status: "waiting",
      });

      try {
        const { data: existing } = await admin
          .from("session_participants")
          .select("*")
          .eq("session_id", sessionId)
          .eq("user_id", user.id)
          .single();

        if (existing) {
          const COOLDOWN_MS = 30 * 1000;
          const lastUpdated = new Date(existing.updated_at).getTime();
          const elapsed = Date.now() - lastUpdated;

          if (elapsed < COOLDOWN_MS) {
            const remainingSec = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
            return NextResponse.json(
              { error: `Please wait ${remainingSec}s before re-requesting admission.` },
              { status: 429 }
            );
          }

          await admin
            .from("session_participants")
            .update({
              status: "waiting",
              user_name: resolvedUserName,
              joined_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("session_id", sessionId)
            .eq("user_id", user.id);
        }
      } catch (err) {
        console.warn("[participants] DB re_request warning:", err);
      }

      const newVersion = await bumpStateVersion(admin, sessionId);
      return NextResponse.json({
        status: "waiting" as AdmissionStatus,
        stateVersion: newVersion,
      });
    }

    // ── RBAC CHECK FOR LECTURER-ONLY ACTIONS ─────────────────────────────────
    if (action === "admit" || action === "deny" || action === "kick") {
      if (!isLecturer) {
        return NextResponse.json(
          { error: "Forbidden: Only the session lecturer can modify admission states." },
          { status: 403 }
        );
      }

      if (!targetUserId) {
        return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
      }

      // ── ACTION: ADMIT ──────────────────────────────────────────────────────
      if (action === "admit") {
        // Immediate in-memory admission guarantees instant propagation without regression
        admitCachedParticipant(sessionId, targetUserId, userName);

        try {
          if (targetUserId === "ALL") {
            await admin
              .from("session_participants")
              .update({
                status: "admitted",
                admitted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("session_id", sessionId)
              .eq("status", "waiting");
          } else {
            // First attempt direct update for existing student record
            const { data: updated, error: updateErr } = await admin
              .from("session_participants")
              .update({
                status: "admitted",
                admitted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("session_id", sessionId)
              .eq("user_id", targetUserId)
              .select();

            // If not found in table or update failed, fallback to upsert
            if (updateErr || !updated || updated.length === 0) {
              await admin
                .from("session_participants")
                .upsert(
                  {
                    session_id: sessionId,
                    user_id: targetUserId,
                    user_name: userName || "Student",
                    role: "student",
                    status: "admitted",
                    admitted_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "session_id,user_id" }
                );
            }
          }
        } catch (dbErr) {
          console.warn("[participants] DB admit warning (cache preserved):", dbErr);
        }

        const newVersion = await bumpStateVersion(admin, sessionId);
        return NextResponse.json({
          success: true,
          action: "admit",
          targetUserId,
          stateVersion: newVersion,
        });
      }

      // ── ACTION: DENY / KICK ────────────────────────────────────────────────
      if (action === "deny" || action === "kick") {
        setCachedStatus(sessionId, targetUserId, "denied");

        try {
          await admin
            .from("session_participants")
            .update({
              status: "denied",
              updated_at: new Date().toISOString(),
            })
            .eq("session_id", sessionId)
            .eq("user_id", targetUserId);
        } catch (dbErr) {
          console.warn("[participants] DB deny/kick warning:", dbErr);
        }

        const newVersion = await bumpStateVersion(admin, sessionId);
        return NextResponse.json({
          success: true,
          action,
          targetUserId,
          stateVersion: newVersion,
        });
      }
    }

    // ── ACTION: LEAVE ────────────────────────────────────────────────────────
    if (action === "leave") {
      setCachedStatus(sessionId, user.id, "left");

      try {
        await admin
          .from("session_participants")
          .update({
            status: "left",
            updated_at: new Date().toISOString(),
          })
          .eq("session_id", sessionId)
          .eq("user_id", user.id);
      } catch (dbErr) {
        console.warn("[participants] DB leave warning:", dbErr);
      }

      return NextResponse.json({ success: true, action: "leave" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API POST /api/classroom/[sessionId]/participants error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
