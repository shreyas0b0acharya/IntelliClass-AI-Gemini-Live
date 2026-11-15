import { NextResponse, type NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SessionRoadmap } from "@/features/classroom/types/roadmap";

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

    // 1. Verify session ownership and get configuration
    const { data: session, error: sessionError } = await admin
      .from("sessions")
      .select("*, courses(*)")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session || session.status === "deleted") {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const isOwner =
      session.created_by === user.id ||
      (session.courses && (session.courses as { created_by?: string }).created_by === user.id);

    if (!isOwner) {
      return NextResponse.json(
        { error: "Forbidden: Only the conductor can mint a Gemini Live token." },
        { status: 403 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured on the server" },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: "v1alpha" },
    });

    const modelName = process.env.GEMINI_LIVE_MODEL || "models/gemini-3.8-live";

    // 2. Map voice to Gemini Live supported voices: Aoede, Charon, Fenrir, Kore, Puck
    const voiceId = (session.voice_id || "").toLowerCase();
    let liveVoiceName = "Puck"; // engaging, clear professor voice
    if (voiceId.includes("female") || voiceId.includes("bella") || voiceId.includes("sarah") || voiceId.includes("rachel")) {
      liveVoiceName = "Aoede";
    } else if (voiceId.includes("fenrir") || voiceId.includes("deep") || voiceId.includes("male")) {
      liveVoiceName = "Fenrir";
    }

    // 3. Construct System Instruction with pedagogical guidelines and roadmap context
    const roadmap = session.roadmap as SessionRoadmap | null;
    let roadmapSummary = "No structured roadmap provided yet. Teach dynamically based on course topic.";
    if (roadmap?.topics?.length) {
      roadmapSummary = roadmap.topics
        .map(
          (t) =>
            `- [${t.id}] Topic ${t.order}: "${t.title}" (~${t.estimatedDurationMinutes} mins): ${t.description}. Key concepts: ${t.subtopics?.map((s) => s.title).join(", ") || t.learningObjectives?.join(", ")}`
        )
        .join("\n");
    }

    const systemInstruction = `You are the AI Professor for this interactive classroom.
Your name is ${session.courses?.created_by ? "Professor" : "the AI Professor"}.
Subject: ${session.courses?.name || "College Course"}.
Current Lecture Topic: ${session.topic || "Main Topic"}.

ROADMAP FOR TODAY'S LECTURE:
${roadmapSummary}

CURRENT ACTIVE TOPIC ID: ${session.current_topic_id || (roadmap?.topics?.[0]?.id ?? "topic-1")}

PEDAGOGICAL & CLASSROOM RULES:
1. Tone: Warm, engaging, intellectually rigorous, and encouraging. Use relatable, intuitive real-world analogies to make complex concepts click.
2. Structure: Teach through the roadmap topic by topic. When you start or complete a topic, you MUST call the tool "advance_topic" to advance the classroom synchronized state.
3. Interactive Checkpoints: Periodically check in with the class (e.g. "Does everyone see why this trade-off occurs? Let's verify...").
4. Answering Questions: When students ask questions via microphone, answer directly, succinctly, and warmly. If you need specific course textbook definitions or course materials, call "search_course_materials".
5. Visual Projections: When introducing an architecture, diagram, formula, or slide, call "project_media" to project it on the classroom whiteboard screen.
6. Conciseness: Deliver spoken lecture audio naturally. Avoid robotic or overly verbose speech. Keep explanations vivid and conversational.`;

    // 4. Create Ephemeral Auth Token
    const token = await ai.authTokens.create({
      config: {
        uses: 2,
        expireTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: modelName,
        },
      },
    });

    return NextResponse.json({
      token: token.name,
      model: modelName,
      voiceName: liveVoiceName,
      systemInstruction,
      roadmap: session.roadmap,
      currentTopicId: session.current_topic_id,
      sessionId: session.id,
      courseId: session.course_id,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API POST /api/classroom/[sessionId]/live-token error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
