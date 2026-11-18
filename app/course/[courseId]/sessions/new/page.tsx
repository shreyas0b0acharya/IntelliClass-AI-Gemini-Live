"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useIsMounted } from "@/hooks/useIsMounted";
import { api } from "@/lib/api";
import {
  getModelPreferences,
  GenderSelector,
  VoiceSpeedControls,
} from "@/features/settings";
import type { Course, CourseRoadmapItem, StudentGroup, MediaAsset } from "@/lib/supabase/types";
import { ThemeToggle } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  FileText,
  ShieldCheck,
  Radio,
  MapPin,
  Users,
  Check,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { LectureScriptModal } from "@/features/classroom";
import type { SessionRoadmap } from "@/features/classroom/types/roadmap";
import { cn } from "@/lib/utils";

// Pure CSR Dynamic Import for 3D Avatar Preview (skips SSR evaluation)
const AvatarPreview = dynamic(
  () => import("@/features/avatar/components/AvatarPreview").then((m) => m.AvatarPreview),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[320px] flex flex-col items-center justify-center gap-3 bg-muted/20 rounded-2xl border border-border/40 select-none">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground font-medium">Loading 3D preview...</span>
      </div>
    ),
  }
);

export default function NewSessionPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const router = useRouter();

  // Course, Roadmaps & Student Groups State
  const hasMounted = useIsMounted();
  const [course, setCourse] = useState<Course | null>(null);
  const [roadmaps, setRoadmaps] = useState<CourseRoadmapItem[]>([]);
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string>("");
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Form Fields
  const [topic, setTopic] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [voiceId, setVoiceId] = useState("Fenrir");
  const [speed, setSpeed] = useState(1.0);
  const [customPrompt, setCustomPrompt] = useState("");

  // Scheduling State
  const [isSchedulingOpen, setIsSchedulingOpen] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState("");

  // Submission & Script Modal State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const [generatedRoadmap, setGeneratedRoadmap] = useState<SessionRoadmap | null>(null);
  const [showScriptModal, setShowScriptModal] = useState(false);

  // Load Course, Roadmaps, Student Groups & Model Preferences
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [courseRes, rmRes, groupRes, mediaRes] = await Promise.all([
          api.getCourse(courseId),
          api.getCourseRoadmaps(courseId).catch(() => ({ roadmaps: [] })),
          api.getStudentGroups().catch(() => ({ groups: [] })),
          api.getMediaAssets(courseId).catch(() => ({ assets: [] })),
        ]);

        if (!isMounted) return;
        setCourse(courseRes.course);

        const fetchedRoadmaps = rmRes?.roadmaps || [];
        setRoadmaps(fetchedRoadmaps);
        if (fetchedRoadmaps.length > 0) {
          const first = fetchedRoadmaps[0];
          setSelectedRoadmapId(first.id);
          setTopic(first.title);
        }

        const fetchedGroups = groupRes?.groups || [];
        setStudentGroups(fetchedGroups);
        // Pre-select all groups for immediate direct access by default
        setSelectedGroupIds(fetchedGroups.map((g) => g.id));

        if (mediaRes?.assets) setMediaAssets(mediaRes.assets);

        // Load stored avatar & voice preferences
        const prefs = getModelPreferences();
        const initialGender = prefs.defaultGender || "male";
        setGender(initialGender);
        setVoiceId(initialGender === "female" ? prefs.defaultFemaleVoice : prefs.defaultMaleVoice);
        setSpeed(prefs.speechSpeed || 1.0);
      } catch (err) {
        console.error("Failed to load initial data for new session:", err);
        toast.error("Failed to load course details.");
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [courseId]);

  // Sync voice when gender changes
  const handleGenderChange = (newGender: "male" | "female") => {
    setGender(newGender);
    if (newGender === "female") {
      setVoiceId("Aoede");
    } else {
      setVoiceId("Fenrir");
    }
  };

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

  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const selectAllGroups = () => {
    setSelectedGroupIds(studentGroups.map((g) => g.id));
  };

  const deselectAllGroups = () => {
    setSelectedGroupIds([]);
  };

  // Submission handler: Create Session + Load/Generate AI Lecture Roadmap
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!topic.trim()) {
      toast.error("Please enter a lecture topic.");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("Creating Gemini Live classroom session...");

    try {
      console.log("📝 [New Session] Creating Gemini Live session for topic:", topic);
      const avatarModel = gender === "female" ? "women-avatarsdk" : "men-avatarsdk";
      const { session } = await api.createCourseSession(courseId, {
        topic: topic.trim(),
        voice_id: voiceId,
        avatar_model: avatarModel,
        speech_speed: speed,
        assigned_group_ids: selectedGroupIds,
        roadmap: activeRoadmap?.roadmap || undefined,
      });

      setCreatedSessionId(session.id);

      // If roadmap was already selected, use it directly (already grounded in materials)
      if (activeRoadmap?.roadmap) {
        setGeneratedRoadmap(activeRoadmap.roadmap);
        setIsSubmitting(false);
        setStatusMessage("");
        setShowScriptModal(true);
        toast.success("AI Topic Roadmap prepared from selected curriculum! Click 'Start Live Broadcast' to launch.");
      } else {
        // Dynamic standalone lecture topic without existing roadmap
        setStatusMessage("AI Professor is generating 4-to-8 interactive roadmap topics via Gemini AI...");
        console.log(`🤖 [New Session] Calling generateRoadmap for session ${session.id}...`);
        const roadmapRes = await api.generateRoadmap(session.id, {
          lectureTopic: topic.trim(),
          targetDurationMinutes: 30,
          customPrompt: customPrompt.trim() || undefined,
        });

        console.log(`✅ [New Session] Generated dynamic roadmap for session ${session.id}`);
        setGeneratedRoadmap(roadmapRes.roadmap);
        setIsSubmitting(false);
        setStatusMessage("");
        setShowScriptModal(true);
        toast.success("AI Topic Roadmap prepared! Click 'Start Live Broadcast' to launch the classroom.");
      }
    } catch (err: unknown) {
      console.error("❌ [New Session] Create session error:", err);
      let msg = err instanceof Error ? err.message : "Failed to create session";
      if (
        msg.includes("503") ||
        msg.includes("high demand") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("Service Unavailable")
      ) {
        msg = "The AI model is currently experiencing high demand. Please try again in a few moments.";
      }
      toast.error(msg, { duration: 7000 });
      setIsSubmitting(false);
      setStatusMessage("");
    }
  };

  const handleLaunchLiveSession = () => {
    if (!createdSessionId) return;
    setShowScriptModal(false);
    router.push(`/classroom/${createdSessionId}`);
  };

  const handleSaveDraft = async () => {
    if (!topic.trim()) {
      toast.error("Please enter a lecture topic.");
      return;
    }
    setIsSubmitting(true);
    try {
      const avatarModel = gender === "female" ? "women-avatarsdk" : "men-avatarsdk";
      await api.createCourseSession(courseId, {
        topic: topic.trim(),
        voice_id: voiceId,
        avatar_model: avatarModel,
        speech_speed: speed,
        status: "draft",
        assigned_group_ids: selectedGroupIds,
        roadmap: activeRoadmap?.roadmap || undefined,
      });
      toast.success("Session saved as draft!");
      router.push(`/course/${courseId}?tab=classes`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save draft.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScheduleSession = async () => {
    if (!topic.trim()) {
      toast.error("Please enter a lecture topic.");
      return;
    }
    if (!scheduleDateTime) {
      setIsSchedulingOpen(true);
      toast.info("Please pick a scheduled date and time.");
      return;
    }
    setIsSubmitting(true);
    try {
      const avatarModel = gender === "female" ? "women-avatarsdk" : "men-avatarsdk";
      const targetEpochMs = new Date(scheduleDateTime).getTime();
      await api.createCourseSession(courseId, {
        topic: topic.trim(),
        voice_id: voiceId,
        avatar_model: avatarModel,
        speech_speed: speed,
        status: "scheduled",
        target_epoch_ms: targetEpochMs,
        assigned_group_ids: selectedGroupIds,
        roadmap: activeRoadmap?.roadmap || undefined,
      });
      toast.success(`Session scheduled for ${new Date(scheduleDateTime).toLocaleString()}`);
      router.push(`/course/${courseId}?tab=classes`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to schedule session.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hasMounted || loadingInitial) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 bg-background">
        <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/10 flex items-center justify-center text-primary animate-spin">
          <Loader2 className="h-6 w-6" />
        </div>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Loading Lecture Studio...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted dark:bg-background text-foreground dark:text-foreground flex flex-col">
      {/* ── Sticky Action Bar (Frosted Glass Header) ───────────────────────── */}
      <header className="sticky top-0 z-30 h-16 px-6 sm:px-8 flex items-center justify-between border-b border-black/5 dark:border-white/10 backdrop-blur-md bg-white/70 dark:bg-background/70 transition-all">
        <div className="flex items-center gap-4 min-w-0">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-9"
          >
            <Link href={`/course/${courseId}`} className="inline-flex items-center justify-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span>{course?.title || "Course Space"}</span>
            </Link>
          </Button>

          <div className="h-4 w-px bg-black/10 dark:bg-white/15 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <h1 className="text-sm sm:text-base font-bold tracking-tight truncate">
              New AI Broadcast Lecture
            </h1>
          </div>
        </div>

        {/* Action Controls - 3 Choices */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(`/course/${courseId}`)}
            disabled={isSubmitting}
            className="text-xs"
          >
            <span>Cancel</span>
          </Button>

          {/* Choice 1: Save Draft */}
          <Button
            type="button"
            variant="secondary"
            onClick={handleSaveDraft}
            disabled={isSubmitting || !topic.trim()}
            className="h-9 text-xs font-semibold"
          >
            <span>💾 Save Draft</span>
          </Button>

          {/* Choice 2: Start Later */}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!isSchedulingOpen) {
                setIsSchedulingOpen(true);
              } else if (scheduleDateTime) {
                handleScheduleSession();
              } else {
                toast.info("Please pick a scheduled date and time.");
              }
            }}
            disabled={isSubmitting || !topic.trim()}
            className="h-9 text-xs font-semibold"
          >
            <span>📅 {isSchedulingOpen && scheduleDateTime ? "Confirm Schedule" : "Start Later"}</span>
          </Button>

          {/* Choice 3: Start Now (Live Broadcast) */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !topic.trim()}
            variant="default"
            aria-label="Create Live Gemini Classroom - Start Now"
            className="bg-primary hover:bg-primary/90 h-9 font-semibold text-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 mr-1.5" />
                <span>Preparing...</span>
              </>
            ) : (
              <>
                <Radio className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
                <span>▶️ Start Now</span>
              </>
            )}
          </Button>

          <div className="h-4 w-px bg-black/10 dark:bg-white/15 hidden sm:block" />

          <ThemeToggle />
        </div>
      </header>

      {/* ── Main Studio Layout ────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Progress Alert during generation */}
        {isSubmitting && statusMessage && (
          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
            <div>
              <p className="text-xs font-bold text-primary">Preparing Live Classroom</p>
              <p className="text-xs text-muted-foreground">{statusMessage}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ═════════════════════════════════════════════════════════════════
              LEFT COLUMN: LECTURE DEFINITION, ROADMAP & COHORTS (7 Cols)
             ═════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 space-y-6">
            {/* Delivery Engine Mode Selector */}
            <div className="bg-white dark:bg-card rounded-2xl border border-black/5 dark:border-white/5 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Classroom Delivery Engine
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Real-time conversational instruction powered by Google Gemini Live
                  </p>
                </div>
              </div>

              <div className="pt-1">
                {/* Gemini Live Mode Card */}
                <div
                  role="button"
                  tabIndex={0}
                  data-testid="mode-card-gemini-live"
                  className="relative rounded-2xl p-4 border-2 border-primary bg-primary/[0.04] dark:bg-primary/[0.08] shadow-sm ring-1 ring-primary/20 flex flex-col justify-between gap-3 text-left group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-primary text-primary-foreground shadow-xs">
                        <Radio className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-foreground">Gemini Live AI</span>
                          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Active Engine
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Real-time Conversational AI
                        </p>
                      </div>
                    </div>
                    <div className="w-4 h-4 rounded-full border-2 border-primary bg-primary flex items-center justify-center shrink-0 mt-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Dynamic 4–8 topic roadmap grounded in your course materials. Supports live 2-way student voice Q&amp;A, conversational pacing, and LiveKit WebRTC audio.
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/40 text-[10px] text-muted-foreground font-medium">
                    <span className="bg-black/[0.03] dark:bg-white/[0.05] px-2 py-0.5 rounded-md">
                      ⚡ 3s Generation
                    </span>
                    <span className="bg-black/[0.03] dark:bg-white/[0.05] px-2 py-0.5 rounded-md">
                      🎙️ Live Q&amp;A
                    </span>
                    <span className="bg-black/[0.03] dark:bg-white/[0.05] px-2 py-0.5 rounded-md">
                      🗺️ Grounded Topics
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Inset Card 1: Lecture Topic */}
            <div className="bg-white dark:bg-card rounded-2xl border border-black/5 dark:border-white/5 p-6 mb-6 shadow-xs space-y-4">
              <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-4">
                Lecture Topic
              </h2>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="topic">
                    Lesson Topic <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Concurrency &amp; Multithreading in Java"
                    className="h-11"
                  />
                </div>

                {/* Auto-generated Meeting Code Informational Badge */}
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-xs leading-relaxed">
                    A unique, cryptographically secure student access code (<span className="font-mono text-primary font-semibold">cls-xxxx-xxxx</span>) will be automatically assigned upon creation.
                  </p>
                </div>

                {/* Scheduling Date/Time Field */}
                {isSchedulingOpen && (
                  <div className="p-3.5 rounded-xl border border-sky-500/30 bg-sky-500/5 space-y-2 animate-in fade-in">
                    <Label htmlFor="schedule-time" className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                      Scheduled Broadcast Date &amp; Time *
                    </Label>
                    <Input
                      id="schedule-time"
                      type="datetime-local"
                      value={scheduleDateTime}
                      onChange={(e) => setScheduleDateTime(e.target.value)}
                      disabled={isSubmitting}
                      className="h-10 text-xs bg-white dark:bg-card"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Inset Card 2: Curriculum Roadmap (Carries Associated Grounded Sources) */}
            <div className="bg-white dark:bg-card rounded-2xl border border-black/5 dark:border-white/5 p-6 mb-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-chart-4/10 flex items-center justify-center text-chart-4">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Curriculum Roadmap
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                      Sources and learning objectives are inherited directly from your roadmap
                    </p>
                  </div>
                </div>

                {linkedSources.length > 0 && (
                  <span className="text-xs font-semibold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded-full">
                    {linkedSources.length} Grounded Source{linkedSources.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {roadmaps.length > 0 ? (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {roadmaps.map((rm) => {
                      const isSelected = selectedRoadmapId === rm.id;
                      const sourcesCount = rm.roadmap?.sources?.length || 0;
                      return (
                        <button
                          type="button"
                          key={rm.id}
                          onClick={() => handleRoadmapSelect(rm.id)}
                          className={cn(
                            "p-3.5 rounded-xl border text-left transition-all cursor-pointer",
                            isSelected
                              ? "border-primary bg-primary/10 ring-1 ring-primary/30 text-foreground"
                              : "border-border/60 bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold truncate text-foreground">{rm.title}</span>
                            {isSelected && <Check className="h-4 w-4 text-primary shrink-0 ml-1" />}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1.5">
                            <span>{rm.topicsCount} Topics</span>
                            <span>&bull;</span>
                            <span className="text-sky-600 dark:text-sky-400 font-medium">
                              {sourcesCount} Source{sourcesCount !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </button>
                      );
                    })}

                    {/* Custom Standalone Lecture Option */}
                    <button
                      type="button"
                      onClick={() => handleRoadmapSelect("custom")}
                      className={cn(
                        "p-3.5 rounded-xl border text-left transition-all cursor-pointer",
                        selectedRoadmapId === "custom" || (!selectedRoadmapId && roadmaps.length > 0)
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30 text-foreground"
                          : "border-dashed border-border/60 bg-muted/10 hover:bg-muted/30 text-muted-foreground"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">Custom Ad-hoc Topic</span>
                        {(selectedRoadmapId === "custom" || !selectedRoadmapId) && (
                          <Check className="h-4 w-4 text-primary shrink-0 ml-1" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Generate topics dynamically without a roadmap
                      </p>
                    </button>
                  </div>

                  {/* Grounded Sources Display */}
                  {linkedSources.length > 0 ? (
                    <div className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/20 text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-sky-600 dark:text-sky-400 text-xs">
                        <FileText className="h-3.5 w-3.5" />
                        <span>Inherited Reference Sources:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {linkedSources.map((src, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-lg bg-card border border-border/60 text-[11px] font-medium text-foreground flex items-center gap-1.5 shadow-2xs"
                          >
                            <FileText className="h-3 w-3 text-sky-500" />
                            {src}
                          </span>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground pt-1">
                        The AI Professor will automatically ground lecture explanations, quiz questions, and slides in these indexed materials.
                      </p>
                    </div>
                  ) : selectedRoadmapId && selectedRoadmapId !== "custom" ? (
                    <div className="p-3 rounded-xl bg-muted/30 border border-border/50 text-xs text-muted-foreground">
                      This roadmap has no linked source files. Topics will use general AI knowledge.
                    </div>
                  ) : null}

                  <div className="flex items-center justify-end pt-1">
                    <Link
                      href={`/course/${courseId}?tab=roadmaps`}
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <span>Manage Roadmaps in Course Space</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2 text-center">
                  <p className="text-xs text-muted-foreground">
                    No roadmaps published in this Course Space yet. You can enter a topic above, or create a roadmap in the Roadmaps tab to ground your classes in uploaded materials.
                  </p>
                  <Button asChild variant="outline" size="xs" className="mt-1">
                    <Link href={`/course/${courseId}?tab=roadmaps`}>
                      <MapPin className="h-3.5 w-3.5 mr-1 text-chart-4" />
                      <span>Create Grounded Roadmap</span>
                    </Link>
                  </Button>
                </div>
              )}
            </div>

            {/* Inset Card 3: Student Groups Direct Access */}
            <div className="bg-white dark:bg-card rounded-2xl border border-black/5 dark:border-white/5 p-6 mb-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Grant Direct Access (Student Groups)
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                      Enrolled students enter directly without waiting room approval
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {studentGroups.length > 0 && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={selectAllGroups}
                        className="h-6 text-[11px] px-2 text-primary"
                      >
                        Select All
                      </Button>
                      <span className="text-muted-foreground text-xs">•</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={deselectAllGroups}
                        className="h-6 text-[11px] px-2 text-muted-foreground"
                      >
                        Deselect All
                      </Button>
                    </>
                  )}
                  <Link
                    href="/students"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1 ml-1"
                  >
                    <span>Manage Groups</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              {studentGroups.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {studentGroups.map((group) => {
                    const isChecked = selectedGroupIds.includes(group.id);
                    const memberCount = group.members_count ?? (group.members?.length || 0);
                    return (
                      <div
                        key={group.id}
                        onClick={() => toggleGroupSelection(group.id)}
                        className={cn(
                          "p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer select-none transition-all",
                          isChecked
                            ? "bg-emerald-500/5 border-emerald-500/30 text-foreground"
                            : "border-border/60 bg-muted/20 opacity-80 hover:opacity-100"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Checkbox
                            id={`group-${group.id}`}
                            checked={isChecked}
                            onCheckedChange={() => toggleGroupSelection(group.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="cursor-pointer"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{group.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {memberCount} Student{memberCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>

                        {group.description && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border/40 shrink-0">
                            {group.description}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2 text-center">
                  <p className="text-xs text-muted-foreground">
                    No student groups created yet. You can create reusable student groups in the Students Management page.
                  </p>
                  <Button asChild variant="outline" size="xs">
                    <Link href="/students">
                      <Users className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                      <span>Create Student Groups</span>
                    </Link>
                  </Button>
                </div>
              )}
            </div>

            {/* Inset Card 4: Teaching Directives & Focus Area */}
            <div className="bg-white dark:bg-card rounded-2xl border border-black/5 dark:border-white/5 p-6 mb-6 shadow-xs space-y-4">
              <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-4">
                Teaching Directives &amp; Focus Area (Optional)
              </h2>

              <Textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. Emphasize synchronized blocks and deadlock avoidance. Include a real-world banking transaction example. Keep tone engaging and encouraging for undergraduates."
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════
              RIGHT COLUMN: 3D AVATAR & KOKORO VOICE STUDIO (5 Cols)
              Matching Settings page pixel-for-pixel with sticky positioning
             ═════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 sticky top-20 space-y-6">
            {/* Section: Instructor Persona & Voice Controls */}
            <div className="bg-white dark:bg-card rounded-2xl border border-black/5 dark:border-white/5 p-6 shadow-xs space-y-5">
              <div className="space-y-0.5">
                <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Instructor Persona &amp; Voice
                </h2>
                <p className="text-xs text-muted-foreground">
                  Select the 3D instructor model and Gemini Live neural voice profile for this lecture.
                </p>
              </div>

              {/* Reusable Gender Selector Component */}
              <GenderSelector
                value={gender}
                onChange={handleGenderChange}
                disabled={isSubmitting}
              />

              {/* Reusable Voice & Speed Controls Component */}
              <VoiceSpeedControls
                gender={gender}
                voiceId={voiceId}
                onVoiceChange={setVoiceId}
                speed={speed}
                onSpeedChange={setSpeed}
                disabled={isSubmitting}
              />
            </div>

            {/* Section: 3D Viewport Preview (Exact Settings Style) */}
            <div className="bg-white dark:bg-card rounded-3xl border border-black/10 dark:border-white/10 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-foreground dark:text-foreground">
                    {gender === "male" ? "Prof. Arthur" : "Dr. Clara"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {gender === "male" ? "Male Avatar Mesh" : "Female Avatar Mesh"} &bull; Real-time 3D Viewport
                  </p>
                </div>
                <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20">
                  ACTIVE
                </span>
              </div>

              {/* 3D Canvas Preview Frame */}
              <AvatarPreview
                gender={gender}
                isSpeaking={false}
                className="w-full h-72 rounded-2xl"
              />
            </div>
          </div>
        </div>
      </main>

      {/* Pre-Flight Gemini Live Lecture Roadmap Review */}
      {createdSessionId && (
        <LectureScriptModal
          open={showScriptModal}
          onOpenChange={setShowScriptModal}
          topic={topic}
          isLecturer={true}
          status="created"
          sessionId={createdSessionId}
          roadmap={generatedRoadmap}
          lectureMode="gemini_live"
          initialViewMode="roadmap"
          onGenerateRoadmap={async () => {
            if (!createdSessionId) return;
            const res = await api.generateRoadmap(createdSessionId, {
              lectureTopic: topic.trim(),
              customPrompt: customPrompt.trim() || undefined,
            });
            if (res?.roadmap) {
              setGeneratedRoadmap(res.roadmap);
              toast.success("AI lecture roadmap updated!");
            }
          }}
          onStartSession={handleLaunchLiveSession}
        />
      )}
    </div>
  );
}