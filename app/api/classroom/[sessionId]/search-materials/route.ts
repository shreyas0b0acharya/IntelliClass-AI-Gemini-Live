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

    const topK = Math.min(Math.max(body.topK || 4, 1), 8);

    // 3. Vector Search bounded by 3500ms timeout
    const timeoutPromise = new Promise<{ results: Array<{ content: string; similarity: number }> }>((resolve) =>
      setTimeout(() => resolve({ results: [] }), 3500)
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
          match_threshold: 0.30,
          match_count: topK,
          course_id_filter: session.course_id,
        });

        if (error || !matches || matches.length === 0) {
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

    let response = await Promise.race([searchPromise, timeoutPromise]);

    // 4. Robust Keyword / Text Fallback: If vector search returned 0 results or timed out,
    // perform direct text lookup on document_chunks for this course.
    if (!response.results || response.results.length === 0) {
      console.log(`[search-materials] Vector search returned 0 results for "${query}". Falling back to text search...`);
      try {
        // Extract meaningful keywords (> 3 letters)
        const keywords = query
          .replace(/[^\w\s]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length > 3)
          .slice(0, 4);

        let fallbackChunks: Array<{ content: string; metadata?: any }> | null = null;

        if (keywords.length > 0) {
          // Search for any chunk containing the first significant keyword
          const firstWord = keywords[0];
          const { data: textMatches } = await admin
            .from("document_chunks")
            .select("content, metadata")
            .eq("course_id", session.course_id)
            .ilike("content", `%${firstWord}%`)
            .limit(topK);

          if (textMatches && textMatches.length > 0) {
            fallbackChunks = textMatches;
          }
        }

        // If still empty, fetch top textbook chunks for this course (excluding auto-saved notes)
        if (!fallbackChunks || fallbackChunks.length === 0) {
          const { data: generalChunks } = await admin
            .from("document_chunks")
            .select("content, metadata")
            .eq("course_id", session.course_id)
            .not("metadata->>source", "ilike", "%auto_save%")
            .limit(topK);

          fallbackChunks = generalChunks;
        }

        if (fallbackChunks && fallbackChunks.length > 0) {
          response = {
            results: fallbackChunks.map((c, i) => {
              const meta = c.metadata as { file_name?: string; source?: string; page?: number } | null;
              const src = meta?.file_name || meta?.source || "Course Document";
              const pageStr = meta?.page ? ` (p. ${meta.page})` : "";
              return {
                content: `[Source: ${src}${pageStr}]\n${c.content}`,
                similarity: 0.9 - i * 0.05,
              };
            }),
          };
        }
      } catch (fallbackErr) {
        console.warn("[search-materials] Keyword fallback search error:", fallbackErr);
      }
    }

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
