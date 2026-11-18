"use client";

import { useState } from "react";
import type { CourseStudent } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Clock,
  Check,
  Copy,
  Mail,
  Shield,
  Presentation,
  Search,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface StudentsTabProps {
  courseId: string;
  isLecturer: boolean;
  students: CourseStudent[];
  requests: CourseStudent[];
  onRefresh: () => void;
}

export function StudentsTab({
  courseId,
  isLecturer,
  students,
  requests,
  onRefresh,
}: StudentsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"enrolled" | "requests">("enrolled");
  const [searchQuery, setSearchQuery] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Filter enrolled students by search
  const filteredStudents = students.filter(
    (s) =>
      s.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.userId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleApprove = async (participantId: string, studentName: string) => {
    try {
      await api.manageStudentRequest(courseId, {
        action: "approve",
        participantId,
      });
      toast.success(`Approved ${studentName} for Course Space admission`);
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to approve request");
    }
  };

  const handleReject = async (participantId: string, studentName: string) => {
    try {
      await api.manageStudentRequest(courseId, {
        action: "reject",
        participantId,
      });
      toast.info(`Rejected request for ${studentName}`);
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to reject request");
    }
  };

  const handleRemove = async (userId: string, studentName: string) => {
    if (!confirm(`Are you sure you want to remove ${studentName} from this course space?`)) return;
    try {
      await api.manageStudentRequest(courseId, {
        action: "remove",
        userId,
      });
      toast.success(`Removed ${studentName} from course roster`);
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove student");
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error("Please enter an email address.");
      return;
    }
    setIsSendingInvite(true);
    try {
      await api.manageStudentRequest(courseId, {
        action: "invite",
        email: inviteEmail.trim(),
      });
      toast.success(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail("");
      setIsInviteOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send invitation.");
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/join?courseId=${courseId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.success("Course invitation link copied!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl border border-black/5 dark:border-white/5 bg-white dark:bg-card shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Students Roster
            </h2>
            <p className="text-xs text-muted-foreground">
              Manage student enrollment, pending join requests, and broadcast permissions.
            </p>
          </div>
        </div>

        {isLecturer && (
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsInviteOpen(true)}
            className="h-10 px-4 font-semibold shrink-0"
          >
            <UserPlus className="h-4 w-4 mr-1.5" />
            <span>Invite Students</span>
          </Button>
        )}
      </div>

      {/* ── Tabs & Search Filter ───────────────────────────────────────── */}
      <Tabs
        value={activeSubTab}
        onValueChange={(v) => setActiveSubTab(v as "enrolled" | "requests")}
        className="space-y-4"
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-black/5 dark:border-white/10 pb-4">
          <TabsList className="h-auto">
            <TabsTrigger value="enrolled" className="cursor-pointer">
              <UserCheck className="h-3.5 w-3.5 mr-1.5 text-primary" />
              <span>Enrolled ({students.length})</span>
            </TabsTrigger>
            <TabsTrigger value="requests" className="cursor-pointer relative">
              <Clock className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
              <span>Requests ({requests.length})</span>
              {requests.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                  {requests.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {activeSubTab === "enrolled" && (
            <div className="relative w-full sm:w-64">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>
          )}
        </div>

        {/* ── Sub-Tab 1: Enrolled Roster ───────────────────────────────── */}
        <TabsContent value="enrolled" className="space-y-3">
          {filteredStudents.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground border border-dashed rounded-3xl space-y-3">
              <Users className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="font-medium text-foreground">No students enrolled yet</p>
              <p className="max-w-xs mx-auto">
                Share the course invite link or approve pending join requests to populate the roster.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStudents.map((s) => (
                <div
                  key={s.userId}
                  className="p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-card flex items-center justify-between gap-4 shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase shrink-0">
                      {s.userName.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground truncate">{s.userName}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          Enrolled
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span>Joined: {new Date(s.joinedAt).toLocaleDateString()}</span>
                        {s.attendedSessionsCount && (
                          <>
                            <span>&bull;</span>
                            <span>{s.attendedSessionsCount} classes attended</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {isLecturer && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleRemove(s.userId, s.userName)}
                      className="text-xs text-muted-foreground hover:text-red-500"
                    >
                      <span>Remove</span>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Sub-Tab 2: Pending Join Requests ─────────────────────────── */}
        <TabsContent value="requests" className="space-y-3">
          {requests.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground border border-dashed rounded-3xl space-y-2">
              <Check className="h-7 w-7 text-emerald-500 mx-auto" />
              <p className="font-semibold text-foreground">No pending requests</p>
              <p>All student join requests have been processed.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="p-4 rounded-2xl border border-amber-500/25 bg-amber-500/5 dark:bg-amber-500/10 flex items-center justify-between gap-4 shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                      {r.userName.slice(0, 2)}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{r.userName}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Requested {new Date(r.joinedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {isLecturer && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => handleReject(r.id, r.userName)}
                        className="h-8 text-xs text-muted-foreground hover:text-red-500"
                      >
                        <UserX className="h-3.5 w-3.5 mr-1" />
                        <span>Reject</span>
                      </Button>
                      <Button
                        variant="default"
                        size="xs"
                        onClick={() => handleApprove(r.id, r.userName)}
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <UserCheck className="h-3.5 w-3.5 mr-1" />
                        <span>Approve</span>
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Invite Modal ───────────────────────────────────────────────── */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Invite Students</DialogTitle>
            <DialogDescription>
              Share your direct course space link or send an email invitation.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 min-h-0 pt-6 items-start">
            <div className="p-6 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
              <div className="space-y-1">
                <Label className="text-sm font-bold">Direct Course Link</Label>
                <p className="text-xs text-muted-foreground">Students can use this link to enroll directly into the course space.</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/join?courseId=${courseId}`}
                  className="font-mono text-xs h-10"
                />
                <Button type="button" variant="outline" onClick={handleCopyLink} className="h-10 px-4 shrink-0">
                  {copiedLink ? <Check className="h-4 w-4 text-emerald-500 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
                  <span>{copiedLink ? "Copied" : "Copy"}</span>
                </Button>
              </div>
            </div>

            <form onSubmit={handleSendInvite} className="p-6 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-4">
              <div className="space-y-1">
                <Label htmlFor="stu-email" className="text-sm font-bold">Send Direct Invitation Email</Label>
                <p className="text-xs text-muted-foreground">Deliver a direct invitation link to a student&apos;s email address.</p>
              </div>
              <Input
                id="stu-email"
                type="email"
                placeholder="student@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={isSendingInvite}
                className="h-10 text-sm"
              />
              <Button type="submit" disabled={isSendingInvite || !inviteEmail.trim()} className="w-full h-10 font-semibold">
                {isSendingInvite ? "Sending..." : "Send Invite"}
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
