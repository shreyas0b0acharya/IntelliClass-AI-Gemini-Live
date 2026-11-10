import "server-only";
import { ai } from "@/ai/genkit";
import { z } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeWithModelFallback, getPrimaryModel } from "@/ai/model-manager";

export const SourceSelectionSchema = z.object({
  fileName: z.string(),
  startPage: z.number().optional(),
  endPage: z.number().optional(),
});

export const GenerateTeachingScriptInputSchema = z.object({
  courseId: z.string(),
  topic: z.string(),
  lecturerName: z.string().optional(),
  sources: z.array(SourceSelectionSchema).optional(),
  customPrompt: z.string().optional(),
  directText: z.string().optional(),
});
export type GenerateTeachingScriptInput = z.infer<typeof GenerateTeachingScriptInputSchema>;

export const GenerateTeachingScriptOutputSchema = z.object({
  status: z.string(),
  topic: z.string(),
  script: z.string(),
  chunksUsed: z.number(),
  modelUsed: z.string().optional(),
});
export type GenerateTeachingScriptOutput = z.infer<typeof GenerateTeachingScriptOutputSchema>;

const generateTeachingScriptPrompt = ai.definePrompt({
  name: "generateTeachingScriptPrompt",
  model: googleAI.model(getPrimaryModel()),
  input: {
    schema: z.object({
      topic: z.string(),
      lecturerName: z.string().optional(),
      context: z.string(),
      visualAssetsContext: z.string().optional(),
      customPrompt: z.string().optional(),
    }),
  },
  output: { schema: z.object({ script: z.string() }) },
  config: {
    maxOutputTokens: 12000,
    temperature: 0.75,
  },
  system: `You are {{#if lecturerName}}{{lecturerName}}{{else}}the Professor{{/if}}, a warm, experienced college professor with 20+ years of teaching excellence.
You speak in an engaging, natural, highly relatable classroom lecture style.

Your teaching rules:
1. Greet the class warmly in your persona: "Alright class, I am {{#if lecturerName}}{{lecturerName}}{{else}}your professor{{/if}}, let us begin today's discussion on..."
2. Explain every concept step-by-step with intuitive real-world analogies (like Indian railway reservation queues, local market trade, or everyday relatable mechanics).
3. Insert natural transitions: "Now, let us observe this carefully,", "Are you following so far? Good.", "This is very important for your exams and understanding — keep this in mind."
4. Periodically insert [ENGAGEMENT] to ask a quick rhetorical checkpoint question.
5. Visual Projection Screen / Whiteboard: Whenever you introduce, explain, or refer to a visual figure, diagram, circuit, graph, or slide listed in the Visual Assets context, place the exact tag [IMAGE: url | label] on its own line right where it should appear on the student projection screen!
6. NO markdown formatting (*, #, \`, bullet points, numbered lists). Do NOT insert [PAUSE] tags or any pause placeholders. The text will be spoken directly by the Speech synthesis engine.
7. Write continuous, well-punctuated natural speech sentences with smooth conversational transitions.
8. Deliver a thorough, comprehensive, deeply explanatory lecture. Minimum 1200 words. Cover the entire topic in full depth without rushing.`,
  prompt: `Generate a comprehensive, engaging spoken lecture script for the following topic:

Topic: {{{topic}}}

{{#if lecturerName}}
Professor Persona: {{{lecturerName}}}
{{/if}}

{{#if customPrompt}}
Special Instructions from Lecturer: {{{customPrompt}}}
{{/if}}

{{#if visualAssetsContext}}
Available Visual Diagrams & Figures for Classroom Projection:
{{{visualAssetsContext}}}
{{/if}}

Course Material Context:
{{{context}}}

Provide the complete lecture speaking script now:`,
});

