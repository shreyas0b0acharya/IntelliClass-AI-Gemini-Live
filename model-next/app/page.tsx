"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar, SessionCodeInput } from "@/components/shared";
import { useAuth } from "@/features/auth";
import { AppButton } from "@/components/app";
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
} from "lucide-react";

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
      className={`group relative p-8 sm:p-10 rounded-3xl bg-white dark:bg-[#1c1c1e] border border-[#e5e5ea] dark:border-[#2c2c2e] hover:border-[#d2d2d7] dark:hover:border-[#3a3a3c] transition-all duration-300 flex flex-col justify-between shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-none ${className}`}
    >
      <div>
        <div className="w-12 h-12 rounded-2xl bg-[#f5f5f7] dark:bg-[#2c2c2e] border border-[#e5e5ea] dark:border-[#3a3a3c] flex items-center justify-center text-[#86868b] dark:text-[#a1a1a6] mb-6 transition-transform group-hover:scale-105">
          {icon}
        </div>
        <span className="text-[11px] uppercase tracking-widest font-bold text-[#86868b] dark:text-[#86868b] block mb-2">
          {tag}
        </span>
        <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7] mb-3">
          {title}
        </h3>
        <p className="text-[15px] sm:text-[16px] leading-relaxed text-[#86868b] dark:text-[#a1a1a6]">
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

  // ── A. LOGGED-IN STUDENT VIEW: CLEAN MINIMAL JOIN SCREEN ────────────────
  if (!isLoading && user && !isLecturer) {
    return (
      <div className="min-h-screen w-full bg-[#f5f5f7] dark:bg-black text-[#1d1d1f] dark:text-[#f5f5f7] flex flex-col antialiased selection:bg-[#0071e3] selection:text-white transition-colors duration-300">
        <Navbar showLinks={false} />

        <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12">
          <div className="w-full max-w-md mx-auto text-center space-y-8 animate-in fade-in zoom-in-95 duration-300 bg-white dark:bg-[#1c1c1e] border border-[#e5e5ea] dark:border-[#2c2c2e] rounded-3xl p-8 sm:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] dark:shadow-none">
            {/* Header Icon */}
            <div className="w-14 h-14 rounded-2xl bg-[#0071e3] text-white flex items-center justify-center shadow-xs mx-auto mb-2">
              <KeyRound className="h-7 w-7" />
            </div>

            {/* Heading */}
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
                Join Live Class
              </h1>
              <p className="text-[15px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
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
            <div className="pt-6 border-t border-[#e5e5ea] dark:border-[#2c2c2e] flex flex-col items-center gap-3 text-xs text-[#86868b] dark:text-[#a1a1a6]">
              <Link
                href="/showcase"
                className="hover:text-[#0071e3] dark:hover:text-[#0071e3] flex items-center gap-1.5 transition-colors font-medium"
              >
                <Presentation className="h-3.5 w-3.5 text-[#0071e3]" />
                Test 3D Avatar &amp; Audio Lab
              </Link>
            </div>
          </div>
        </main>

        <footer className="py-5 border-t border-[#e5e5ea] dark:border-[#2c2c2e] text-center text-xs text-[#86868b]">
          IntelliClass AI &bull; Student Portal
        </footer>
      </div>
    );
  }

  // ── B. GUEST VISITOR VIEW: APPLE HIG LANDING PAGE ───────────────────────
  return (
    <div className="min-h-screen w-full bg-white dark:bg-black text-[#1d1d1f] dark:text-[#f5f5f7] selection:bg-[#0071e3] selection:text-white antialiased transition-colors duration-300">
      {/* ── 1. UNIFIED APPLE FROSTED NAVBAR ──────────────────────────────────── */}
      <Navbar />

      {/* ── 2. HERO SECTION ─────────────────────────────────────────────────── */}
      <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 px-4 sm:px-6 text-center max-w-5xl mx-auto">
        {/* Apple Eyebrow Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#f5f5f7] dark:bg-[#1c1c1e] border border-[#e5e5ea] dark:border-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] text-[12px] font-semibold tracking-tight mb-8">
          <span className="w-2 h-2 rounded-full bg-[#0071e3]" />
          Autonomous AI Classroom System
        </div>

        {/* Apple Massive Headline */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[76px] font-bold tracking-[-0.03em] leading-[1.06] text-[#1d1d1f] dark:text-[#f5f5f7] mb-6">
          The AI classroom.<br className="hidden sm:inline" />
          Teaches like a professor.
        </h1>

        {/* Subhead (17px Apple Body standard) */}
        <p className="text-[17px] sm:text-[20px] leading-relaxed text-[#86868b] dark:text-[#a1a1a6] max-w-2xl mx-auto mb-10 font-normal">
          IntelliClass transforms course textbooks into live, interactive 3D lectures with an expressive biomechanical avatar, neural speech, and instant Q&amp;A.
        </p>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-xl mx-auto mb-8">
          <AppButton
            asChild
            size="lg"
            variant="primary"
            shape="pill"
            className="w-full sm:w-auto px-7 text-[15px] sm:text-[16px] shadow-xs"
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            <Link href="/register">
              <span>Start as Lecturer</span>
            </Link>
          </AppButton>

          {/* Student Join Code Box */}
          <SessionCodeInput
            placeholder="Enter meeting code..."
            buttonText="Join"
          />
        </div>

        {/* Monochromatic Link */}
        <div className="flex items-center justify-center gap-6 text-[15px]">
          <Link
            href="/showcase"
            className="text-[#0071e3] hover:underline flex items-center gap-1 font-medium group"
          >
            Explore 3D Avatar Lab in real time
            <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Key Metrics Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-16 mt-16 border-t border-[#e5e5ea] dark:border-[#2c2c2e] max-w-4xl mx-auto">
          {HIGHLIGHTS.map((item) => (
            <div key={item.label} className="text-center">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
                {item.value}
              </div>
              <div className="text-xs sm:text-[13px] text-[#86868b] dark:text-[#a1a1a6] mt-1 font-medium">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3. FEATURES BENTO GRID ──────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-[#f5f5f7] dark:bg-[#161617] border-y border-[#e5e5ea] dark:border-[#2c2c2e] transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-[12px] uppercase tracking-widest font-bold text-[#86868b] dark:text-[#a1a1a6] block mb-2">
              Capabilities
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
              Engineered for natural pedagogy.
            </h2>
            <p className="text-[17px] text-[#86868b] dark:text-[#a1a1a6] mt-4 leading-relaxed">
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
          <span className="text-[12px] uppercase tracking-widest font-bold text-[#86868b] dark:text-[#a1a1a6] block mb-2">
            Workflow
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
            From syllabus to broadcast.
          </h2>
          <p className="text-[17px] text-[#86868b] dark:text-[#a1a1a6] mt-4">
            A three-step pipeline designed for university faculty and students.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((step) => (
            <div
              key={step.step}
              className="p-8 sm:p-10 rounded-3xl bg-white dark:bg-[#1c1c1e] border border-[#e5e5ea] dark:border-[#2c2c2e] shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-none flex flex-col justify-between"
            >
              <div>
                <div className="text-4xl font-bold tracking-tight text-[#0071e3] mb-6">
                  {step.step}
                </div>
                <h3 className="text-xl font-bold text-[#1d1d1f] dark:text-[#f5f5f7] mb-3">
                  {step.title}
                </h3>
                <p className="text-[15px] sm:text-[16px] leading-relaxed text-[#86868b] dark:text-[#a1a1a6]">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 5. PRIVACY & SECURITY BANNER ────────────────────────────────────── */}
      <section className="py-16 bg-[#f5f5f7] dark:bg-[#1c1c1e] border-y border-[#e5e5ea] dark:border-[#2c2c2e] transition-colors">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#2c2c2e] border border-[#e5e5ea] dark:border-[#3a3a3c] flex items-center justify-center text-[#86868b] dark:text-[#a1a1a6] shrink-0 shadow-xs">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div className="space-y-1 flex-1">
            <h4 className="text-lg font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
              Enterprise Institutional Security
            </h4>
            <p className="text-sm text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
              Course documents and generated teaching data remain strictly protected under encrypted database row-level security.
            </p>
          </div>
          <div className="shrink-0">
            <Link
              href="/register"
              className="text-xs font-semibold text-[#0071e3] hover:underline flex items-center gap-1"
            >
              Learn more <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 6. BOTTOM CALL TO ACTION ────────────────────────────────────────── */}
      <section className="py-24 md:py-32 text-center px-4 sm:px-6 max-w-4xl mx-auto">
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7] mb-6">
          Ready to elevate your lectures?
        </h2>
        <p className="text-[17px] sm:text-[19px] text-[#86868b] dark:text-[#a1a1a6] max-w-xl mx-auto mb-10 leading-relaxed">
          Create custom AI-led sessions in seconds. Accessible on any modern web browser.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <AppButton
            asChild
            size="lg"
            variant="primary"
            shape="pill"
            className="w-full sm:w-auto px-7 text-[15px] sm:text-[16px] shadow-xs"
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            <Link href="/register">
              <span>Create Lecturer Account</span>
            </Link>
          </AppButton>
          <AppButton
            asChild
            size="lg"
            variant="secondary"
            shape="pill"
            className="w-full sm:w-auto px-7 text-[15px] sm:text-[16px]"
          >
            <Link href="/login">
              <span>Sign In</span>
            </Link>
          </AppButton>
        </div>
      </section>

      {/* ── 7. APPLE MINIMALIST FOOTER ──────────────────────────────────────── */}
      <footer className="py-10 border-t border-[#e5e5ea] dark:border-[#2c2c2e] bg-white dark:bg-black text-xs text-[#86868b] dark:text-[#86868b] transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
            IntelliClass AI
          </div>
          <div>
            Copyright &copy; {new Date().getFullYear()} IntelliClass. University Final Year Capstone Project.
          </div>
          <div className="flex items-center gap-4">
            <Link href="/showcase" className="hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-colors">
              Avatar Lab
            </Link>
            <Link href="/dashboard" className="hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}