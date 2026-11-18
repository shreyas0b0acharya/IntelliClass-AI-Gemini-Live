"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth";
import { api } from "@/lib/api";
import type { StudentGroup, StudentGroupMember } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users,
  Plus,
  Search,
  Mail,
  UserCheck,
  Trash2,
  Edit2,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  ArrowRight,
  FolderPlus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudentsManagementPage() {
  const router = useRouter();
  const { user, isLecturer, isLoading: authLoading } = useAuth();

  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Search state
  const [groupSearch, setGroupSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  // Fast email input state
  const [emailInput, setEmailInput] = useState("");
  const [isAddingStudent, setIsAddingStudent] = useState(false);

  // Group Create / Edit Dialog State
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<StudentGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  // Delete Group Confirmation
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<StudentGroup | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  // Remove Member Confirmation
  const [removeMemberTarget, setRemoveMemberTarget] = useState<StudentGroupMember | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);

  // Fetch groups
  const loadGroups = async () => {
    try {
      const res = await api.getStudentGroups();
      setGroups(res.groups || []);
      if (res.groups && res.groups.length > 0 && !selectedGroupId) {
        setSelectedGroupId(res.groups[0].id);
      }
    } catch (err) {
      console.error("Failed to load student groups:", err);
      toast.error("Failed to load student groups.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    loadGroups();
  }, [user, authLoading]);

  const selectedGroup = useMemo(() => {
    return groups.find((g) => g.id === selectedGroupId) || groups[0] || null;
  }, [groups, selectedGroupId]);

  const filteredGroups = useMemo(() => {
    if (!groupSearch.trim()) return groups;
    const q = groupSearch.toLowerCase();
    return groups.filter(
      (g) => g.name.toLowerCase().includes(q) || (g.description && g.description.toLowerCase().includes(q))
    );
  }, [groups, groupSearch]);

  const filteredMembers = useMemo(() => {
    if (!selectedGroup?.members) return [];
    if (!studentSearch.trim()) return selectedGroup.members;
    const q = studentSearch.toLowerCase();
    return selectedGroup.members.filter(
      (m) =>
        m.student_email.toLowerCase().includes(q) ||
        (m.user_name && m.user_name.toLowerCase().includes(q))
    );
  }, [selectedGroup, studentSearch]);

  // Handle Add Student on Enter
  const handleAddStudent = async () => {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    if (!email.includes("@") || !email.includes(".")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (!selectedGroup) {
      toast.error("Please select a student group first.");
      return;
    }

    setIsAddingStudent(true);
    try {
      const res = await api.addStudentToGroup(selectedGroup.id, email);
      toast.success(`"${email}" added with direct class access!`);
      setEmailInput("");

      // Update local state smoothly
      setGroups((prev) =>
        prev.map((g) => {
          if (g.id === selectedGroup.id) {
            const currentMembers = g.members || [];
            return {
              ...g,
              members_count: (g.members_count || 0) + 1,
              members: [res.member, ...currentMembers],
            };
          }
          return g;
        })
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add student.";
      toast.error(msg);
    } finally {
      setIsAddingStudent(false);
    }
  };

  // Handle Save / Edit Group
  const handleSaveGroup = async () => {
    if (!groupName.trim()) {
      toast.error("Group name is required.");
      return;
    }

    setIsSavingGroup(true);
    try {
      if (editingGroup) {
        await api.updateStudentGroup(editingGroup.id, {
          name: groupName.trim(),
          description: groupDescription.trim() || undefined,
        });
        toast.success("Student group updated.");
      } else {
        const res = await api.createStudentGroup({
          name: groupName.trim(),
          description: groupDescription.trim() || undefined,
        });
        toast.success(`Group "${res.group.name}" created!`);
        setSelectedGroupId(res.group.id);
      }
      setIsGroupDialogOpen(false);
      setEditingGroup(null);
      setGroupName("");
      setGroupDescription("");
      loadGroups();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save group.";
      toast.error(msg);
    } finally {
      setIsSavingGroup(false);
    }
  };

  // Handle Delete Group
  const handleDeleteGroup = async () => {
    if (!deleteGroupTarget) return;
    setIsDeletingGroup(true);
    try {
      await api.deleteStudentGroup(deleteGroupTarget.id);
      toast.success("Group deleted.");
      setDeleteGroupTarget(null);
      if (selectedGroupId === deleteGroupTarget.id) {
        setSelectedGroupId(null);
      }
      loadGroups();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete group.";
      toast.error(msg);
    } finally {
      setIsDeletingGroup(false);
    }
  };

  // Handle Remove Member
  const handleRemoveMember = async () => {
    if (!removeMemberTarget || !selectedGroup) return;
    setIsRemovingMember(true);
    try {
      await api.removeStudentFromGroup(selectedGroup.id, {
        memberId: removeMemberTarget.id,
      });
      toast.success(`Removed ${removeMemberTarget.student_email} from group.`);

      // Update local state
      setGroups((prev) =>
        prev.map((g) => {
          if (g.id === selectedGroup.id) {
            const currentMembers = g.members || [];
            return {
              ...g,
              members_count: Math.max(0, (g.members_count || 1) - 1),
              members: currentMembers.filter((m) => m.id !== removeMemberTarget.id),
            };
          }
          return g;
        })
      );
      setRemoveMemberTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove student.";
      toast.error(msg);
    } finally {
      setIsRemovingMember(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="space-y-6 p-6 animate-pulse">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <Skeleton className="md:col-span-4 h-96 rounded-3xl" />
          <Skeleton className="md:col-span-8 h-96 rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl border border-border/60 bg-card shadow-xs">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0 shadow-xs">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Students &amp; Cohort Groups
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Reusable student rosters with instant class admission. Adding an email grants direct access without separate approvals.
            </p>
          </div>
        </div>

        <Button
          onClick={() => {
            setEditingGroup(null);
            setGroupName("");
            setGroupDescription("");
            setIsGroupDialogOpen(true);
          }}
          className="h-10 font-semibold gap-2 rounded-xl shadow-xs"
        >
          <Plus className="h-4 w-4" />
          <span>Create Student Group</span>
        </Button>
      </div>

      {/* ── Master-Detail Layout ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Groups Roster (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-4 rounded-3xl border border-border/60 bg-card shadow-xs space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Student Groups ({groups.length})
              </span>
            </div>

            {/* Search groups */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                placeholder="Search groups..."
                className="h-9 pl-9 pr-3 text-xs rounded-xl bg-muted/30 border-border/60"
              />
            </div>

            {/* Group Cards List */}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {filteredGroups.length === 0 ? (
                <div className="p-8 text-center border border-dashed rounded-2xl bg-muted/20 space-y-2">
                  <FolderPlus className="h-6 w-6 mx-auto text-muted-foreground/60" />
                  <p className="text-xs font-semibold text-foreground">No groups found</p>
                  <p className="text-[11px] text-muted-foreground">
                    Create a group to organize your students into reusable classes.
                  </p>
                </div>
              ) : (
                filteredGroups.map((group) => {
                  const isSelected = selectedGroup?.id === group.id;
                  return (
                    <div
                      key={group.id}
                      onClick={() => setSelectedGroupId(group.id)}
                      className={`group p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-primary/10 border-primary/40 shadow-xs ring-1 ring-primary/20"
                          : "bg-muted/20 hover:bg-muted/40 border-border/60"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-foreground truncate">
                            {group.name}
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                            {group.members_count || 0} students
                          </span>
                        </div>
                        {group.description && (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {group.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingGroup(group);
                            setGroupName(group.name);
                            setGroupDescription(group.description || "");
                            setIsGroupDialogOpen(true);
                          }}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Edit Group"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteGroupTarget(group);
                          }}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          title="Delete Group"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Active Group Workspace (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {selectedGroup ? (
            <div className="p-6 sm:p-8 rounded-3xl border border-border/60 bg-card shadow-xs space-y-6">
              {/* Group Overview Banner */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-border/50">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold text-foreground truncate">
                      {selectedGroup.name}
                    </h2>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Direct Access Active
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedGroup.description || "Reusable student cohort. Members can join any assigned class directly."}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-muted border border-border/60 text-foreground">
                    {selectedGroup.members_count || 0} Total Members
                  </span>
                </div>
              </div>

              {/* ── Fast Add Student: Enter Email and Press Enter ──────────── */}
              <div className="space-y-2 p-4 sm:p-5 rounded-2xl bg-muted/30 border border-border/60">
                <div className="flex items-center justify-between">
                  <Label htmlFor="quick-add-email" className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5 text-primary" />
                    Add Student by Email (Instant Access)
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    Press <strong>Enter ↵</strong> to add instantly
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="quick-add-email"
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddStudent();
                        }
                      }}
                      placeholder="e.g. student@college.edu — press Enter to grant access..."
                      disabled={isAddingStudent}
                      className="h-11 pl-10 pr-3 rounded-xl bg-background border-border/60 text-xs focus-visible:ring-primary/20"
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={handleAddStudent}
                    disabled={isAddingStudent || !emailInput.trim()}
                    className="h-11 px-4 rounded-xl font-semibold gap-1.5 shrink-0"
                  >
                    {isAddingStudent ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        <span>Add Student</span>
                      </>
                    )}
                  </Button>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  💡 Students added to this group will bypass waiting rooms and approval queues when assigned to classes.
                </p>
              </div>

              {/* ── Members Roster List ────────────────────────────────────── */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Group Members ({filteredMembers.length})
                    </span>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Filter members..."
                      className="h-8 pl-9 pr-3 text-xs rounded-xl bg-muted/40 border-border/60"
                    />
                  </div>
                </div>

                {filteredMembers.length === 0 ? (
                  <div className="p-10 rounded-2xl border border-dashed border-border/70 text-center space-y-2 bg-muted/10">
                    <Mail className="h-8 w-8 mx-auto text-muted-foreground/50" />
                    <p className="text-sm font-semibold text-foreground">No students in this group yet</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Enter a student&apos;s email address in the field above and press Enter to grant instant access.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
                    {filteredMembers.map((member) => (
                      <div
                        key={member.id}
                        className="p-3.5 rounded-2xl border border-border/60 bg-muted/15 hover:bg-muted/30 transition-colors flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                            {member.student_email[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">
                              {member.user_name || member.student_email.split("@")[0]}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {member.student_email}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setRemoveMemberTarget(member)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            title="Remove from group"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center rounded-3xl border border-dashed border-border/60 bg-card/40 space-y-3">
              <Users className="h-10 w-10 mx-auto text-muted-foreground/60" />
              <h3 className="text-base font-bold text-foreground">Select or Create a Student Group</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Organize your students into reusable cohorts like &ldquo;Batch 2026&rdquo; or &ldquo;CS Elective&rdquo; to manage class access effortlessly.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Create / Edit Group Dialog ───────────────────────────────────────── */}
      <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
        <DialogContent className="w-[80vw] max-w-[80vw] h-[80vh] max-h-[80vh] flex flex-col p-0 overflow-hidden rounded-3xl">
          <div className="p-6 border-b border-border/50 bg-muted/30 shrink-0">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">
                    {editingGroup ? "Edit Student Group" : "Create New Student Group"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Define a reusable cohort for easy classroom access and batch assignments.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 sm:p-8 flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="group-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Group Name *
                </Label>
                <Input
                  id="group-name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Batch 2026 - CS Section A"
                  disabled={isSavingGroup}
                  className="h-11 rounded-xl text-sm"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="group-desc" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Description / Semester (Optional)
                </Label>
                <Textarea
                  id="group-desc"
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="e.g. Third year undergraduate core engineering cohort."
                  disabled={isSavingGroup}
                  rows={4}
                  className="rounded-xl text-sm resize-none"
                />
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-muted/30 border border-border/60 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Direct Access Benefits
                </span>
                <div className="space-y-2.5 text-xs text-muted-foreground leading-relaxed">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>No Waiting Rooms:</strong> Students in this group enter assigned lectures automatically.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>One-Click Class Assignment:</strong> Select this group when creating any class rather than adding students one by one.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Cross-Course Reusability:</strong> Use this group across multiple courses and upcoming semesters.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 sm:p-6 border-t bg-muted/20 shrink-0 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsGroupDialogOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveGroup}
              disabled={isSavingGroup || !groupName.trim()}
              className="rounded-xl font-semibold px-5"
            >
              {isSavingGroup ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingGroup ? (
                "Save Changes"
              ) : (
                "Create Group"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Group Confirm Dialog ─────────────────────────────────────── */}
      <AlertDialog
        open={Boolean(deleteGroupTarget)}
        onOpenChange={(open) => !open && setDeleteGroupTarget(null)}
      >
        <AlertDialogContent className="w-[80vw] max-w-[80vw] h-[80vh] max-h-[80vh] flex flex-col justify-between p-8 sm:p-10 rounded-3xl overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 items-center">
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive">
                <Trash2 className="h-7 w-7" />
              </div>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-2xl font-bold tracking-tight">
                  Delete Student Group?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  Are you sure you want to delete <span className="font-semibold text-foreground">&ldquo;{deleteGroupTarget?.name}&rdquo;</span>?
                  This group and all associated member links will be permanently deleted. Students will not be removed from their individual user accounts.
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>

            <div className="p-6 rounded-2xl bg-muted/30 border border-border/60 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Group Impact</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Group Name:</span>
                  <span className="font-semibold text-foreground">{deleteGroupTarget?.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Total Members:</span>
                  <span className="font-semibold text-foreground">{deleteGroupTarget?.members_count || 0}</span>
                </div>
              </div>
            </div>
          </div>

          <AlertDialogFooter className="flex-row justify-end gap-3 pt-6 border-t border-border/50 shrink-0">
            <AlertDialogCancel disabled={isDeletingGroup} className="rounded-xl px-5 h-11">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteGroup}
              disabled={isDeletingGroup}
              className="rounded-xl px-6 h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingGroup ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              <span>Delete Group</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Remove Member Confirm Dialog ────────────────────────────────────── */}
      <AlertDialog
        open={Boolean(removeMemberTarget)}
        onOpenChange={(open) => !open && setRemoveMemberTarget(null)}
      >
        <AlertDialogContent className="w-[80vw] max-w-[80vw] h-[80vh] max-h-[80vh] flex flex-col justify-between p-8 sm:p-10 rounded-3xl overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 items-center">
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive">
                <Trash2 className="h-7 w-7" />
              </div>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-2xl font-bold tracking-tight">
                  Remove Student from Group?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  Remove <span className="font-semibold text-foreground">{removeMemberTarget?.student_email}</span> from this group?
                  They will no longer have direct automatic access to classes assigned to this group.
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>

            <div className="p-6 rounded-2xl bg-muted/30 border border-border/60 space-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-semibold text-foreground">{removeMemberTarget?.student_email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Group:</span>
                <span className="font-semibold text-foreground">{selectedGroup?.name}</span>
              </div>
            </div>
          </div>

          <AlertDialogFooter className="flex-row justify-end gap-3 pt-6 border-t border-border/50 shrink-0">
            <AlertDialogCancel disabled={isRemovingMember} className="rounded-xl px-5 h-11">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={isRemovingMember}
              className="rounded-xl px-6 h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemovingMember ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              <span>Remove Student</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
