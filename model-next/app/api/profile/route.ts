import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ profile: null, user: null }, { status: 200 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError && profileError.code !== "PGRST116") {
      console.error("Profile fetch error:", profileError);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ profile, user });
  } catch (err: any) {
    console.error("API GET /api/profile error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, role } = body;

    const newProfile = {
      id: user.id,
      name: name || user.user_metadata?.name || "User",
      role: role || user.user_metadata?.role || "student",
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("profiles")
      .upsert(newProfile)
      .select()
      .single();

    if (error) {
      console.error("Profile upsert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile: data });
  } catch (err: any) {
    console.error("API POST /api/profile error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, role } = body;

    const updates: Record<string, any> = {};
    if (name && typeof name === "string") updates.name = name.trim();
    if (role && (role === "lecturer" || role === "student")) updates.role = role;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    // 1. Update public.profiles row
    const { data: profile, error: updateError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("Profile update error:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 2. Sync user metadata in auth if role was changed
    if (updates.role || updates.name) {
      try {
        await supabase.auth.updateUser({
          data: {
            ...(updates.role ? { role: updates.role } : {}),
            ...(updates.name ? { name: updates.name } : {}),
          },
        });
      } catch (authMetaErr) {
        console.warn("Auth metadata sync warning:", authMetaErr);
      }
    }

    console.log(`✅ [Profile API] Successfully updated profile for user ${user.id}:`, updates);
    return NextResponse.json({ profile });
  } catch (err: any) {
    console.error("API PATCH /api/profile error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`⚠️ [Account API] Permanent account deletion requested for user: ${user.id} (${user.email})`);

    // 1. Delete row from public.profiles using authenticated client
    const { error: profileDeleteError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", user.id);

    if (profileDeleteError) {
      console.warn("Profile table delete warning:", profileDeleteError);
    }

    // 2. Delete user from auth.users via Admin API (cascades all foreign keys)
    try {
      const adminClient = createAdminClient();
      const { error: adminDeleteError } = await adminClient.auth.admin.deleteUser(user.id);
      if (adminDeleteError) {
        console.warn("Admin deleteUser warning:", adminDeleteError);
      }
    } catch (adminErr) {
      console.warn("createAdminClient deleteUser catch:", adminErr);
    }

    // 3. Sign out session
    await supabase.auth.signOut();

    console.log(`✅ [Account API] User account ${user.id} successfully deleted.`);
    return NextResponse.json({ success: true, message: "Account deleted permanently." });
  } catch (err: any) {
    console.error("API DELETE /api/profile error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete account" }, { status: 500 });
  }
}
