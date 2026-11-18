import { create } from "zustand";
import type { SessionStateStatus, ClassroomParticipant } from "../types/classroom";
import type { SpeechItem } from "../types/speech";
import type { LectureItem } from "../types/lecture-item";
import type { SessionRoadmap } from "../types/roadmap";

export interface MediaDisplay {
  type: "image" | "video";
  url: string;
  caption?: string;
}

export interface ClassroomStoreState {
  // Session & Broadcaster State
  sessionId: string | null;
  topic: string;
  status: SessionStateStatus;
  stoppedReason?: string;
  isLecturer: boolean;
  sequence: number;
  teachingMode: "live" | "scripted";

  // Roadmap & Live Progression
  roadmap: SessionRoadmap | null;
  currentTopicId: string | null;
  liveRms: number;

  // Lecture Items & Playback
  items: LectureItem[];
  currentIndex: number;
  currentSubtitle: string;
  currentSpeech: SpeechItem | null;
  activeMedia: MediaDisplay | null;
  audioUnlocked: boolean;

  // Q&A and Interactivity
  isThinking: boolean;
  userQuestion: string;

  // Realtime Presence & Admissions
  myAdmissionStatus: "admitted" | "waiting" | "denied";
  participants: ClassroomParticipant[];
  activeStudentCount: number;
  activeLecturerCount: number;
  emptyRoomCountdown: number | null;

  // Store Actions
  setSessionId: (id: string) => void;
  setTopic: (topic: string) => void;
  setStatus: (status: SessionStateStatus) => void;
  setStoppedReason: (reason?: string) => void;
  setIsLecturer: (isLecturer: boolean) => void;
  setSequence: (seq: number) => void;
  setTeachingMode: (mode: "live" | "scripted") => void;
  setRoadmap: (roadmap: SessionRoadmap | null) => void;
  setCurrentTopicId: (topicId: string | null) => void;
  setLiveRms: (rms: number) => void;
  setItems: (items: LectureItem[]) => void;
  setCurrentIndex: (index: number) => void;
  setCurrentSubtitle: (subtitle: string) => void;
  setCurrentSpeech: (speech: SpeechItem | null) => void;
  setActiveMedia: (media: MediaDisplay | null) => void;
  setAudioUnlocked: (unlocked: boolean) => void;
  setIsThinking: (isThinking: boolean) => void;
  setUserQuestion: (q: string) => void;
  setMyAdmissionStatus: (status: "admitted" | "waiting" | "denied") => void;
  setParticipants: (participants: ClassroomParticipant[]) => void;
  setActiveStudentCount: (count: number) => void;
  setActiveLecturerCount: (count: number) => void;
  setEmptyRoomCountdown: (seconds: number | null) => void;
  resetStore: () => void;
}

const initialState = {
  sessionId: null,
  topic: "",
  status: "created" as SessionStateStatus,
  stoppedReason: undefined,
  isLecturer: false,
  sequence: 0,
  teachingMode: "live" as "live" | "scripted",
  roadmap: null as SessionRoadmap | null,
  currentTopicId: null as string | null,
  liveRms: 0,
  items: [],
  currentIndex: 0,
  currentSubtitle: "Ready to begin lecture.",
  currentSpeech: null,
  activeMedia: null,
  audioUnlocked: false,
  isThinking: false,
  userQuestion: "",
  myAdmissionStatus: "waiting" as "admitted" | "waiting" | "denied",
  participants: [],
  activeStudentCount: 0,
  activeLecturerCount: 0,
  emptyRoomCountdown: null,
};

export const useClassroomStore = create<ClassroomStoreState>((set) => ({
  ...initialState,

  setSessionId: (sessionId) => set({ sessionId }),
  setTopic: (topic) => set({ topic }),
  setStatus: (status) => set({ status }),
  setStoppedReason: (stoppedReason) => set({ stoppedReason }),
  setIsLecturer: (isLecturer) => set({ isLecturer }),
  setSequence: (sequence) => set({ sequence }),
  setTeachingMode: (teachingMode) => set({ teachingMode }),
  setRoadmap: (roadmap) => set({ roadmap }),
  setCurrentTopicId: (currentTopicId) => set({ currentTopicId }),
  setLiveRms: (liveRms) => set({ liveRms }),
  setItems: (items) => set({ items }),
  setCurrentIndex: (currentIndex) => set({ currentIndex }),
  setCurrentSubtitle: (currentSubtitle) => set({ currentSubtitle }),
  setCurrentSpeech: (currentSpeech) => set({ currentSpeech }),
  setActiveMedia: (activeMedia) => set({ activeMedia }),
  setAudioUnlocked: (audioUnlocked) => set({ audioUnlocked }),
  setIsThinking: (isThinking) => set({ isThinking }),
  setUserQuestion: (userQuestion) => set({ userQuestion }),
  setMyAdmissionStatus: (myAdmissionStatus) => set({ myAdmissionStatus }),
  setParticipants: (participants) => set({ participants }),
  setActiveStudentCount: (activeStudentCount) => set({ activeStudentCount }),
  setActiveLecturerCount: (activeLecturerCount) => set({ activeLecturerCount }),
  setEmptyRoomCountdown: (emptyRoomCountdown) => set({ emptyRoomCountdown }),
  resetStore: () => set(initialState),
}));
