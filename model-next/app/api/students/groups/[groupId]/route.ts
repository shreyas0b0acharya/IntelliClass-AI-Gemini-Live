import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params;
    const { user } = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: group, error: groupError } = await admin
      .from("student_groups")
      .select("*")
      .eq("id", groupId)
      .eq("created_by", user.id)
      .single();

    if (groupError || !group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const { data: members, error: membersError } = await admin
      .from("student_group_members")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });

    if (membersError) {
      return NextResponse.json({ error: membersError.message }, { status: 500 });
    }

    return NextResponse.json({
      group: {
        ...group,
        members_count: members?.length || 0,
        members: members || [],
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
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
    const { name, description } = body as { name?: string; description?: string };

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name && name.trim()) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;

    const admin = createAdminClient();

    const { data: group, error } = await admin
      .from("student_groups")
      .update(updates)
      .eq("id", groupId)
      .eq("created_by", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ group });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
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

    const admin = createAdminClient();

    const { error } = await admin
      .from("student_groups")
      .delete()
      .eq("id", groupId)
      .eq("created_by", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
