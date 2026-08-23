"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClassroom } from "@/features/classroom/hooks/useClassroom";
import { useClassroomStore } from "@/features/classroom/store/classroomStore";
import { AvatarStage } from "@/features/classroom/components/AvatarStage";
import { SubtitleBar } from "@/features/classroom/components/SubtitleBar";
import { QuestionInput } from "@/features/classroom/components/QuestionInput";
import { SessionController } from "@/features/classroom/components/SessionController";
import { ChatPanel } from "@/features/classroom/components/ChatPanel";
import { AudioUnlockModal } from "@/features/classroom/components/AudioUnlockModal";
import { LeaveClassroomDialog } from "@/features/classroom/components/LeaveClassroomDialog";
import { ParticipantsModal } from "@/features/classroom/components/ParticipantsModal";
import { LectureScriptModal } from "@/features/classroom/components/LectureScriptModal";
import { SessionProgressHUD } from "@/features/classroom/components/SessionProgressHUD";
import { ProjectionBoard } from "@/features/classroom/components/ProjectionBoard";
import { VolumeControl } from "@/features/classroom/components/VolumeControl";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Copy,
  Link2,
  Users,
  Loader2,
  Clock,
  AlertTriangle,
  BookOpen,
  FileText,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { CourseFile, MediaAsset } from "@/lib/supabase/types";
