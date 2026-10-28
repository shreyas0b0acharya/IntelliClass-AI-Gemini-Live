"use client";

import { useState } from "react";
import type { ClassroomParticipant } from "../types/classroom";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  Search,
  ShieldCheck,
  GraduationCap,
  Check,
  X,
  UserCheck,
  UserMinus,
  Clock,
} from "lucide-react";

interface ParticipantsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participants: ClassroomParticipant[];
  isLecturer: boolean;
  currentUserId?: string;
  onAdmit?: (userId: string) => void;
  onDeny?: (userId: string) => void;
  onKick?: (userId: string) => void;
  onAdmitAll?: () => void;
}

export function ParticipantsModal({
  open,
  onOpenChange,
  participants,
  isLecturer,
  currentUserId,
  onAdmit,
  onDeny,
  onKick,
  onAdmitAll,
}: ParticipantsModalProps) {
  const [search, setSearch] = useState("");

  const filtered = participants.filter((p) =>
    (p.name || "Anonymous").toLowerCase().includes(search.toLowerCase())
  );

  const lecturers = filtered.filter((p) => p.role === "lecturer");
  const admittedStudents = filtered.filter(
    (p) => p.role === "student" && p.status === "admitted"
  );
  const waitingStudents = filtered.filter(
    (p) => p.role === "student" && p.status === "waiting"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[94vw] sm:w-[90vw] md:max-w-lg max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl sm:rounded-3xl border border-border/60 bg-popover text-popover-foreground shadow-2xl"
      >
        {/* Header */}
        <DialogHeader className="shrink-0 p-5 pb-3 border-b border-border/50 bg-card/40 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-xs">
                <Users className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-bold tracking-tight text-foreground truncate">
                  Classroom People
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {participants.length} Participant{participants.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isLecturer && waitingStudents.length > 0 && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={onAdmitAll}
                  className="h-8 px-3 text-xs font-semibold inline-flex items-center gap-1.5 rounded-xl shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground transition-all shrink-0"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>Admit All ({waitingStudents.length})</span>
                </Button>
              )}

              <DialogClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                  aria-label="Close dialog"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogClose>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search participants by name..."
              className="h-9 pl-9 pr-3 text-xs rounded-xl bg-muted/40 border-border/60 focus-visible:bg-background transition-colors"
            />
          </div>
        </DialogHeader>

        {/* Participant List Content */}
        <div className="p-5 pt-4 max-h-[60vh] flex-1 min-h-0 overflow-y-auto space-y-6">
          {/* Waiting Room Requests (Lecturer Admission Controls) */}
          {isLecturer && waitingStudents.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-chart-4 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Waiting to Join ({waitingStudents.length})
                </span>
              </div>

              <div className="space-y-1.5">
                {waitingStudents.map((student) => (
                  <div
                    key={student.userId}
                    className="p-3 rounded-2xl bg-chart-4/10 border border-chart-4/20 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-chart-4/20 text-chart-4 dark:text-chart-4 font-bold text-xs flex items-center justify-center shrink-0">
                        {(student.name || "S")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground dark:text-foreground truncate">
                          {student.name}
                        </p>
                        <p className="text-xs text-muted-foreground">Wants to join broadcast</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="xs"
                        variant="default"
                        onClick={() => onAdmit?.(student.userId)}
 className="h-8 inline-flex items-center "
                        title="Accept / Admit Student"
                      >
                        <Check className="h-3.5 w-3.5 stroke-2" />
                        <span>Accept</span>
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => onDeny?.(student.userId)}
 className="h-8 inline-flex items-center "
                        title="Decline Student"
                      >
                        <X className="h-3.5 w-3.5 stroke-2" />
                        <span>Decline</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Host / Faculty Section */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              Host / Faculty ({lecturers.length})
            </span>

            {lecturers.length > 0 ? (
              <div className="space-y-1.5">
                {lecturers.map((lecturer) => (
                  <div
                    key={lecturer.userId}
                    className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                        {(lecturer.name || "L")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-foreground dark:text-foreground truncate">
                            {lecturer.name}
                          </p>
                          {lecturer.userId === currentUserId && (
                            <span className="text-xs font-semibold text-muted-foreground">(You)</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">Classroom Broadcaster</p>
                      </div>
                    </div>

                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      Host
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] text-center">
                <p className="text-xs text-muted-foreground">Faculty is operating in autonomous broadcast mode.</p>
              </div>
            )}
          </div>

          {/* Admitted Students Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Students in Classroom ({admittedStudents.length})
              </span>
            </div>

            {admittedStudents.length > 0 ? (
              <div className="space-y-1.5">
                {admittedStudents.map((student) => {
                  const isOnline = student.connectionStatus !== "offline";
                  return (
                    <div
                      key={student.userId}
                      className="p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 border border-black/5 dark:border-white/5 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-chart-2/15 text-chart-2 dark:text-chart-2 font-bold text-xs flex items-center justify-center shrink-0">
                            {(student.name || "S")[0].toUpperCase()}
                          </div>
                          {/* Live Presence Indicator */}
                          <span
                            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-border ${isOnline ? "bg-chart-2" : "bg-muted-foreground"
                              }`}
                            title={isOnline ? "Online" : "Temporarily Offline"}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-semibold text-foreground dark:text-foreground truncate">
                              {student.name}
                            </p>
                            {student.userId === currentUserId && (
                              <span className="text-xs font-semibold text-muted-foreground">(You)</span>
                            )}
                            {student.connectionCount && student.connectionCount > 1 ? (
                              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">
                                {student.connectionCount} tabs
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {isOnline ? "Connected" : "Reconnecting"} • Joined {student.joinedAt ? new Date(student.joinedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "just now"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold text-chart-2 dark:text-chart-2 bg-chart-2/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <GraduationCap className="h-3 w-3" />
                          Admitted
                        </span>

                        {isLecturer && student.userId !== currentUserId && (
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => onKick?.(student.userId)}
 className="h-7 inline-flex items-center "
                            title="Remove student from session"
                          >
                            <UserMinus className="h-3 w-3" />
                            <span className="hidden sm:inline">Remove</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 text-center">
                <p className="text-xs text-muted-foreground">
                  {waitingStudents.length > 0 ? "Students are waiting for admission above." : "No students currently connected to this lecture."}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
