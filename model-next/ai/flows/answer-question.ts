import "server-only";
import { ai } from "@/ai/genkit";
import { z } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeWithModelFallback } from "@/ai/model-manager";

export const StudentAIQuestionAnsweringInputSchema = z.object({
  question: z.string().describe("The student's question."),
  courseId: z.string().describe("The ID of the course."),
  studentName: z.string().describe("The name of the student asking."),
  lecturerName: z.string().optional().describe("The professor/lecturer persona name."),
  currentLectureContext: z.string().optional().describe("The sentence or concept the professor was discussing."),
  lastSpokenSentence: z.string().optional().describe("The sentence spoken right before the interruption."),
  sessionTopic: z.string().optional().describe("The overall lecture topic."),
  currentIndex: z.number().optional().describe("The current index in the lecture."),
});
export type StudentAIQuestionAnsweringInput = z.infer<typeof StudentAIQuestionAnsweringInputSchema>;

export const StudentAIQuestionAnsweringOutputSchema = z.object({
  answer: z.string().describe("The professor's spoken answer and transition."),
  mode: z.enum(["RAG", "FALLBACK", "FAILSAFE"]).describe("Retrieval mode utilized."),
});
export type StudentAIQuestionAnsweringOutput = z.infer<typeof StudentAIQuestionAnsweringOutputSchema>;

