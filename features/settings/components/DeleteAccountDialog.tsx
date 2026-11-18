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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Trash2, ShieldAlert, Loader2 } from "lucide-react";
import { useAuth } from "@/features/auth";
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
          <Button
            variant="destructive"
            size="sm"
 className=" inline-flex items-center "
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete Account</span>
          </Button>
        )}
      </DialogTrigger>

 <DialogContent className="max-w-md ">
 <DialogHeader className=" text-left">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 dark:bg-destructive/20 flex items-center justify-center text-destructive dark:text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>

 <DialogTitle className=" flex items-center ">
            Permanently Delete Account?
          </DialogTitle>

 <DialogDescription className="">
 This action is <strong className="text-foreground dark:text-foreground">irreversible</strong>. Permanently deletes your account (<span className="font-mono text-destructive">{user?.email || "your email"}</span>), profile data, AI settings, and session associations from IntelliClass AI.
          </DialogDescription>
        </DialogHeader>

        {/* Security Warning Callout */}
        <div className="p-3.5 rounded-2xl bg-destructive/[0.06] border border-destructive/15 flex items-start gap-3 my-2 text-xs text-destructive dark:text-destructive">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Are you absolutely sure?</p>
            <p className="text-xs leading-relaxed text-destructive/90 dark:text-destructive">
              Once deleted, you will immediately lose access to all course spaces and lecture history.
            </p>
          </div>
        </div>

        {/* Type DELETE to confirm input */}
        <div className="space-y-2 pt-2">
 <Label htmlFor="confirm-delete" className="">
            Type <span className="font-mono font-bold text-destructive dark:text-destructive">DELETE</span> to confirm:
          </Label>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            disabled={isDeleting}
            autoComplete="off"
 className="h-10 "
          />
        </div>

 <DialogFooter className="">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isDeleting}
 className="h-10 "
          >
            <span>Cancel</span>
          </Button>

          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
 className="h-10 inline-flex items-center "
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span>Deleting Account...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                <span>Permanently Delete</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DeleteAccountDialog;
