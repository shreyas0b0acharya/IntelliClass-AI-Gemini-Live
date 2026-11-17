import { NextResponse, type NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SessionRoadmap } from "@/features/classroom/types/roadmap";
import type { User } from "@supabase/supabase-js";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    let { user } = await getAuthenticatedUser(request);

    let body: { participantId?: string; participantName?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Body may be empty
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

    // Fallback: If cookie/bearer wasn't available, check if the participantId belongs to the conductor
    if (!user && body.participantId) {
      const isConductorParticipant =
        session.created_by === body.participantId ||
        (session.courses && (session.courses as { created_by?: string }).created_by === body.participantId);
      if (isConductorParticipant) {
        user = { id: body.participantId } as unknown as User;
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const rawModel = process.env.GEMINI_LIVE_MODEL || "gemini-3.8-live";
    const canonicalModel = rawModel.replace(/^models\//, "");
    const constraintModel = `models/${canonicalModel}`;

    // 2. Map voice to Gemini Live supported voices: Aoede, Charon, Fenrir, Kore, Puck
    const voiceId = (session.voice_id || "").toLowerCase();
    let liveVoiceName = "Fenrir"; // clear, authoritative, natural professor voice
    if (voiceId.includes("female") || voiceId.includes("aoede") || voiceId.includes("bella") || voiceId.includes("clara")) {
      liveVoiceName = "Aoede";
    } else if (voiceId.includes("kore")) {
      liveVoiceName = "Kore";
    } else if (voiceId.includes("charon")) {
      liveVoiceName = "Charon";
    } else if (voiceId.includes("puck")) {
      liveVoiceName = "Puck";
    } else if (voiceId.includes("fenrir") || voiceId.includes("male") || voiceId.includes("arthur")) {
      liveVoiceName = "Fenrir";
    }

    // 3. Construct System Instruction with pedagogical guidelines and roadmap context
    const roadmap = session.roadmap as SessionRoadmap | null;
    let roadmapSummary = "No structured roadmap provided yet. Teach dynamically based on course topic.";
    if (roadmap?.topics?.length) {
      roadmapSummary = roadmap.topics
        .map(
          (t) =>
            `- [${t.id}] Topic ${t.order}: "${t.title}" (~${t.estimatedDurationMinutes} mins): ${t.description}. Objectives: ${t.learningObjectives?.join("; ") || "Core mastery"}`
        )
        .join("\n");
    }

    const isFemale =
      liveVoiceName === "Aoede" ||
      liveVoiceName === "Kore" ||
      Boolean(session.avatar_model && session.avatar_model.includes("women"));
    const professorName = isFemale ? "Professor Clara" : "Professor Arthur";

    const systemInstruction = `You are the AI Professor delivering an engaging, live interactive college lecture.
Your name is ${professorName}.
Subject: ${session.courses?.name || "Computer Science & Advanced Engineering"}.
Current Lecture Topic: ${session.topic || "Main Topic"}.

ROADMAP FOR TODAY'S LECTURE:
${roadmapSummary}

CURRENT ACTIVE TOPIC ID: ${session.current_topic_id || (roadmap?.topics?.[0]?.id ?? "topic-1")}

CRITICAL PEDAGOGICAL TEACHING RULES:
1. Tone: Authoritative yet warm, intellectually stimulating, articulate, and deeply engaging.
2. Continuous Spoken Teaching: When lecturing, you MUST deliver an in-depth, multi-sentence conceptual explanation (at least 4 to 6 full spoken sentences per turn). Do NOT stop after just one greeting sentence! Explain the underlying mechanisms, why the concept was invented, and how it behaves in practice.
3. Intuitive Pedagogical Analogies: Ground every technical concept in a vivid, intuitive real-world analogy so students grasp it immediately.
4. Autonomous Topic Flow: Do not pause to ask "Are you ready?" or expect immediate student responses during the lecture flow. Teach the concept thoroughly and continuously.
5. Topic Progression: When you conclude a topic and move to the next, call the tool "advance_topic" to advance the synchronized classroom state for all students.
6. Answering Questions: When students ask questions via chat or microphone, answer directly, succinctly, and warmly with encouragement.
7. Visual Projections: When introducing an architecture, diagram, formula, or slide, call "project_media" to project it on the classroom whiteboard screen.`;

    console.log(`🎫 [Gemini Live Token API] Minting ephemeral token for session "${sessionId}" (model="${constraintModel}", voice="${liveVoiceName}")`);

    // 4. Create Ephemeral Auth Token
    const token = await ai.authTokens.create({
      config: {
        uses: 2,
        expireTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: constraintModel,
        },
      },
    });

    console.log(`✅ [Gemini Live Token API] Successfully minted token "${token.name?.slice(0, 20)}..."`);

    return NextResponse.json({
      token: token.name,
      model: canonicalModel,
      voiceName: liveVoiceName,
      systemInstruction,
      roadmap: session.roadmap,
      currentTopicId: session.current_topic_id,
      sessionId: session.id,
      courseId: session.course_id,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("❌ API POST /api/classroom/[sessionId]/live-token error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
