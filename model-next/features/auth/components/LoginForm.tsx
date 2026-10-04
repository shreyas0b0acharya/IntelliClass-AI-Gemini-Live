"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Loader2,
  ArrowRight,
  Lock,
  Mail,
  Radio,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function LoginFormContent() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setIsGoogleLoading(true);
    try {
      const callbackUrl = `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
        },
      });

      if (error) throw error;
    } catch (err: unknown) {
      console.error("Google OAuth error:", err);
      const msg = err instanceof Error ? err.message : "Failed to initiate Google Sign In";
      setErrorMessage(msg);
      toast.error(msg);
      setIsGoogleLoading(false);
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      const msg = "Please enter both your email address and password.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        let userMessage = error.message;
        if (error.message.toLowerCase().includes("invalid login credentials")) {
          userMessage = "Invalid email address or password. Please verify your credentials or click 'Forgot password?' below.";
        } else if (error.message.toLowerCase().includes("email not confirmed")) {
          userMessage = "Your email address has not been confirmed yet. Please check your inbox for the confirmation email.";
        }
        setErrorMessage(userMessage);
        toast.error(userMessage);
        return;
      }

      let finalRedirect = redirectTo;
      if (data?.user) {
        try {
          const { profile: prof } = await api.getProfile();
          if (prof) {
            localStorage.setItem("intelliclass_profile", JSON.stringify(prof));
            if (!searchParams.get("redirectTo") && !searchParams.get("next")) {
              finalRedirect = prof.role === "lecturer" ? "/dashboard" : "/";
            }
          }
        } catch (profileErr) {
          console.warn("Profile fetch warning after login:", profileErr);
        }
      }

      toast.success("Welcome back to IntelliClass!");
      // Full window navigation ensures cookies and session are re-evaluated by middleware cleanly
      window.location.href = finalRedirect;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sign in. Please verify your credentials.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md lg:max-w-none mx-auto bg-white dark:bg-[#1c1c1e] border border-[#e5e5ea] dark:border-[#2c2c2e] rounded-3xl lg:rounded-[32px] shadow-[0_12px_48px_rgba(0,0,0,0.05)] dark:shadow-none grid grid-cols-1 lg:grid-cols-12 overflow-hidden transition-colors duration-200">
      {/* ── LEFT COLUMN: BRANDING & DESCRIPTIONS (2-COLUMN VIEW ONLY) ── */}
      <div className="hidden lg:flex col-span-12 lg:col-span-6 bg-[#fafafa] dark:bg-[#161618] border-r border-[#e5e5ea] dark:border-[#2c2c2e] p-8 sm:p-10 lg:p-14 2xl:p-16 flex-col justify-between text-left transition-colors duration-200">
        <div>
          <div className="w-12 h-12 2xl:w-14 2xl:h-14 rounded-2xl bg-[#0071e3] text-white flex items-center justify-center shadow-xs mb-6">
            <Sparkles className="h-6 w-6 2xl:h-7 2xl:w-7" />
          </div>
          <span className="text-xs uppercase tracking-widest font-bold text-[#86868b] dark:text-[#86868b] block mb-2">
            IntelliClass AI &bull; Autonomous Lecture Environment
          </span>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl 2xl:text-[42px] font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7] mb-3 leading-tight">
            Sign In to IntelliClass
          </h1>
          <p className="text-[15px] lg:text-[16px] 2xl:text-[17px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed mb-8 2xl:mb-10">
            Access your AI-powered lecture studio, synchronized textbooks, and real-time interactive classroom sessions.
          </p>

          {/* Feature Highlights */}
          <div className="space-y-4 2xl:space-y-5 pt-2">
            <div className="flex items-center gap-3.5 text-[14px] 2xl:text-[15px] text-[#1d1d1f] dark:text-[#f5f5f7] font-medium">
              <CheckCircle2 className="h-5 w-5 text-[#0071e3] shrink-0" />
              <span>Real-time 3D professor avatar interaction</span>
            </div>
            <div className="flex items-center gap-3.5 text-[14px] 2xl:text-[15px] text-[#1d1d1f] dark:text-[#f5f5f7] font-medium">
              <CheckCircle2 className="h-5 w-5 text-[#0071e3] shrink-0" />
              <span>Live in-session Q&amp;A and interruption</span>
            </div>
            <div className="flex items-center gap-3.5 text-[14px] 2xl:text-[15px] text-[#1d1d1f] dark:text-[#f5f5f7] font-medium">
              <CheckCircle2 className="h-5 w-5 text-[#0071e3] shrink-0" />
              <span>Contextual textbook &amp; slide synthesis</span>
            </div>
          </div>
        </div>

        {/* Security Trust Footnote */}
        <div className="pt-6 mt-10 2xl:mt-14 border-t border-[#e5e5ea] dark:border-[#2c2c2e] flex items-center gap-2.5 text-xs 2xl:text-[13px] text-[#86868b] dark:text-[#86868b]">
          <ShieldCheck className="h-4.5 w-4.5 text-[#86868b] shrink-0" />
          <span>Encrypted institutional authentication with Row-Level Security</span>
        </div>
      </div>

      {/* ── RIGHT COLUMN: FORM & CONTROLS ────────────────────────────────── */}
      <div className="col-span-12 lg:col-span-6 p-6 sm:p-10 lg:p-14 2xl:p-16 flex flex-col justify-center transition-colors duration-200">
        {/* Single Column Compact Header (Only visible on small / single-column screen) */}
        <div className="lg:hidden mb-5 text-center">
          <div className="w-10 h-10 mx-auto rounded-2xl bg-[#0071e3] text-white flex items-center justify-center shadow-xs mb-2.5">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
            Sign In to IntelliClass
          </h1>
        </div>

        {/* Session Redirect Alert */}
        {redirectTo.startsWith("/session/") && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-[#0071e3] text-xs sm:text-sm font-semibold mb-4">
            <Radio className="h-4 w-4 animate-pulse shrink-0" />
            <span>Sign in to automatically enter your scheduled lecture session.</span>
          </div>
        )}

        {/* Google SSO Button */}
        <Button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading || isGoogleLoading}
          variant="outline"
          size="lg"
          className="w-full text-[#1d1d1f] dark:text-[#f5f5f7] bg-white dark:bg-[#2c2c2e] border-[#d2d2d7]/80 dark:border-[#3a3a3c] rounded-full"
        >
          {isGoogleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          ) : (
            <GoogleIcon />
          )}
          <span>Continue with Google</span>
        </Button>

        {/* Hairline Divider (Perfect Center) */}
        <div className="relative my-5 2xl:my-6 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#e5e5ea] dark:border-[#2c2c2e]" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white dark:bg-[#1c1c1e] px-4 text-[11px] font-bold text-[#86868b] uppercase tracking-wider">
              or with email
            </span>
          </div>
        </div>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-[#ff3b30] dark:text-[#ff453a] text-xs sm:text-[13px] font-medium mb-4 animate-in fade-in slide-in-from-top-2 duration-200 text-left">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            <div className="flex-1 leading-snug">{errorMessage}</div>
          </div>
        )}

        {/* Email/Password Form */}
        <form onSubmit={handleLogin} action="#" className="space-y-4">
          <div className="space-y-1.5 text-left">
            <label
              htmlFor="email"
              className="block text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
            >
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 h-4 w-4 text-[#86868b] pointer-events-none" />
              <input
                id="email"
                type="email"
                placeholder="name@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading || isGoogleLoading}
                required
                className="w-full h-12 pl-11 pr-4 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-transparent focus:border-[#0071e3] focus:bg-white dark:focus:bg-[#1c1c1e] focus:ring-2 focus:ring-[#0071e3]/20 text-[15px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#86868b] dark:placeholder:text-[#a1a1a6] outline-none transition-all duration-200"
              />
            </div>
          </div>

          <div className="space-y-1.5 text-left">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-[#0071e3] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 h-4 w-4 text-[#86868b] pointer-events-none" />
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading || isGoogleLoading}
                required
                className="w-full h-12 pl-11 pr-4 rounded-xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-transparent focus:border-[#0071e3] focus:bg-white dark:focus:bg-[#1c1c1e] focus:ring-2 focus:ring-[#0071e3]/20 text-[15px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#86868b] dark:placeholder:text-[#a1a1a6] outline-none transition-all duration-200"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading || isGoogleLoading}
            variant="default"
            size="lg"
            className="w-full mt-3 rounded-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <span>Enter Academy</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        {/* Footer Link */}
        <div className="mt-6 pt-5 border-t border-[#e5e5ea] dark:border-[#2c2c2e] text-center">
          <p className="text-[13px] sm:text-[14px] text-[#86868b] dark:text-[#a1a1a6]">
            Don&apos;t have an account?{" "}
            <Link
              href={`/register${redirectTo !== "/dashboard" ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`}
              className="font-semibold text-[#0071e3] hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export function LoginForm() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-5xl h-96 p-10 rounded-3xl bg-white dark:bg-[#1c1c1e] border border-[#e5e5ea] dark:border-[#2c2c2e] flex items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-[#0071e3]" />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
