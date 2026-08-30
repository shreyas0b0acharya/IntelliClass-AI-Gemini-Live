import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_MODEL_PREFERENCES, type ModelPreferences } from "@/features/settings";

/**
 * GET /api/settings
 * Retrieves user's persisted model preferences from Supabase.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ preferences: DEFAULT_MODEL_PREFERENCES, user: null });
    }

    // 1. Try to read from user_metadata.preferences
    const metaPreferences = user.user_metadata?.preferences as Partial<ModelPreferences> | undefined;

    // 2. Try to read from profiles table (if preferences column exists)
    let profilePreferences: Partial<ModelPreferences> | undefined;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (profile && typeof profile === "object" && "preferences" in profile) {
        profilePreferences = profile.preferences as Partial<ModelPreferences>;
      }
    } catch {
      // Ignored if column or row doesn't exist
    }

    const mergedPreferences: ModelPreferences = {
      ...DEFAULT_MODEL_PREFERENCES,
      ...(metaPreferences || {}),
      ...(profilePreferences || {}),
    };

    return NextResponse.json({
      preferences: mergedPreferences,
      user: { id: user.id, email: user.email },
    });
  } catch (err: unknown) {
    console.error("API GET /api/settings error:", err);
    return NextResponse.json({ preferences: DEFAULT_MODEL_PREFERENCES }, { status: 200 });
  }
}

/**
 * POST /api/settings
 * Persists model preferences to Supabase user metadata and profiles table.
 */
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

    const body = (await request.json()) as Partial<ModelPreferences>;

    const updatedPreferences: ModelPreferences = {
      ...DEFAULT_MODEL_PREFERENCES,
      ...(user.user_metadata?.preferences || {}),
      ...body,
    };

    // 1. Persist directly to Supabase Auth User Metadata
    const { error: updateAuthError } = await supabase.auth.updateUser({
      data: {
        preferences: updatedPreferences,
      },
    });

    if (updateAuthError) {
      console.warn("Supabase auth.updateUser preferences warning:", updateAuthError.message);
    }

    // 2. Attempt to update profiles table if available
    try {
      await supabase
        .from("profiles")
        .update({ preferences: updatedPreferences } as Record<string, unknown>)
        .eq("id", user.id);
    } catch {
      // Ignored if column doesn't exist yet
    }

    return NextResponse.json({
      preferences: updatedPreferences,
      success: true,
    });
  } catch (err: unknown) {
    console.error("API POST /api/settings error:", err);
    const msg = err instanceof Error ? err.message : "Failed to persist preferences to Supabase.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
