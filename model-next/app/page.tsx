"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar, SessionCodeInput } from "@/components/shared";
import { useAuth } from "@/features/auth";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  ChevronRight,
  BookOpen,
  UserCheck,
  MessageSquareText,
  FileSpreadsheet,
  Waves,
  BarChart3,
  ShieldCheck,
  KeyRound,
  Presentation,
  Loader2,
} from "lucide-react";

const LandingHeroAvatarStage = dynamic(
  () => import("@/features/avatar").then((m) => m.LandingHeroAvatarStage),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[440px] sm:h-[480px] md:h-[500px] flex flex-col items-center justify-center gap-3 text-muted-foreground bg-muted/10 rounded-3xl border border-border/40 select-none">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="text-xs font-medium">Loading 3D classroom scene...</span>
      </div>
    ),
  }
);

interface FeatureCardProps {
  icon: React.ReactNode;
  tag: string;
  title: string;
  description: string;
  className?: string;
}

function FeatureCard({ icon, tag, title, description, className = "" }: FeatureCardProps) {
  return (
    <div
      className={`group relative p-8 sm:p-10 rounded-3xl bg-white dark:bg-card border border-border dark:border-border hover:border-border dark:hover:border-border transition-all duration-300 flex flex-col justify-between shadow-xs dark:shadow-none ${className}`}
    >
      <div>
        <div className="w-12 h-12 rounded-2xl bg-muted dark:bg-muted border border-border dark:border-border flex items-center justify-center text-muted-foreground dark:text-muted-foreground mb-6 transition-transform group-hover:scale-105">
          {icon}
        </div>
        <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground dark:text-muted-foreground block mb-2">
          {tag}
        </span>
        <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground dark:text-foreground mb-3">
          {title}
        </h3>
        <p className="text-base sm:text-base leading-relaxed text-muted-foreground dark:text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

const HIGHLIGHTS = [
  { value: "WebGL", label: "Realtime 3D Biomechanical Avatar" },
  { value: "Sub-300ms", label: "Sentence-Streamed Neural TTS" },
  { value: "Gemini RAG", label: "Curriculum Context Engine" },
];

const STEPS = [
  {
    step: "01",
    title: "Upload Curriculum",
    description: "Provide textbooks, lecture PDFs, or lecture notes. The system chunks and embeds material instantly.",
  },
  {
    step: "02",
    title: "Generate AI Script",
    description: "Gemini synthesizes a pedagogically structured lecture with slide transitions, pauses, and analogies.",
  },
  {
    step: "03",
    title: "Broadcast Live",
    description: "Students join via a 6-character session code to experience the synchronized 3D professor avatar.",
  },
];

export default function HomePage() {
  const router = useRouter();
  const { user, profile, isLecturer, isLoading } = useAuth();

  // If a faculty member visits root while logged in, redirect them directly to the Faculty Studio
  useEffect(() => {
    if (!isLoading && user && isLecturer) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, isLecturer, router]);

  // Handle incoming Supabase auth recovery codes and errors landing on root
  useEffect(() => {
    if (typeof window !== "undefined") {
      const search = window.location.search;
      const hash = window.location.hash;

      // 1. If recovery code landed on root, route to callback
      const params = new URLSearchParams(search);
      const code = params.get("code");
      if (code) {
        router.replace(`/auth/callback?code=${encodeURIComponent(code)}&next=/reset-password`);
        return;
      }

      // 2. If recovery hash token landed on root, route directly to /reset-password
      if (hash.includes("type=recovery")) {
        router.replace(`/reset-password${hash}`);
        return;
      }

      // 3. If token expired, forward to /forgot-password
      if (
        search.includes("otp_expired") ||
        hash.includes("otp_expired") ||
        search.includes("error=access_denied") ||
        hash.includes("error=access_denied")
      ) {
        router.replace(
          "/forgot-password?error_code=otp_expired&error_description=Your+password+reset+link+has+expired+or+is+invalid.+Please+request+a+new+recovery+email."
        );
      }
    }
  }, [router]);

  // ── A. LOGGED-IN STUDENT VIEW: CLEAN MINIMAL JOIN SCREEN ────────────────
  if (!isLoading && user && !isLecturer) {
    return (
      <div className="min-h-screen w-full bg-muted dark:bg-black text-foreground dark:text-foreground flex flex-col antialiased selection:bg-primary selection:text-white transition-colors duration-300">
        <Navbar showLinks={false} />

        <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12">
          <div className="w-full max-w-md mx-auto text-center space-y-8 animate-in fade-in zoom-in-95 duration-300 bg-white dark:bg-card border border-border dark:border-border rounded-3xl p-8 sm:p-10 shadow-sm dark:shadow-none">
            {/* Header Icon */}
            <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-xs mx-auto mb-2">
              <KeyRound className="h-7 w-7" />
            </div>

            {/* Heading */}
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground dark:text-foreground">
                Join Live Class
              </h1>
              <p className="text-base text-muted-foreground dark:text-muted-foreground leading-relaxed">
                {profile?.name ? `Welcome, ${profile.name}. ` : ""}
                Enter the session code provided by your professor.
              </p>
            </div>

            {/* Reusable Clean Input Form */}
            <div className="flex justify-center pt-2">
              <SessionCodeInput
                autoFocus
                size="large"
                buttonText="Join"
                placeholder="Enter meeting code..."
                className="w-full justify-between"
              />
            </div>

            {/* Sub-actions */}
            <div className="pt-6 border-t border-border dark:border-border flex flex-col items-center gap-3 text-xs text-muted-foreground dark:text-muted-foreground">
              <Link
                href="/showcase"
                className="hover:text-primary dark:hover:text-primary flex items-center gap-1.5 transition-colors font-medium"
              >
                <Presentation className="h-3.5 w-3.5 text-primary" />
                Test 3D Avatar &amp; Audio Lab
              </Link>
            </div>
          </div>
        </main>

        <footer className="py-5 border-t border-border dark:border-border text-center text-xs text-muted-foreground">
          IntelliClass AI &bull; Student Portal
        </footer>
      </div>
    );
  }

  // ── B. GUEST VISITOR VIEW: APPLE HIG LANDING PAGE ───────────────────────
  return (
    <div className="min-h-screen w-full bg-white dark:bg-black text-foreground dark:text-foreground selection:bg-primary selection:text-white antialiased transition-colors duration-300">
      {/* ── 1. UNIFIED APPLE FROSTED NAVBAR ──────────────────────────────────── */}
      <Navbar />

      {/* ── 2. HERO SECTION ─────────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-16 md:pt-28 md:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Column: Value Proposition & Action Controls */}
          <div className="lg:col-span-6 xl:col-span-7 text-center lg:text-left">
            {/* Apple Eyebrow Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-muted dark:bg-card border border-border dark:border-border text-foreground dark:text-foreground text-xs font-semibold tracking-tight mb-6">
              <span className="w-2 h-2 rounded-full bg-primary" />
              Autonomous AI Classroom System
            </div>

            {/* Apple Massive Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[58px] xl:text-[68px] font-bold tracking-tight leading-[1.08] text-foreground dark:text-foreground mb-6">
              The AI classroom.<br className="hidden sm:inline" />
              Teaches like a professor.
            </h1>

            {/* Subhead (17px Apple Body standard) */}
            <p className="text-base sm:text-lg leading-relaxed text-muted-foreground dark:text-muted-foreground max-w-2xl mx-auto lg:mx-0 mb-8 font-normal">
              IntelliClass transforms course textbooks into live, interactive 3D lectures with an expressive biomechanical avatar, neural speech, and instant Q&amp;A.
            </p>

            {/* Action Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-8">
              <Button
                asChild
                size="lg"
                variant="default"
                className="w-full sm:w-auto px-7 text-base shadow-xs"
              >
                <Link href="/register" className="inline-flex items-center justify-center gap-2">
                  <span>Start as Lecturer</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              {/* Student Join Code Box */}
              <SessionCodeInput
                placeholder="Enter meeting code..."
                buttonText="Join"
              />
            </div>

            {/* Monochromatic Link */}
            {/* <div className="flex items-center justify-center lg:justify-start gap-6 text-sm sm:text-base">
              <Link
                href="/showcase"
                className="text-primary hover:underline flex items-center gap-1 font-medium group"
              >
                Explore 3D Avatar Lab in real time
                <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div> */}
          </div>

          {/* Right Column: Interactive 3D Stage with Standing Chalkboard & Avatar Switcher */}
          <div className="lg:col-span-6 xl:col-span-5 w-full max-w-lg mx-auto lg:max-w-none">
            <LandingHeroAvatarStage />
          </div>
        </div>

        {/* Key Metrics Ribbon (Full Width below 2-column grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-16 mt-16 border-t border-border dark:border-border max-w-5xl mx-auto">
          {HIGHLIGHTS.map((item) => (
            <div key={item.label} className="text-center">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground dark:text-foreground">
                {item.value}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground mt-1 font-medium">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3. FEATURES BENTO GRID ──────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-muted dark:bg-card border-y border-border dark:border-border transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground dark:text-muted-foreground block mb-2">
              Capabilities
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground dark:text-foreground">
              Engineered for natural pedagogy.
            </h2>
            <p className="text-base text-muted-foreground dark:text-muted-foreground mt-4 leading-relaxed">
              Every system is built to mimic the nuances of human lecturing — from gesture timing to contextual student interruption.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              icon={<BookOpen className="h-6 w-6" />}
              tag="Gemini 2.5 RAG"
              title="Curriculum Synthesis"
              description="Ingests university textbooks and lecture slides to generate deep, conceptual scripts complete with Socratic checks."
            />

            <FeatureCard
              icon={<UserCheck className="h-6 w-6" />}
              tag="Three.js & WebGL"
              title="3D Biomechanical Avatar"
              description="Full facial blendshape animation, accurate viseme lip-synchronization, and natural professor body language."
            />

            <FeatureCard
              icon={<MessageSquareText className="h-6 w-6" />}
              tag="Real-Time Q&A"
              title="Live Class Interruption"
              description="Students ask clarifying questions at any second. The avatar pauses, addresses the student in character, and resumes."
            />

            <FeatureCard
              icon={<FileSpreadsheet className="h-6 w-6" />}
              tag="Vector Pipeline"
              title="Smart PDF Ingestion"
              description="Automated chunking and semantic indexing across dense scientific papers, diagrams, and equations."
            />

            <FeatureCard
              icon={<Waves className="h-6 w-6" />}
              tag="Neural TTS Engine"
              title="Sentence-Streamed Speech"
              description="Chunk-level voice synthesis runs under 300ms, streaming natural intonation without noticeable audio buffering."
            />

            <FeatureCard
              icon={<BarChart3 className="h-6 w-6" />}
              tag="Classroom Telemetry"
              title="Analytics & Attendance"
              description="Track real-time student presence, Q&A engagement frequency, and session completion metrics."
            />
          </div>
        </div>
      </section>

      {/* ── 4. HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 md:py-32 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-20">
          <span className="text-xs uppercase tracking-widest font-bold text-muted-foreground dark:text-muted-foreground block mb-2">
            Workflow
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground dark:text-foreground">
            From syllabus to broadcast.
          </h2>
          <p className="text-base text-muted-foreground dark:text-muted-foreground mt-4">
            A three-step pipeline designed for university faculty and students.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((step) => (
            <div
              key={step.step}
              className="p-8 sm:p-10 rounded-3xl bg-white dark:bg-card border border-border dark:border-border shadow-xs dark:shadow-none flex flex-col justify-between"
            >
              <div>
                <div className="text-4xl font-bold tracking-tight text-primary mb-6">
                  {step.step}
                </div>
                <h3 className="text-xl font-bold text-foreground dark:text-foreground mb-3">
                  {step.title}
                </h3>
                <p className="text-base sm:text-base leading-relaxed text-muted-foreground dark:text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 5. PRIVACY & SECURITY BANNER ────────────────────────────────────── */}
      <section className="py-16 bg-muted dark:bg-card border-y border-border dark:border-border transition-colors">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="w-14 h-14 rounded-2xl bg-white dark:bg-muted border border-border dark:border-border flex items-center justify-center text-muted-foreground dark:text-muted-foreground shrink-0 shadow-xs">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div className="space-y-1 flex-1">
            <h4 className="text-lg font-bold text-foreground dark:text-foreground">
              Enterprise Institutional Security
            </h4>
            <p className="text-sm text-muted-foreground dark:text-muted-foreground leading-relaxed">
              Course documents and generated teaching data remain strictly protected under encrypted database row-level security.
            </p>
          </div>
          <div className="shrink-0">
            <Link
              href="/register"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              Learn more <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 6. BOTTOM CALL TO ACTION ────────────────────────────────────────── */}
      <section className="py-24 md:py-32 text-center px-4 sm:px-6 max-w-4xl mx-auto">
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground dark:text-foreground mb-6">
          Ready to elevate your lectures?
        </h2>
        <p className="text-base sm:text-lg text-muted-foreground dark:text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
          Create custom AI-led sessions in seconds. Accessible on any modern web browser.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            asChild
            size="lg"
            variant="default"
 className="w-full sm:w-auto "
          >
            <Link href="/register" className="inline-flex items-center justify-center gap-2">
              <span>Create Lecturer Account</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="secondary"
 className="w-full sm:w-auto "
          >
            <Link href="/login">
              <span>Sign In</span>
            </Link>
          </Button>
        </div>
      </section>

      {/* ── 7. APPLE MINIMALIST FOOTER ──────────────────────────────────────── */}
      <footer className="py-10 border-t border-border dark:border-border bg-white dark:bg-black text-xs text-muted-foreground dark:text-muted-foreground transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="font-semibold text-foreground dark:text-foreground">
            IntelliClass AI
          </div>
          <div>
            Copyright &copy; {new Date().getFullYear()} IntelliClass. University Final Year Capstone Project.
          </div>
          <div className="flex items-center gap-4">
            <Link href="/showcase" className="hover:text-foreground dark:hover:text-foreground transition-colors">
              Avatar Lab
            </Link>
            <Link href="/dashboard" className="hover:text-foreground dark:hover:text-foreground transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}