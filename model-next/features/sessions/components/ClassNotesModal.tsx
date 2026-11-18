"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Copy,
  Download,
  Share2,
  CheckCircle2,
  Clock,
  Sparkles,
  BookOpen,
  Calendar,
  Layers,
  X,
  Loader2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { ClassroomSession } from "@/lib/supabase/types";

export interface FormattedSessionNote {
  id: string;
  topicId?: string;
  text: string;
  timestamp?: string;
  badge?: string;
}

export interface SessionNotesData {
  notesList: FormattedSessionNote[];
  markdownContent: string;
  previewSnippet: string;
  topicsCovered: string[];
  statusBadgeText: string;
  pausedTopicNumber?: number;
  totalTopics: number;
}

export function extractSessionNotes(session: ClassroomSession): SessionNotesData {
  const isEnded = session.status === "ended";
  const isPaused = session.status === "paused";
  const rawNotes = session.live_session_stats?.notes;
  const list: FormattedSessionNote[] = [];

  const formattedDate = new Date(session.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const code = session.meeting_code || session.id.slice(0, 8);
  const roadmapTopics: any[] = session.roadmap?.topics || [];
  const totalTopics = roadmapTopics.length || 1;
  const topicsCovered: string[] = roadmapTopics.map((t) => t.title || "Curriculum Topic");

  // Collect any live audio speech notes recorded during broadcast
  const speechNotes: FormattedSessionNote[] = [];
  if (Array.isArray(rawNotes)) {
    rawNotes.forEach((n: any, idx: number) => {
      if (typeof n === "string" && n.trim()) {
        speechNotes.push({
          id: `note_${idx}`,
          text: n.trim(),
          badge: "Spoken Takeaway",
        });
      } else if (n && typeof n === "object") {
        const text = n.text || n.content || JSON.stringify(n);
        if (text && text.trim()) {
          const isGenericSummary =
            text.includes("successfully completed all") ||
            text.includes("paused at Topic") ||
            text.includes("Lecture session successfully completed") ||
            text.includes("Final review concluded");
          speechNotes.push({
            id: n.id || `note_${idx}`,
            topicId: n.topicId,
            text: text.trim(),
            timestamp: n.timestamp,
            badge: isGenericSummary ? "Status Checkpoint" : "Spoken Takeaway",
          });
        }
      }
    });
  } else if (typeof rawNotes === "string" && rawNotes.trim()) {
    speechNotes.push({
      id: "note_single",
      text: rawNotes.trim(),
      badge: "Spoken Takeaway",
    });
  }

  const realSpeechNotes = speechNotes.filter((n) => n.badge === "Spoken Takeaway");

  let preview = "";
  let statusBadgeText = "";
  let pausedTopicNumber: number | undefined;

  if (isPaused) {
    const pausedTopicId = session.current_topic_id || session.live_session_stats?.currentTopicId;
    let topicIdx = roadmapTopics.findIndex((t) => t.id === pausedTopicId);
    if (topicIdx < 0) topicIdx = 0;
    pausedTopicNumber = topicIdx + 1;
    const currentTopic = roadmapTopics[topicIdx];
    const topicTitle = currentTopic?.title || session.topic || "Active Topic";

    statusBadgeText = `Paused at Topic ${pausedTopicNumber} of ${totalTopics}`;
    
    // Always lead with checkpoint location, then append a speech note snippet if available
    const pauseLeader = `⏸️ Paused at Topic ${pausedTopicNumber} of ${totalTopics}: "${topicTitle}"`;
    if (realSpeechNotes.length > 0) {
      const firstNote = realSpeechNotes[0].text.slice(0, 120);
      preview = `${pauseLeader} — ${firstNote}${firstNote.length === 120 ? "…" : ""}`;
    } else {
      preview = `${pauseLeader}. Checkpoint saved — ready to resume broadcast.`;
    }

    // 1. Primary Checkpoint Note
    list.push({
      id: `checkpoint_paused_${session.id}`,
      topicId: currentTopic?.id,
      text: `⏸️ Checkpoint: Lecture paused at Topic ${pausedTopicNumber} of ${totalTopics}: "${topicTitle}". State preserved in database. Ready to resume broadcast.`,
      timestamp: session.updated_at || session.created_at,
      badge: "Paused Checkpoint",
    });

    // 2. Real Spoken Lecture Notes (if any)
    realSpeechNotes.forEach((sn) => list.push(sn));

    // 3. Active In-Progress Topic Summary & Focus
    if (currentTopic) {
      const objectives = (currentTopic.learningObjectives || []).join("; ");
      list.push({
        id: `active_paused_${currentTopic.id || topicIdx}`,
        topicId: currentTopic.id,
        text: `Active Topic (Paused): ${topicTitle}${
          currentTopic.summary ? ` — ${currentTopic.summary}` : ""
        }${objectives ? ` (Core Focus: ${objectives})` : ""}`,
        badge: "In-Progress",
      });
    }

    // 4. Topics covered prior to pause
    for (let i = 0; i < topicIdx; i++) {
      const prevTopic = roadmapTopics[i];
      list.push({
        id: `prior_covered_${prevTopic.id || i}`,
        topicId: prevTopic.id,
        text: `✓ Completed Prior to Pause: Topic ${i + 1}: ${prevTopic.title}${
          prevTopic.summary ? ` — ${prevTopic.summary}` : ""
        }`,
        badge: "Delivered",
      });
    }

    // 5. Pending Topics upon resumption
    if (topicIdx < totalTopics - 1) {
      const remainingTitles = roadmapTopics.slice(topicIdx + 1).map((t) => t.title).join("; ");
      list.push({
        id: `pending_resumption_${session.id}`,
        text: `⏳ Pending Resumption: ${totalTopics - 1 - topicIdx} upcoming topic(s) to complete upon resume (${remainingTitles}).`,
        badge: "Pending",
      });
    }

  } else if (isEnded) {
    statusBadgeText = `All ${totalTopics} topics completed`;

    if (realSpeechNotes.length > 0) {
      preview = realSpeechNotes.slice(0, 2).map((n) => n.text).join(" • ");
    } else {
      preview = `✓ Completed lecture across all ${totalTopics} topics on ${formattedDate}. All core curriculum learning objectives delivered.`;
    }

    // 1. Completion Concluded Note
    list.push({
      id: `checkpoint_ended_${session.id}`,
      text: `✓ Lecture Concluded: Successfully completed all ${totalTopics} curriculum topics on ${formattedDate}. Full lecture delivered and archived.`,
      timestamp: session.updated_at || session.created_at,
      badge: "Completed",
    });

    // 2. Real Spoken Lecture Notes (if any)
    realSpeechNotes.forEach((sn) => list.push(sn));

    // 3. Full Delivered Modules List
    roadmapTopics.forEach((t, idx) => {
      const objectives = (t.learningObjectives || []).join("; ");
      list.push({
        id: `topic_delivered_${t.id || idx}`,
        topicId: t.id,
        text: `✓ Delivered Topic ${idx + 1} of ${totalTopics}: ${t.title}${
          t.summary ? ` — ${t.summary}` : ""
        }${objectives ? ` [Mastered Objectives: ${objectives}]` : ""}`,
        badge: "Delivered",
      });
    });

  } else {
    // Draft / Running / Scheduled
    statusBadgeText = `${totalTopics} topics planned`;
    if (realSpeechNotes.length > 0) {
      list.push(...realSpeechNotes);
      preview = realSpeechNotes.slice(0, 2).map((n) => n.text).join(" • ");
    } else {
      roadmapTopics.forEach((t, idx) => {
        const objectives = (t.learningObjectives || []).join("; ");
        list.push({
          id: `topic_${t.id || idx}`,
          topicId: t.id,
          text: `Topic ${idx + 1}: ${t.title}${t.summary ? `: ${t.summary}` : ""}${
            objectives ? ` (Objectives: ${objectives})` : ""
          }`,
        });
      });
      preview = `Curriculum roadmap initialized with ${totalTopics} topics for ${session.topic}.`;
    }
  }

  const statusLabel = isEnded
    ? `Completed (All ${totalTopics} Topics Delivered)`
    : isPaused
    ? `Paused (Checkpoint at Topic ${pausedTopicNumber || 1} of ${totalTopics})`
    : "Live / In-Progress";

  let markdown = `# ${session.topic} — Class Notes & Key Takeaways\n\n`;
  markdown += `**Class Status:** ${statusLabel}  \n`;
  markdown += `**Conducted Date:** ${formattedDate}  \n`;
  markdown += `**Meeting Code:** \`${code}\`  \n\n`;

  if (isPaused) {
    const topicIdx = (pausedTopicNumber || 1) - 1;
    const currentTopic = roadmapTopics[topicIdx];
    const topicTitle = currentTopic?.title || session.topic;
    markdown += `> ⏸️ **Lecture Paused Checkpoint:** Currently paused at Topic ${
      pausedTopicNumber || 1
    } of ${totalTopics}: *"${topicTitle}"*. Checkpoint state preserved in database. Broadcasting will resume from this module.\n\n`;
    
    if (roadmapTopics.length > 0) {
      markdown += `### Lecture Resumption Overview\n`;
      markdown += `- **Active Checkpoint:** Topic ${pausedTopicNumber || 1}: ${topicTitle}\n`;
      if (topicIdx > 0) {
        markdown += `- **Delivered Before Pause:** Topics 1 through ${topicIdx}\n`;
      }
      if (topicIdx < totalTopics - 1) {
        markdown += `- **Remaining After Resume:** Topics ${topicIdx + 2} through ${totalTopics}\n`;
      }
      markdown += `\n`;
    }
  } else if (isEnded) {
    markdown += `> ✓ **Lecture Successfully Concluded:** Full curriculum broadcast finished across all ${totalTopics} topics on ${formattedDate}. All core learning objectives delivered and preserved.\n\n`;
    if (topicsCovered.length > 0) {
      markdown += `### Delivered Curriculum Topics\n`;
      topicsCovered.forEach((title, idx) => {
        markdown += `- **Topic ${idx + 1}:** ${title}\n`;
      });
      markdown += `\n`;
    }
  }

  if (list.length > 0) {
    markdown += `### Detailed Notes & Checkpoints\n\n`;
    list.forEach((item, i) => {
      const timeStr = item.timestamp
        ? ` *(${new Date(item.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })})*`
        : "";
      markdown += `${i + 1}. ${item.text}${timeStr}\n\n`;
    });
  } else {
    markdown += `### Summary\n\nInteractive AI college lecture covering curriculum objectives for **${session.topic}**.\n`;
  }

  return {
    notesList: list,
    markdownContent: markdown,
    previewSnippet: preview,
    topicsCovered,
    statusBadgeText,
    pausedTopicNumber,
    totalTopics,
  };
}

export interface ClassNotesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ClassroomSession;
  isLecturer?: boolean;
}