export const generateTeachingScriptFlow = ai.defineFlow(
  {
    name: "generateTeachingScriptFlow",
    inputSchema: GenerateTeachingScriptInputSchema,
    outputSchema: GenerateTeachingScriptOutputSchema,
  },
  async (input) => {
    console.log(`📝 [Script Generator] Starting generation for topic: "${input.topic}" | Course: ${input.courseId}`);
    const supabase = createAdminClient();
    const allChunks: string[] = [];

    // 1. Fetch relevant chunks from document_chunks table
    if (input.sources && input.sources.length > 0) {
      const sourceNames = input.sources.map((s) => s.fileName);
      console.log(`📚 [Script Generator] Querying document chunks for sources:`, sourceNames);

      const { data, error } = await supabase
        .from("document_chunks")
        .select("content, metadata")
        .eq("course_id", input.courseId)
        .in("metadata->>source", sourceNames)
        .limit(100);

      if (error) {
        console.warn(`⚠️ [Script Generator] Database retrieval warning: ${error.message}`);
      }

      if (data && data.length > 0) {
        const selectionMap = new Map(input.sources.map((s) => [s.fileName, s]));

        for (const row of data) {
          const meta = row.metadata as Record<string, unknown> | null;
          const srcName = typeof meta?.source === "string" ? meta.source : undefined;
          const page = typeof meta?.page === "number" ? meta.page : undefined;
          const selection = srcName ? selectionMap.get(srcName) : undefined;

          if (selection) {
            if (selection.startPage !== undefined && (page === undefined || page < selection.startPage)) continue;
            if (selection.endPage !== undefined && (page === undefined || page > selection.endPage)) continue;
            allChunks.push(row.content.substring(0, 1500));
          }
        }
        console.log(`🔍 [Script Generator] Found ${allChunks.length} targeted chunks matching page criteria.`);
      }
    }

    if (input.directText && input.directText.trim()) {
      allChunks.push(input.directText.trim());
    }

    if (allChunks.length === 0) {
      // Fallback: fetch any chunks available for the course
      console.log(`ℹ️ [Script Generator] No exact source match. Fetching general course chunks...`);
      const { data: fallbackData } = await supabase
        .from("document_chunks")
        .select("content")
        .eq("course_id", input.courseId)
        .limit(15);

      if (fallbackData && fallbackData.length > 0) {
        fallbackData.forEach((row) => allChunks.push(row.content.substring(0, 1500)));
        console.log(`🔍 [Script Generator] Retrieved ${allChunks.length} course chunks for grounding.`);
      }
    }

    // 2. Fetch visual diagrams from media_assets table
    let visualAssetsContext = "";
    try {
      const { data: mediaData } = await supabase
        .from("media_assets")
        .select("id, file_url, label")
        .eq("course_id", input.courseId)
        .limit(15);

      if (mediaData && mediaData.length > 0) {
        const resolvedMedia = mediaData.map((m) => {
          const match = m.file_url?.match(/(?:course-files\/)?([^?]+(?:media_assets\/[^?]+|mediaassets\/[^?]+))/);
          const ext = m.label?.includes(".jpg") || m.label?.includes(".jpeg") ? "jpeg" : "png";
          const path = match ? match[1] : `${input.courseId}/media_assets/${m.id}.${ext}`;
          return `- [IMAGE: /api/media/${path} | ${m.label}]`;
        });
        visualAssetsContext = resolvedMedia.join("\n");
        console.log(`🖼️ [Script Generator] Found ${mediaData.length} extracted visual diagrams for blackboard projection.`);
      }
    } catch (e) {
      console.warn("⚠️ [Script Generator] Error fetching media assets:", e);
    }

    // Use top 15 targeted chunks from the uploaded materials or general domain knowledge
    const selectedChunks = allChunks.slice(0, 15);
    const context = selectedChunks.length > 0
      ? selectedChunks.join("\n\n---\n\n")
      : `Provide deep, comprehensive foundational knowledge and practical real-world intuition on ${input.topic}.`;

    console.log(`🤖 [Script Generator] Initiating generation with ${selectedChunks.length} grounding chunks (${context.length} chars of context)...`);

    // 3. Call Prompt with automatic dynamic model fallback
    const { result: scriptOutput, usedModel } = await executeWithModelFallback(
      "Script Generator",
      async (modelName) => {
        const { output } = await generateTeachingScriptPrompt(
          {
            topic: input.topic,
            lecturerName: input.lecturerName,
            context,
            visualAssetsContext: visualAssetsContext || undefined,
            customPrompt: input.customPrompt,
          },
          { model: googleAI.model(modelName) }
        );

        if (!output?.script) {
          throw new Error(`Model ${modelName} returned an empty script response.`);
        }
        return output;
      }
    );

    // 4. Post-process clean up for TTS (strip any accidental [PAUSE] tags, keep [ENGAGEMENT] and [IMAGE: ...])
    const cleanScript = scriptOutput.script
      .replace(/\[PAUSE\]/gi, " ")
      .replace(/[*#`_~]/g, "")
      .replace(/\s+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const wordCount = cleanScript.split(/\s+/).length;
    console.log(`✅ [Script Generator] Successfully created lecture script! (${wordCount} words, ${cleanScript.length} characters, model: ${usedModel})`);

    return {
      status: "success",
      topic: input.topic,
      script: cleanScript,
      chunksUsed: selectedChunks.length,
      modelUsed: usedModel,
    };
  }
);

export async function generateTeachingScript(
  input: GenerateTeachingScriptInput
): Promise<GenerateTeachingScriptOutput> {
  return generateTeachingScriptFlow(input);
}
