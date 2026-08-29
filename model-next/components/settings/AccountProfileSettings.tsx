"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { AppButton } from "@/components/app/AppButton";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Mail,
  Calendar,
  CheckCircle2,
  Presentation,
  BookOpen,
  Sparkles,
  ShieldCheck,
  Loader2,
  ShieldAlert,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function AccountProfileSettings() {
  const { profile, user, isLecturer, signOut } = useAuth();
  const router = useRouter();

  // Role Switch Confirmation State
  const [pendingRole, setPendingRole] = useState<"lecturer" | "student" | null>(null);
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);

  const handleOpenConfirm = (role: "lecturer" | "student") => {
    if (profile?.role === role || isSwitchingRole) return;
    setPendingRole(role);
  };

  const handleConfirmRoleSwitch = async () => {
    if (!pendingRole) return;

    setIsSwitchingRole(true);
    try {
      // 1. Update role in database
      await api.updateProfile({ role: pendingRole });
      toast.success(
        `Role successfully switched to ${
          pendingRole === "lecturer" ? "Lecturer" : "Student"
        }! Signing out to refresh permissions...`
      );

      // 2. Clear session and log out
      await signOut();

      // 3. Redirect to login page
      setPendingRole(null);
      router.push("/login");
      router.refresh();
    } catch (err: unknown) {
      console.error("Role switch error:", err);
      const msg = err instanceof Error ? err.message : "Failed to switch role.";
      toast.error(msg);
      setIsSwitchingRole(false);
    }
  };

  const formattedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : user?.created_at
    ? new Date(user.created_at).toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Active Member";

  const initials = profile?.name
    ? profile.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "IC";

  return (
    <div className="space-y-6">
      {/* ── 1. Account Profile Inset Grouped Card ─────────────────────── */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/5 dark:border-white/10 shadow-xs p-6 sm:p-7 transition-all">
        <h2 className="text-[11px] font-semibold tracking-wider text-[#86868b] uppercase mb-4">
          Account Profile
        </h2>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            {/* Apple-style Soft Gradient Avatar Badge */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0071e3] to-[#409cff] text-white flex items-center justify-center font-bold text-xl shadow-xs shrink-0 tracking-tight">
              {initials}
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-lg font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight truncate">
                  {profile?.name || "IntelliClass User"}
                </h3>
                <span
                  className={`text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${
                    isLecturer
                      ? "bg-[#0071e3]/10 text-[#0071e3] border-[#0071e3]/20 dark:bg-[#0071e3]/20"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 dark:bg-emerald-500/20"
                  }`}
                >
                  {isLecturer ? "FACULTY / LECTURER" : "STUDENT / LEARNER"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-[#86868b]">
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 opacity-70" />
                  <span className="truncate">{user?.email || "user@intelliclass.ai"}</span>
                </div>
                <span className="hidden sm:inline text-black/20 dark:text-white/20">&bull;</span>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 opacity-70" />
                  <span>Joined {formattedDate}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Role & Permissions Management (Apple Tile Controls) ──── */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/5 dark:border-white/10 shadow-xs p-6 sm:p-7 space-y-5 transition-all">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-semibold tracking-wider text-[#86868b] uppercase">
              Role &amp; Permissions Management
            </h2>
            <span className="text-[11px] font-medium text-[#86868b]">
              Current Active: <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">{isLecturer ? "Lecturer" : "Student"}</strong>
            </span>
          </div>
          <p className="text-xs text-[#86868b] leading-relaxed">
            Select your account operating mode. Switching roles updates permissions and signs you out so you can sign in with your fresh profile.
          </p>
        </div>

        {/* Role Panels Grid without overflow-hidden clipping */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Panel A: Lecturer / Faculty Role */}
          <div
            onClick={() => !isLecturer && handleOpenConfirm("lecturer")}
            className={`rounded-2xl p-6 border transition-all duration-200 flex flex-col justify-between ${
              isLecturer
                ? "border-2 border-[#0071e3] bg-[#0071e3]/[0.03] dark:bg-[#0071e3]/[0.07] shadow-xs"
                : "bg-[#f5f5f7] dark:bg-[#2c2c2e] border-black/5 dark:border-white/5 hover:border-black/20 dark:hover:border-white/20 cursor-pointer"
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    isLecturer
                      ? "bg-[#0071e3] text-white shadow-xs"
                      : "bg-black/5 dark:bg-white/10 text-[#86868b]"
                  }`}
                >
                  <Presentation className="h-4 w-4" />
                </div>

                {isLecturer ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider text-[#0071e3] bg-[#0071e3]/10 dark:bg-[#0071e3]/20 px-2.5 py-0.5 rounded-full border border-[#0071e3]/20">
                    <CheckCircle2 className="h-3 w-3" /> ACTIVE
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-[#86868b] inline-flex items-center gap-1">
                    <span>Select</span>
                    <ChevronRight className="h-3 w-3" />
                  </span>
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
                  Lecturer / Faculty Member
                </h4>
                <p className="text-xs text-[#86868b] mt-1.5 leading-relaxed">
                  Full faculty studio access. Create course spaces, upload syllabus PDFs, configure 3D professor personas, generate curriculum scripts, and broadcast live interactive lectures.
                </p>
              </div>
            </div>

            <div className="pt-4 mt-3 border-t border-black/5 dark:border-white/5">
              <AppButton
                type="button"
                size="sm"
                shape="pill"
                variant={isLecturer ? "tinted" : "primary"}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenConfirm("lecturer");
                }}
                disabled={isLecturer || isSwitchingRole}
                className="w-full h-9 text-xs font-semibold"
                leftIcon={isLecturer ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              >
                <span>{isLecturer ? "Current Active Role" : "Switch to Lecturer"}</span>
              </AppButton>
            </div>
          </div>

          {/* Panel B: Student / Learner Role */}
          <div
            onClick={() => isLecturer && handleOpenConfirm("student")}
            className={`rounded-2xl p-6 border transition-all duration-200 flex flex-col justify-between ${
              !isLecturer
                ? "border-2 border-[#0071e3] bg-[#0071e3]/[0.03] dark:bg-[#0071e3]/[0.07] shadow-xs"
                : "bg-[#f5f5f7] dark:bg-[#2c2c2e] border-black/5 dark:border-white/5 hover:border-black/20 dark:hover:border-white/20 cursor-pointer"
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    !isLecturer
                      ? "bg-[#0071e3] text-white shadow-xs"
                      : "bg-black/5 dark:bg-white/10 text-[#86868b]"
                  }`}
                >
                  <BookOpen className="h-4 w-4" />
                </div>

                {!isLecturer ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider text-[#0071e3] bg-[#0071e3]/10 dark:bg-[#0071e3]/20 px-2.5 py-0.5 rounded-full border border-[#0071e3]/20">
                    <CheckCircle2 className="h-3 w-3" /> ACTIVE
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-[#86868b] inline-flex items-center gap-1">
                    <span>Select</span>
                    <ChevronRight className="h-3 w-3" />
                  </span>
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
                  Student / Learner
                </h4>
                <p className="text-xs text-[#86868b] mt-1.5 leading-relaxed">
                  Join live interactive AI classrooms via session codes, ask questions during lectures with real-time spoken answers, view projected diagrams, and inspect transcripts.
                </p>
              </div>
            </div>

            <div className="pt-4 mt-3 border-t border-black/5 dark:border-white/5">
              <AppButton
                type="button"
                size="sm"
                shape="pill"
                variant={!isLecturer ? "tinted" : "primary"}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenConfirm("student");
                }}
                disabled={!isLecturer || isSwitchingRole}
                className="w-full h-9 text-xs font-semibold"
                leftIcon={!isLecturer ? <CheckCircle2 className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
              >
                <span>{!isLecturer ? "Current Active Role" : "Switch to Student"}</span>
              </AppButton>
            </div>
          </div>
        </div>

        {/* Data Safety Note */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 text-xs text-[#86868b]">
          <ShieldCheck className="h-4 w-4 text-[#0071e3] shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            <strong className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">Data Safety Guarantee:</strong> Switching roles will sign you out so your session restarts with the updated permissions. All your existing course spaces, files, and account data remain completely intact.
          </p>
        </div>
      </div>

      {/* ── 3. Danger Zone: Apple Destructive Style ───────────────────── */}
      <div className="bg-red-500/[0.03] dark:bg-red-500/[0.06] rounded-2xl border border-red-500/20 dark:border-red-500/20 shadow-xs p-6 sm:p-7 space-y-4 transition-all">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <h2 className="text-[11px] font-semibold tracking-wider uppercase">
            Danger Zone
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-0.5">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
              Delete Account &amp; Personal Data
            </h4>
            <p className="text-xs text-[#86868b] dark:text-[#a1a1a6] leading-relaxed max-w-xl">
              Permanently delete your account and all associated profile preferences, materials, and session data. This action is irreversible.
            </p>
          </div>

          <DeleteAccountDialog />
        </div>
      </div>

      {/* ── Role Switch Confirmation Dialog (macOS Sheet Style) ──────── */}
      <Dialog
        open={Boolean(pendingRole)}
        onOpenChange={(open) => {
          if (!isSwitchingRole && !open) setPendingRole(null);
        }}
      >
        <DialogContent className="max-w-md rounded-3xl p-6 border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl text-[#1d1d1f] dark:text-[#f5f5f7] shadow-2xl">
          <DialogHeader className="space-y-3 text-left">
            <div className="w-12 h-12 rounded-2xl bg-[#0071e3]/10 dark:bg-[#0071e3]/20 flex items-center justify-center text-[#0071e3] shadow-xs">
              <LogOut className="h-6 w-6" />
            </div>

            <DialogTitle className="text-lg font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
              Switch Role to {pendingRole === "lecturer" ? "Lecturer" : "Student"}?
            </DialogTitle>

            <DialogDescription className="text-xs text-[#86868b] leading-relaxed">
              Switching your role will update your account permissions and automatically sign you out. You can log back in immediately with your updated <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">{pendingRole === "lecturer" ? "Lecturer" : "Student"}</strong> role.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 flex items-start gap-2.5 my-2 text-xs text-[#86868b]">
            <ShieldCheck className="h-4 w-4 text-[#0071e3] shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              All your course spaces, syllabus documents, and profile data will remain safely stored.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-black/5 dark:border-white/5">
            <AppButton
              type="button"
              variant="ghost"
              shape="pill"
              onClick={() => setPendingRole(null)}
              disabled={isSwitchingRole}
              className="h-10 px-5 text-xs text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white"
            >
              <span>Cancel</span>
            </AppButton>

            <AppButton
              type="button"
              onClick={handleConfirmRoleSwitch}
              disabled={isSwitchingRole}
              isLoading={isSwitchingRole}
              loadingText="Updating & Signing Out..."
              variant="primary"
              shape="pill"
              className="h-10 px-5 text-xs font-semibold"
              leftIcon={!isSwitchingRole ? <LogOut className="h-4 w-4" /> : undefined}
            >
              <span>Confirm &amp; Sign Out</span>
            </AppButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
