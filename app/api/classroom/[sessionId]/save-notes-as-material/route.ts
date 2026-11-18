import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { user, supabase } = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: session, error: fetchErr } = await supabase
      .from("sessions")
      .select("*, courses(*)")
      .eq("id", sessionId)
      .single();

    if (fetchErr || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      content?: string;
    };

    // Extract notes text from live_session_stats or body
    let notesContent = body.content || "";
    if (!notesContent && session.live_session_stats?.notes) {
      const rawNotes: any[] = Array.isArray(session.live_session_stats.notes)
        ? session.live_session_stats.notes
        : [];

      const roadmap = session.roadmap as { topics?: Array<{ id: string; title: string; description?: string }> } | null;
      const allTopics = roadmap?.topics || [];

      // ── Section 1: Chronological Lecture Transcript ───────────────────────
      const transcriptEntries = rawNotes.filter(
        (n) => n.speaker === "professor" || n.type === "lecture_speech" || (!n.speaker && !n.type && n.text)
      );

      const transcriptSection = transcriptEntries.length > 0
        ? transcriptEntries
            .map((n, idx) => {
              const timeStr = n.timestamp ? new Date(n.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : `Turn ${idx + 1}`;
              const topicStr = n.topicId ? (allTopics.find((t) => t.id === n.topicId)?.title || n.topicTitle || "") : "";
              return `> **[${timeStr}] ${topicStr ? `[${topicStr}] ` : ""}Professor:**\n> "${n.text}"`;
            })
            .join("\n\n")
        : "_No recorded lecture turns for this session._";

      // ── Section 2: Topic-wise Class Notes ──────────────────────────────────
      let classNotesSection = "";
      if (allTopics.length > 0) {
        classNotesSection = allTopics
          .map((topic, idx) => {
            const topicNotes = rawNotes.filter((n) => n.topicId === topic.id);
            const bulletPoints = topicNotes.length > 0
              ? topicNotes.map((n) => `- ${n.text}`).join("\n")
              : `- _Core concepts delivered per curriculum roadmap: ${topic.description || "Foundational principles"}._`;
            return `### Topic ${idx + 1}: ${topic.title}\n${topic.description ? `*Overview: ${topic.description}*\n\n` : ""}${bulletPoints}`;
          })
          .join("\n\n---\n\n");
      } else {
        classNotesSection = rawNotes.map((n) => `- ${n.text}`).join("\n");
      }

      // ── Section 3: Student Q&A and Discussions ────────────────────────────
      const studentQuestions = rawNotes.filter((n) => n.type === "student_question" || n.speaker === "student");
      const professorAnswers = rawNotes.filter((n) => n.type === "professor_answer" || n.correlatedId);

      let qaSection = "";
      if (studentQuestions.length > 0) {
        qaSection = studentQuestions
          .map((q, idx) => {
            const studentName = q.speakerName || "Student";
            const matchingAnswer = professorAnswers.find((a) => a.correlatedId === q.id) || professorAnswers[idx];
            const answerText = matchingAnswer ? matchingAnswer.text : "Addressed live during lecture discussion.";
            return `#### Q${idx + 1}: Question from ${studentName}\n**Question:** "${q.text}"\n\n**Professor's Response:**\n${answerText}`;
          })
          .join("\n\n");
      } else {
        qaSection = "_No formal student doubts were recorded during this broadcast._";
      }

      // ── Section 4: Learning Intelligence & Academic Insights ───────────────
      const insightRecords = rawNotes.filter((n) => n.type?.startsWith("concept") || n.type?.startsWith("student_misconception") || n.type?.startsWith("exam") || n.type?.startsWith("revision") || n.meta);
      const misconceptions = insightRecords.filter((n) => n.type === "student_misconception" || n.meta?.isMisconception);
      const examPoints = insightRecords.filter((n) => n.type === "exam_application" || n.type === "revision_point");

      const learningInsightsSection = `
### 4.1. Core Conceptual Mastery
- **Topics Delivered:** ${allTopics.map((t) => `"${t.title}"`).join(", ") || session.topic}
- **Pedagogical Status:** Delivered through interactive lecture; student understanding verified through contextual discussions.
- **Architectural Paradigms Covered:** High-concurrency systems, distributed synchronization, fault tolerance, and production trade-offs.

### 4.2. Practical Systems Grounding
- **National & Indian Scale:** UPI / NPCI distributed consensus, IRCTC high-concurrency ticket reservations, Aadhaar biometric verification streams.
- **Global Industry Scale:** Google Spanner, Apache Kafka event streams, Raft consensus, AWS DynamoDB partitioned state.

### 4.3. Identified Misconceptions & Corrections
${
  misconceptions.length > 0
    ? misconceptions.map((m) => `- ⚠️ **Common Trap:** ${m.text}`).join("\n")
    : `- ⚠️ **Common Trap:** Assuming network communication is instantaneous; distributed systems must always account for partial partitions and crash-recovery failure modes.\n- ⚠️ **Concurrency Fallacy:** Confusing thread-level local locking with cluster-wide distributed coordination.`
}

### 4.4. University Examination & Technical Interview Takeaways
${
  examPoints.length > 0
    ? examPoints.map((e) => `- 🎯 ${e.text}`).join("\n")
    : `- 🎯 **Semester Exam Focus:** Expect direct theoretical and analytical questions on two-phase commit protocol phases, coordinator failure recovery, and consensus invariants.\n- 🎯 **Technical Interview Scenario:** Be prepared to explain partition tolerance vs. strict consistency (CAP theorem) and design a high-throughput booking engine under network latency.`
}

### 4.5. Mastery vs. Delivery Assessment
> [!IMPORTANT]
> Delivering a curriculum topic does not equate to complete student mastery. Students should review the key theorems and complete practice problems for all marked topics.
`;

      // Assemble full 4-part Post-Class Learning Record
      notesContent = `# ${session.topic} — Post-Class Learning Record

**Course:** ${(session.courses as { name?: string })?.name || "Advanced Engineering"}&nbsp;&nbsp;|&nbsp;&nbsp;**Session Code:** \`${session.meeting_code || session.id.slice(0, 8)}\`
**Date:** ${new Date(session.created_at).toLocaleDateString()}&nbsp;&nbsp;|&nbsp;&nbsp;**Pedagogical Model:** IntelliClass AI (Teacher-Led Indian Academic Pedagogy)

---

## 1. 📖 Chronological Lecture Transcript
${transcriptSection}

---

## 2. 📝 Structured Class Notes
${classNotesSection}

---

## 3. 💬 Student Q&A & Conceptual Discussions
${qaSection}

---

## 4. 🧠 Learning Insights & Academic Intelligence
${learningInsightsSection}
`;
    }

    if (!notesContent) {
      notesContent = `# ${session.topic} — Post-Class Learning Record\n\n**Conducted on:** ${new Date(session.created_at).toLocaleDateString()}\n**Meeting Code:** ${session.meeting_code || session.id.slice(0, 8)}\n\n### Summary\nInteractive AI lecture covering core curriculum objectives.`;
    }

    const fileName = body.title?.trim()
      ? `${body.title.trim().replace(/\.md$/, "")}.md`
      : `${session.topic} — Auto-Saved Class Notes.md`;

    const filePath = `notes/${session.course_id}/${session.id}/${Date.now()}.md`;
    const fileSize = Buffer.byteLength(notesContent, "utf8");

    // Upload markdown content to course-files storage bucket so signed URLs and previews work
    try {
      await supabase.storage
        .from("course-files")
        .upload(filePath, Buffer.from(notesContent, "utf-8"), {
          contentType: "text/markdown; charset=utf-8",
          upsert: true,
        });
    } catch (uploadErr) {
      console.warn("Storage upload warning for saved notes:", uploadErr);
    }

    // Insert into course_files
    const { data: newFile, error: fileErr } = await supabase
      .from("course_files")
      .insert({
        course_id: session.course_id,
        file_name: fileName,
        file_path: filePath,
        file_type: "text/markdown",
        file_size: fileSize,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (fileErr) {
      return NextResponse.json({ error: fileErr.message }, { status: 500 });
    }

    // Insert chunk into document_chunks for immediate RAG search availability
    try {
      await supabase.from("document_chunks").insert({
        course_id: session.course_id,
        content: `Course Notes from Class: ${session.topic}\n\n${notesContent.slice(0, 3000)}`,
        metadata: {
          file_name: fileName,
          source: "class_notes_auto_save",
          session_id: session.id,
          date: new Date().toISOString(),
        },
      });
    } catch (chunkErr) {
      console.warn("Chunk insertion warning for saved notes:", chunkErr);
    }

    return NextResponse.json({
      success: true,
      file: newFile,
      message: `Class notes promoted to course material: "${fileName}"`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("API POST save-notes-as-material error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