export function ClassNotesModal({
  open,
  onOpenChange,
  session,
  isLecturer = false,
}: ClassNotesModalProps) {
  const [viewMode, setViewMode] = useState<"structured" | "markdown">("structured");
  const [isPromoting, setIsPromoting] = useState(false);
  const [isPromoted, setIsPromoted] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const notesData = extractSessionNotes(session);
  const isEnded = session.status === "ended";
  const isPaused = session.status === "paused";

  const formattedDate = new Date(session.created_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const meetingCode = session.meeting_code || session.id.slice(0, 8);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(notesData.markdownContent);
      setHasCopied(true);
      toast.success("Class notes copied to clipboard!");
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      toast.error("Failed to copy notes.");
    }
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([notesData.markdownContent], {
        type: "text/markdown;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const cleanTitle = session.topic.replace(/[^a-zA-Z0-9_-]/g, "_");
      link.href = url;
      link.download = `${cleanTitle}_Class_Notes.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Class notes downloaded as Markdown (.md)!");
    } catch {
      toast.error("Failed to download notes.");
    }
  };

  const handlePromoteToMaterial = async () => {
    if (!isLecturer || isPromoted) return;
    setIsPromoting(true);
    try {
      const res = await api.saveNotesAsCourseMaterial(session.id, {
        title: `${session.topic} — Class Notes`,
        content: notesData.markdownContent,
      });
      setIsPromoted(true);
      toast.success(res.message || "Class notes saved to Course Materials tab!");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("intelliclass:materials-changed"));
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to promote notes to Course Material."
      );
    } finally {
      setIsPromoting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[80vw] max-w-[80vw] h-[80vh] max-h-[80vh] overflow-hidden flex flex-col p-0 gap-0 rounded-3xl border border-border/60 bg-popover text-popover-foreground shadow-2xl"
      >
        {/* Header */}
        <DialogHeader className="shrink-0 p-5 sm:p-6 pb-4 border-b border-border/50 bg-card/40 backdrop-blur-md">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-base sm:text-lg font-bold tracking-tight truncate max-w-xl">
                    {session.topic}
                  </DialogTitle>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isEnded
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        : isPaused
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        : "bg-primary/10 text-primary border-primary/20"
                    }`}
                  >
                    {isEnded ? "Completed Class" : isPaused ? "Paused Class" : "Live Session"}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-muted-foreground">
                    Code: {meetingCode}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate max-w-xl mt-0.5">
                  Conducted on {formattedDate} • {notesData.notesList.length} notes &amp; checkpoints
                </p>
              </div>
            </div>

            {/* Action Buttons in Header */}
            <div className="flex items-center gap-2 shrink-0">
              {isLecturer && (
                <Button
                  size="sm"
                  variant={isPromoted ? "outline" : "default"}
                  onClick={handlePromoteToMaterial}
                  disabled={isPromoting || isPromoted}
                  className="font-semibold text-xs h-9 rounded-xl gap-1.5 shadow-xs"
                >
                  {isPromoting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isPromoted ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Share2 className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {isPromoted
                      ? "Saved in Materials"
                      : isPromoting
                      ? "Saving..."
                      : "Promote to Material"}
                  </span>
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="font-semibold text-xs h-9 rounded-xl gap-1.5"
                title="Copy notes to clipboard"
              >
                {hasCopied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>{hasCopied ? "Copied" : "Copy"}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="font-semibold text-xs h-9 rounded-xl gap-1.5"
                title="Download notes as markdown"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Download .md</span>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Top Meta Strip */}
        <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:px-6 sm:py-3.5 bg-muted/20 border-b border-border/40">
          <div className="p-2.5 rounded-xl bg-background/60 border border-border/50 text-center">
            <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
              Total Checkpoints
            </div>
            <div className="text-sm font-bold font-mono text-foreground mt-0.5">
              {notesData.notesList.length} Notes
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-background/60 border border-border/50 text-center">
            <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
              Lecture Status
            </div>
            <div
              className={`text-sm font-bold mt-0.5 ${
                isEnded ? "text-emerald-500" : isPaused ? "text-amber-500" : "text-primary"
              }`}
            >
              {isEnded ? "Completed" : isPaused ? "Paused" : "Live"}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-background/60 border border-border/50 text-center">
            <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
              Delivery Engine
            </div>
            <div className="text-sm font-bold text-foreground mt-0.5">
              Gemini Live AI
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-background/60 border border-border/50 text-center">
            <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
              Curriculum Topics
            </div>
            <div className="text-sm font-bold font-mono text-primary mt-0.5">
              {notesData.topicsCovered.length || 1} Modules
            </div>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="shrink-0 flex items-center justify-between px-6 py-2.5 border-b border-border/30 bg-card/20">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant={viewMode === "structured" ? "default" : "ghost"}
              size="xs"
              onClick={() => setViewMode("structured")}
              className="h-7 text-xs font-semibold rounded-lg"
            >
              <Layers className="h-3.5 w-3.5 mr-1" />
              <span>Checkpoint Cards</span>
            </Button>
            <Button
              type="button"
              variant={viewMode === "markdown" ? "default" : "ghost"}
              size="xs"
              onClick={() => setViewMode("markdown")}
              className="h-7 text-xs font-semibold rounded-lg"
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              <span>Markdown Source</span>
            </Button>
          </div>

          <span className="text-xs text-muted-foreground">
            Auto-captured and synced to course space
          </span>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {viewMode === "structured" ? (
            <div className="space-y-4 max-w-4xl mx-auto">
              {/* Covered Curriculum Topics Banner if available */}
              {notesData.topicsCovered.length > 0 && (
                <div className="p-4 rounded-2xl bg-primary/[0.03] border border-primary/15 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                    <span className="text-primary flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>Curriculum Syllabus Coverage</span>
                    </span>
                    <span className="text-muted-foreground font-mono text-[11px]">
                      {isEnded
                        ? `All ${notesData.totalTopics} Topics Mastered`
                        : isPaused
                        ? `Paused at Topic ${notesData.pausedTopicNumber || 1} of ${notesData.totalTopics}`
                        : `${notesData.totalTopics} Topics`}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    {notesData.topicsCovered.map((topic, i) => {
                      const topicNumber = i + 1;
                      const isDelivered =
                        isEnded ||
                        (isPaused &&
                          notesData.pausedTopicNumber !== undefined &&
                          topicNumber < notesData.pausedTopicNumber);
                      const isCurrentPaused =
                        isPaused && notesData.pausedTopicNumber === topicNumber;

                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-2 text-xs font-medium p-2.5 rounded-xl border transition-all ${
                            isCurrentPaused
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
                              : isDelivered
                              ? "bg-background/80 border-border/40 text-foreground"
                              : "bg-muted/30 border-dashed border-border/40 text-muted-foreground"
                          }`}
                        >
                          {isCurrentPaused ? (
                            <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          ) : isDelivered ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/40 shrink-0" />
                          )}
                          <span className="truncate">
                            Topic {topicNumber}: {topic}
                          </span>
                          {isCurrentPaused && (
                            <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400">
                              Paused
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Checkpoint Notes Cards */}
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Detailed Class Notes ({notesData.notesList.length})</span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Chronological order
                  </span>
                </div>

                {notesData.notesList.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl border border-dashed border-border/60 bg-muted/10">
                    <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-semibold text-foreground">
                      No Speech Notes Captured Yet
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                      During live class broadcasts, speaking turns and whiteboard explanations are
                      automatically saved as durable notes checkpoints.
                    </p>
                  </div>
                ) : (
                  notesData.notesList.map((item, index) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-card border border-border/50 shadow-xs hover:border-border transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                            {index + 1}
                          </span>
                          <span>
                            {item.badge === "Spoken Takeaway"
                              ? `Lecture Note #${index + 1}`
                              : `Checkpoint #${index + 1}`}
                          </span>
                          {item.badge && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ml-1.5 ${
                                item.badge === "Spoken Takeaway"
                                  ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20"
                                  : item.badge === "Paused Checkpoint"
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                  : item.badge === "In-Progress"
                                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                  : item.badge === "Completed" || item.badge === "Delivered"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </span>
                        {item.timestamp && (
                          <span className="flex items-center gap-1 font-mono text-[11px]">
                            <Clock className="h-3 w-3" />
                            {new Date(item.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                        {item.text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto h-full flex flex-col">
              <pre className="flex-1 p-5 rounded-2xl bg-muted/40 border border-border/50 text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed overflow-y-auto">
                {notesData.markdownContent}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
