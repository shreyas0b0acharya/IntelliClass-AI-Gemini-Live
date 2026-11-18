export type InteractionSpeaker = "professor" | "student" | "system";

export type InteractionType =
  | "lecture_speech"
  | "student_question"
  | "professor_answer"
  | "knowledge_check"
  | "student_answer"
  | "misconception_correction"
  | "concept_definition"
  | "exam_application"
  | "revision_point";

export interface ClassroomInteractionRecord {
  id: string;
  turnId?: string;
  sequence: number;
  timestamp: string;
  topicId?: string;
  topicTitle?: string;
  speaker: InteractionSpeaker;
  speakerName: string;
  type: InteractionType;
  text: string;
  correlatedId?: string; // Links answer to question or follow-up
  meta?: {
    conceptName?: string;
    isMisconception?: boolean;
    demonstratedUnderstanding?: boolean;
    needsRevision?: boolean;
    examSignificance?: "high" | "medium" | "low";
  };
}

export interface PostClassLearningRecord {
  sessionId: string;
  sessionTopic: string;
  courseId: string;
  generatedAt: string;
  lectureTranscript: Array<{
    timestamp: string;
    speakerName: string;
    text: string;
    topicTitle?: string;
  }>;
  classNotes: Array<{
    topicId: string;
    topicTitle: string;
    summary: string;
    keyPoints: string[];
  }>;
  studentQA: Array<{
    questionId: string;
    studentName: string;
    question: string;
    answer: string;
    timestamp: string;
    topicTitle?: string;
  }>;
  learningInsights: {
    conceptsMastered: string[];
    conceptsNeedingRevision: string[];
    identifiedMisconceptions: Array<{
      misconception: string;
      correction: string;
    }>;
    examAndInterviewTakeaways: string[];
    unresolvedQuestions: string[];
  };
}
