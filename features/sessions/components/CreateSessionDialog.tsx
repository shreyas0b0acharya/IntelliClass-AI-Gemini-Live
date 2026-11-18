"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  useModelPreferences,
  MALE_MODEL_PRESETS,
  FEMALE_MODEL_PRESETS,
  GenderSelector,
  ModelNameInput,
  VoiceSpeedControls,
} from "@/features/settings";
import {
  DEFAULT_MALE_VOICE_ID,
  DEFAULT_FEMALE_VOICE_ID,
  DEFAULT_SPEECH_SPEED,
  DEFAULT_MALE_AVATAR_MODEL,
  DEFAULT_FEMALE_AVATAR_MODEL,
} from "@/config";
import type { CourseFile, CourseRoadmapItem, StudentGroup } from "@/lib/supabase/types";
import { AvatarPreview, type HeadTTSData } from "@/features/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Presentation, Loader2, Sparkles, Plus, FileText, MapPin, Users, ShieldCheck, Check } from "lucide-react";
import { toast } from "sonner";

interface CreateSessionDialogProps {
  courseId: string;
  courseTitle?: string;
  trigger?: React.ReactNode;
}

function CreateSessionModalContent({
  courseId,
  onClose,
}: {
  courseId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { preferences } = useModelPreferences();

  const [topic, setTopic] = useState("");
  const [gender, setGender] = useState<"male" | "female">(
    () => preferences.defaultGender || "male"
  );
  const [lecturerName, setLecturerName] = useState(
    () =>
      (preferences.defaultGender === "female"
        ? preferences.defaultFemaleModelName
        : preferences.defaultMaleModelName) || "Prof. Arthur"
  );
  const [voiceId, setVoiceId] = useState(
    () =>
      (preferences.defaultGender === "female"
        ? preferences.defaultFemaleVoice
        : preferences.defaultMaleVoice) || DEFAULT_MALE_VOICE_ID
  );
  const [speed, setSpeed] = useState(() => preferences.speechSpeed || DEFAULT_SPEECH_SPEED);
  
  // Roadmap & Student Groups State (replaces manual file selection)
  const [roadmaps, setRoadmaps] = useState<CourseRoadmapItem[]>([]);
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string>("");
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [statusStep, setStatusStep] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");

  // HeadTTS preview state & LipSync
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [previewAudioPath, setPreviewAudioPath] = useState<string | undefined>();
  const [previewLipSyncData, setPreviewLipSyncData] = useState<HeadTTSData | undefined>();

  useEffect(() => {
    let active = true;
    Promise.all([
      api.getCourseRoadmaps(courseId).catch(() => ({ roadmaps: [] })),
      api.getStudentGroups().catch(() => ({ groups: [] })),
    ])
      .then(([rmRes, groupRes]) => {
        if (!active) return;
        if (rmRes?.roadmaps) {
          setRoadmaps(rmRes.roadmaps);
          if (rmRes.roadmaps.length > 0) {
            const first = rmRes.roadmaps[0];
            setSelectedRoadmapId(first.id);
            setTopic(first.title);
          }
        }
        if (groupRes?.groups) {
          setStudentGroups(groupRes.groups);
          // By default, pre-select all groups for convenience
          setSelectedGroupIds(groupRes.groups.map((g) => g.id));
        }
      })
      .catch((err) => console.error("Error loading roadmaps and groups in modal:", err));

    return () => {
      active = false;
    };
  }, [courseId]);

  const activeRoadmap = roadmaps.find((r) => r.id === selectedRoadmapId) || null;
  const linkedSources: string[] = activeRoadmap?.roadmap?.sources?.map((s: any) => s.fileName) || [];

  const handleRoadmapSelect = (rmId: string) => {
    setSelectedRoadmapId(rmId);
    if (rmId === "custom") {
      setTopic("");
    } else {
      const rm = roadmaps.find((r) => r.id === rmId);
      if (rm) {
        setTopic(rm.title);
      }
    }
  };

  // When gender toggle is switched in the modal, update prefilled name & voice for that gender
  const handleGenderChange = (newGender: "male" | "female") => {
    setGender(newGender);
    setPreviewAudioPath(undefined);
    setPreviewLipSyncData(undefined);
    setIsTestingVoice(false);
    if (newGender === "male") {
      setLecturerName(preferences.defaultMaleModelName);
      setVoiceId(DEFAULT_MALE_VOICE_ID);
    } else {
      setLecturerName(preferences.defaultFemaleModelName);
      setVoiceId(DEFAULT_FEMALE_VOICE_ID);
    }
  };

  const handleExecution = async (action: "start_now" | "start_later" | "save_draft") => {
    if (!topic.trim()) {
      toast.error("Please provide a lecture topic.");
      return;
    }

    if (action === "start_later" && !scheduleDate) {
      setIsScheduling(true);
      toast.info("Please pick a scheduled date and time.");
      return;
    }

    setIsTestingVoice(false);
    setIsGenerating(true);
    setStatusStep(
      action === "start_now"
        ? "Initializing live broadcast classroom..."
        : action === "start_later"
        ? "Scheduling session..."
        : "Saving session draft..."
    );

    try {
      const avatarModel = gender === "female" ? DEFAULT_FEMALE_AVATAR_MODEL : DEFAULT_MALE_AVATAR_MODEL;
      const targetEpochMs = scheduleDate ? new Date(scheduleDate).getTime() : undefined;
      const status = action === "start_now" ? "created" : action === "start_later" ? "scheduled" : "draft";

      const { session: sessionData } = await api.createCourseSession(courseId, {
        topic: topic.trim(),
        voice_id: voiceId,
        avatar_model: avatarModel,
        speech_speed: speed,
        status,
        target_epoch_ms: targetEpochMs,
        assigned_group_ids: selectedGroupIds,
        roadmap: activeRoadmap?.roadmap || undefined,
      });

      if (!sessionData) {
        throw new Error("Failed to initialize session.");
      }

      const sessionId = sessionData.id;

      // Only generate dynamic roadmap if custom standalone class without existing roadmap
      if (!activeRoadmap && action === "start_now") {
        setStatusStep(`Generating AI lecture roadmap with ${lecturerName || "AI Professor"}...`);
        await api.generateRoadmap(sessionId, {
          lectureTopic: topic.trim(),
          customPrompt: lecturerName ? `You are ${lecturerName}, an expert professor.` : undefined,
        }).catch((err) => console.warn("Roadmap generation warning:", err));
      }

      if (action === "start_now") {
        toast.success("Live AI Classroom initialized!");
        onClose();
        router.push(`/classroom/${sessionId}`);
      } else if (action === "start_later") {
        toast.success(`Session scheduled for ${new Date(scheduleDate).toLocaleString()}`);
        onClose();
      } else {
        toast.success("Class draft saved successfully!");
        onClose();
      }
    } catch (err: unknown) {
      console.error("Create session error:", err);
      let msg = err instanceof Error ? err.message : "Failed to generate classroom session.";
      if (
        msg.includes("503") ||
        msg.includes("high demand") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("Service Unavailable")
      ) {
        msg = "The AI model is currently experiencing high demand. Please try again in a few moments.";
      }
      toast.error(msg, { duration: 7000 });
    } finally {
      setIsGenerating(false);
      setStatusStep("");
    }
  };

  const currentPresets = gender === "male" ? MALE_MODEL_PRESETS : FEMALE_MODEL_PRESETS;
  const previewPrompt = `Hello class! I am ${lecturerName || "your professor"}. Today we will explore ${topic.trim() ? topic.trim() : "interactive curriculum concepts"
    }.`;

  return (
    <>
      {/* Header */}
      <div className="bg-black/[0.02] dark:bg-white/[0.02] p-6 border-b border-black/5 dark:border-white/10 shrink-0">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
 <DialogTitle className="">
                Launch AI Lecture
              </DialogTitle>
 <DialogDescription className="">
                Customize your 3D lecturer persona, topic roadmap, and Gemini Live audio.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
      </div>

      {/* Scrollable Form Content */}
      <form onSubmit={(e) => { e.preventDefault(); handleExecution("start_now"); }} className="p-6 overflow-y-auto space-y-6 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* ── Left Column: Configuration ─────────────────────────── */}
          <div className="md:col-span-7 space-y-5">
            {/* Lecture Topic */}
            <div className="space-y-2">
              <Label htmlFor="lecture-topic" className="">
                Lecture Topic / Objective *
              </Label>
              <Input
                id="lecture-topic"
                placeholder="e.g. Memory Management & Garbage Collection in JVM"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isGenerating}
                required
                className=" h-11 "
              />
            </div>

            {/* Scheduling Date/Time Picker */}
            {isScheduling && (
              <div className="p-3.5 rounded-xl border border-sky-500/30 bg-sky-500/5 space-y-2 animate-in fade-in">
                <Label htmlFor="schedule-time" className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                  Scheduled Broadcast Date &amp; Time *
                </Label>
                <Input
                  id="schedule-time"
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  disabled={isGenerating}
                  className="h-10 text-xs bg-white dark:bg-card"
                />
              </div>
            )}

            {/* Persona Gender Toggle (Reusable GenderSelector) */}
            <div className="space-y-2">
 <Label className="">
                3D Lecturer Persona Model
              </Label>
              <GenderSelector
                value={gender}
                onChange={handleGenderChange}
                disabled={isGenerating}
              />
            </div>

            {/* Model / Lecturer Name (Reusable ModelNameInput) */}
            <ModelNameInput
              id="lecture-model-name"
              label="Lecturer Model Name"
              value={lecturerName}
              onChange={setLecturerName}
              presets={currentPresets}
              gender={gender}
              disabled={isGenerating}
            />

            {/* Voice Profile & Speed Controls (Reusable VoiceSpeedControls) */}
            <VoiceSpeedControls
              gender={gender}
              voiceId={voiceId}
              onVoiceChange={setVoiceId}
              speed={speed}
              onSpeedChange={setSpeed}
              disabled={isGenerating}
            />

            {/* 1. Course Roadmap Selection (Carries Associated Sources Automatically) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-chart-4" />
                  Course Roadmap (Auto-Links Sources)
                </Label>
                {roadmaps.length === 0 && (
                  <span className="text-[11px] text-muted-foreground">No roadmaps created</span>
                )}
              </div>

              {roadmaps.length > 0 ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {roadmaps.map((rm) => {
                      const isSelected = selectedRoadmapId === rm.id;
                      const sourcesCount = rm.roadmap?.sources?.length || 0;
                      return (
                        <button
                          type="button"
                          key={rm.id}
                          onClick={() => handleRoadmapSelect(rm.id)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            isSelected
                              ? "border-primary bg-primary/10 ring-1 ring-primary/30 text-foreground"
                              : "border-border/60 bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold truncate text-foreground">{rm.title}</span>
                            {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1" />}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                            <span>{rm.topicsCount} Topics</span>
                            <span>&bull;</span>
                            <span>{sourcesCount} Sources</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Display Auto-Linked Sources from selected Roadmap */}
                  {linkedSources.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-sky-500/5 border border-sky-500/20 text-xs flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sky-600 dark:text-sky-400 text-[11px] flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        Linked Sources from Roadmap:
                      </span>
                      {linkedSources.map((src, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-card border border-border/50 text-[11px] font-medium text-foreground">
                          {src}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground">
                  No roadmaps published in this Course Space yet. Create a roadmap in the Roadmaps tab to auto-bind materials.
                </div>
              )}
            </div>

            {/* 2. Student Groups Direct Access Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-emerald-500" />
                  Grant Direct Access (Student Groups)
                </Label>
                <Link href="/students" className="text-[11px] text-primary hover:underline">
                  Manage Groups →
                </Link>
              </div>

              {studentGroups.length > 0 ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {studentGroups.map((group) => {
                      const isAssigned = selectedGroupIds.includes(group.id);
                      return (
                        <button
                          type="button"
                          key={group.id}
                          onClick={() => {
                            setSelectedGroupIds((prev) =>
                              isAssigned ? prev.filter((id) => id !== group.id) : [...prev, group.id]
                            );
                          }}
                          className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                            isAssigned
                              ? "border-emerald-500/40 bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/20"
                              : "border-border/60 bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="text-xs font-bold truncate text-foreground block">{group.name}</span>
                            <span className="text-[11px] text-muted-foreground">{group.members_count || 0} students</span>
                          </div>
                          {isAssigned && <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span>Students in selected groups receive instant admission without waiting rooms.</span>
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground flex items-center justify-between">
                  <span>No student groups created yet.</span>
                  <Link href="/students" className="text-primary font-semibold hover:underline">
                    Create Group
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* ── Right Column: Live 3D Model Render Preview ─────────── */}
          <div className="md:col-span-5 space-y-3">
            <div className="flex items-center justify-between">
 <Label className="">
                3D Avatar &amp; LipSync
              </Label>
              <span className="text-[10px] font-mono text-primary font-semibold">
                {gender === "male" ? DEFAULT_MALE_AVATAR_MODEL : DEFAULT_FEMALE_AVATAR_MODEL}
              </span>
            </div>

            {/* 3D Viewport Preview */}
            <AvatarPreview
              gender={gender}
              isSpeaking={false}
              className="w-full h-60 rounded-2xl"
            />
          </div>
        </div>

        {statusStep && (
          <div className="flex items-center gap-2 text-xs font-medium text-primary animate-pulse p-2 rounded-xl bg-primary/5 border border-primary/15">
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            <span>{statusStep}</span>
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0 pt-3 border-t border-black/5 dark:border-white/5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isGenerating}
            className="h-10 order-last sm:order-first"
          >
            <span>Cancel</span>
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            {/* Choice 1: Save Draft */}
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleExecution("save_draft")}
              disabled={isGenerating || !topic.trim()}
              className="h-10 text-xs font-semibold"
            >
              <span>💾 Save Draft</span>
            </Button>

            {/* Choice 2: Start Later */}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!isScheduling) {
                  setIsScheduling(true);
                } else if (scheduleDate) {
                  handleExecution("start_later");
                } else {
                  toast.info("Please pick a scheduled date and time.");
                }
              }}
              disabled={isGenerating || !topic.trim()}
              className="h-10 text-xs font-semibold"
            >
              <span>📅 {isScheduling && scheduleDate ? "Confirm Schedule" : "Start Later"}</span>
            </Button>

            {/* Choice 3: Start Now */}
            <Button
              type="button"
              onClick={() => handleExecution("start_now")}
              disabled={isGenerating || !topic.trim()}
              variant="default"
              aria-label="Create Live Gemini Classroom - Start Now"
              className="h-10 inline-flex items-center gap-1.5 font-semibold"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  <span>Preparing...</span>
                </>
              ) : (
                <>
                  <Presentation className="h-3.5 w-3.5" />
                  <span>▶️ Start Now</span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </>
  );
}

export function CreateSessionDialog({ courseId, courseTitle: _courseTitle, trigger }: CreateSessionDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button
            variant="default"
 className=" inline-flex items-center "
          >
            <Plus className="h-4 w-4" />
            <span>New AI Lecture</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[80vw] max-w-[80vw] h-[80vh] max-h-[80vh] flex flex-col overflow-hidden p-0">
        {open && <CreateSessionModalContent courseId={courseId} onClose={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
