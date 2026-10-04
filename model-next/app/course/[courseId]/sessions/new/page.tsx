"use client";

import { use, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  getModelPreferences,
  GenderSelector,
  VoiceSpeedControls,
  HeadTTSTestButton,
} from "@/features/settings";
import type { Course, CourseFile, MediaAsset } from "@/lib/supabase/types";
import { AvatarPreview, type HeadTTSData } from "@/features/avatar";
import { MaterialImageCarousel, MaterialViewerModal } from "@/features/materials";
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
  Upload,
  ShieldCheck,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { parseLectureScript } from "@/features/classroom/types/lecture-item";
import { LectureScriptModal } from "@/features/classroom";

interface SelectedFileConfig {
  selected: boolean;
  startPage?: number;
  endPage?: number;
}

export default function NewSessionPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const router = useRouter();

  // Course & Files State
  const [course, setCourse] = useState<Course | null>(null);
  const [courseFiles, setCourseFiles] = useState<CourseFile[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [selectedViewFile, setSelectedViewFile] = useState<CourseFile | null>(null);

  // Form Fields
  const [topic, setTopic] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [voiceId, setVoiceId] = useState("am_fenrir");
  const [speed, setSpeed] = useState(1.0);
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Record<string, SelectedFileConfig>>({});

  // Direct Inline File Upload State
  const [isUploadingMaterial, setIsUploadingMaterial] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 3D Avatar Preview & Speech Test State
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [previewAudioPath, setPreviewAudioPath] = useState<string | undefined>();
  const [previewLipSyncData, setPreviewLipSyncData] = useState<HeadTTSData | undefined>();
  const [previewPrompt] = useState(
    "Welcome to today's lecture. We will explore key concepts step-by-step."
  );

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // Load Course & Files & Default Preferences
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [courseRes, filesRes, mediaRes] = await Promise.all([
          api.getCourse(courseId),
          api.getCourseFiles(courseId),
          api.getMediaAssets(courseId).catch(() => ({ assets: [] })),
        ]);

        if (!isMounted) return;
        setCourse(courseRes.course);
        setCourseFiles(filesRes.files || []);
        if (mediaRes?.assets) setMediaAssets(mediaRes.assets);

        // Load stored avatar & voice preferences
        const prefs = getModelPreferences();
        const initialGender = prefs.defaultGender || "male";
        setGender(initialGender);
        setVoiceId(initialGender === "female" ? prefs.defaultFemaleVoice : prefs.defaultMaleVoice);
        setSpeed(prefs.speechSpeed || 1.0);

        // Pre-select all available course files by default
        const initialSelected: Record<string, SelectedFileConfig> = {};
        filesRes.files.forEach((f) => {
          initialSelected[f.file_name] = { selected: true };
        });
        setSelectedFiles(initialSelected);
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
      setVoiceId("af_bella");
    } else {
      setVoiceId("am_fenrir");
    }
    setPreviewAudioPath(undefined);
    setPreviewLipSyncData(undefined);
    setIsTestingVoice(false);
  };

  // Handle direct file upload inside new session page
  const handleDirectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    setIsUploadingMaterial(true);
    setUploadProgressText(`Uploading ${file.name}...`);

    try {
      const uploadRes = await api.uploadCourseFile(courseId, file);
      const uploadedFile = uploadRes.file;

      setUploadProgressText("Indexing document content with vector embeddings...");
      try {
        await api.processCourseFile({
          fileUrl: uploadRes.fileUrl,
          fileName: uploadedFile.file_name,
          courseId,
        });
      } catch (procErr) {
        console.warn("Vector processing warning:", procErr);
      }

      // Add to files list and select it immediately
      setCourseFiles((prev) => [uploadedFile, ...prev]);
      setSelectedFiles((prev) => ({
        ...prev,
        [uploadedFile.file_name]: { selected: true },
      }));

      // Refresh media assets so extracted images and diagrams appear immediately
      try {
        const mediaRes = await api.getMediaAssets(courseId);
        if (mediaRes?.assets) {
          setMediaAssets(mediaRes.assets);
        }
      } catch (mediaErr) {
        console.warn("Failed to refresh media assets after direct upload:", mediaErr);
      }

      toast.success(`"${file.name}" uploaded and added to lecture sources!`);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: unknown) {
      console.error("Upload error:", err);
      const msg = err instanceof Error ? err.message : "Failed to upload document.";
      toast.error(msg);
    } finally {
      setIsUploadingMaterial(false);
      setUploadProgressText("");
    }
  };

  // Toggle file selection
  const toggleFileSelection = (fileName: string) => {
    setSelectedFiles((prev) => {
      const current = prev[fileName] || { selected: false };
      return {
        ...prev,
        [fileName]: {
          ...current,
          selected: !current.selected,
        },
      };
    });
  };

  // Update file page range
  const updatePageRange = (
    fileName: string,
    field: "startPage" | "endPage",
    val: string
  ) => {
    const num = val === "" ? undefined : parseInt(val, 10);
    setSelectedFiles((prev) => ({
      ...prev,
      [fileName]: {
        ...prev[fileName],
        [field]: isNaN(num as number) ? undefined : num,
      },
    }));
  };

  // Script Review State
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const [generatedScript, setGeneratedScript] = useState<string>("");
  const [showScriptModal, setShowScriptModal] = useState(false);

  // Submission handler: Create Session + Generate AI Lecture Script
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!topic.trim()) {
      toast.error("Please enter a lecture topic.");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("Creating classroom broadcast session...");

    try {
      // 1. Create Session (Server automatically generates unique meeting code)
      console.log("📝 [New Session] Creating course session for topic:", topic);
      const { session } = await api.createCourseSession(courseId, {
        topic: topic.trim(),
        voice_id: voiceId,
      });

      // 2. Format selected sources
      const sources = Object.entries(selectedFiles)
        .filter(([_, config]) => config.selected)
        .map(([fileName, config]) => ({
          fileName,
          startPage: config.startPage,
          endPage: config.endPage,
        }));

      // 3. Generate Lecture Script with AI Grounding
      const modelPersonaName = gender === "female" ? "Dr. Clara" : "Prof. Arthur";
      setStatusMessage("AI Professor is generating structured lesson script & visual cues via Gemini 2.5 Flash...");
      console.log(`🤖 [New Session] Calling generateSessionScript for session ${session.id} (Model Persona: "${modelPersonaName}")...`);
      const scriptRes = await api.generateSessionScript(session.id, {
        courseId,
        topic: topic.trim(),
        lecturerName: modelPersonaName,
        sources: sources.length > 0 ? sources : undefined,
        customPrompt: customPrompt.trim() || undefined,
        voice: voiceId,
      });

      console.log(`✅ [New Session] Generated script (${scriptRes.script?.length} chars). Presenting for lecturer review.`);
      setCreatedSessionId(session.id);
      setGeneratedScript(scriptRes.script);
      setIsSubmitting(false);
      setStatusMessage("");
      setShowScriptModal(true);
      toast.success("AI Curriculum Script prepared! Please review and confirm to enter the live classroom.");
    } catch (err: unknown) {
      console.error("❌ [New Session] Create session error:", err);
      const msg = err instanceof Error ? err.message : "Failed to create session";
      toast.error(msg);
      setIsSubmitting(false);
      setStatusMessage("");
    }
  };

  const handleSaveAndApproveScript = async (newScript: string) => {
    if (!createdSessionId) return;
    setGeneratedScript(newScript);
    await api.updateClassroomSession(createdSessionId, { script: newScript });
    toast.success("Curriculum script updated successfully!");
  };

  const handleLaunchLiveSession = () => {
    if (!createdSessionId) return;
    setShowScriptModal(false);
    router.push(`/classroom/${createdSessionId}`);
  };

  if (loadingInitial) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 bg-background">
        <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/10 flex items-center justify-center text-[#0071e3] animate-spin">
          <Loader2 className="h-6 w-6" />
        </div>
        <p className="text-[11px] font-semibold tracking-wider text-[#86868b] uppercase">
          Loading Lecture Studio...
        </p>
      </div>
    );
  }

  const selectedCount = Object.values(selectedFiles).filter((f) => f.selected).length;

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#000000] text-[#1d1d1f] dark:text-[#f5f5f7] flex flex-col">
      {/* ── Sticky Action Bar (Frosted Glass Header) ───────────────────────── */}
      <header className="sticky top-0 z-30 h-16 px-6 sm:px-8 flex items-center justify-between border-b border-black/5 dark:border-white/10 backdrop-blur-md bg-white/70 dark:bg-[#121212]/70 transition-all">
        <div className="flex items-center gap-4 min-w-0">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="rounded-full h-9 px-3 text-xs font-medium text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]"
          >
            <Link href={`/course/${courseId}`} className="inline-flex items-center justify-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span>{course?.title || "Course Space"}</span>
            </Link>
          </Button>

          <div className="h-4 w-px bg-black/10 dark:bg-white/15 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#0071e3]/10 flex items-center justify-center text-[#0071e3]">
              <Sparkles className="h-4 w-4" />
            </div>
            <h1 className="text-sm sm:text-base font-bold tracking-tight truncate">
              New AI Broadcast Lecture
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push(`/course/${courseId}`)}
            disabled={isSubmitting}
            className="rounded-full px-5 py-2.5 font-medium text-xs border-0"
          >
            <span>Cancel</span>
          </Button>

          {/* Primary CTA: Apple System Blue Pill */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !topic.trim()}
            variant="default"
            className="rounded-full px-6 py-2.5 font-medium shadow-xs text-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                <span>Preparing Lecture...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Create &amp; Generate Lecture</span>
              </>
            )}
          </Button>

          <ThemeToggle />
        </div>
      </header>

      {/* ── Main Studio Layout ────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Progress Alert during generation */}
        {isSubmitting && statusMessage && (
          <div className="p-4 rounded-2xl bg-[#0071e3]/10 border border-[#0071e3]/20 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <Loader2 className="h-5 w-5 text-[#0071e3] animate-spin shrink-0" />
            <div>
              <p className="text-xs font-bold text-[#0071e3]">Generating Lecture Materials</p>
              <p className="text-xs text-[#86868b]">{statusMessage}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ═════════════════════════════════════════════════════════════════
              LEFT COLUMN: LECTURE DEFINITION & SOURCE MATERIALS (7 Cols)
             ═════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 space-y-6">
            {/* Inset Card 1: Lecture Topic */}
            <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/5 dark:border-white/5 p-6 mb-6 shadow-xs space-y-4">
              <h2 className="text-[11px] font-semibold tracking-wider text-[#86868b] uppercase mb-4">
                Lecture Topic
              </h2>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="topic" className="text-xs font-semibold">
                    Lesson Topic <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Concurrency &amp; Multithreading in Java"
                    className="h-11 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border-black/10 dark:border-white/10 text-sm font-medium focus-visible:ring-1 focus-visible:ring-[#0071e3]"
                  />
                </div>

                {/* Auto-generated Meeting Code Informational Badge */}
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 text-xs text-[#86868b]">
                  <ShieldCheck className="h-4 w-4 text-[#0071e3] shrink-0" />
                  <p className="text-[11px] leading-relaxed">
                    A unique, cryptographically secure student access code (<span className="font-mono text-[#0071e3] font-semibold">cls-xxxx-xxxx</span>) will be automatically assigned upon creation.
                  </p>
                </div>
              </div>
            </div>

            {/* Inset Card 2: Reference Materials & Syllabus Documents */}
            <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/5 dark:border-white/5 p-6 mb-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                <h2 className="text-[11px] font-semibold tracking-wider text-[#86868b] uppercase">
                  Reference Materials &amp; Syllabus Documents
                </h2>
                <span className="text-[11px] font-semibold text-[#0071e3] bg-[#0071e3]/10 px-2.5 py-0.5 rounded-full">
                  {selectedCount} Source{selectedCount !== 1 ? "s" : ""} Selected
                </span>
              </div>

              <p className="text-xs text-[#86868b] leading-relaxed">
                Choose existing syllabus materials or upload new textbook chapters. The AI Professor
                uses these documents as grounded knowledge to generate structured slides and explanations.
              </p>

              {/* Direct Drag & Drop Upload Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-black/10 dark:border-white/10 hover:border-[#0071e3]/60 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors cursor-pointer text-center group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleDirectFileUpload}
                  accept=".pdf,application/pdf"
                  className="hidden"
                  disabled={isUploadingMaterial}
                />
                <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/10 group-hover:bg-[#0071e3]/10 flex items-center justify-center text-[#0071e3] mb-2 transition-colors">
                  {isUploadingMaterial ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Upload className="h-5 w-5" />
                  )}
                </div>
                <p className="text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  {isUploadingMaterial ? uploadProgressText : "Drop new PDF document here or click to browse"}
                </p>
                <p className="text-[11px] text-[#86868b] mt-0.5">
                  PDF format up to 25MB • Automatically indexed for AI teaching
                </p>
              </div>

              {/* Refined Materials List with interactive rows */}
              {courseFiles.length > 0 ? (
                <div className="space-y-2 pt-2">
                  <Label className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider block mb-2">
                    Available Course Materials ({courseFiles.length})
                  </Label>

                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {courseFiles.map((file) => {
                      const isSelected = selectedFiles[file.file_name]?.selected || false;
                      return (
                        <div
                          key={file.id}
                          className={`hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors p-2.5 flex flex-col gap-2 border ${isSelected
                              ? "bg-[#0071e3]/5 border-[#0071e3]/30"
                              : "border-black/5 dark:border-white/5"
                            }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <Checkbox
                                id={`file-${file.id}`}
                                checked={isSelected}
                                onChange={() => toggleFileSelection(file.file_name)}
                                className="rounded-md border-black/20 dark:border-white/20"
                              />
                              <FileText className="h-4 w-4 text-[#0071e3] shrink-0" />
                              <label
                                htmlFor={`file-${file.id}`}
                                className="text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] truncate cursor-pointer"
                              >
                                {file.file_name}
                              </label>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-[#86868b] font-medium hidden sm:inline">
                                {file.file_size ? `${(file.file_size / (1024 * 1024)).toFixed(1)} MB` : "Document"}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => setSelectedViewFile(file)}
                                className="h-7 w-7 text-[#86868b] hover:text-[#0071e3] hover:bg-[#0071e3]/10 rounded-md"
                                title="View PDF Document"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Pill-shaped page range inputs */}
                          {isSelected && (
                            <div className="pt-2 border-t border-black/5 dark:border-white/10 flex items-center gap-3 text-xs pl-7">
                              <span className="text-[11px] text-[#86868b] font-medium shrink-0">
                                Page Range:
                              </span>
                              <div className="flex items-center gap-1.5">
                                <Input
                                  type="number"
                                  placeholder="Start"
                                  min={1}
                                  value={selectedFiles[file.file_name]?.startPage ?? ""}
                                  onChange={(e) =>
                                    updatePageRange(file.file_name, "startPage", e.target.value)
                                  }
                                  className="bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-lg px-3 py-1.5 text-sm w-20 text-center border-transparent focus:border-[#0071e3] h-7 p-1"
                                />
                                <span className="text-[#86868b]">-</span>
                                <Input
                                  type="number"
                                  placeholder="End"
                                  min={1}
                                  value={selectedFiles[file.file_name]?.endPage ?? ""}
                                  onChange={(e) =>
                                    updatePageRange(file.file_name, "endPage", e.target.value)
                                  }
                                  className="bg-[#f5f5f7] dark:bg-[#2c2c2e] rounded-lg px-3 py-1.5 text-sm w-20 text-center border-transparent focus:border-[#0071e3] h-7 p-1"
                                />
                              </div>
                              <span className="text-[10px] text-[#86868b]">(Leave blank for full book)</span>
                            </div>
                          )}

                          {/* Extracted Visuals Carousel */}
                          <MaterialImageCarousel fileName={file.file_name} assets={mediaAssets} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 text-center">
                  <p className="text-xs text-[#86868b]">
                    No course documents found yet. Upload a syllabus or textbook chapter above to enhance AI teaching precision.
                  </p>
                </div>
              )}
            </div>

            {/* Inset Card 3: Teaching Directives & Focus Area */}
            <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/5 dark:border-white/5 p-6 mb-6 shadow-xs space-y-4">
              <h2 className="text-[11px] font-semibold tracking-wider text-[#86868b] uppercase mb-4">
                Teaching Directives &amp; Focus Area (Optional)
              </h2>

              <Textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. Emphasize synchronized blocks and deadlock avoidance. Include a real-world banking transaction example. Keep tone engaging and encouraging for undergraduates."
                rows={3}
                className="rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border-black/10 dark:border-white/10 text-xs font-medium resize-none focus-visible:ring-1 focus-visible:ring-[#0071e3] p-3.5"
              />
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════
              RIGHT COLUMN: 3D AVATAR & KOKORO VOICE STUDIO (5 Cols)
              Matching Settings page pixel-for-pixel with sticky positioning
             ═════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 sticky top-20 space-y-6">
            {/* Section: Instructor Persona & Voice Controls */}
            <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/5 dark:border-white/5 p-6 shadow-xs space-y-5">
              <div className="space-y-0.5">
                <h2 className="text-[11px] font-semibold tracking-wider text-[#86868b] uppercase">
                  Instructor Persona &amp; Voice
                </h2>
                <p className="text-xs text-[#86868b]">
                  Select the 3D instructor model and HeadTTS neural voice profile for this lecture.
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
            <div className="bg-white dark:bg-[#1c1c1e] rounded-3xl border border-black/10 dark:border-white/10 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {gender === "male" ? "Prof. Arthur" : "Dr. Clara"}
                  </h3>
                  <p className="text-[11px] text-[#86868b]">
                    {gender === "male" ? "Male Avatar Mesh" : "Female Avatar Mesh"} &bull; Real-time 3D Viewport
                  </p>
                </div>
                <span className="text-[10px] font-semibold bg-[#0071e3]/10 text-[#0071e3] px-2.5 py-0.5 rounded-full border border-[#0071e3]/20">
                  ACTIVE
                </span>
              </div>

              {/* 3D Canvas Preview Frame */}
              <AvatarPreview
                gender={gender}
                isSpeaking={isTestingVoice}
                audioPath={previewAudioPath}
                lipSyncData={previewLipSyncData}
                onLipSyncEnd={() => setIsTestingVoice(false)}
                className="w-full h-72 rounded-2xl"
              />

              {/* Reusable HeadTTS Test Button */}
              <div className="pt-0.5">
                <HeadTTSTestButton
                  text={previewPrompt}
                  voice={voiceId}
                  speed={speed}
                  isPlaying={isTestingVoice}
                  onPlayStateChange={setIsTestingVoice}
                  onDataReceived={(path, data) => {
                    setPreviewAudioPath(path);
                    setPreviewLipSyncData(data);
                  }}
                  className="w-full rounded-full h-11 font-medium text-xs shadow-2xs cursor-pointer gap-2"
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Material PDF Document Viewer Modal */}
      <MaterialViewerModal
        courseId={courseId}
        file={selectedViewFile}
        open={Boolean(selectedViewFile)}
        onOpenChange={(open) => !open && setSelectedViewFile(null)}
        mediaAssets={mediaAssets}
      />

      {/* Pre-Flight Script Review & Approval Gate */}
      {createdSessionId && (
        <LectureScriptModal
          open={showScriptModal}
          onOpenChange={setShowScriptModal}
          items={parseLectureScript(generatedScript).items}
          currentIndex={0}
          topic={topic}
          isLecturer={true}
          status="created"
          rawScript={generatedScript}
          onSaveScript={handleSaveAndApproveScript}
          onStartSession={handleLaunchLiveSession}
        />
      )}
    </div>
  );
}
