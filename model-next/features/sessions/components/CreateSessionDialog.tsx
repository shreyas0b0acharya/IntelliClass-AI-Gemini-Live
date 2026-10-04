"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  useModelPreferences,
  MALE_MODEL_PRESETS,
  FEMALE_MODEL_PRESETS,
  GenderSelector,
  ModelNameInput,
  VoiceSpeedControls,
  HeadTTSTestButton,
} from "@/features/settings";
import type { CourseFile } from "@/lib/supabase/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Presentation, Loader2, Sparkles, Plus } from "lucide-react";
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
        : preferences.defaultMaleVoice) || "am_fenrir"
  );
  const [speed, setSpeed] = useState(() => preferences.speechSpeed || 1.0);
  const [files, setFiles] = useState<CourseFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusStep, setStatusStep] = useState("");

  // HeadTTS preview state & LipSync
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [previewAudioPath, setPreviewAudioPath] = useState<string | undefined>();
  const [previewLipSyncData, setPreviewLipSyncData] = useState<HeadTTSData | undefined>();

  useEffect(() => {
    let active = true;
    api.getCourseFiles(courseId)
      .then(({ files: fetchedFiles }) => {
        if (active && fetchedFiles && fetchedFiles.length > 0) {
          setFiles(fetchedFiles);
          setSelectedFile(fetchedFiles[0].file_name);
        }
      })
      .catch((err) => console.error("Error loading course files in modal:", err));

    return () => {
      active = false;
    };
  }, [courseId]);

  // When gender toggle is switched in the modal, update prefilled name & voice for that gender
  const handleGenderChange = (newGender: "male" | "female") => {
    setGender(newGender);
    setPreviewAudioPath(undefined);
    setPreviewLipSyncData(undefined);
    setIsTestingVoice(false);
    if (newGender === "male") {
      setLecturerName(preferences.defaultMaleModelName);
      setVoiceId("am_fenrir");
    } else {
      setLecturerName(preferences.defaultFemaleModelName);
      setVoiceId("af_bella");
    }
  };

  const handleCreateAndGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      toast.error("Please provide a lecture topic.");
      return;
    }

    setIsTestingVoice(false);
    setIsGenerating(true);
    setStatusStep("Initializing classroom session...");

    try {
      const { session: sessionData } = await api.createCourseSession(courseId, {
        topic: topic.trim(),
        voice_id: voiceId,
      });

      if (!sessionData) {
        throw new Error("Failed to initialize session.");
      }

      const sessionId = sessionData.id;
      setStatusStep(`Synthesizing lecture with ${lecturerName || "AI Lecturer"}...`);

      const sources = selectedFile ? [{ fileName: selectedFile }] : [];

      await api.generateSessionScript(sessionId, {
        courseId,
        topic: topic.trim(),
        sources,
        voice: voiceId,
        customPrompt: lecturerName ? `You are ${lecturerName}, an expert professor.` : undefined,
      });

      toast.success("Live AI Lecture Session created!");
      onClose();
      router.push(`/classroom/${sessionId}`);
    } catch (err: unknown) {
      console.error("Create session error:", err);
      const msg = err instanceof Error ? err.message : "Failed to generate classroom session.";
      toast.error(msg);
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
            <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center text-[#0071e3]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Launch AI Lecture
              </DialogTitle>
              <DialogDescription className="text-xs text-[#86868b]">
                Customize your 3D lecturer persona, curriculum topic, and HeadTTS neural audio.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
      </div>

      {/* Scrollable Form Content */}
      <form onSubmit={handleCreateAndGenerate} className="p-6 overflow-y-auto space-y-6 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* ── Left Column: Configuration ─────────────────────────── */}
          <div className="md:col-span-7 space-y-5">
            {/* Lecture Topic */}
            <div className="space-y-2">
              <Label htmlFor="lecture-topic" className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
                Lecture Topic / Objective *
              </Label>
              <Input
                id="lecture-topic"
                placeholder="e.g. Memory Management & Garbage Collection in JVM"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isGenerating}
                required
                className="rounded-xl h-11 border-black/10 dark:border-white/10 bg-[#f5f5f7] dark:bg-[#2c2c2e]"
              />
            </div>

            {/* Persona Gender Toggle (Reusable GenderSelector) */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
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

            {/* Source Document Selection */}
            {files.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
                  Source Syllabus Document (Optional)
                </Label>
                <Select
                  value={selectedFile || "__all__"}
                  onValueChange={(val) => setSelectedFile(val === "__all__" ? "" : val)}
                  disabled={isGenerating}
                >
                  <SelectTrigger className="w-full h-10 px-3 rounded-xl border border-black/10 dark:border-white/10 bg-[#f5f5f7] dark:bg-[#2c2c2e] text-xs font-medium text-[#1d1d1f] dark:text-[#f5f5f7] focus:ring-1 focus:ring-[#0071e3] cursor-pointer">
                    <SelectValue placeholder="Select course document..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl shadow-2xl p-1">
                    <SelectItem
                      value="__all__"
                      className="rounded-xl py-2 text-xs font-medium cursor-pointer"
                    >
                      All Course Knowledge (Global Context)
                    </SelectItem>
                    {files.map((f) => (
                      <SelectItem
                        key={f.id}
                        value={f.file_name}
                        className="rounded-xl py-2 text-xs font-medium cursor-pointer truncate"
                      >
                        {f.file_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* ── Right Column: Live 3D Model Render Preview ─────────── */}
          <div className="md:col-span-5 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
                3D Avatar &amp; LipSync
              </Label>
              <span className="text-[10px] font-mono text-[#0071e3] font-semibold">
                {gender === "male" ? "men-avatarsdk" : "women-avatarsdk"}
              </span>
            </div>

            {/* 3D Viewport with real-time HeadTTS LipSync */}
            <AvatarPreview
              gender={gender}
              isSpeaking={isTestingVoice}
              audioPath={previewAudioPath}
              lipSyncData={previewLipSyncData}
              onLipSyncEnd={() => setIsTestingVoice(false)}
              className="w-full h-60 rounded-2xl"
            />

            {/* Reusable HeadTTS Test Button */}
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
              className="w-full rounded-full h-10 font-medium text-xs shadow-xs cursor-pointer gap-2"
            />
          </div>
        </div>

        {statusStep && (
          <div className="flex items-center gap-2 text-xs font-medium text-[#0071e3] animate-pulse p-2 rounded-xl bg-[#0071e3]/5 border border-[#0071e3]/15">
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            <span>{statusStep}</span>
          </div>
        )}

        <DialogFooter className="pt-4 border-t border-black/5 dark:border-white/10 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isGenerating}
            className="px-5 h-10 border-black/10 dark:border-white/10 font-medium text-xs bg-white dark:bg-[#2c2c2e] rounded-full"
          >
            <span>Cancel</span>
          </Button>
          <Button
            type="submit"
            disabled={isGenerating}
            variant="default"
            className="px-6 h-10 font-medium text-xs shadow-xs rounded-full inline-flex items-center gap-1.5"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Presentation className="h-3.5 w-3.5" />
                <span>Launch Session</span>
              </>
            )}
          </Button>
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
            className="px-5 py-2.5 font-medium text-xs sm:text-sm shadow-xs rounded-full inline-flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>New AI Lecture</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl bg-white dark:bg-[#1c1c1e] max-h-[90vh] flex flex-col">
        {open && <CreateSessionModalContent courseId={courseId} onClose={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