export const studentAIQuestionAnsweringFlow = ai.defineFlow(
  {
    name: "studentAIQuestionAnsweringFlow",
    inputSchema: StudentAIQuestionAnsweringInputSchema,
    outputSchema: StudentAIQuestionAnsweringOutputSchema,
  },
  async (input) => {
    const supabase = createAdminClient();
    let context = "";
    let mode: "RAG" | "FALLBACK" | "FAILSAFE" = "FALLBACK";

    // 1. Vector Search bounded by 1500ms timeout
    const normalizedQ = input.question.trim().toLowerCase().replace(/[?!.,]/g, "");
    const GREETINGS = new Set(["hi", "hello", "hey", "good morning", "good evening", "yes", "no", "okay", "ok", "thanks", "thank you"]);
    const isPureGreeting = GREETINGS.has(normalizedQ);

    const isPresentationOrReportRequest =
      normalizedQ.includes("presentation") ||
      normalizedQ.includes("slide") ||
      normalizedQ.includes("ppt") ||
      normalizedQ.includes("report") ||
      normalizedQ.includes("summary") ||
      normalizedQ.includes("outline") ||
      normalizedQ.includes("overview");

    if (!isPureGreeting) {
      try {
        const vectorSearchPromise = (async () => {
          const embeddingResults = await ai.embed({
            embedder: "googleai/gemini-embedding-001",
            content: input.question,
          });

          const embedding = embeddingResults[0]?.embedding;
          if (!embedding) return null;

          const { data: matches, error } = await supabase.rpc("match_documents", {
            query_embedding: embedding,
            match_threshold: 0.50,
            match_count: 4,
            course_id_filter: input.courseId,
          });

          if (!error && matches && matches.length > 0) {
            return matches
              .map((m: { content?: string }) => m.content)
              .filter(Boolean)
              .join("\n\n---\n\n");
          }
          return null;
        })();

        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 1500)
        );

        const matchedContext = await Promise.race([vectorSearchPromise, timeoutPromise]);
        if (matchedContext && matchedContext.length > 30) {
          context = matchedContext;
          mode = "RAG";
        } else {
          // Fallback: Fetch top document chunks directly from database so the AI is always grounded in the course
          const { data: fallbackChunks } = await supabase
            .from("document_chunks")
            .select("content, metadata")
            .eq("course_id", input.courseId)
            .limit(3);

          if (fallbackChunks && fallbackChunks.length > 0) {
            context = fallbackChunks.map((c) => c.content).join("\n\n---\n\n");
            mode = "RAG";
          }
        }
      } catch (err) {
        console.warn("Vector RAG match fallback triggered:", err);
        mode = "FAILSAFE";
      }
    }

    // 2. Build system instruction with full awareness of class intention and user request
    const profPersona = input.lecturerName || "Professor Arthur";
    const studentFirstName = (input.studentName || "Student").trim().split(/\s+/)[0];
    const sanitizedLastSentence = input.lastSpokenSentence
      ? input.lastSpokenSentence.replace(/^[\s/]+/, "").replace(/[\s/]+$/, "").trim()
      : "";

    let systemInstruction = "";

    if (isPresentationOrReportRequest) {
      systemInstruction = `You are ${profPersona}, the authoritative AI Professor and lead researcher for this course.
The user is requesting a presentation structure, slide outline, or comprehensive summary of the course material.
You must be 100% aware of the course intention, uploaded documents, and delivered curriculum topics.

Subject / Topic: "${input.sessionTopic || "Course Curriculum"}"

Instructions:
1. Provide a well-structured, professional, curriculum-aware presentation outline or breakdown.
2. Ground every slide or section directly in the course materials provided below.
3. Include clear slide titles, key concepts, formulas/metrics, and real-world analogies.
4. If this is IntelliClass AI, reflect the real technical architecture: 97% bandwidth reduction (~64 kbps), pure Gemini Live audio, client-side Three.js 3D avatar with Oculus viseme lip sync, and multimodal RAG.
5. Format cleanly with clear bullet points and bold headers.`;
    } else {
      systemInstruction = `You are ${profPersona}, a warm, intellectually sharp college professor addressing a student during class.
Explain the answer directly, accurately, and authoritatively.

Topic: "${input.sessionTopic || "Current Topic"}"
${input.currentLectureContext ? `- Recent Context: "${input.currentLectureContext}"` : ""}
${sanitizedLastSentence ? `- Last Spoken: "${sanitizedLastSentence}"` : ""}

Style Rules:
1. MANDATORY NAME ADDRESSING: You MUST start your response by warmly and explicitly addressing ${studentFirstName} by name (e.g., "Great question, ${studentFirstName}!" or "${studentFirstName}, to understand this concept..."). Never begin answering without greeting the student by name.
2. Deliver a clear, complete conceptual explanation (2 to 4 sentences). Never give a superficial or robotic one-liner.
3. If referencing course concepts, explain the underlying mechanism step-by-step.
4. Conclude naturally and warmly.`;
    }

    const prompt =
      context
        ? `OFFICIAL COURSE MATERIALS & TEXTBOOK EXCERPTS:\n${context}\n\nSTUDENT REQUEST / QUESTION: ${input.question}`
        : `STUDENT REQUEST / QUESTION: ${input.question}`;

    console.log(
      `🧠 [Q&A Flow] Answering question from ${input.studentName}: "${input.question}" (mode=${mode}, contextLen=${context.length}, isPresentation=${isPresentationOrReportRequest})`
    );

    const { result: text } = await executeWithModelFallback(
      "Q&A Flow",
      async (modelName) => {
        const response = await ai.generate({
          model: googleAI.model(modelName),
          system: systemInstruction,
          prompt: prompt,
          config: {
            maxOutputTokens: isPresentationOrReportRequest ? 2048 : 800,
            temperature: 0.4,
          },
        });
        if (!response.text) {
          throw new Error(`Empty response received from ${modelName}`);
        }
        return response.text;
      }
    );

    let cleanAnswer = isPresentationOrReportRequest
      ? text.trim()
      : text.replace(/[*#`_~]/g, "").replace(/\s+/g, " ").trim();

    // Guard: ensure the professor explicitly addresses the student by name
    if (!isPresentationOrReportRequest && studentFirstName && !cleanAnswer.toLowerCase().includes(studentFirstName.toLowerCase())) {
      cleanAnswer = `Great question, ${studentFirstName}! ${cleanAnswer}`;
    }

    console.log(
      `✅ [Q&A Flow] Generated answer (${cleanAnswer.length} chars): "${cleanAnswer.slice(0, 100)}..."`
    );

    return {
      answer: cleanAnswer,
      mode,
    };
  }
);

export async function studentAIQuestionAnswering(
  input: StudentAIQuestionAnsweringInput
): Promise<StudentAIQuestionAnsweringOutput> {
  return studentAIQuestionAnsweringFlow(input);
}
