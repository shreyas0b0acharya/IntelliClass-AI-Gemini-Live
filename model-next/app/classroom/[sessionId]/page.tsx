"use client";

import { use, useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  useClassroom,
  useClassroomStore,
  useClassroomLayout,
  AvatarStage,
  AudioUnlockModal,
  LeaveClassroomDialog,
  ParticipantsModal,
  LectureScriptModal,
  ClassroomHeader,
  StageOverlay,
  MobileViewSwitcher,
  ChatPanel,
  getCapabilities,
} from "@/features/classroom";
import { AssetSyncModal } from "@/components/shared";
import { assetStorage } from "@/features/avatar";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Clock,
  AlertTriangle,
  BookOpen,
  FileText,
  Eye,
  RotateCcw,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { CourseFile, MediaAsset } from "@/lib/supabase/types";
import { MaterialViewerModal, MaterialImageCarousel } from "@/features/materials";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function ClassroomPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();
  const classroom = useClassroom(sessionId);
  const store = useClassroomStore();
  const layout = useClassroomLayout();

  // Active view tab for compact/mobile layouts ("stage" vs "chat")
  const [activeTab, setActiveTab] = useState<"stage" | "chat">("stage");

  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);
  const [courseFiles, setCourseFiles] = useState<CourseFile[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [selectedViewFile, setSelectedViewFile] = useState<CourseFile | null>(null);

  // Live Closed Captions (CC) toggle — persistent per user across sessions
  const [showCaptions, setShowCaptions] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("intelliclass_show_captions");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });

  const handleToggleCaptions = () => {
    setShowCaptions((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("intelliclass_show_captions", String(next));
      }
      toast.info(next ? "💬 Live captions enabled" : "Live captions hidden", { duration: 1500 });
      return next;
    });
  };

  // Script Progress HUD toggle (Lecturer only) — persistent across sessions
  const [showProgressHUD, setShowProgressHUD] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("intelliclass_show_progress_hud");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });

  const handleToggleProgressHUD = () => {
    setShowProgressHUD((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("intelliclass_show_progress_hud", String(next));
      }
      toast.info(next ? "📊 Progress HUD enabled" : "Progress HUD hidden", { duration: 1500 });
      return next;
    });
  };

  // Forcefully exit students when the lecturer ends the session.
  // Guard: only fire once the profile is known (profile !== null) to avoid
  // a race where isLecturer is momentarily false for the actual lecturer.
  useEffect(() => {
    if (
      classroom.profile !== null &&
      classroom.session &&
      !classroom.isLecturer &&
      classroom.sessionStatus === "ended"
    ) {
      toast.info("🎓 The instructor has concluded this lecture session.", {
        description: "Redirecting you to the home page...",
        duration: 3000,
      });
      const timer = setTimeout(() => {
        router.replace("/");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [classroom.profile, classroom.session, classroom.isLecturer, classroom.sessionStatus, router]);

  // Adaptive Bandwidth Arbitration: yield background sync during live lecture audio
  useEffect(() => {
    assetStorage.setAudioStreaming(Boolean(classroom.currentSpeech));
  }, [classroom.currentSpeech]);

  const isLecturer = Boolean(classroom.isLecturer);
  const capabilities = useMemo(
    () => getCapabilities(isLecturer ? "lecturer" : "student"),
    [isLecturer]
  );

  if (!classroom.session || !classroom.user) {
    return (
      <div className="h-dvh min-h-dvh w-screen flex flex-col items-center justify-center gap-4 bg-background">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary animate-spin">
          <Loader2 className="h-6 w-6" />
        </div>
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Initializing Real-time Classroom...
        </p>
      </div>
    );
  }

  const courseId = classroom.session.course_id;
  const meetingCode = classroom.session.meeting_code || classroom.session.id?.slice(0, 8);

  const avatarModel =
    classroom.session.voice_id?.startsWith("af_")
      ? "women-avatarsdk"
      : "men-avatarsdk";

  const hasWaitingStudents =
    isLecturer && classroom.participants.some((p) => p.status === "waiting");

  const handleStopAndLeave = async () => {
    if (isLecturer && classroom.sessionStatus === "running") {
      await classroom.endSession();
    }
    router.push(`/course/${courseId}`);
  };

  const handleContinueInBackground = () => {
    router.push(`/course/${courseId}`);
  };

  const handleOpenMaterials = async () => {
    if (courseFiles.length === 0 && courseId) {
      try {
        const res = await api.getCourseFiles(courseId);
        setCourseFiles(res.files || []);
        const mRes = await api.getMediaAssets(courseId);
        setMediaAssets(mRes.assets || []);
      } catch (e) {
        console.warn("Failed to load course materials:", e);
      }
    }
    setShowMaterialsModal(true);
  };

  return (
    <div
      data-role={isLecturer ? "lecturer" : "student"}
      className="h-dvh min-h-dvh w-screen flex flex-col overflow-hidden bg-background select-none"
    >
      {/* Audio Unlock Overlay */}
      {!classroom.audioUnlocked && (
        <AudioUnlockModal
          onUnlock={() => classroom.setAudioUnlocked(true)}
          topic={classroom.session.topic}
          isLecturer={isLecturer}
        />
      )}

      {/* Leave Classroom Dialog */}
      <LeaveClassroomDialog
        open={showLeaveDialog}
        onOpenChange={setShowLeaveDialog}
        isLecturer={isLecturer}
        sessionStatus={classroom.sessionStatus}
        onStopAndLeave={handleStopAndLeave}
        onContinueInBackground={handleContinueInBackground}
      />

      {/* Google Meet Style Participants Modal */}
      <ParticipantsModal
        open={showParticipantsModal}
        onOpenChange={setShowParticipantsModal}
        participants={classroom.participants}
        isLecturer={isLecturer}
        currentUserId={classroom.user.id}
        onAdmit={classroom.admitParticipant}
        onDeny={classroom.denyParticipant}
        onKick={classroom.kickParticipant}
        onAdmitAll={classroom.admitAllParticipants}
      />

      {/* Lecture Script & Curriculum Inspector Modal */}
      <LectureScriptModal
        open={showScriptModal}
        onOpenChange={setShowScriptModal}
        items={store.items}
        currentIndex={store.currentIndex}
        topic={classroom.session.topic}
        isLecturer={isLecturer}
        status={classroom.sessionStatus}
        rawScript={classroom.session.script || ""}
        onSaveScript={classroom.updateScript}
        onStartSession={classroom.startSession}
      />

      {/* Course Materials Browser Modal */}
      <Dialog open={showMaterialsModal} onOpenChange={setShowMaterialsModal}>
        <DialogContent className="sm:max-w-xl rounded-3xl p-6 border border-border/40 bg-card/95 backdrop-blur-2xl shadow-2xl space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">Course Syllabus Materials</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Browse and view textbooks and reference PDFs for this course
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {courseFiles.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-border/60 rounded-2xl">
                <p className="text-xs text-muted-foreground">No syllabus documents attached to this course.</p>
              </div>
            ) : (
              courseFiles.map((file) => {
                const sizeMb = file.file_size ? (file.file_size / (1024 * 1024)).toFixed(1) : "N/A";
                return (
                  <div
                    key={file.id}
                    className="p-3 rounded-2xl border border-border/40 bg-background/50 hover:border-[#0071e3]/40 transition-all flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate text-foreground">{file.file_name}</p>
                          <span className="text-[10px] text-muted-foreground">{sizeMb} MB</span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          setSelectedViewFile(file);
                        }}
                        className="h-8 px-3 text-xs font-bold shrink-0 rounded-xl inline-flex items-center gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View PDF</span>
                      </Button>
                    </div>

                    {/* Extracted Diagram Carousel with Instant 'Project to Stage' for Lecturer */}
                    <MaterialImageCarousel
                      fileName={file.file_name}
                      assets={mediaAssets}
                      onProjectToStage={isLecturer ? classroom.projectMedia : undefined}
                    />
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Universal PDF Document Viewer Modal */}
      {courseId && (
        <MaterialViewerModal
          courseId={courseId}
          file={selectedViewFile}
          open={Boolean(selectedViewFile)}
          onOpenChange={(open) => !open && setSelectedViewFile(null)}
          mediaAssets={mediaAssets}
          onProjectToStage={isLecturer ? classroom.projectMedia : undefined}
        />
      )}

      {/* Modular, Accessible Classroom Header */}
      <ClassroomHeader
        topic={classroom.session.topic}
        meetingCode={meetingCode}
        courseId={courseId}
        isLecturer={isLecturer}
        capabilities={capabilities}
        sessionStatus={classroom.sessionStatus}
        voiceId={classroom.session.voice_id}
        avatarModel={avatarModel}
        activeStudentCount={classroom.activeStudentCount}
        emptyRoomCountdown={classroom.emptyRoomCountdown}
        stoppedReason={classroom.stoppedReason || undefined}
        participantsCount={classroom.participants.length}
        hasWaitingStudents={hasWaitingStudents}
        scriptItemCount={store.items.length}
        onLeaveClick={() => setShowLeaveDialog(true)}
        onOpenParticipants={() => setShowParticipantsModal(true)}
        onOpenScript={() => setShowScriptModal(true)}
        onOpenMaterials={handleOpenMaterials}
        onStartSession={classroom.startSession}
        onPauseSession={classroom.pauseSession}
        onEndSession={classroom.endSession}
        onRestartSession={classroom.restartSession}
        isCompact={layout.isCompact}
        showCaptions={showCaptions}
        onToggleCaptions={handleToggleCaptions}
        showProgressHUD={showProgressHUD}
        onToggleProgressHUD={handleToggleProgressHUD}
      />

      {/* Main Classroom Area: State-Preserving Persistent Panels */}
      <div className="flex-1 relative min-h-0 overflow-hidden lg:grid lg:grid-cols-4">
        {/* Student Waiting Room State (Google Meet Knocking) */}
        {!isLecturer && classroom.myAdmissionStatus === "waiting" && (
          <div className="absolute inset-0 z-30 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center animate-pulse">
              <Clock className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-foreground">Asking to join...</h2>
              <p className="text-xs text-muted-foreground max-w-sm">
                The lecturer has been notified. You&apos;ll be admitted to the live lecture as soon as the professor accepts your request.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for lecturer approval...
            </div>
          </div>
        )}

        {/* Student Denied / Removed State */}
        {!isLecturer && classroom.myAdmissionStatus === "denied" && (
          <div className="absolute inset-0 z-30 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-red-500/10 text-red-500 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-foreground">Session Access Revoked</h2>
              <p className="text-xs text-muted-foreground max-w-sm">
                You were removed or declined from this live lecture session by the instructor.
              </p>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <Button
                onClick={classroom.requestRejoin}
                variant="default"
                size="sm"
                className="px-5 h-9 font-semibold text-xs shadow-xs rounded-xl"
              >
                <span>Ask to Join Again</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/course/${courseId}`)}
                className="px-4 h-9 font-semibold text-xs rounded-xl"
              >
                <span>Return to Course Space</span>
              </Button>
            </div>
          </div>
        )}

        {/* Lecturer Session Ended — Recovery Overlay */}
        {isLecturer && classroom.sessionStatus === "ended" && (
          <div className="absolute inset-0 z-40 bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center space-y-5">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <RotateCcw className="h-8 w-8" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold text-foreground">Session Ended</h2>
              <p className="text-xs text-muted-foreground max-w-sm">
                This broadcast has concluded. You can restart it from the beginning or return to the course page.
              </p>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <Button
                onClick={classroom.restartSession}
                variant="default"
                size="sm"
                className="px-6 h-10 font-semibold text-xs shadow-lg gap-2 rounded-xl inline-flex items-center"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Restart Broadcast</span>
              </Button>
              <Button
                onClick={() => router.push(`/course/${courseId}`)}
                variant="outline"
                size="sm"
                className="px-5 h-10 font-semibold text-xs rounded-xl"
              >
                <span>Return to Course</span>
              </Button>
            </div>
          </div>
        )}

        {/* Student Session Ended Forced Exit State */}
        {!isLecturer && classroom.sessionStatus === "ended" && (
          <div className="absolute inset-0 z-40 bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center">
              <BookOpen className="h-8 w-8" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold text-foreground">Lecture Session Concluded</h2>
              <p className="text-xs text-muted-foreground max-w-sm">
                The professor has ended this live broadcast. Redirecting to home...
              </p>
            </div>
            <Button
              onClick={() => router.replace("/")}
              variant="default"
              size="sm"
              className="mt-3 px-6 h-10 font-semibold text-xs shadow-lg rounded-xl"
            >
              <span>Return to Home</span>
            </Button>
          </div>
        )}

        {/* ── Panel 1: Lecture Stage (Canvas + Overlays) ── */}
        <div
          id="panel-stage"
          role="tabpanel"
          aria-labelledby="tab-stage"
          className={cn(
            "h-full overflow-hidden transition-opacity duration-200",
            // Desktop: 3 columns, always visible and interactive
            "lg:relative lg:col-span-3 lg:visible lg:opacity-100 lg:pointer-events-auto lg:z-auto",
            // Compact (Mobile / Short Viewports): absolute full-screen toggled by activeTab
            layout.isCompact && (
              activeTab === "stage"
                ? "visible opacity-100 pointer-events-auto z-10 absolute inset-0"
                : "invisible opacity-0 pointer-events-none z-0 absolute inset-0"
            )
          )}
        >
          <div className="flex flex-col relative h-full bg-gradient-to-b from-background via-background/95 to-muted/20 p-2 sm:p-4">
            <div className="flex-1 relative w-full h-full min-h-0 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl">
              <AvatarStage
                model={avatarModel}
                isSpeaking={Boolean(classroom.currentSpeech)}
                audioPath={classroom.currentSpeech?.audioPath}
                lipSyncData={classroom.currentSpeech?.lipSyncData}
                targetEpochMs={classroom.currentSpeech?.targetEpochMs}
                sequence={classroom.currentSpeech?.sequence}
                onLipSyncEnd={() => classroom.handleAudioEnd(classroom.currentSpeech?.requestId)}
                subtitle={classroom.currentSubtitle}
                activeMedia={classroom.activeMedia || store.activeMedia}
                userQuestion={classroom.userQuestion}
                isThinking={classroom.isThinking}
                sessionStatus={classroom.sessionStatus}
                onCloseMedia={() => classroom.setActiveMedia(null)}
                onQuestionChange={classroom.setUserQuestion}
                onQuestionSubmit={(e) => {
                  e?.preventDefault();
                  classroom.handleInterrupt();
                }}
              />

              <StageOverlay
                sessionStatus={classroom.sessionStatus}
                currentIndex={store.currentIndex}
                totalItems={store.items.length}
                currentSpeechText={classroom.currentSpeech?.text}
                isThinking={classroom.isThinking}
                onOpenScript={() => setShowScriptModal(true)}
                canEditCurriculum={capabilities.canEditCurriculum}
                activeMedia={classroom.activeMedia || store.activeMedia}
                onCloseMedia={isLecturer ? classroom.dismissMedia : () => classroom.setActiveMedia(null)}
                subtitle={classroom.currentSubtitle}
                showCaptions={showCaptions}
                showProgressHUD={showProgressHUD}
                canAskDoubt={capabilities.canAskDoubt}
                userQuestion={classroom.userQuestion}
                onQuestionChange={classroom.setUserQuestion}
                onQuestionSubmit={(e) => {
                  e?.preventDefault();
                  classroom.handleInterrupt();
                }}
                isCompact={layout.isCompact}
                isShortLandscape={layout.isShortLandscape}
              />
            </div>
          </div>
        </div>

        {/* ── Panel 2: Live Chat & Notes Sidebar ── */}
        <div
          id="panel-chat"
          role="tabpanel"
          aria-labelledby="tab-chat"
          className={cn(
            "h-full overflow-hidden transition-opacity duration-200 border-l border-border/40 bg-card/40",
            // Desktop: 1 column, always visible and interactive
            "lg:relative lg:col-span-1 lg:visible lg:opacity-100 lg:pointer-events-auto lg:z-auto",
            // Compact (Mobile / Short Viewports): absolute full-screen toggled by activeTab
            layout.isCompact && (
              activeTab === "chat"
                ? "visible opacity-100 pointer-events-auto z-10 absolute inset-0 bg-background"
                : "invisible opacity-0 pointer-events-none z-0 absolute inset-0"
            )
          )}
        >
          <ChatPanel sessionId={sessionId} userId={classroom.user.id} />
        </div>
      </div>

      {/* ── Mobile Accessible Switcher (Rendered on Compact Screens) ── */}
      {layout.isCompact && (
        <MobileViewSwitcher
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      )}

      {/* Background Core Asset Sync Modal */}
      <AssetSyncModal preferredGender={avatarModel.includes("women") ? "women" : "men"} />
    </div>
  );
}
