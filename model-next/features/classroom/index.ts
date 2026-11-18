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
export { Lecturer2DFallback } from "./components/Lecturer2DFallback";
export { ClassroomHeader } from "./components/ClassroomHeader";
export { StageOverlay } from "./components/StageOverlay";
export { MobileViewSwitcher } from "./components/MobileViewSwitcher";
export { ClassroomConfigModal } from "./components/ClassroomConfigModal";
export { SessionPersonaModal } from "./components/SessionPersonaModal";
export { RoadmapInspector } from "./components/RoadmapInspector";
export { GoogleMeetControls } from "./components/GoogleMeetControls";

// Hooks
export { useClassroom } from "./hooks/useClassroom";
export { useClassroomSync } from "./hooks/useClassroomSync";
export { useGeminiLiveSession } from "./hooks/useGeminiLiveSession";
export { useClassroomLayout, type ClassroomLayoutFacts } from "./hooks/useClassroomLayout";

// Store
export { useClassroomStore } from "./store/classroomStore";

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
export type { ClassroomCapabilities } from "./types/capabilities";
export { getCapabilities } from "./types/capabilities";
export type {
  ClassroomInteractionRecord,
  PostClassLearningRecord,
  InteractionSpeaker,
  InteractionType,
} from "./types/interaction";
