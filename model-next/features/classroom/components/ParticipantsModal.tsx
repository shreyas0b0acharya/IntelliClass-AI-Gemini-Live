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
  Mic,
  MicOff,
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
  floorHolderId?: string | null;
  onGrantFloor?: (userId: string) => void;
  onRevokeFloor?: (userId: string) => void;
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
  floorHolderId,
  onGrantFloor,
  onRevokeFloor,
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
        className="w-[80vw] max-w-[80vw] h-[80vh] max-h-[80vh] overflow-hidden flex flex-col p-0 gap-0 rounded-3xl border border-border/60 bg-popover text-popover-foreground shadow-2xl"
      >
        {/* Header */}
        <DialogHeader className="shrink-0 p-6 pb-4 border-b border-border/50 bg-card/40 backdrop-blur-md">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-xs">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg font-bold tracking-tight text-foreground truncate">
                  Classroom People & Floor Controls
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {participants.length} Participant{participants.length !== 1 ? "s" : ""} active in this session
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="relative w-64 md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search participants by name..."
                  className="h-9 pl-9 pr-3 text-xs rounded-xl bg-muted/40 border-border/60 focus-visible:bg-background transition-colors"
                />
              </div>

              {isLecturer && waitingStudents.length > 0 && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={onAdmitAll}
                  className="h-9 px-3.5 text-xs font-semibold inline-flex items-center gap-1.5 rounded-xl shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground transition-all shrink-0"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>Admit All ({waitingStudents.length})</span>
                </Button>
              )}

              <DialogClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                  aria-label="Close dialog"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogClose>
            </div>
          </div>
        </DialogHeader>

        {/* 2-Column Content Grid: Left (Waiting & Hosts), Right (Admitted Students) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-border/50">
          {/* Left Column: Waiting Queue & Hosts (4 cols) */}
          <div className="lg:col-span-4 p-6 flex flex-col gap-6 overflow-y-auto bg-muted/10">
            {/* Waiting Room Requests (Lecturer Admission Controls) */}
            {isLecturer && waitingStudents.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-chart-4 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Waiting to Join ({waitingStudents.length})
                  </span>
                </div>

                <div className="space-y-2">
                  {waitingStudents.map((student) => (
                    <div
                      key={student.userId}
                      className="p-3 rounded-2xl bg-chart-4/10 border border-chart-4/20 flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-chart-4/20 text-chart-4 font-bold text-xs flex items-center justify-center shrink-0">
                          {(student.name || "S")[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">
                            {student.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">Wants to join broadcast</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="xs"
                          variant="default"
                          onClick={() => onAdmit?.(student.userId)}
                          className="h-7 px-2.5 inline-flex items-center gap-1 text-xs font-semibold rounded-lg"
                          title="Accept / Admit Student"
                        >
                          <Check className="h-3.5 w-3.5 stroke-2" />
                          <span>Admit</span>
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => onDeny?.(student.userId)}
                          className="h-7 px-2 text-xs rounded-lg text-muted-foreground hover:text-destructive"
                          title="Decline Student"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Host / Faculty Section */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Host / Faculty ({lecturers.length})
              </span>

              {lecturers.length > 0 ? (
                <div className="space-y-2">
                  {lecturers.map((lecturer) => (
                    <div
                      key={lecturer.userId}
                      className="p-3.5 rounded-2xl bg-card border border-border/60 flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                          {(lecturer.name || "L")[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-foreground truncate">
                              {lecturer.name}
                            </p>
                            {lecturer.userId === currentUserId && (
                              <span className="text-[11px] font-semibold text-muted-foreground">(You)</span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">Classroom Broadcaster</p>
                        </div>
                      </div>

                      <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Host
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-card border border-border/40 text-center">
                  <p className="text-xs text-muted-foreground">Faculty is operating in autonomous broadcast mode.</p>
                </div>
              )}
            </div>

            {/* Session Stats card */}
            <div className="mt-auto p-4 rounded-2xl bg-card border border-border/60 space-y-2 text-xs">
              <p className="font-semibold text-foreground">Live Room Summary</p>
              <div className="flex justify-between text-muted-foreground">
                <span>Admitted:</span>
                <span className="font-semibold text-foreground">{admittedStudents.length}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Waiting Approval:</span>
                <span className="font-semibold text-chart-4">{waitingStudents.length}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Microphone Floor:</span>
                <span className="font-semibold text-foreground">
                  {floorHolderId ? (participants.find(p => p.userId === floorHolderId)?.name || "Active") : "Open / Teacher"}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Admitted Students Roster (8 cols) */}
          <div className="lg:col-span-8 p-6 flex flex-col gap-4 overflow-hidden">
            <div className="flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Students in Classroom ({admittedStudents.length})
              </span>
              <span className="text-xs text-muted-foreground">
                {admittedStudents.filter(s => s.connectionStatus !== "offline").length} Online
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              {admittedStudents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {admittedStudents.map((student) => {
                    const isOnline = student.connectionStatus !== "offline";
                    return (
                      <div
                        key={student.userId}
                        className="p-3.5 rounded-2xl bg-card hover:bg-muted/30 border border-border/60 transition-colors flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-9 h-9 rounded-full bg-chart-2/15 text-chart-2 font-bold text-xs flex items-center justify-center">
                              {(student.name || "S")[0].toUpperCase()}
                            </div>
                            <span
                              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${
                                isOnline ? "bg-chart-2" : "bg-muted-foreground"
                              }`}
                              title={isOnline ? "Online" : "Temporarily Offline"}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-foreground truncate">
                                {student.name}
                              </p>
                              {student.userId === currentUserId && (
                                <span className="text-[11px] font-semibold text-muted-foreground">(You)</span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {isOnline ? "Connected" : "Reconnecting"} • {student.joinedAt ? new Date(student.joinedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "active"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isLecturer && onGrantFloor && onRevokeFloor && student.userId !== currentUserId && (
                            <Button
                              size="xs"
                              variant={floorHolderId === student.userId ? "destructive" : "outline"}
                              onClick={() => {
                                if (floorHolderId === student.userId) {
                                  onRevokeFloor(student.userId);
                                } else {
                                  onGrantFloor(student.userId);
                                }
                              }}
                              className="h-7 px-2.5 text-xs rounded-xl"
                              title={
                                floorHolderId === student.userId
                                  ? "Revoke microphone floor"
                                  : "Grant microphone floor to student"
                              }
                            >
                              {floorHolderId === student.userId ? (
                                <>
                                  <MicOff className="h-3 w-3 mr-1" />
                                  <span>Mute</span>
                                </>
                              ) : (
                                <>
                                  <Mic className="h-3 w-3 mr-1 text-chart-2" />
                                  <span>Give Mic</span>
                                </>
                              )}
                            </Button>
                          )}

                          {isLecturer && student.userId !== currentUserId && (
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => onKick?.(student.userId)}
                              className="h-7 px-2 text-xs rounded-lg text-muted-foreground hover:text-destructive"
                              title="Remove student from session"
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-8 rounded-2xl bg-card/50 border border-dashed border-border/60 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-semibold text-foreground">No students in room</p>
                  <p className="text-xs text-muted-foreground max-w-sm mt-1">
                    {waitingStudents.length > 0 ? "Students are waiting for admission in the queue on the left." : "Share the session link or invite students to join this live lecture."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
