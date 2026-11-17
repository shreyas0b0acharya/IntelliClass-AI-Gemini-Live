"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useIsMounted } from "@/hooks/useIsMounted";
import { supabase } from "@/lib/supabase/client";
import { api, ApiError } from "@/lib/api";
import type { ClassroomSession, Profile } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared";
import {
  Radio,
  Sparkles,
  Volume2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Users,
  AlertCircle,
  Play,
} from "lucide-react";
import { toast } from "sonner";

export default function SessionPreJoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();

  const hasMounted = useIsMounted();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<ClassroomSession | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioTested, setAudioTested] = useState(false);
  const [isTestingAudio, setIsTestingAudio] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkAuthAndLoadSession() {
      try {
        // 1. Check if user is authenticated
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace(`/login?redirectTo=/session/${encodeURIComponent(code)}`);
          return;
        }

        // 2. Load profile
        const { profile: userProfile } = await api.getProfile();
        if (active && userProfile) {
          setProfile(userProfile);
        }

        // 3. Resolve session code
        const { session: fetchedSession } = await api.getMeetingSession(code);
        if (active && fetchedSession) {
          setSession(fetchedSession);
        }
      } catch (err: unknown) {
        const is404 = err instanceof ApiError && err.status === 404;
        if (!is404) {
          console.warn("Session pre-join load error:", err);
        }
        const msg =
          err instanceof Error
            ? err.message
            : "Could not find a lecture session matching this session code.";
        if (active) setErrorMsg(msg);
      } finally {
        if (active) setLoading(false);
      }
    }

    checkAuthAndLoadSession();

    // 4. Realtime subscription to track when lecturer starts session
    const channel = supabase
      .channel(`session:prejoin:${code}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
        },
        (payload) => {
          const updated = payload.new as ClassroomSession;
          if (updated && updated.status) {
            setSession((prev) => {
              if (prev && (prev.id === updated.id || prev.meeting_code === updated.meeting_code)) {
                if (prev.status !== "running" && updated.status === "running") {
                  toast.success("🎓 The lecturer is now live! You can join the session.");
                }
                return { ...prev, ...updated };
              }
              return prev;
            });
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [code, router]);

  // Audio test helper to unlock audio context ahead of 3D stage
  const handleTestAudio = () => {
    setIsTestingAudio(true);
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 chime
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3); // A5 chime

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.45);

      setAudioTested(true);
      toast.success("Audio output verified!");
    } catch {
      toast.info("Audio ready.");
      setAudioTested(true);
    } finally {
      setIsTestingAudio(false);
    }
  };

  const handleJoinClassroom = () => {
    if (!session) return;
    router.push(`/classroom/${session.id}`);
  };

  if (!hasMounted || loading) {
    return (
      <div className="h-screen w-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 rounded-3xl bg-primary/10 flex items-center justify-center text-primary animate-spin">
          <Loader2 className="h-7 w-7" />
        </div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
          Connecting to AI Session &bull; {code}...
        </h2>
      </div>
    );
  }

  if (errorMsg || !session) {
    return (
      <div className="min-h-screen w-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full p-8 rounded-3xl border border-border/60 bg-card/80 shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-foreground">Session Not Found</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {errorMsg || `No lecture session was found for session code "${code}".`}
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <Button
              asChild
              variant="default"
              size="lg"
 className="h-11 "
            >
              <Link href="/" className="inline-flex items-center justify-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span>Return to Home</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isLive = session.status === "running";
  const personaName =
    session.voice_id === "af_bella" ? "Professor Bella" : "Professor Sharma";
  const personaGender = session.voice_id === "af_bella" ? "Female" : "Male";

  return (
    <div className="min-h-screen w-screen flex flex-col bg-gradient-to-b from-background via-background/95 to-muted/20">
      {/* Top Navbar */}
      <header className="h-16 px-6 shrink-0 flex items-center justify-between border-b border-border/40 bg-card/40 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2.5 font-extrabold text-foreground">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-base tracking-tight font-bold">IntelliClass AI</span>
        </Link>

        <div className="flex items-center gap-3">
          {profile && (
            <span className="text-xs text-muted-foreground font-semibold hidden sm:inline-block">
              Joining as <span className="text-foreground font-bold">{profile.name}</span>
            </span>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Main Green Room Content */}
      <main className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* Left Preview Stage Card */}
          <div className="md:col-span-7 flex flex-col items-center justify-center p-8 rounded-3xl border border-border/60 bg-card/80 shadow-2xl relative overflow-hidden min-h-[340px]">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center text-center space-y-4">
              <div className="w-24 h-24 rounded-3xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-4xl shadow-lg relative">
                {session.voice_id === "af_bella" ? "👩‍🏫" : "👨‍🏫"}
                {isLive && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-destructive" />
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">{personaName}</h3>
                <p className="text-xs text-muted-foreground">
                  AI Lecturer &bull; {personaGender} Persona
                </p>
              </div>

              {/* Status Badge */}
              <div
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isLive
                  ? "bg-destructive/15 text-destructive border border-destructive/30 animate-pulse"
                  : session.status === "paused"
                    ? "bg-chart-4/15 text-chart-4 border border-chart-4/30"
                    : session.status === "ended"
                      ? "bg-muted text-muted-foreground border border-border/40"
                      : "bg-primary/10 text-primary border border-primary/20"
                  }`}
              >
                {isLive ? (
                  <>
                    <Radio className="h-3.5 w-3.5" /> Broadcast in Progress
                  </>
                ) : session.status === "paused" ? (
                  "Lecture Paused"
                ) : session.status === "ended" ? (
                  "Session Completed"
                ) : (
                  "Stage Ready"
                )}
              </div>
            </div>

            {/* Bottom Audio Test Bar */}
            <div className="mt-8 z-10 w-full flex items-center justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestAudio}
                disabled={isTestingAudio}
 className={`h-10 ${
 audioTested ? " " : ""
                }`}
              >
                {isTestingAudio ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span>Testing Audio...</span>
                  </>
                ) : (
                  <>
                    {audioTested ? (
                      <CheckCircle2 className="h-4 w-4 text-chart-2" />
                    ) : (
                      <Volume2 className="h-4 w-4 text-primary" />
                    )}
                    <span>{audioTested ? "Audio Ready" : "Test Speaker & Audio"}</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right Join Action Card */}
          <div className="md:col-span-5 space-y-6 flex flex-col justify-center">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                <Users className="h-3 w-3" /> Ready to Join
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                {session.topic}
              </h1>
              <p className="text-xs text-muted-foreground font-mono">
                Session Code: <span className="font-bold text-foreground">{session.meeting_code || code}</span>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                Session Info
              </span>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground">3D Avatar Stage:</span>
                <span className="text-foreground">WebGL Realtime</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Live Q&amp;A:</span>
                <span className="text-chart-2">Enabled</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Subtitles &amp; Slides:</span>
                <span className="text-foreground">Synchronized</span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Button
                onClick={handleJoinClassroom}
                variant="default"
                size="lg"
 className={`w-full h-12 ${
 isLive ? " " : ""
                }`}
              >
                <Play className="h-5 w-5 fill-current" />
                <span>{isLive ? "Join Live Session" : "Join Session Room"}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>

              <p className="text-xs text-center text-muted-foreground font-medium">
                {isLive
                  ? "🔴 The lecture is currently in progress."
                  : "✨ The session room is open. Join now to enter the waiting room and be ready when the instructor begins."}
              </p>

              <p className="text-xs text-center text-muted-foreground">
                No app installation required &bull; 100% browser powered
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
