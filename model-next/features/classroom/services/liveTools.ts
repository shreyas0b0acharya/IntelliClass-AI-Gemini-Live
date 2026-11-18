import { FunctionDeclaration, Type, Behavior } from "@google/genai";

export const advanceTopicDeclaration: FunctionDeclaration = {
  name: "advance_topic",
  description: "Transition progress when completing a topic, starting the next topic, or ending the session.",
  behavior: Behavior.NON_BLOCKING,
  parameters: {
    type: Type.OBJECT,
    properties: {
      event: {
        type: Type.STRING,
        enum: ["topic_started", "topic_completed", "topic_revisited", "session_completed"],
        description: "Pedagogical progress event.",
      },
      completedTopicId: {
        type: Type.STRING,
        description: "ID of the completed topic.",
      },
      nextTopicId: {
        type: Type.STRING,
        description: "ID of the topic being started (omit if event is session_completed).",
      },
      transitionReason: {
        type: Type.STRING,
        description: "Pedagogical reason for the transition.",
      },
    },
    required: ["event"],
  },
};

export const searchCourseMaterialsDeclaration: FunctionDeclaration = {
  name: "search_course_materials",
  description: "Retrieve specific factual context, formulas, or excerpts from uploaded course textbooks.",
  behavior: Behavior.NON_BLOCKING,
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "Targeted search query for semantic vector lookup.",
      },
    },
    required: ["query"],
  },
};

export const projectMediaDeclaration: FunctionDeclaration = {
  name: "project_media",
  description: "Display an extracted textbook figure or diagram on the student whiteboard.",
  behavior: Behavior.NON_BLOCKING,
  parameters: {
    type: Type.OBJECT,
    properties: {
      assetId: {
        type: Type.STRING,
        description: "UUID of the media asset from the roadmap.",
      },
      caption: {
        type: Type.STRING,
        description: "Spoken description of the figure.",
      },
    },
    required: ["assetId"],
  },
};

export const recordLearningInsightDeclaration: FunctionDeclaration = {
  name: "record_learning_insight",
  description: "Record a pedagogical learning insight: key concept definition, student misconception, or revision point.",
  behavior: Behavior.NON_BLOCKING,
  parameters: {
    type: Type.OBJECT,
    properties: {
      topicId: {
        type: Type.STRING,
        description: "Topic ID being discussed.",
      },
      insightType: {
        type: Type.STRING,
        enum: ["concept_definition", "student_misconception", "exam_application", "revision_point"],
        description: "Type of learning insight.",
      },
      title: {
        type: Type.STRING,
        description: "Short concept or insight title.",
      },
      content: {
        type: Type.STRING,
        description: "Detailed academic explanation or misconception correction.",
      },
      demonstratedUnderstanding: {
        type: Type.BOOLEAN,
        description: "Whether the student/class has demonstrated understanding through discussion or questions.",
      },
    },
    required: ["insightType", "title", "content"],
  },
};

export const classroomLiveTools = [
  advanceTopicDeclaration,
  searchCourseMaterialsDeclaration,
  projectMediaDeclaration,
  recordLearningInsightDeclaration,
];
