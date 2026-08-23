"use client";

import { useState } from "react";
import type { ClassroomParticipant } from "../types/classroom";
import {
  Dialog,
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
      <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-black/5 dark:border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#0071e3]/10 flex items-center justify-center text-[#0071e3]">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold tracking-tight">
                  Classroom People
                </DialogTitle>
                <p className="text-[11px] text-[#86868b] mt-0.5">
                  {participants.length} Participant{participants.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {isLecturer && waitingStudents.length > 0 && (
              <Button
                size="sm"
                onClick={onAdmitAll}
                className="rounded-full px-3 h-8 bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold text-xs gap-1.5 cursor-pointer shadow-xs"
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>Admit All ({waitingStudents.length})</span>
              </Button>
            )}
          </div>

          {/* Search bar */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#86868b]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search participants by name..."
              className="h-9 pl-9 pr-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border-black/5 dark:border-white/10 text-xs"
            />
          </div>
        </DialogHeader>

        {/* Participant List Content */}
        <div className="p-6 pt-4 max-h-[60vh] overflow-y-auto space-y-6">
          {/* Waiting Room Requests (Lecturer Admission Controls) */}
          {isLecturer && waitingStudents.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Waiting to Join ({waitingStudents.length})
                </span>
              </div>

              <div className="space-y-1.5">
                {waitingStudents.map((student) => (
                  <div
                    key={student.userId}
                    className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                        {(student.name || "S")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
                          {student.name}
                        </p>
                        <p className="text-[10px] text-[#86868b]">Wants to join broadcast</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => onAdmit?.(student.userId)}
                        className="h-8 px-2.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer shadow-xs gap-1 text-[11px] font-bold"
                        title="Accept / Admit Student"
                      >
                        <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                        <span>Accept</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDeny?.(student.userId)}
                        className="h-8 px-2 rounded-full hover:bg-red-500/10 text-red-500 cursor-pointer gap-1 text-[11px] font-bold"
                        title="Decline Student"
                      >
                        <X className="h-3.5 w-3.5 stroke-[2.5]" />
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
            <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider block">
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
                      <div className="w-8 h-8 rounded-full bg-[#0071e3] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                        {(lecturer.name || "L")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
                            {lecturer.name}
                          </p>
                          {lecturer.userId === currentUserId && (
                            <span className="text-[9px] font-semibold text-[#86868b]">(You)</span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#86868b]">Classroom Broadcaster</p>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold text-[#0071e3] bg-[#0071e3]/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      Host
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] text-center">
                <p className="text-xs text-[#86868b]">Faculty is operating in autonomous broadcast mode.</p>
              </div>
            )}
          </div>

          {/* Admitted Students Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider">
                Students in Classroom ({admittedStudents.length})
              </span>
            </div>

            {admittedStudents.length > 0 ? (
              <div className="space-y-1.5">
                {admittedStudents.map((student) => (
                  <div
                    key={student.userId}
                    className="p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 border border-black/5 dark:border-white/5 transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                        {(student.name || "S")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
                            {student.name}
                          </p>
                          {student.userId === currentUserId && (
                            <span className="text-[9px] font-semibold text-[#86868b]">(You)</span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#86868b]">
                          Joined {student.joinedAt ? new Date(student.joinedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "just now"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <GraduationCap className="h-3 w-3" />
                        Active
                      </span>

                      {isLecturer && student.userId !== currentUserId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onKick?.(student.userId)}
                          className="h-7 px-2 text-[10px] text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-lg cursor-pointer gap-1 font-semibold"
                          title="Remove student from session"
                        >
                          <UserMinus className="h-3 w-3" />
                          <span className="hidden sm:inline">Remove</span>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 text-center">
                <p className="text-xs text-[#86868b]">
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
