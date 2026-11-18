import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Fetch groups created by this teacher
    const { data: groups, error: groupsError } = await admin
      .from("student_groups")
      .select("id, name, description, created_by, created_at, updated_at")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    if (groupsError) {
      return NextResponse.json({ error: groupsError.message }, { status: 500 });
    }

    // Fetch members for these groups
    const groupIds = (groups || []).map((g) => g.id);
    let members: any[] = [];

    if (groupIds.length > 0) {
      const { data: fetchedMembers, error: membersError } = await admin
        .from("student_group_members")
        .select("id, group_id, student_email, user_id, added_by, created_at")
        .in("group_id", groupIds)
        .order("created_at", { ascending: false });

      if (!membersError && fetchedMembers) {
        members = fetchedMembers;
      }
    }

    // Fetch user profiles to attach names if students have signed up
    const userIds = members.map((m) => m.user_id).filter(Boolean);
    const profileMap = new Map<string, string>();

    if (userIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, name")
        .in("id", userIds);

      (profiles || []).forEach((p) => {
        if (p.name) profileMap.set(p.id, p.name);
      });
    }

    // Attach members and member counts to groups
    const populatedGroups = (groups || []).map((g) => {
      const groupMembers = members
        .filter((m) => m.group_id === g.id)
        .map((m) => ({
          ...m,
          user_name: m.user_id ? profileMap.get(m.user_id) || null : null,
        }));

      return {
        ...g,
        members_count: groupMembers.length,
        members: groupMembers,
      };
    });

    return NextResponse.json({ groups: populatedGroups });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("GET /api/students/groups error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { name, description } = body as { name?: string; description?: string };

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: group, error } = await admin
      .from("student_groups")
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ group: { ...group, members_count: 0, members: [] } }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("POST /api/students/groups error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
