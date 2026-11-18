"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  Lock,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";

function ResetPasswordFormContent() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const errorCode = searchParams.get("error_code");
    const errorParam = searchParams.get("error");
    const errorDesc = searchParams.get("error_description");
    const code = searchParams.get("code");

    if (errorCode === "otp_expired" || errorParam === "access_denied") {
      queueMicrotask(() => {
        setIsExpired(true);
        setErrorMessage(errorDesc || "This password reset link is invalid or has expired.");
        toast.error("Password reset link expired");
      });
    } else if (typeof window !== "undefined" && window.location.hash.includes("otp_expired")) {
      queueMicrotask(() => {
        setIsExpired(true);
        setErrorMessage("This password reset link is invalid or has expired.");
        toast.error("Password reset link expired");
      });
    } else if (code) {
      supabase.auth.exchangeCodeForSession(code).catch((err: unknown) => {
        console.warn("Direct code exchange warning:", err);
      });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsExpired(false);
        setErrorMessage(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [searchParams]);

  const handleUpdatePassword = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    setErrorMessage(null);

    if (!password || !confirmPassword) {
      const msg = "Please enter and confirm your new password.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (password.length < 6) {
      const msg = "Password must be at least 6 characters long.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (password !== confirmPassword) {
      const msg = "Passwords do not match. Please re-enter.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      setIsSuccess(true);
      toast.success("Password updated successfully!");
    } catch (err: unknown) {
      console.error("Update password error:", err);
      let msg = "Failed to update password. Your recovery link may have expired.";
      if (err instanceof Error && err.message) {
        msg = err.message;
        if (msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("session")) {
          setIsExpired(true);
        }
      }
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md lg:max-w-none mx-auto bg-white dark:bg-card border border-border dark:border-border rounded-3xl lg:rounded-3xl shadow-xl dark:shadow-none grid grid-cols-1 lg:grid-cols-12 overflow-hidden transition-colors duration-200">
      {/* ── LEFT COLUMN: BRANDING & DESCRIPTIONS ── */}
      <div className="hidden lg:flex col-span-12 lg:col-span-6 bg-background dark:bg-card border-r border-border dark:border-border p-8 sm:p-10 lg:p-14 2xl:p-16 flex-col justify-between text-left transition-colors duration-200">
        <div>
          <div className="w-12 h-12 2xl:w-14 2xl:h-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-xs mb-6">
            <KeyRound className="h-6 w-6 2xl:h-7 2xl:w-7" />
          </div>
          <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground dark:text-muted-foreground block mb-2">
            IntelliClass AI &bull; Security Verification
          </span>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl 2xl:text-4xl font-bold tracking-tight text-foreground dark:text-foreground mb-3 leading-tight">
            Create New Password
          </h1>
          <p className="text-base lg:text-base 2xl:text-base text-muted-foreground dark:text-muted-foreground leading-relaxed mb-8 2xl:mb-10">
            Choose a strong, unique password to protect your teaching materials, audio configurations, and student credentials.
          </p>

          <div className="space-y-4 2xl:space-y-5 pt-2">
            <div className="flex items-center gap-3.5 text-sm 2xl:text-base text-foreground dark:text-foreground font-medium">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              <span>Minimum 6 characters recommended</span>
            </div>
            <div className="flex items-center gap-3.5 text-sm 2xl:text-base text-foreground dark:text-foreground font-medium">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              <span>Instantly invalidates old compromised credentials</span>
            </div>
            <div className="flex items-center gap-3.5 text-sm 2xl:text-base text-foreground dark:text-foreground font-medium">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              <span>Synchronizes across all devices and live classrooms</span>
            </div>
          </div>
        </div>

        <div className="pt-6 mt-10 2xl:mt-14 border-t border-border dark:border-border flex items-center gap-2.5 text-xs 2xl:text-sm text-muted-foreground dark:text-muted-foreground">
          <ShieldCheck className="h-4.5 w-4.5 text-muted-foreground shrink-0" />
          <span>Encrypted with SHA-256 session token verification</span>
        </div>
      </div>

      {/* ── RIGHT COLUMN: FORM & CONTROLS ── */}
      <div className="col-span-12 lg:col-span-6 p-6 sm:p-10 lg:p-14 2xl:p-16 flex flex-col justify-center transition-colors duration-200">
        <div className="lg:hidden mb-5 text-center">
          <div className="w-10 h-10 mx-auto rounded-2xl bg-primary text-white flex items-center justify-center shadow-xs mb-2.5">
            <KeyRound className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground dark:text-foreground">
            Set New Password
          </h1>
        </div>

        {isSuccess ? (
          <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-chart-2/10 dark:bg-chart-2/20 text-chart-2 dark:text-chart-2 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground dark:text-foreground">
                Password Updated!
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground leading-relaxed max-w-sm mx-auto">
                Your password has been successfully reset. You can now sign in with your new password.
              </p>
            </div>

            <Button
              asChild
              variant="default"
              size="lg"
 className="w-full "
            >
              <Link href="/login" className="inline-flex items-center justify-center gap-2">
                <span>Continue to Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : isExpired ? (
          /* Expired / Invalid Recovery Link State */
          <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-chart-4/10 dark:bg-chart-4/20 text-chart-4 dark:text-chart-4 flex items-center justify-center">
              <RotateCcw className="h-7 w-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground dark:text-foreground">
                Reset Link Expired
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground leading-relaxed max-w-sm mx-auto">
                {errorMessage || "This password recovery link has already been used or has expired for security reasons."}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-muted dark:bg-muted text-xs text-muted-foreground text-left leading-relaxed">
              Security links expire quickly to protect your account. You can request a fresh recovery email below.
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <Button
                asChild
                variant="default"
                size="lg"
 className="w-full "
              >
                <Link href="/forgot-password" className="inline-flex items-center justify-center gap-2">
                  <span>Request New Reset Link</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
 className="w-full "
              >
                <Link href="/login" className="inline-flex items-center justify-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span>Return to Sign In</span>
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            {errorMessage && (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive dark:text-destructive text-xs sm:text-sm font-medium mb-4 animate-in fade-in slide-in-from-top-2 duration-200 text-left">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <div className="flex-1 leading-snug">{errorMessage}</div>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} action="#" className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label
                  htmlFor="new-password"
                  className="block text-sm font-semibold text-foreground dark:text-foreground"
                >
                  New password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    id="new-password"
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    autoFocus
                    className="w-full h-12 pl-11 pr-4 rounded-xl bg-muted dark:bg-muted border border-transparent focus:border-primary focus:bg-white dark:focus:bg-card focus:ring-2 focus:ring-ring/20 text-base text-foreground dark:text-foreground placeholder:text-muted-foreground dark:placeholder:text-muted-foreground outline-none transition-all duration-200"
                  />
                </div>
              </div>

              <div className="space-y-1.5 text-left">
                <label
                  htmlFor="confirm-password"
                  className="block text-sm font-semibold text-foreground dark:text-foreground"
                >
                  Confirm new password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    id="confirm-password"
                    type="password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    className="w-full h-12 pl-11 pr-4 rounded-xl bg-muted dark:bg-muted border border-transparent focus:border-primary focus:bg-white dark:focus:bg-card focus:ring-2 focus:ring-ring/20 text-base text-foreground dark:text-foreground placeholder:text-muted-foreground dark:placeholder:text-muted-foreground outline-none transition-all duration-200"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                variant="default"
                size="lg"
 className="w-full mt-3 "
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <span>Update Password</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-border dark:border-border text-center">
              <p className="text-sm sm:text-sm text-muted-foreground dark:text-muted-foreground">
                <Link
                  href="/login"
                  className="font-semibold text-primary hover:underline inline-flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Return to Sign In</span>
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-5xl h-96 p-10 rounded-3xl bg-white dark:bg-card border border-border dark:border-border flex items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      }
    >
      <ResetPasswordFormContent />
    </Suspense>
  );
}
