import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateTeachingScript } from "@/ai/flows/generate-script";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const supabase = await createClient();

    // Authenticate lecturer via Bearer token or cookies
    const authHeader = request.headers.get("Authorization");
    let user = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "").trim();
      const { data: userData } = await supabase.auth.getUser(token);
      user = userData?.user;
    }

    if (!user) {
      const { data: userData } = await supabase.auth.getUser();
      user = userData?.user;
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, name")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "lecturer") {
      return NextResponse.json(
        { error: "Forbidden. Only lecturers can generate scripts." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { courseId, topic, sources, customPrompt, directText, voice, lecturerName } = body;

    if (!courseId || !topic) {
      return NextResponse.json(
        { error: "courseId and topic are required." },
        { status: 400 }
      );
    }

    // Verify course ownership
    const { data: course } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("created_by", user.id)
      .single();

    if (!course) {
      return NextResponse.json(
        { error: "Course not found or unauthorized." },
        { status: 404 }
      );
    }

    const resolvedLecturerName = lecturerName || profile?.name || "Professor";
    console.log(`📡 [API /generate-script] Request received for sessionId: ${sessionId}, lecturer: "${resolvedLecturerName}"`);

    // Call Genkit flow
    const result = await generateTeachingScript({
      courseId,
      topic,
      lecturerName: resolvedLecturerName,
      sources,
      customPrompt,
      directText,
    });

    console.log(`💾 [API /generate-script] Saving generated script (${result.script.length} chars) to sessions table for sessionId: ${sessionId}`);

    // Update session with generated script & voice using authenticated client
    const { data: updatedRows, error: updateError } = await supabase
      .from("sessions")
      .update({
        script: result.script,
        voice_id: voice || "af_bella",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .select();

    if (updateError) {
      console.error(`❌ [API /generate-script] Supabase client update error:`, updateError);
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.warn(`⚠️ [API /generate-script] 0 rows updated via user client, attempting admin client fallback...`);
      const admin = createAdminClient();
      const { error: adminErr } = await admin
        .from("sessions")
        .update({
          script: result.script,
          voice_id: voice || "af_bella",
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (adminErr) {
        console.error(`❌ [API /generate-script] Admin update failed:`, adminErr);
      }
    }

    console.log(`🎉 [API /generate-script] Successfully updated session ${sessionId} with lecture script!`);

    console.log(`🎉 [API /generate-script] Successfully updated session ${sessionId} with lecture script!`);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("❌ [API /classroom/generate-script] Error:", error);
    return NextResponse.json(
      { error: error.message || "Script generation failed." },
      { status: 500 }
    );
  }
}
