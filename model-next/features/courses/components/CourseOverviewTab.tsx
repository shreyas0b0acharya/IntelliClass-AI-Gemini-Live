"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Course, CourseFile, ClassroomSession, CourseStudent } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { StatusBadge, CopyCodeBadge } from "@/components/shared";
import { FileUploadDialog } from "@/features/materials";
import { CreateSessionDialog } from "@/features/sessions";
import {
  Users,
  Presentation,
  MapPin,
  FileText,
  Play,
  Radio,
  Plus,
  Upload,
  UserPlus,
  Calendar,
  Clock,
  Sparkles,
  ArrowRight,
  Pencil,
  RotateCcw,
  BookOpen,
  CheckCircle2,
  Check,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface CourseOverviewTabProps {
  course: Course;
  isLecturer: boolean;
  sessions: ClassroomSession[];
  materials: CourseFile[];
  students: CourseStudent[];
  pendingRequestsCount: number;
  onTabChange: (tab: string) => void;
  onRefreshCourse: () => void;
  onRefreshMaterials: () => void;
  onRefreshSessions: () => void;
}

export function CourseOverviewTab({
  course,
  isLecturer,
  sessions,
  materials,
  students,
  pendingRequestsCount,
  onTabChange,
  onRefreshCourse,
  onRefreshMaterials,
  onRefreshSessions,
}: CourseOverviewTabProps) {
  const router = useRouter();

  // Edit Course Modal State
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [editTitle, setEditTitle] = useState(course.title);
  const [editDesc, setEditDesc] = useState(course.description || "");
  const [editInstructions, setEditInstructions] = useState(course.teaching_instructions || "");
  const [isSavingCourse, setIsSavingCourse] = useState(false);

  // Invite Students Modal State
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Calculate Metrics
  const enrolledCount = students.length || 0;
  const completedSessions = sessions.filter((s) => s.status === "ended");
  const completedCount = completedSessions.length;

  // Next Scheduled Class
  const now = Date.now();
  const scheduledSessions = sessions
    .filter(
      (s) =>
        s.status === "scheduled" ||
        (s.status === "created" && s.target_epoch_ms && s.target_epoch_ms > now)
    )
    .sort((a, b) => (a.target_epoch_ms || 0) - (b.target_epoch_ms || 0));
  const nextScheduled = scheduledSessions[0];

  // Active / Live Session
  const liveSession = sessions.find((s) => s.status === "running");

  // Recent Sessions (up to 4)
  const recentSessions = [...sessions]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 4);

  // Count roadmap topics across sessions
  const totalTopics = sessions.reduce((acc, s) => {
    return acc + (s.roadmap?.topics?.length || 0);
  }, 0);

  // Handle Save Course Details
  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      toast.error("Please enter a course title.");
      return;
    }
    setIsSavingCourse(true);
    try {
      await api.updateCourse(course.id, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        teaching_instructions: editInstructions.trim(),
      });
      toast.success("Course details updated successfully!");
      setIsEditingCourse(false);
      onRefreshCourse();
    } catch (err: unknown) {
      console.error("Update course error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update course.");
    } finally {
      setIsSavingCourse(false);
    }
  };

  // Handle Invite Dispatch
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error("Please enter an email address.");
      return;
    }
    setIsSendingInvite(true);
    try {
      await api.manageStudentRequest(course.id, {
        action: "invite",
        email: inviteEmail.trim(),
      });
      toast.success(`Invitation dispatched to ${inviteEmail.trim()}`);
      setInviteEmail("");
      setIsInviteOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send invitation.");
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleCopyCourseLink = () => {
    const url = `${window.location.origin}/join?courseId=${course.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.success("Course invitation link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleRepeatSession = async (session: ClassroomSession) => {
    try {
      toast.info(`Cloning session "${session.topic}"...`);
      const res = await api.repeatClass(session.id);
      toast.success("Session cloned! Opening studio...");
      onRefreshSessions();
      router.push(`/course/${course.id}/sessions/new?topic=${encodeURIComponent(session.topic)}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to repeat session.");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* ── 1. Metrics Snapshot ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1: Students */}
        <div
          onClick={() => onTabChange("students")}
          className="p-5 rounded-3xl border border-black/5 dark:border-white/5 bg-white dark:bg-card shadow-xs hover:border-primary/30 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Students
            </span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {enrolledCount}
            </span>
            <span className="text-xs text-muted-foreground font-medium">Enrolled</span>
          </div>
          {pendingRequestsCount > 0 && (
            <p className="text-[11px] text-amber-500 font-semibold mt-1">
              +{pendingRequestsCount} pending approval
            </p>
          )}
        </div>

        {/* Metric 2: Completed Classes */}
        <div
          onClick={() => onTabChange("classes")}
          className="p-5 rounded-3xl border border-black/5 dark:border-white/5 bg-white dark:bg-card shadow-xs hover:border-primary/30 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Classes
            </span>
            <div className="w-8 h-8 rounded-xl bg-chart-2/10 text-chart-2 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Presentation className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {completedCount}
            </span>
            <span className="text-xs text-muted-foreground font-medium">Completed</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {sessions.length} total sessions
          </p>
        </div>

        {/* Metric 3: Roadmap Topics */}
        <div
          onClick={() => onTabChange("roadmaps")}
          className="p-5 rounded-3xl border border-black/5 dark:border-white/5 bg-white dark:bg-card shadow-xs hover:border-primary/30 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Curriculum
            </span>
            <div className="w-8 h-8 rounded-xl bg-chart-4/10 text-chart-4 flex items-center justify-center group-hover:scale-110 transition-transform">
              <MapPin className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {totalTopics || sessions.length || 0}
            </span>
            <span className="text-xs text-muted-foreground font-medium">Topics</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Structured roadmaps</p>
        </div>

        {/* Metric 4: Materials */}
        <div
          onClick={() => onTabChange("materials")}
          className="p-5 rounded-3xl border border-black/5 dark:border-white/5 bg-white dark:bg-card shadow-xs hover:border-primary/30 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sources
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {materials.length}
            </span>
            <span className="text-xs text-muted-foreground font-medium">Materials</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Ready for RAG grounding</p>
        </div>
      </div>

      {/* ── 2. Quick Actions Bar ────────────────────────────────────────── */}
      <div className="p-4 sm:p-5 rounded-3xl border border-black/5 dark:border-white/5 bg-white/60 dark:bg-card/60 backdrop-blur-md shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            Quick Actions
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isLecturer && (
            <>
              {/* Action 1: Start a Class */}
              <Button asChild variant="default" size="sm" className="h-9 px-4 font-semibold">
                <Link href={`/course/${course.id}/sessions/new`}>
                  <Play className="h-3.5 w-3.5 fill-current mr-1.5" />
                  <span>Start a Class</span>
                </Link>
              </Button>

              {/* Action 2: Create Roadmap */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onTabChange("roadmaps")}
                className="h-9 px-3.5 font-semibold"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5 text-primary" />
                <span>Create Roadmap</span>
              </Button>

              {/* Action 3: Add Materials */}
              <FileUploadDialog
                courseId={course.id}
                onUploaded={onRefreshMaterials}
                trigger={
                  <Button variant="outline" size="sm" className="h-9 px-3.5 font-semibold">
                    <Upload className="h-3.5 w-3.5 mr-1.5 text-primary" />
                    <span>Add Materials</span>
                  </Button>
                }
              />

              {/* Action 4: Invite Students */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsInviteOpen(true)}
                className="h-9 px-3.5 font-semibold"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1.5 text-primary" />
                <span>Invite Students</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── 3. Next Scheduled Class or Live Broadcast Banner ───────────── */}
      {liveSession ? (
        <div className="p-6 rounded-3xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
              <Radio className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">
                  Broadcast In Progress
                </span>
                <CopyCodeBadge code={liveSession.meeting_code || liveSession.id.slice(0, 8)} />
              </div>
              <h3 className="text-lg font-bold text-foreground mt-0.5">
                {liveSession.topic}
              </h3>
            </div>
          </div>
          <Button asChild size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700 h-10 px-5">
            <Link href={`/classroom/${liveSession.id}`} className="inline-flex items-center gap-2">
              <span>Enter Live Studio</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : nextScheduled ? (
        <div className="p-6 rounded-3xl border border-sky-500/25 bg-sky-500/5 dark:bg-sky-500/10 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/15 text-sky-500 flex items-center justify-center shrink-0">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-500">
                  Next Scheduled Class
                </span>
                <StatusBadge status="scheduled" />
              </div>
              <h3 className="text-lg font-bold text-foreground mt-0.5">
                {nextScheduled.topic}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                <Clock className="h-3 w-3" />
                <span>
                  {nextScheduled.target_epoch_ms
                    ? new Date(nextScheduled.target_epoch_ms).toLocaleString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : new Date(nextScheduled.created_at).toLocaleDateString()}
                </span>
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="default" className="h-10 px-5">
            <Link href={`/classroom/${nextScheduled.id}`} className="inline-flex items-center gap-2">
              <span>Review &amp; Launch</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : null}

      {/* ── 4. Main Two-Column Overview Canvas ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Course Space Overview & Teaching Instructions (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Course Details Card */}
          <div className="p-6 rounded-3xl border border-black/5 dark:border-white/5 bg-white dark:bg-card shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <span>Teaching Instructions &amp; Objectives</span>
              </h3>
              {isLecturer && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setEditTitle(course.title);
                    setEditDesc(course.description || "");
                    setEditInstructions(course.teaching_instructions || "");
                    setIsEditingCourse(true);
                  }}
                  className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  <span>Edit</span>
                </Button>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Course Overview</span>
                <p className="text-sm text-foreground/90 leading-relaxed mt-0.5">
                  {course.description || "No overview configured. Click edit to set course objectives."}
                </p>
              </div>
              {course.teaching_instructions && (
                <div className="pt-2 border-t border-black/5 dark:border-white/5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Teaching Instructions</span>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                    {course.teaching_instructions}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Teaching Classes */}
          <div className="p-6 rounded-3xl border border-black/5 dark:border-white/5 bg-white dark:bg-card shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Presentation className="h-4 w-4 text-primary" />
                <span>Recent Classes &amp; Records</span>
              </h3>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onTabChange("classes")}
                className="h-7 text-xs text-primary"
              >
                <span>View All ({sessions.length})</span>
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>

            {recentSessions.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-2xl p-4">
                No classes conducted yet. Click &quot;Start a Class&quot; to begin your first lecture.
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentSessions.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] flex items-center justify-between gap-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground truncate">
                          {s.topic}
                        </span>
                        <StatusBadge status={s.status} />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isLecturer && s.status === "ended" && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => handleRepeatSession(s)}
                          title="Repeat this class configuration"
                          className="h-8 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          <span>Repeat</span>
                        </Button>
                      )}
                      <Button asChild variant="outline" size="xs" className="h-8 text-xs px-3">
                        <Link href={`/classroom/${s.id}`}>
                          <span>{s.status === "running" ? "Broadcast" : "Open"}</span>
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Recent Materials & Student Join Requests (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Student Requests Banner */}
          {pendingRequestsCount > 0 && (
            <div className="p-5 rounded-3xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  <span>Join Requests Pending</span>
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  {pendingRequestsCount}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {pendingRequestsCount} student(s) requested admission to this Course Space.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onTabChange("students")}
                className="w-full text-xs h-8 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              >
                <span>Review &amp; Approve Students</span>
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}

          {/* Recently Added Materials */}
          <div className="p-6 rounded-3xl border border-black/5 dark:border-white/5 bg-white dark:bg-card shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span>Course Materials</span>
              </h3>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onTabChange("materials")}
                className="h-7 text-xs text-primary"
              >
                <span>View Library ({materials.length})</span>
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>

            {materials.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-2xl p-4">
                No syllabus materials uploaded. Upload PDFs to enable Gemini diagram projections.
              </div>
            ) : (
              <div className="space-y-2">
                {materials.slice(0, 4).map((f) => (
                  <div
                    key={f.id}
                    className="p-3 rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground truncate">{f.file_name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {((f.file_size || 0) / (1024 * 1024)).toFixed(1)} MB &bull; Ready
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Edit Course Dialog ─────────────────────────────────────────── */}
      <Dialog open={isEditingCourse} onOpenChange={setIsEditingCourse}>
        <DialogContent className="flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Edit Course Space</DialogTitle>
            <DialogDescription>
              Update course title and AI teaching guidelines.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveCourse} className="flex-1 min-h-0 flex flex-col justify-between pt-4 space-y-4">
            <div className="space-y-2 shrink-0">
              <Label htmlFor="edit-title">Course Title</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                disabled={isSavingCourse}
                required
                className="h-11"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
              <div className="space-y-2 flex flex-col min-h-0">
                <Label htmlFor="edit-desc">Course Overview &amp; Outcomes</Label>
                <Textarea
                  id="edit-desc"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Course overview and intended outcomes..."
                  disabled={isSavingCourse}
                  className="flex-1 min-h-[140px] resize-none"
                />
              </div>
              <div className="space-y-2 flex flex-col min-h-0">
                <Label htmlFor="edit-instructions">Teaching Instructions (Optional)</Label>
                <Textarea
                  id="edit-instructions"
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                  placeholder="Preferred teaching style, level, language, and constraints..."
                  disabled={isSavingCourse}
                  className="flex-1 min-h-[140px] resize-none"
                />
              </div>
            </div>
            <DialogFooter className="shrink-0 pt-4 border-t border-black/5 dark:border-white/5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditingCourse(false)}
                disabled={isSavingCourse}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingCourse}>
                {isSavingCourse ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Invite Students Dialog ─────────────────────────────────────── */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Invite Students</DialogTitle>
            <DialogDescription>
              Share the course invitation link or send an invite directly by email.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 min-h-0 pt-6 items-start">
            {/* Left: Shareable Link */}
            <div className="p-6 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
              <div className="space-y-1">
                <Label className="text-sm font-bold">Course Invitation Link</Label>
                <p className="text-xs text-muted-foreground">Any student with this link can request access to this Course Space.</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/join?courseId=${course.id}`}
                  className="font-mono text-xs h-10"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyCourseLink}
                  className="shrink-0 h-10 px-4"
                >
                  {copiedLink ? <Check className="h-4 w-4 text-emerald-500 mr-1.5" /> : null}
                  <span>{copiedLink ? "Copied" : "Copy Link"}</span>
                </Button>
              </div>
            </div>

            {/* Right: Direct Email */}
            <form onSubmit={handleSendInvite} className="p-6 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
              <div className="space-y-1">
                <Label htmlFor="invite-email" className="text-sm font-bold">Send Direct Email Invitation</Label>
                <p className="text-xs text-muted-foreground">Deliver an invitation email directly to the student&apos;s institutional inbox.</p>
              </div>
              <Input
                id="invite-email"
                type="email"
                placeholder="student@university.edu"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={isSendingInvite}
                className="h-10 text-sm"
              />
              <Button type="submit" disabled={isSendingInvite || !inviteEmail.trim()} className="w-full h-10 font-semibold">
                {isSendingInvite ? "Sending..." : "Send Invitation"}
              </Button>
            </form>
          </div>
          <DialogFooter className="shrink-0 pt-4 border-t border-black/5 dark:border-white/5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsInviteOpen(false)}
              disabled={isSendingInvite}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
