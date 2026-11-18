import { NextResponse, type NextRequest } from "next/server";
import { GoogleGenAI, Modality } from "@google/genai";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SessionRoadmap } from "@/features/classroom/types/roadmap";
import { enforcePersonaConsistency } from "@/features/avatar";
import type { User } from "@supabase/supabase-js";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    let { user } = await getAuthenticatedUser(request);

    let body: {
      participantId?: string;
      participantName?: string;
      isResume?: boolean;
      lastSpokenSentence?: string;
      activeTopicId?: string;
    } = {};
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

    // 2. Strict Persona Consistency Enforcement:
    // Ensure avatar model and Gemini Live voice gender are 100% aligned.
    // Men avatar -> Male voice (Charon, Puck, Fenrir - default Charon).
    // Women avatar -> Female voice (Aoede, Kore - default Aoede).
    // NEVER men avatar with women voice or vice versa.
    const persona = enforcePersonaConsistency(session.avatar_model, session.voice_id);
    let liveVoiceName = persona.voiceId;
    const vid = liveVoiceName.toLowerCase();
    if (persona.gender === "female") {
      liveVoiceName = vid.includes("kore") ? "Kore" : "Aoede";
    } else {
      if (vid.includes("puck")) {
        liveVoiceName = "Puck";
      } else if (vid.includes("fenrir")) {
        liveVoiceName = "Fenrir";
      } else {
        liveVoiceName = "Charon";
      }
    }

    // 3. Construct System Instruction with full session awareness
    const roadmap = session.roadmap as SessionRoadmap | null;
    const allTopics = roadmap?.topics || [];
    const totalTopics = allTopics.length;

    // Determine resume state: which topics are already done vs remaining
    const activeTopicId = body.activeTopicId || session.current_topic_id || allTopics[0]?.id || null;
    const activeTopicIdx = activeTopicId ? allTopics.findIndex((t) => t.id === activeTopicId) : 0;
    const deliveredTopics = activeTopicIdx > 0 ? allTopics.slice(0, activeTopicIdx) : [];
    const remainingTopics = activeTopicIdx >= 0 ? allTopics.slice(activeTopicIdx) : allTopics;
    const hasPriorNotes = Array.isArray(session.live_session_stats?.notes) && session.live_session_stats.notes.length > 0;
    const isResume = Boolean(body.isResume) || activeTopicIdx > 0 || session.status === "paused" || hasPriorNotes;
    const lastSpoken = body.lastSpokenSentence || session.live_session_stats?.lastPausedSubtitle || "";

    // Fetch key course material chunks to seed the AI professor with authentic textbook knowledge
    let materialContext = "";
    let sourceFileList: string[] = [];
    try {
      const { createAdminClient: innerAdmin } = await import("@/lib/supabase/admin");
      const adminForMaterials = innerAdmin();

      // Query authentic course document chunks from document_chunks table
      const { data: rawChunks } = await adminForMaterials
        .from("document_chunks")
        .select("content, metadata")
        .eq("course_id", session.course_id)
        .order("id", { ascending: true })
        .limit(30);

      if (rawChunks && rawChunks.length > 0) {
        // Prioritize actual uploaded textbooks/PDFs/documents over auto-saved notes
        const textbookChunks = rawChunks.filter(
          (c) =>
            !c.metadata?.source?.includes("class_notes_auto_save") &&
            !c.metadata?.file_name?.includes("Auto-Saved Class Notes")
        );
        const selectedChunks = textbookChunks.length > 0 ? textbookChunks.slice(0, 20) : rawChunks.slice(0, 15);

        const sourcesSet = new Set<string>();
        selectedChunks.forEach((c) => {
          const s = c.metadata?.file_name || c.metadata?.source;
          if (s) sourcesSet.add(s);
        });
        sourceFileList = Array.from(sourcesSet);

        materialContext = selectedChunks
          .map((c: { content: string; metadata?: any }, i: number) => {
            const meta = c.metadata as { file_name?: string; source?: string; page?: number } | null;
            const src = meta?.file_name || meta?.source || "Course Document";
            const pageStr = meta?.page ? ` (p. ${meta.page})` : "";
            return `[Document Excerpt ${i + 1} from "${src}"${pageStr}]:\n${c.content.slice(0, 800)}`;
          })
          .join("\n\n---\n\n");
      }
    } catch (chunkErr) {
      console.warn("Could not retrieve document chunks for live token:", chunkErr);
    }

    // Build full roadmap detail for each topic
    const buildTopicLine = (t: { id: string; order?: number; title: string; estimatedDurationMinutes?: number; description?: string; learningObjectives?: string[]; suggestedAnalogies?: string[] }, status: "DELIVERED" | "ACTIVE" | "PENDING") => {
      const objectives = t.learningObjectives?.join("; ") || "Core mastery";
      const analogy = t.suggestedAnalogies?.[0] ? `Analogy: "${t.suggestedAnalogies[0]}"` : "";
      const statusTag = status === "DELIVERED" ? "✓ ALREADY DELIVERED — DO NOT RE-TEACH" : status === "ACTIVE" ? "▶ ACTIVE / START HERE" : "⏳ PENDING";
      return `  [${t.id}] Topic ${t.order ?? ""}: "${t.title}" (~${t.estimatedDurationMinutes ?? "?"}min) [${statusTag}]\n    Overview: ${t.description || "See course objectives"}\n    Objectives: ${objectives}${analogy ? `\n    ${analogy}` : ""}`;
    };

    let roadmapSummary = "No structured roadmap provided — teach dynamically based on course topic.";
    if (allTopics.length > 0) {
      const lines: string[] = [];
      allTopics.forEach((t, idx) => {
        const status = idx < activeTopicIdx ? "DELIVERED" : idx === activeTopicIdx ? "ACTIVE" : "PENDING";
        lines.push(buildTopicLine(t, status));
      });
      roadmapSummary = lines.join("\n\n");
    }

    const isFemale = persona.gender === "female";
    const professorName = isFemale ? "Professor Clara" : "Professor Arthur";
    const courseName = (session.courses as { name?: string } | null)?.name || "Computer Science & Advanced Engineering";

    const personaVocalDirective = isFemale
      ? `VOCAL IDENTITY — IMMUTABLE:
You are Professor Clara. Adult female. Voice: confident, articulate, warm, distinctly feminine. NEVER sound male or robotic.`
      : `VOCAL IDENTITY — IMMUTABLE:
You are Professor Arthur. Adult male. Voice: deep, resonant, authoritative, clearly masculine. NEVER sound female, high-pitched, or child-like.`;

    // Build session state block with crystal-clear resume commands
    const currentActiveTopicObj = allTopics[activeTopicIdx] || allTopics[0];
    const sessionStateBlock = isResume
      ? `SESSION STATE: ▶ RESUMING CLASS AT TOPIC ${activeTopicIdx + 1} OF ${totalTopics}: "${currentActiveTopicObj?.title}"
${deliveredTopics.length > 0 ? `Topics ALREADY delivered in earlier turns:\n${deliveredTopics.map((t, idx) => `  - Topic ${idx + 1}: "${t.title}"`).join("\n")}\nCRITICAL: DO NOT repeat or re-introduce any completed topic.` : ""}
${lastSpoken ? `Right before pausing, the lecture was discussing: "${lastSpoken}". Seamlessly continue directly from this explanation.` : ""}
DO NOT introduce yourself or say "Welcome to class".
DO NOT restart from Topic 1 or restart this topic from the beginning.
RESUME DIRECTLY with Topic ${activeTopicIdx + 1}: "${currentActiveTopicObj?.title}" (ID: ${activeTopicId}).`
      : `SESSION STATE: 🆕 FRESH START
This is the beginning of the class. You will teach all ${totalTopics} topic(s) in order.
Begin with Topic 1: "${allTopics[0]?.title || "Introduction"}".`;

    // Build material awareness block with authentic textbook grounding
    const sourceSummary = sourceFileList.length > 0 ? sourceFileList.join(", ") : "Uploaded Course Documents";
    const materialBlock = materialContext
      ? `AUTHENTIC COURSE MATERIAL (PRIMARY SYLLABUS & TEXTBOOK):
Source Document(s): ${sourceSummary}

MANDATORY MATERIAL FIDELITY INSTRUCTIONS:
1. Ground every topic explanation in the authentic course excerpts below.
2. You MUST use the specific technical keywords, definitions, component names, system architecture, and examples from these excerpts.
3. NEVER speak in generic generalities when specific terms exist in this material.
4. Reference the material directly (e.g., "As detailed in our course report on...", "The document specifies that...").
5. If you need deeper context or exact formulas during a topic, call "search_course_materials" with the topic title.

[EXCERPTS FROM UPLOADED COURSE MATERIALS]:
${materialContext}`
      : `No pre-fetched material excerpts available. Call "search_course_materials" to query the course knowledge base before or during each topic.`;

    const systemInstruction = `You are ${professorName}, an esteemed, intellectually rigorous, and warmly approachable Indian college professor conducting this live interactive classroom lecture.

${personaVocalDirective}

═══════════════════════════════════════════
INDIAN CLASSROOM TEACHING PERSONALITY & PEDAGOGY
═══════════════════════════════════════════
1. TEACHING TONE: Warm, deeply respectful, confident, and scholarly. Treat students as junior researchers. Use engaging pedagogical phrasing (e.g., "Notice carefully how this works", "In engineering practice, we observe...").
2. PROGRESSIVE EXPLANATION: Always teach progressively from simple intuitive fundamentals to step-by-step technical mechanics, culminating in real-world system architecture.
3. PRACTICAL INDIAN & GLOBAL EXAMPLES: Ground abstract concepts in both high-scale Indian architectures (such as UPI/NPCI instant payments consensus, IRCTC tatkal high-concurrency booking engines, Aadhaar biometric verification pipelines, ISRO satellite telemetry dispatch) and global systems (Google Spanner, Kafka, Raft, AWS DynamoDB).
4. ACADEMIC & EXAMINATION RIGOR: Highlight university examination relevance (frequently tested semester exam questions, GATE problem patterns, and technical interview design trade-offs). Never dumb down concepts—use precise academic terminology.
5. CONSTRUCTIVE & ENCOURAGING: Never shame or dismiss a student for an incorrect answer or basic doubt. Provide constructive, positive guidance ("Close attempt! Think about what happens if the network partitions here...").
6. BILINGUAL / HINGLISH FLEXIBILITY: Deliver the lecture in clear, scholarly English, but seamlessly clarify concepts in simple terms or intuitive Hinglish if a student requests it.
7. NO ROBOTIC FILLER: Avoid hollow motivational slogans, repetitive generic phrases, or saying "As an AI...". Speak naturally as a veteran professor.

═══════════════════════════════════════════
COURSE IDENTITY
═══════════════════════════════════════════
Course: ${courseName}
Lecture Title: ${session.topic || "Main Topic"}
Session ID: ${sessionId}
Total Topics: ${totalTopics}
Active Topic ID: ${activeTopicId || "not set"}

═══════════════════════════════════════════
${sessionStateBlock}
═══════════════════════════════════════════

═══════════════════════════════════════════
FULL CURRICULUM ROADMAP
═══════════════════════════════════════════
${roadmapSummary}

═══════════════════════════════════════════
${materialBlock}
═══════════════════════════════════════════

═══════════════════════════════════════════
TOOLS YOU MUST USE
═══════════════════════════════════════════
• advance_topic → Call this whenever you finish teaching a topic and advance to the next one (or when session completes). Pass completedTopicId and nextTopicId.
• search_course_materials → Call this BEFORE teaching each topic to retrieve exact excerpts, theorems, and definitions from uploaded course documents. Use query = topic title.
• project_media → Call this when referencing an architectural diagram, figure, formula, or flowchart.
• record_learning_insight → Call this when explaining a foundational concept definition, correcting a student misconception, or identifying a vital examination revision takeaway.

═══════════════════════════════════════════
TEACHING METHODOLOGY & INTERACTION RULES
═══════════════════════════════════════════
1. TEACHING CYCLE:
   a. Introduce the topic and its engineering significance.
   b. Unpack the mechanism step-by-step using precise textbook keywords.
   c. Illustrate with a concrete practical analogy and real-world system example.
   d. Ask a purposeful conceptual knowledge-check question to the class.
   e. Answer incoming student doubts, addressing any underlying misconceptions.
   f. Summarize key exam takeaways, call advance_topic, and transition smoothly.
2. DEPTH: Every teaching turn = minimum 4–6 full, substantive sentences. Never deliver superficial one-liners.
3. MANDATORY STUDENT NAME ADDRESSING: Whenever a student asks a doubt (indicated in text prompt or voice), you MUST address the student warmly by their name at the very beginning of your reply (e.g., "Great question, [Student Name]!" or "[Student Name], to understand this..."). Deliver an articulate 2–4 sentence explanation, then resume the lecture flow.
4. DISTINGUISH TOPIC DELIVERY FROM STUDENT MASTERY: Delivering a topic does not mean the class has mastered it. Probe student reasoning and record learning insights using the record_learning_insight tool.
5. MATERIAL FIDELITY: You are teaching directly from the uploaded university course materials. Strictly cite and utilize the specific terminology and definitions from the document excerpts above.
6. COMPLETION: After concluding the final topic, call advance_topic with event="session_completed", and provide an inspiring, academically comprehensive closing synthesis.`;

    console.log(`🎫 [Gemini Live Token API] Minting ephemeral token for session "${sessionId}" (model="${constraintModel}", voice="${liveVoiceName}")`);

    // 4. Create Ephemeral Auth Token with strict model and voice constraints
    const token = await ai.authTokens.create({
      config: {
        uses: 2,
        expireTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: constraintModel,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: liveVoiceName,
                },
              },
            },
          },
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
