"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  Mail,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";

function ForgotPasswordFormContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const errorCode = searchParams.get("error_code");
    const errorDesc = searchParams.get("error_description");
    const errorParam = searchParams.get("error");

    if (errorCode === "otp_expired" || errorParam === "access_denied") {
      const msg = errorDesc || "Your password reset link has expired or is invalid. Please enter your email below to request a new link.";
      queueMicrotask(() => {
        setErrorMessage(msg);
        toast.error("Password reset link expired");
      });
    } else if (typeof window !== "undefined" && window.location.hash.includes("otp_expired")) {
      queueMicrotask(() => {
        setErrorMessage("Your password reset link has expired or is invalid. Please enter your email below to request a new link.");
        toast.error("Password reset link expired");
      });
    }
  }, [searchParams]);

  const handleResetPassword = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      const msg = "Please enter your registered email address.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setIsLoading(true);
    try {
      const callbackUrl = `${window.location.origin}/auth/callback?next=/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: callbackUrl,
      });

      if (error) {
        throw error;
      }

      setIsSuccess(true);
      toast.success("Password reset instructions sent to your email!");
    } catch (err: unknown) {
      console.error("Password reset request error:", err);
      let msg = "Failed to send password reset email. Please try again.";
      if (err instanceof Error && err.message) {
        msg = err.message;
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
            IntelliClass AI &bull; Account Recovery
          </span>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl 2xl:text-4xl font-bold tracking-tight text-foreground dark:text-foreground mb-3 leading-tight">
            Reset Password
          </h1>
          <p className="text-base lg:text-base 2xl:text-base text-muted-foreground dark:text-muted-foreground leading-relaxed mb-8 2xl:mb-10">
            Forgot your access credentials? Enter your institutional email address and we&apos;ll send you a secure link to create a new password.
          </p>

          {/* Feature Highlights */}
          <div className="space-y-4 2xl:space-y-5 pt-2">
            <div className="flex items-center gap-3.5 text-sm 2xl:text-base text-foreground dark:text-foreground font-medium">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              <span>Instant cryptographic reset token generation</span>
            </div>
            <div className="flex items-center gap-3.5 text-sm 2xl:text-base text-foreground dark:text-foreground font-medium">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              <span>Secure password updates without losing classroom history</span>
            </div>
            <div className="flex items-center gap-3.5 text-sm 2xl:text-base text-foreground dark:text-foreground font-medium">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              <span>Protected by Supabase Auth with Row-Level Security</span>
            </div>
          </div>
        </div>

        {/* Security Trust Footnote */}
        <div className="pt-6 mt-10 2xl:mt-14 border-t border-border dark:border-border flex items-center gap-2.5 text-xs 2xl:text-sm text-muted-foreground dark:text-muted-foreground">
          <ShieldCheck className="h-4.5 w-4.5 text-muted-foreground shrink-0" />
          <span>Encrypted institutional authentication with multi-factor support</span>
        </div>
      </div>

      {/* ── RIGHT COLUMN: FORM & CONTROLS ── */}
      <div className="col-span-12 lg:col-span-6 p-6 sm:p-10 lg:p-14 2xl:p-16 flex flex-col justify-center transition-colors duration-200">
        {/* Single Column Compact Header (Only visible on small / single-column screen) */}
        <div className="lg:hidden mb-5 text-center">
          <div className="w-10 h-10 mx-auto rounded-2xl bg-primary text-white flex items-center justify-center shadow-xs mb-2.5">
            <KeyRound className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground dark:text-foreground">
            Reset Password
          </h1>
          <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-1">
            Enter your email to receive recovery instructions
          </p>
        </div>

        {isSuccess ? (
          /* Success Confirmation State */
          <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-chart-2/10 dark:bg-chart-2/20 text-chart-2 dark:text-chart-2 flex items-center justify-center">
              <Mail className="h-7 w-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground dark:text-foreground">
                Check Your Inbox
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground leading-relaxed max-w-sm mx-auto">
                We sent a secure password reset link to{" "}
                <span className="font-semibold text-foreground dark:text-white">{email}</span>. Click the link in the email to set your new password.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-muted dark:bg-muted text-xs text-muted-foreground text-left leading-relaxed">
              Didn&apos;t receive the email? Check your spam or junk folder, or wait a minute before requesting another link.
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => {
                  setIsSuccess(false);
                  setEmail("");
                }}
 className="w-full "
              >
                <span>Try another email</span>
              </Button>

              <Button
                asChild
                variant="default"
                size="lg"
 className="w-full "
              >
                <Link href="/login" className="inline-flex items-center justify-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Sign In</span>
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          /* Email Input Form */
          <>
            {/* Error Alert Banner */}
            {errorMessage && (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive dark:text-destructive text-xs sm:text-sm font-medium mb-4 animate-in fade-in slide-in-from-top-2 duration-200 text-left">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <div className="flex-1 leading-snug">{errorMessage}</div>
              </div>
            )}

            <form onSubmit={handleResetPassword} action="#" className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label
                  htmlFor="reset-email"
                  className="block text-sm font-semibold text-foreground dark:text-foreground"
                >
                  Account email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    id="reset-email"
                    type="email"
                    placeholder="name@university.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                    autoFocus
                    className="w-full h-12 pl-11 pr-4 rounded-xl bg-muted dark:bg-muted border border-transparent focus:border-primary focus:bg-white dark:focus:bg-card focus:ring-2 focus:ring-ring/20 text-base text-foreground dark:text-foreground placeholder:text-muted-foreground dark:placeholder:text-muted-foreground outline-none transition-all duration-200"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1 pl-1">
                  We will send a single-use password reset link to this address.
                </p>
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
                    <span>Sending Recovery Link...</span>
                  </>
                ) : (
                  <>
                    <span>Send Reset Link</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Footer Navigation Link */}
            <div className="mt-6 pt-5 border-t border-border dark:border-border text-center">
              <p className="text-sm sm:text-sm text-muted-foreground dark:text-muted-foreground">
                Remember your password?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-primary hover:underline inline-flex items-center gap-1"
                >
                  <span>Sign in</span>
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ForgotPasswordForm() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-5xl h-96 p-10 rounded-3xl bg-white dark:bg-card border border-border dark:border-border flex items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      }
    >
      <ForgotPasswordFormContent />
    </Suspense>
  );
}
