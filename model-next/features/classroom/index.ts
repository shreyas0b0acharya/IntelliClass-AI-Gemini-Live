// features/classroom/index.ts

// Components
export { AudioUnlockModal } from "./components/AudioUnlockModal";
export { AvatarStage } from "./components/AvatarStage";
export { ChatPanel } from "./components/ChatPanel";
export { LeaveClassroomDialog } from "./components/LeaveClassroomDialog";
export { LectureScriptModal } from "./components/LectureScriptModal";
export { MediaPanel } from "./components/MediaPanel";
export { ParticipantsModal } from "./components/ParticipantsModal";
export { ProjectionBoard } from "./components/ProjectionBoard";
export { QuestionInput } from "./components/QuestionInput";
export { SessionController } from "./components/SessionController";
export { SessionProgressHUD } from "./components/SessionProgressHUD";
export { SubtitleBar } from "./components/SubtitleBar";
export { VolumeControl } from "./components/VolumeControl";

// Hooks
export { useClassroom } from "./hooks/useClassroom";
export { useClassroomSync } from "./hooks/useClassroomSync";
export { useSpeechQueue } from "./hooks/useSpeechQueue";

// Store
export { useClassroomStore } from "./store/classroomStore";

// Services
export { fetchSpeechTTS } from "./services/tts";

// Types
export type {
  SessionStateStatus,
  ClassroomEvent,
  ClassroomParticipant,
  InterruptionItem,
  QueueItem,
} from "./types/classroom";
export type {
  BaseLectureItem,
  LectureSpeechItem,
  LecturePauseItem,
  LectureEngagementItem,
  LectureImageItem,
  LectureVideoItem,
  LectureItem,
  ParsedLecture,
} from "./types/lecture-item";
export { parseLectureScript } from "./types/lecture-item";
export type {
  SpeechStatus,
  SpeechItem,
  TTSFetchOptions,
} from "./types/speech";
