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
import {
  DEFAULT_MALE_VOICE_ID,
  DEFAULT_FEMALE_VOICE_ID,
  DEFAULT_SPEECH_SPEED,
  DEFAULT_MALE_AVATAR_MODEL,
  DEFAULT_FEMALE_AVATAR_MODEL,
} from "@/config";
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
        : preferences.defaultMaleVoice) || DEFAULT_MALE_VOICE_ID
  );
  const [speed, setSpeed] = useState(() => preferences.speechSpeed || DEFAULT_SPEECH_SPEED);
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
      setVoiceId(DEFAULT_MALE_VOICE_ID);
    } else {
      setLecturerName(preferences.defaultFemaleModelName);
      setVoiceId(DEFAULT_FEMALE_VOICE_ID);
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
      const avatarModel = gender === "female" ? DEFAULT_FEMALE_AVATAR_MODEL : DEFAULT_MALE_AVATAR_MODEL;
      const { session: sessionData } = await api.createCourseSession(courseId, {
        topic: topic.trim(),
        voice_id: voiceId,
        avatar_model: avatarModel,
        speech_speed: speed,
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
            <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/10 flex items-center justify-center text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
 <DialogTitle className="">
                Launch AI Lecture
              </DialogTitle>
 <DialogDescription className="">
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

            {/* Source Document Selection */}
            {files.length > 0 && (
              <div className="space-y-1.5">
 <Label className="">
                  Source Syllabus Document (Optional)
                </Label>
                <Select
                  value={selectedFile || "__all__"}
                  onValueChange={(val) => setSelectedFile(val === "__all__" ? "" : val)}
                  disabled={isGenerating}
                >
 <SelectTrigger className="w-full h-10 cursor-pointer">
                    <SelectValue placeholder="Select course document..." />
                  </SelectTrigger>
 <SelectContent className="">
                    <SelectItem
                      value="__all__"
 className=" cursor-pointer"
                    >
                      All Course Knowledge (Global Context)
                    </SelectItem>
                    {files.map((f) => (
                      <SelectItem
                        key={f.id}
                        value={f.file_name}
 className=" cursor-pointer "
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
 <Label className="">
                3D Avatar &amp; LipSync
              </Label>
              <span className="text-[10px] font-mono text-primary font-semibold">
                {gender === "male" ? DEFAULT_MALE_AVATAR_MODEL : DEFAULT_FEMALE_AVATAR_MODEL}
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
 className="w-full h-10 cursor-pointer "
            />
          </div>
        </div>

        {statusStep && (
          <div className="flex items-center gap-2 text-xs font-medium text-primary animate-pulse p-2 rounded-xl bg-primary/5 border border-primary/15">
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            <span>{statusStep}</span>
          </div>
        )}

 <DialogFooter className=" shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isGenerating}
 className=" h-10 "
          >
            <span>Cancel</span>
          </Button>
          <Button
            type="submit"
            disabled={isGenerating}
            variant="default"
 className=" h-10 inline-flex items-center "
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
 className=" inline-flex items-center "
          >
            <Plus className="h-4 w-4" />
            <span>New AI Lecture</span>
          </Button>
        )}
      </DialogTrigger>
 <DialogContent className="max-w-3xl overflow-hidden max-h-[90vh] flex flex-col">
        {open && <CreateSessionModalContent courseId={courseId} onClose={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
