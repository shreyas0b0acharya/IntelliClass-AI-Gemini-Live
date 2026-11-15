export interface VisualAssetRef {
  id: string;
  url: string;
  label: string;
  caption?: string;
}

export interface RoadmapSubtopic {
  id: string;
  title: string;
  keyConcepts: string[];
}

export interface RoadmapTopic {
  id: string;
  order: number;
  title: string;
  description: string;
  learningObjectives: string[];
  subtopics: RoadmapSubtopic[];
  suggestedAnalogies: string[];
  suggestedVisualAssets: VisualAssetRef[];
  estimatedDurationMinutes: number;
}

export interface SessionRoadmap {
  version: "2.0";
  courseId: string;
  sessionId: string;
  lectureTopic: string;
  totalEstimatedMinutes: number;
  topics: RoadmapTopic[];
}

export interface SessionLearningProgress {
  roadmapVersion: string;
  currentTopicId: string | null;
  coveredTopicIds: string[];
  completedAt: string | null;
  progressVersion: number;
}

export type TopicEvent =
  | "topic_started"
  | "topic_completed"
  | "topic_revisited"
  | "session_completed";
