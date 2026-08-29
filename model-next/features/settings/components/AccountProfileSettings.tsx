"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth";
import { AppButton } from "@/components/app";
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
      {/* 1. Profile Info Card */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar Initials with Glassmorphism */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0071e3] to-[#54a0ff] text-white font-bold text-xl flex items-center justify-center shadow-md shadow-[#0071e3]/20 border border-white/20 shrink-0">
              {initials}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
                  {profile?.name || "IntelliClass User"}
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                    isLecturer
                      ? "bg-[#0071e3]/10 text-[#0071e3] border border-[#0071e3]/20"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  }`}
                >
                  {isLecturer ? "Lecturer" : "Student"}
                </span>
              </div>
              <p className="text-xs text-[#86868b] flex items-center gap-1.5 mt-1">
                <Mail className="h-3.5 w-3.5" />
                <span>{user?.email || "No email available"}</span>
              </p>
            </div>
          </div>

          <div className="text-xs text-[#86868b] flex items-center gap-1.5 self-start sm:self-center bg-black/5 dark:bg-white/5 px-3 py-1.5 rounded-full">
            <Calendar className="h-3.5 w-3.5" />
            <span>Joined {formattedDate}</span>
          </div>
        </div>

        <div className="pt-4 border-t border-black/5 dark:border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#86868b]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Authenticated via Supabase Auth & Session Tokens</span>
          </div>
          <span className="font-mono text-[11px] text-[#86868b]/70 truncate max-w-xs">
            ID: {user?.id || "N/A"}
          </span>
        </div>
      </div>

      {/* 2. Interactive Role Switcher Section */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 shadow-xs space-y-4">
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
            Account Role & Experience Mode
          </h4>
          <p className="text-xs text-[#86868b] leading-relaxed">
            Switch between Lecturer (orchestration, AI voice generation, class analytics) and Student (attending live sessions, interactive Q&A).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* Lecturer Role Tile */}
          <button
            type="button"
            disabled={isSwitchingRole}
            onClick={() => handleOpenConfirm("lecturer")}
            className={`relative flex items-start gap-3.5 p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
              profile?.role === "lecturer"
                ? "border-[#0071e3] bg-[#0071e3]/5 dark:bg-[#0071e3]/10 ring-1 ring-[#0071e3]/30 shadow-xs"
                : "border-black/5 dark:border-white/10 bg-[#f5f5f7] dark:bg-[#2c2c2e] hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100"
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                profile?.role === "lecturer"
                  ? "bg-[#0071e3] text-white shadow-xs"
                  : "bg-black/5 dark:bg-white/10 text-[#86868b]"
              }`}
            >
              <Presentation className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Lecturer Mode
                </span>
                {profile?.role === "lecturer" && (
                  <span className="text-[10px] font-semibold text-[#0071e3] flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#86868b] leading-snug">
                Manage course curricula, generate 3D lectures, test HeadTTS lip sync, and launch classrooms.
              </p>
            </div>
          </button>

          {/* Student Role Tile */}
          <button
            type="button"
            disabled={isSwitchingRole}
            onClick={() => handleOpenConfirm("student")}
            className={`relative flex items-start gap-3.5 p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
              profile?.role === "student"
                ? "border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10 ring-1 ring-emerald-500/30 shadow-xs"
                : "border-black/5 dark:border-white/10 bg-[#f5f5f7] dark:bg-[#2c2c2e] hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100"
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                profile?.role === "student"
                  ? "bg-emerald-500 text-white shadow-xs"
                  : "bg-black/5 dark:bg-white/10 text-[#86868b]"
              }`}
            >
              <BookOpen className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                  Student Mode
                </span>
                {profile?.role === "student" && (
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#86868b] leading-snug">
                Join live 3D classrooms via session PINs, read lesson transcripts, and engage in real-time.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* 3. Danger Zone Card */}
      <div className="p-6 rounded-3xl bg-red-500/[0.03] dark:bg-red-500/[0.06] border border-red-500/15 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              <span>Account Danger Zone</span>
            </h4>
            <p className="text-xs text-[#86868b] leading-relaxed max-w-xl">
              Permanently delete your profile and account associations. This action wipes your course data and cannot be undone.
            </p>
          </div>

          <DeleteAccountDialog />
        </div>
      </div>

      {/* 4. Modal Dialog for Role Switch Confirmation */}
      <Dialog
        open={pendingRole !== null}
        onOpenChange={(open) => {
          if (!open && !isSwitchingRole) {
            setPendingRole(null);
          }
        }}
      >
        <DialogContent className="max-w-md rounded-3xl p-6 border border-black/10 dark:border-white/10 bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] shadow-2xl">
          <DialogHeader className="space-y-3 text-left">
            <div className="w-12 h-12 rounded-2xl bg-[#0071e3]/10 dark:bg-[#0071e3]/20 flex items-center justify-center text-[#0071e3]">
              <Sparkles className="h-6 w-6" />
            </div>

            <DialogTitle className="text-lg font-bold tracking-tight">
              Switch Account Role to{" "}
              {pendingRole === "lecturer" ? "Lecturer" : "Student"}?
            </DialogTitle>

            <DialogDescription className="text-xs text-[#86868b] leading-relaxed">
              Changing your account persona will update your workspace navigation and access rights. For security and session integrity, you will be smoothly signed out to refresh all security tokens.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3.5 rounded-2xl bg-[#f5f5f7] dark:bg-[#2c2c2e] space-y-2 text-xs text-[#1d1d1f] dark:text-[#f5f5f7] my-2">
            <div className="flex items-center justify-between font-semibold">
              <span className="text-[#86868b]">Current Role:</span>
              <span className="capitalize">{profile?.role || "Student"}</span>
            </div>
            <div className="flex items-center justify-between font-semibold">
              <span className="text-[#86868b]">New Selected Role:</span>
              <span className="capitalize text-[#0071e3]">
                {pendingRole || "Lecturer"}
              </span>
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <AppButton
              type="button"
              variant="outline"
              disabled={isSwitchingRole}
              onClick={() => setPendingRole(null)}
              className="w-full sm:w-auto text-xs"
            >
              Cancel
            </AppButton>
            <AppButton
              type="button"
              variant="primary"
              disabled={isSwitchingRole}
              isLoading={isSwitchingRole}
              loadingText="Switching..."
              onClick={handleConfirmRoleSwitch}
              className="w-full sm:w-auto text-xs font-semibold"
            >
              Confirm & Sign Out
            </AppButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AccountProfileSettings;
