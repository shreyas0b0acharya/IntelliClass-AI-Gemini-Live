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

    // 1. Fast Vector Search bounded by 1000ms timeout
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
          match_threshold: 0.65,
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
        setTimeout(() => resolve(null), 1000)
      );

      const matchedContext = await Promise.race([vectorSearchPromise, timeoutPromise]);
      if (matchedContext && matchedContext.length > 30) {
        context = matchedContext;
        mode = "RAG";
      }
    } catch (err) {
      console.warn("Vector RAG match fallback triggered:", err);
      mode = "FAILSAFE";
    }

    // 2. Build system instruction with polite acknowledgment & transition back to lecture
    const profPersona = input.lecturerName || "Professor";
    const sanitizedLastSentence = input.lastSpokenSentence
      ? input.lastSpokenSentence.replace(/^[\s/]+/, "").replace(/[\s/]+$/, "").trim()
      : "";

    const systemInstruction = `You are ${profPersona}, a warm, encouraging college professor teaching a live lecture.
${
  mode === "RAG"
    ? "Answer accurately and concisely based on the provided course material."
    : "Answer concisely and authoritatively using your deep domain expertise."
}

Current Classroom State:
- Topic: "${input.sessionTopic || "Current Topic"}"
${input.currentLectureContext ? `- Recent Context: "${input.currentLectureContext}"` : ""}
${sanitizedLastSentence ? `- Just spoken before question: "${sanitizedLastSentence}"` : ""}

Style Rules:
1. Address the student warmly by name: "${input.studentName}, that is a good question."
2. Explain the answer concisely in 2-3 spoken sentences in your authentic teaching style.
3. NO markdown formatting (*, #, \`, bullets, slashes). Only clean spoken text.
4. Conclude with a natural transition back to the lecture: "Is that clear? Excellent. Now, coming back to what we were exploring — ${
      sanitizedLastSentence || "let us continue our discussion"
    }."`;

    const prompt =
      mode === "RAG" && context
        ? `COURSE MATERIALS CONTEXT:\n${context}\n\nSTUDENT QUESTION: ${input.question}`
        : `STUDENT QUESTION: ${input.question}`;

    console.log(
      `🧠 [Q&A Flow] Answering question from ${input.studentName}: "${input.question}" (mode=${mode}, contextLen=${context.length})`
    );

    const { result: text } = await executeWithModelFallback(
      "Q&A Flow",
      async (modelName) => {
        const response = await ai.generate({
          model: googleAI.model(modelName),
          system: systemInstruction,
          prompt: prompt,
          config: {
            maxOutputTokens: 2048,
            temperature: 0.7,
          },
        });
        if (!response.text) {
          throw new Error(`Empty response received from ${modelName}`);
        }
        return response.text;
      }
    );

    const cleanAnswer = text
      .replace(/[*#`_~]/g, "")
      .replace(/\s+/g, " ")
      .trim();

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
