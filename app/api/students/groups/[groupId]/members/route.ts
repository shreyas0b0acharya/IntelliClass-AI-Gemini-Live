import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params;
    const { user } = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { studentEmail } = body as { studentEmail?: string };

    const email = studentEmail?.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Verify teacher owns the group
    const { data: group, error: groupError } = await admin
      .from("student_groups")
      .select("id")
      .eq("id", groupId)
      .eq("created_by", user.id)
      .single();

    if (groupError || !group) {
      return NextResponse.json({ error: "Group not found or access denied" }, { status: 404 });
    }

    // Check if user with this email already exists in profiles or auth
    let matchedUserId: string | null = null;
    let userName: string | null = null;

    try {
      const { data: profile } = await admin
        .from("profiles")
        .select("id, name")
        .ilike("name", `%${email.split("@")[0]}%`)
        .limit(1)
        .maybeSingle();

      if (profile) {
        matchedUserId = profile.id;
        userName = profile.name;
      }
    } catch {
      // ignore lookup error
    }

    // Insert student into group
    const { data: member, error: insertError } = await admin
      .from("student_group_members")
      .insert({
        group_id: groupId,
        student_email: email,
        user_id: matchedUserId,
        added_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ error: "Student is already in this group" }, { status: 409 });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      member: {
        ...member,
        user_name: userName,
      },
    }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("POST /api/students/groups/[groupId]/members error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params;
    const { user } = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");
    const email = searchParams.get("email");

    if (!memberId && !email) {
      return NextResponse.json({ error: "memberId or email is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Verify teacher owns the group
    const { data: group } = await admin
      .from("student_groups")
      .select("id")
      .eq("id", groupId)
      .eq("created_by", user.id)
      .single();

    if (!group) {
      return NextResponse.json({ error: "Group not found or access denied" }, { status: 404 });
    }

    let query = admin.from("student_group_members").delete().eq("group_id", groupId);
    if (memberId) {
      query = query.eq("id", memberId);
    } else if (email) {
      query = query.eq("student_email", email.toLowerCase());
    }

    const { error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
