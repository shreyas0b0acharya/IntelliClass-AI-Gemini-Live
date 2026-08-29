"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AppButton } from "@/components/app/AppButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Trash2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { toast } from "sonner";

interface DeleteAccountDialogProps {
  trigger?: React.ReactNode;
}

export function DeleteAccountDialog({ trigger }: DeleteAccountDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const { deleteAccount, user } = useAuth();
  const router = useRouter();

  const isConfirmed = confirmText.trim().toUpperCase() === "DELETE";

  const handleDelete = async () => {
    if (!isConfirmed) return;

    setIsDeleting(true);
    try {
      await deleteAccount();
      toast.success("Your account and profile have been permanently deleted.");
      setOpen(false);
      router.push("/auth");
      router.refresh();
    } catch (err: unknown) {
      console.error("Account deletion failed:", err);
      const msg = err instanceof Error ? err.message : "Failed to delete account. Please try again.";
      toast.error(msg);
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isDeleting) {
          setOpen(next);
          if (!next) setConfirmText("");
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <AppButton
            variant="destructive"
            size="sm"
            shape="pill"
            className="px-5 py-2 text-xs font-semibold"
            leftIcon={<Trash2 className="h-4 w-4" />}
          >
            <span>Delete Account</span>
          </AppButton>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-md rounded-3xl p-6 border border-red-500/20 bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] shadow-2xl">
        <DialogHeader className="space-y-3 text-left">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 dark:bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400">
            <AlertTriangle className="h-6 w-6" />
          </div>

          <DialogTitle className="text-lg font-bold tracking-tight text-red-600 dark:text-red-400 flex items-center gap-2">
            Permanently Delete Account?
          </DialogTitle>

          <DialogDescription className="text-xs text-[#86868b] leading-relaxed">
            This action is <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">irreversible</strong>. Permanently deletes your account (<span className="font-mono text-xs text-red-500">{user?.email || "your email"}</span>), profile data, AI settings, and session associations from IntelliClass AI.
          </DialogDescription>
        </DialogHeader>

        {/* Security Warning Callout */}
        <div className="p-3.5 rounded-2xl bg-red-500/[0.06] border border-red-500/15 flex items-start gap-3 my-2 text-xs text-red-700 dark:text-red-300">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Are you absolutely sure?</p>
            <p className="text-[11px] leading-relaxed text-red-600/90 dark:text-red-400/90">
              Once deleted, you will immediately lose access to all course spaces and lecture history.
            </p>
          </div>
        </div>

        {/* Type DELETE to confirm input */}
        <div className="space-y-2 pt-2">
          <Label htmlFor="confirm-delete" className="text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
            Type <span className="font-mono font-bold text-red-600 dark:text-red-400">DELETE</span> to confirm:
          </Label>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            disabled={isDeleting}
            autoComplete="off"
            className="h-10 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border-red-500/20 text-xs font-mono font-bold uppercase tracking-wider focus-visible:ring-1 focus-visible:ring-red-500"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-black/5 dark:border-white/5">
          <AppButton
            type="button"
            variant="ghost"
            shape="pill"
            onClick={() => setOpen(false)}
            disabled={isDeleting}
            className="h-10 px-5 text-xs text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white"
          >
            <span>Cancel</span>
          </AppButton>

          <AppButton
            type="button"
            variant="destructive"
            shape="pill"
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            isLoading={isDeleting}
            loadingText="Deleting Account..."
            className="h-10 px-5 text-xs font-semibold disabled:opacity-40"
            leftIcon={!isDeleting ? <Trash2 className="h-4 w-4" /> : undefined}
          >
            <span>Permanently Delete</span>
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
