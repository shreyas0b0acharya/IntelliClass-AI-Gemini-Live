export type UserRole = "lecturer" | "student";

export interface Profile {
  id: string;
  role: UserRole;
  name: string;
  preferences?: Record<string, unknown>;
  created_at: string;
}

export interface Course {
  id: string;
  title: string;
  description: string | null;
  created_by: string;
  created_at: string;
  profiles?: Profile;
  files_count?: number;
  sessions_count?: number;
}

export interface CourseFile {
  id: string;
  course_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface DocumentChunk {
  id: string;
  course_id: string;
  content: string;
  metadata: {
    source?: string;
    page?: number;
    [key: string]: unknown;
  };
  created_at: string;
}

export type SessionStatus = "created" | "running" | "paused" | "ended";

export type AdmissionStatus = "waiting" | "admitted" | "denied" | "left";
export type ConnectionStatus = "online" | "reconnecting" | "offline";

export interface SessionParticipantRecord {
  id: string;
  session_id: string;
  user_id: string;
  user_name: string;
  role: "lecturer" | "student";
  status: AdmissionStatus;
  joined_at: string;
  admitted_at?: string | null;
  updated_at: string;
}

export interface ClassroomSession {
  id: string;
  course_id: string;
  topic: string;
  script: string;
  voice_id?: string;
  status: SessionStatus;
  current_item_id?: string;
  current_sentence_index?: number;
  sequence?: number;
  state_version?: number;
  meeting_code?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
  stopped_reason?: string;
  course?: Course;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string | null;
  role?: "user" | "ai" | "system";
  message: string;
  created_at: string;
  profiles?: Profile;
}

export interface MediaAsset {
  id: string;
  course_id: string;
  session_id?: string | null;
  type: "image" | "video";
  file_url: string;
  label: string;
  source: string;
  created_at: string;
}
