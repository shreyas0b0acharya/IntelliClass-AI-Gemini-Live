import "server-only";
import { ai } from "@/ai/genkit";
import { z } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeWithModelFallback, getPrimaryModel } from "@/ai/model-manager";
import type { RoadmapTopic } from "@/features/classroom/types/roadmap";

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
Always output valid JSON conforming exactly to the output schema with version "2.0".

You MUST name the array key "topics" in your JSON output (NOT "roadmap", NOT "modules"):
{
  "version": "2.0",
  "courseId": "{{courseId}}",
  "sessionId": "{{sessionId}}",
  "lectureTopic": "{{lectureTopic}}",
  "totalEstimatedMinutes": 30,
  "topics": [
    {
      "id": "topic-1",
      "order": 1,
      "title": "Topic Title",
      "description": "Topic description...",
      "learningObjectives": ["Objective 1", "Objective 2"],
      "subtopics": [
        { "id": "subtopic-1-1", "title": "Subtopic Title", "keyConcepts": ["Concept 1"] }
      ],
      "suggestedAnalogies": ["Analogy 1"],
      "suggestedVisualAssets": [],
      "estimatedDurationMinutes": 6
    }
  ]
}`,
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

    // 4. Extract topics array flexibly regardless of model JSON key naming (topics vs roadmap vs modules)
    const rawObj = (result || {}) as Record<string, unknown>;
    const rawList = Array.isArray(rawObj.topics)
      ? rawObj.topics
      : Array.isArray(rawObj.roadmap)
      ? rawObj.roadmap
      : Array.isArray(rawObj.modules)
      ? rawObj.modules
      : Array.isArray(rawObj.curriculum)
      ? rawObj.curriculum
      : [];

    let parsedTopics: RoadmapTopic[] = (rawList as Record<string, unknown>[]).map((t, idx) => {
      const order = Number(t.order) || idx + 1;
      const title = String(t.title || t.name || `Topic ${order}`);
      const description = String(t.description || t.overview || "");
      const learningObjectives = Array.isArray(t.learningObjectives)
        ? t.learningObjectives.map(String)
        : Array.isArray(t.learning_objectives)
        ? (t.learning_objectives as unknown[]).map(String)
        : typeof t.learning_objectives === "string"
        ? [t.learning_objectives]
        : [];
      const subtopics = Array.isArray(t.subtopics)
        ? (t.subtopics as Record<string, unknown>[]).map((st, sidx) => ({
            id: String(st.id || `subtopic-${order}-${sidx + 1}`),
            title: String(st.title || st.name || `Subtopic ${sidx + 1}`),
            keyConcepts: Array.isArray(st.keyConcepts)
              ? (st.keyConcepts as unknown[]).map(String)
              : Array.isArray(st.key_concepts)
              ? (st.key_concepts as unknown[]).map(String)
              : [],
          }))
        : [];
      const suggestedAnalogies = Array.isArray(t.suggestedAnalogies)
        ? t.suggestedAnalogies.map(String)
        : Array.isArray(t.analogies)
        ? (t.analogies as unknown[]).map(String)
        : [];
      const estimatedDurationMinutes =
        Number(t.estimatedDurationMinutes) ||
        Number(t.duration_minutes) ||
        Number(t.duration) ||
        6;

      return {
        id: String(t.id || `topic-${order}`),
        order,
        title,
        description,
        learningObjectives,
        subtopics,
        suggestedAnalogies,
        suggestedVisualAssets: Array.isArray(t.suggestedVisualAssets) ? (t.suggestedVisualAssets as any) : [],
        estimatedDurationMinutes,
      };
    });

    // Resilient Fallback: If model returned 0 topics, generate a dynamic 4-topic curriculum based on the topic
    if (parsedTopics.length === 0) {
      console.warn(`⚠️ [generateRoadmap] Model returned 0 topics for "${input.lectureTopic}". Generating resilient 4-topic fallback curriculum.`);
      parsedTopics = [
        {
          id: "topic-1",
          order: 1,
          title: `Introduction & Fundamentals of ${input.lectureTopic}`,
          description: `Core motivation, foundational concepts, and high-level architectural overview of ${input.lectureTopic}.`,
          learningObjectives: [`Understand the fundamental principles of ${input.lectureTopic}`],
          subtopics: [{ id: "subtopic-1-1", title: "Core Concepts & Motivation", keyConcepts: ["Foundational architecture", "Core drivers"] }],
          suggestedAnalogies: ["Building foundation & blueprint analogy"],
          suggestedVisualAssets: [],
          estimatedDurationMinutes: 7,
        },
        {
          id: "topic-2",
          order: 2,
          title: `Deep-Dive Architecture & Core Mechanics`,
          description: `Technical mechanisms, protocols, and operational workflows powering ${input.lectureTopic}.`,
          learningObjectives: [`Analyze internal mechanisms and technical implementation patterns`],
          subtopics: [{ id: "subtopic-2-1", title: "Execution Workflows & State Transitions", keyConcepts: ["State machines", "Data pathways"] }],
          suggestedAnalogies: ["Assembly line & traffic dispatch analogy"],
          suggestedVisualAssets: [],
          estimatedDurationMinutes: 8,
        },
        {
          id: "topic-3",
          order: 3,
          title: `Real-World Engineering Trade-offs & Edge Cases`,
          description: `Examining practical edge cases, failure recovery, scalability constraints, and engineering decisions.`,
          learningObjectives: [`Evaluate architectural trade-offs, performance impacts, and edge cases`],
          subtopics: [{ id: "subtopic-3-1", title: "Failure Modes & Recovery Strategies", keyConcepts: ["Resilience", "Bottleneck mitigation"] }],
          suggestedAnalogies: ["Airport runway scheduling & fault tolerance"],
          suggestedVisualAssets: [],
          estimatedDurationMinutes: 8,
        },
        {
          id: "topic-4",
          order: 4,
          title: `Advanced Synthesis, Industry Best Practices & Q&A`,
          description: `Synthesizing learned concepts, reviewing modern production patterns, and conducting open interactive discussion.`,
          learningObjectives: [`Apply synthesis to modern production systems and participate in interactive review`],
          subtopics: [{ id: "subtopic-4-1", title: "Production Patterns & Synthesis", keyConcepts: ["Best practices", "Future outlook"] }],
          suggestedAnalogies: ["Complete orchestra harmony analogy"],
          suggestedVisualAssets: [],
          estimatedDurationMinutes: 7,
        },
      ];
    }

    const totalEstimatedMinutes = parsedTopics.reduce((acc, t) => acc + t.estimatedDurationMinutes, 0);

    // 5. Ensure version, courseId, and sessionId match input
    const finalRoadmap: GenerateRoadmapOutput = {
      version: "2.0",
      courseId: input.courseId,
      sessionId: input.sessionId,
      lectureTopic: input.lectureTopic,
      totalEstimatedMinutes: totalEstimatedMinutes || input.targetDurationMinutes || 30,
      topics: parsedTopics,
    };

    return finalRoadmap;
  }
);
