import "server-only";
import { ai } from "@/ai/genkit";
import { z } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeWithModelFallback, getPrimaryModel } from "@/ai/model-manager";
import type { SessionRoadmap, RoadmapTopic } from "@/features/classroom/types/roadmap";

export const SourceSelectionSchema = z.object({
  fileName: z.string(),
  startPage: z.number().optional(),
  endPage: z.number().optional(),
});

export const GenerateRoadmapInputSchema = z.object({
  courseId: z.string(),
  sessionId: z.string(),
  lectureTopic: z.string(),
  targetDurationMinutes: z.number().optional().default(30),
  sources: z.array(SourceSelectionSchema).optional(),
  customPrompt: z.string().optional(),
});
export type GenerateRoadmapInput = z.infer<typeof GenerateRoadmapInputSchema>;

export const RoadmapTopicSchema = z.object({
  id: z.string().describe("Unique slug like topic-1, topic-2"),
  order: z.number(),
  title: z.string().describe("Concise, descriptive topic title"),
  description: z.string().describe("Brief 1-2 sentence overview of what will be taught"),
  learningObjectives: z.array(z.string()).describe("2-3 specific learning outcomes"),
  subtopics: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      keyConcepts: z.array(z.string()),
    })
  ),
  suggestedAnalogies: z.array(z.string()).describe("1-2 intuitive everyday real-world analogies"),
  suggestedVisualAssets: z.array(
    z.object({
      id: z.string(),
      url: z.string(),
      label: z.string(),
      caption: z.string().optional(),
    })
  ).optional().default([]),
  estimatedDurationMinutes: z.number().describe("Estimated minutes (typically 4 to 8 mins)"),
});

export const SessionRoadmapOutputSchema = z.object({
  version: z.literal("2.0"),
  courseId: z.string(),
  sessionId: z.string(),
  lectureTopic: z.string(),
  totalEstimatedMinutes: z.number(),
  topics: z.array(RoadmapTopicSchema),
});

export type GenerateRoadmapOutput = z.infer<typeof SessionRoadmapOutputSchema>;

const generateRoadmapPrompt = ai.definePrompt({
  name: "generateRoadmapPrompt",
  model: googleAI.model(getPrimaryModel()),
  input: {
    schema: z.object({
      lectureTopic: z.string(),
      targetDurationMinutes: z.number(),
      context: z.string(),
      visualAssetsJson: z.string(),
      customPrompt: z.string().optional(),
    }),
  },
  output: {
    schema: SessionRoadmapOutputSchema,
  },
  config: {
    maxOutputTokens: 8192,
    temperature: 0.4,
  },
  system: `You are an expert curriculum designer and college professor.
Your goal is to transform lecture materials into a structured, lightweight 4-to-8 topic roadmap for a real-time conversational AI lecture.
Each topic must have:
- A clear, engaging title and sequential order.
- Specific, measurable learning objectives.
- Subtopics breaking down the core concepts.
- 1-2 intuitive everyday analogies (e.g. railway booking queues, restaurant kitchens, plumbing, traffic signals).
- Appropriate visual asset selections matching available visual assets.
- Realistic duration estimates totaling approximately the target duration.
Always output valid JSON conforming exactly to the output schema with version "2.0".`,
  prompt: `Design a comprehensive, sequential lecture roadmap for:
Topic: {{{lectureTopic}}}
Target Duration: {{{targetDurationMinutes}}} minutes

{{#if customPrompt}}
Instructor Notes / Specific Emphasis:
{{{customPrompt}}}
{{/if}}

Course Context & Source Materials:
{{{context}}}

Available Visual Assets:
{{{visualAssetsJson}}}`,
});

export const generateRoadmapFlow = ai.defineFlow(
  {
    name: "generateRoadmapFlow",
    inputSchema: GenerateRoadmapInputSchema,
    outputSchema: SessionRoadmapOutputSchema,
  },
  async (input): Promise<GenerateRoadmapOutput> => {
    const supabase = createAdminClient();

    // 1. Fetch available visual assets for the course
    const { data: mediaAssets } = await supabase
      .from("media_assets")
      .select("id, public_url, label, caption")
      .eq("course_id", input.courseId);

    const formattedVisualAssets = (mediaAssets || []).map((a) => ({
      id: a.id,
      url: a.public_url,
      label: a.label || "Visual Diagram",
      caption: a.caption || "",
    }));

    // 2. Fetch relevant context from document chunks
    let contextText = "Standard comprehensive college syllabus curriculum.";
    try {
      let query = supabase
        .from("document_chunks")
        .select("content, chunk_index, file_name")
        .eq("course_id", input.courseId);

      if (input.sources && input.sources.length > 0) {
        const fileNames = input.sources.map((s) => s.fileName);
        query = query.in("file_name", fileNames);
      }

      const { data: chunks } = await query.order("chunk_index", { ascending: true }).limit(50);
      if (chunks && chunks.length > 0) {
        contextText = chunks.map((c) => `[Source: ${c.file_name} #${c.chunk_index}]\n${c.content}`).join("\n\n---\n\n");
      }
    } catch (chunkErr) {
      console.warn("Could not retrieve document chunks for roadmap:", chunkErr);
    }

    // 3. Generate Roadmap via model with fallback
    const { result } = await executeWithModelFallback("generateRoadmap", async (modelName: string) => {
      const response = await generateRoadmapPrompt(
        {
          lectureTopic: input.lectureTopic,
          targetDurationMinutes: input.targetDurationMinutes || 30,
          context: contextText.slice(0, 30000),
          visualAssetsJson: JSON.stringify(formattedVisualAssets, null, 2),
          customPrompt: input.customPrompt,
        },
        { model: googleAI.model(modelName) }
      );

      if (!response.output) {
        throw new Error("Empty response from roadmap generation prompt");
      }
      return response.output;
    });

    // 4. Ensure version, courseId, and sessionId match input
    const finalRoadmap: GenerateRoadmapOutput = {
      ...result,
      version: "2.0",
      courseId: input.courseId,
      sessionId: input.sessionId,
      lectureTopic: input.lectureTopic,
    };

    return finalRoadmap;
  }
);