import { MaterialViewerModal } from "@/features/materials/components/MaterialViewerModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ClassroomPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();
  const classroom = useClassroom(sessionId);
  const store = useClassroomStore();

  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);
  const [courseFiles, setCourseFiles] = useState<CourseFile[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [selectedViewFile, setSelectedViewFile] = useState<CourseFile | null>(null);

  // Forcefully exit students when the lecturer ends the session
  useEffect(() => {
    if (classroom.session && !classroom.isLecturer && classroom.sessionStatus === "ended") {
      toast.info("🎓 The instructor has concluded this lecture session.", {
        description: "Redirecting you to the home page...",
        duration: 3000,
      });
      const timer = setTimeout(() => {
        router.replace("/");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [classroom.session, classroom.isLecturer, classroom.sessionStatus, router]);

  if (!classroom.session || !classroom.user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 bg-background">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary animate-spin">
          <Loader2 className="h-6 w-6" />
        </div>
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Initializing Real-time Classroom...
        </p>
      </div>
    );
  }

  const isLecturer = classroom.isLecturer;
  const courseId = classroom.session.course_id;
  const meetingCode = classroom.session.meeting_code || classroom.session.id?.slice(0, 8);

  const avatarModel =
    classroom.session.voice_id?.startsWith("af_")
      ? "women-avatarsdk"
      : "men-avatarsdk";

  const hasWaitingStudents =
    isLecturer && classroom.participants.some((p) => p.status === "waiting");

  const handleCopyCode = () => {
    navigator.clipboard.writeText(meetingCode);
    toast.success(`Meeting code "${meetingCode}" copied!`);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/session/${encodeURIComponent(meetingCode)}`;
    navigator.clipboard.writeText(url);
    toast.success(`Session link copied!`);
  };

  const handleStopAndLeave = async () => {
    if (isLecturer && classroom.sessionStatus === "running") {
      await classroom.endSession();
    }
    router.push(`/course/${courseId}`);
  };

  const handleContinueInBackground = () => {
    router.push(`/course/${courseId}`);
  };

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden bg-background ${
        isLecturer ? "role-lecturer" : "role-student"
      }`}
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
                    className="p-3 rounded-2xl border border-border/40 bg-background/50 hover:border-[#0071e3]/40 transition-all flex items-center justify-between gap-3"
                  >
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
                      onClick={() => {
                        setSelectedViewFile(file);
                      }}
                      className="rounded-xl h-8 px-3 text-xs font-bold bg-[#0071e3] hover:bg-[#0077ed] text-white gap-1.5 cursor-pointer shadow-xs shrink-0"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>View PDF</span>
                    </Button>
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
        />
      )}

      {/* Classroom Header */}
      <header className="h-16 px-6 shrink-0 flex items-center justify-between border-b border-border/40 bg-card/40 backdrop-blur-xl z-20">
        <div className="flex items-center gap-4 min-w-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLeaveDialog(true)}
            className="rounded-xl h-9 px-3 gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Course Space</span>
          </Button>

          <div className="flex flex-col min-w-0">
            <h1 className="text-sm font-bold text-foreground truncate max-w-sm sm:max-w-md">
              {classroom.session.topic}
            </h1>
            <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1.5 uppercase tracking-wider">
              <span>Voice: {classroom.session.voice_id || "am_fenrir"}</span>
              <span>•</span>
              <span>Model: {avatarModel === "women-avatarsdk" ? "Dr. Clara (Female)" : "Prof. Arthur (Male)"}</span>
              <span>•</span>
              <span className={isLecturer ? "text-indigo-500 font-bold" : "text-emerald-500 font-bold"}>
                {isLecturer ? "Faculty Broadcast View" : "Student Immersion"}
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Course Materials / PDF Viewer Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
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
            }}
            className="rounded-xl h-9 px-3 gap-1.5 text-xs font-semibold cursor-pointer border-border/70 bg-card/60 hover:bg-card"
            title="View Course Textbooks & Materials"
          >
            <FileText className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[11px] hidden sm:inline">Course Materials</span>
          </Button>

          {/* View Script Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowScriptModal(true)}
            className="rounded-xl h-9 px-3 gap-1.5 text-xs font-semibold cursor-pointer border-border/70 bg-card/60 hover:bg-card"
            title="Inspect Lesson Script"
          >
            <BookOpen className="h-3.5 w-3.5 text-[#0071e3]" />
            <span className="text-[11px] hidden sm:inline">Curriculum Script</span>
            <span className="font-mono text-[10px] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">
              {store.items.length || 0}
            </span>
          </Button>

          {/* Meeting Code Copy Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyCode}
            className="rounded-xl h-9 px-3 gap-1.5 text-xs font-semibold cursor-pointer hidden sm:flex border-border/70 bg-card/60 hover:bg-card"
            title="Copy Meeting Code"
          >
            <Copy className="h-3.5 w-3.5" />
            <span className="font-mono text-[11px]">{meetingCode}</span>
          </Button>

          {/* Meeting Link Copy Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="rounded-xl h-9 px-3 gap-1.5 text-xs font-semibold cursor-pointer border-border/70 bg-card/60 hover:bg-card"
            title="Copy Direct Session Link"
          >
            <Link2 className="h-3.5 w-3.5 text-[#0071e3]" />
            <span className="text-[11px]">Copy Link</span>
          </Button>

          {/* Google Meet Participants & Active Count Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowParticipantsModal(true)}
            className="relative rounded-xl h-9 px-3 gap-1.5 text-xs font-semibold cursor-pointer border-border/70 bg-card/60 hover:bg-card"
            title="View Classroom Participants"
          >
            <Users className="h-3.5 w-3.5 text-[#0071e3]" />
            <span className="font-mono text-xs font-bold text-foreground">
              {classroom.participants.length}
            </span>
            {hasWaitingStudents && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-background animate-pulse" />
            )}
          </Button>

          <VolumeControl />

          <SessionController
            status={classroom.sessionStatus}
            isLecturer={isLecturer}
            activeStudentCount={classroom.activeStudentCount}
            emptyRoomCountdown={classroom.emptyRoomCountdown}
            stoppedReason={classroom.stoppedReason}
            onStart={classroom.startSession}
            onPause={classroom.pauseSession}
            onEnd={classroom.endSession}
            onRestart={classroom.restartSession}
          />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Classroom Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 overflow-hidden relative">
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
                className="rounded-xl px-5 h-9 bg-[#0071e3] hover:bg-[#0077ED] text-white font-semibold text-xs cursor-pointer shadow-xs"
              >
                Ask to Join Again
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/course/${courseId}`)}
                className="rounded-xl px-4 h-9 font-semibold text-xs cursor-pointer"
              >
                Return to Course Space
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
              className="mt-3 rounded-2xl px-6 h-10 bg-[#0071e3] hover:bg-[#0077ED] text-white font-semibold text-xs cursor-pointer shadow-lg shadow-[#0071e3]/20"
            >
              Return to Home
            </Button>
          </div>
        )}

        {/* 3D Avatar Stage & Overlay Area */}
        <div className="lg:col-span-3 flex flex-col relative h-full bg-gradient-to-b from-background via-background/95 to-muted/20 p-4">
          <div className="flex-1 relative w-full h-full rounded-3xl overflow-hidden shadow-2xl">
            {/* Top HUD: Session Progress & Script Trigger */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-full flex justify-center px-4">
              <SessionProgressHUD
                status={classroom.sessionStatus}
                currentIndex={store.currentIndex}
                totalItems={store.items.length}
                currentSpeechText={classroom.currentSpeech?.text}
                isThinking={classroom.isThinking}
                onOpenScript={() => setShowScriptModal(true)}
              />
            </div>

            <AvatarStage
              model={avatarModel}
              isSpeaking={Boolean(classroom.currentSpeech)}
              audioPath={classroom.currentSpeech?.audioPath}
              lipSyncData={classroom.currentSpeech?.lipSyncData}
              onLipSyncEnd={() => classroom.handleAudioEnd(classroom.currentSpeech?.requestId)}
            />

            {/* Live Visual Projection Board (Displays Extracted Diagrams & Figures) */}
            <ProjectionBoard
              media={classroom.activeMedia || store.activeMedia}
              onClose={() => classroom.setActiveMedia(null)}
            />

            {/* Subtitles Overlay */}
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 w-full flex justify-center">
              <SubtitleBar subtitle={classroom.currentSubtitle} />
            </div>

            {/* Question / Interruption Bar */}
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 w-full flex justify-center">
              <QuestionInput
                question={classroom.userQuestion}
                isThinking={classroom.isThinking}
                disabled={classroom.sessionStatus !== "running"}
                onQuestionChange={classroom.setUserQuestion}
                onSubmit={(e) => {
                  e?.preventDefault();
                  classroom.handleInterrupt();
                }}
              />
            </div>
          </div>
        </div>

        {/* Live Chat & Transcript Sidebar */}
        <div className="hidden lg:flex lg:col-span-1 h-full overflow-hidden">
          <ChatPanel sessionId={sessionId} userId={classroom.user.id} />
        </div>
      </div>
    </div>
  );
}
