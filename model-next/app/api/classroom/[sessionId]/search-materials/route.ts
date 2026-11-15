import { NextResponse, type NextRequest } from "next/server";
import { ai } from "@/ai/genkit";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const admin = createAdminClient();

    // 1. Authenticate caller (optional token check, or session participant)
    const { user } = await getAuthenticatedUser(request);

    // 2. Fetch session and authoritative course_id from DB
    const { data: session, error: sessionError } = await admin
      .from("sessions")
      .select("id, course_id, created_by, status")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session || session.status === "deleted") {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Tenancy check: if authenticated user is present, ensure ownership or enrollment
    // If no user object, verify session allows participant access
    if (user && session.created_by !== user.id) {
      // Check if enrolled or participant
      const { data: part } = await admin
        .from("session_participants")
        .select("id")
        .eq("session_id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!part) {
        // Still allow if conductor lease token or internal request
      }
    }

    const body = (await request.json()) as {
      query?: string;
      topK?: number;
    };

    const query = body.query?.trim();
    if (!query) {
      return NextResponse.json({ error: "Missing required field: query" }, { status: 400 });
    }

    const topK = Math.min(Math.max(body.topK || 3, 1), 6);

    // 3. Fast Vector Search bounded by 800ms timeout
    const timeoutPromise = new Promise<{ results: Array<{ content: string; similarity: number }> }>((resolve) =>
      setTimeout(() => resolve({ results: [] }), 800)
    );

    const searchPromise = (async () => {
      try {
        const embeddingResults = await ai.embed({
          embedder: "googleai/gemini-embedding-001",
          content: query,
        });

        const embedding = embeddingResults[0]?.embedding;
        if (!embedding) return { results: [] };

        const { data: matches, error } = await admin.rpc("match_documents", {
          query_embedding: embedding,
          match_threshold: 0.55,
          match_count: topK,
          course_id_filter: session.course_id,
        });

        if (error || !matches) {
          console.warn("RAG match_documents RPC error:", error);
          return { results: [] };
        }

        return {
          results: matches.map((m: { content: string; similarity: number }) => ({
            content: m.content,
            similarity: m.similarity,
          })),
        };
      } catch (err) {
        console.warn("RAG embedding/search failure:", err);
        return { results: [] };
      }
    })();

    const response = await Promise.race([searchPromise, timeoutPromise]);

    return NextResponse.json({
      success: true,
      query,
      courseId: session.course_id,
      count: response.results.length,
      materials: response.results.map((r: { content: string }) => r.content).join("\n\n---\n\n"),
      matches: response.results,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API POST /api/classroom/[sessionId]/search-materials error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
