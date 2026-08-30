"use client";

import { useEffect, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Course } from "@/lib/supabase/types";
import { useAuth } from "@/features/auth";
import { api } from "@/lib/api";
import { MaterialList, FileUploadDialog } from "@/features/materials";
import { SessionList, CreateSessionDialog } from "@/features/sessions";
import { AppButton } from "@/components/app";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BookOpen, Presentation, FileText, Plus, Upload } from "lucide-react";
import Link from "next/link";

export default function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") === "materials" ? "materials" : "sessions";

  const [course, setCourse] = useState<Course | null>(null);
  const { isLecturer } = useAuth();
  const [materialRefresh, setMaterialRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    api
      .getCourse(courseId)
      .then(({ course: fetchedCourse }) => {
        if (active && fetchedCourse) setCourse(fetchedCourse);
      })
      .catch((err) => {
        console.error("Error loading course:", err);
      });

    return () => {
      active = false;
    };
  }, [courseId]);

  if (!course) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-36 rounded-full" />
        </div>

        <div className="p-8 rounded-3xl border border-black/5 dark:border-white/5 bg-[#f5f5f7] dark:bg-[#1c1c1e] shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-64 rounded-xl" />
              <Skeleton className="h-3 w-32 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-4 w-full max-w-2xl rounded-md" />
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-4">
            <div className="flex gap-2">
              <Skeleton className="h-10 w-44 rounded-xl" />
              <Skeleton className="h-10 w-44 rounded-xl" />
            </div>
            <Skeleton className="h-10 w-36 rounded-full" />
          </div>

          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-5 rounded-2xl border border-black/5 dark:border-white/5 bg-[#f5f5f7] dark:bg-[#1c1c1e]"
              >
                <div className="flex items-center gap-3.5 flex-1">
                  <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
                  <div className="space-y-2 flex-1 max-w-md">
                    <Skeleton className="h-4 w-52 rounded-md" />
                    <Skeleton className="h-3 w-28 rounded-md" />
                  </div>
                </div>
                <Skeleton className="h-9 w-32 rounded-full shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* ── 1. Top Navigation: Back to Dashboard Pill ──────────────────── */}
      <div className="flex items-center justify-between">
        <AppButton
          variant="secondary"
          shape="pill"
          size="xs"
          onClick={() => router.push("/dashboard")}
          leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}
        >
          <span>Back to Dashboard</span>
        </AppButton>
      </div>

      {/* ── 2. Elevated macOS Course Header Card ──────────────────────── */}
      <div className="p-6 sm:p-8 rounded-3xl border border-black/5 dark:border-white/5 bg-[#f5f5f7] dark:bg-[#1c1c1e] shadow-xs space-y-3">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/10 flex items-center justify-center text-[#0071e3] shadow-xs shrink-0">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
              {course.title}
            </h1>
            <span className="text-[11px] uppercase font-semibold text-[#86868b] tracking-wider">
              Course Space &bull; Active Curriculum
            </span>
          </div>
        </div>
        <p className="text-[14px] text-[#6e6e73] dark:text-[#a1a1a6] max-w-3xl leading-relaxed">
          {course.description || "Interactive AI course space for real-time lecturing, syllabus synthesis, and student inquiries."}
        </p>
      </div>

      {/* ── 3. Apple-Style Segmented Control & Buttons ────────────────── */}
      <Tabs defaultValue={defaultTab} className="space-y-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-black/5 dark:border-white/10 pb-4">
          {/* Segmented Control Track */}
          <TabsList className="bg-black/5 dark:bg-white/10 p-1 rounded-xl border border-black/5 dark:border-white/5 h-auto">
            <TabsTrigger
              value="sessions"
              className="rounded-lg gap-2 text-xs font-medium px-4 py-2 text-[#6e6e73] dark:text-[#a1a1a6] data-[state=active]:bg-white dark:data-[state=active]:bg-[#2c2c2e] data-[state=active]:text-[#1d1d1f] dark:data-[state=active]:text-[#f5f5f7] data-[state=active]:shadow-sm transition-all cursor-pointer"
            >
              <Presentation className="h-3.5 w-3.5 text-[#0071e3]" />
              <span>Lectures &amp; Broadcasts</span>
            </TabsTrigger>
            <TabsTrigger
              value="materials"
              className="rounded-lg gap-2 text-xs font-medium px-4 py-2 text-[#6e6e73] dark:text-[#a1a1a6] data-[state=active]:bg-white dark:data-[state=active]:bg-[#2c2c2e] data-[state=active]:text-[#1d1d1f] dark:data-[state=active]:text-[#f5f5f7] data-[state=active]:shadow-sm transition-all cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5 text-[#0071e3]" />
              <span>Course Syllabus Materials</span>
            </TabsTrigger>
          </TabsList>

          {/* Action CTAs for Lecturers */}
          <div className="flex flex-wrap items-center gap-2.5">
            {isLecturer && (
              <>
                <FileUploadDialog
                  courseId={courseId}
                  onUploaded={() => setMaterialRefresh((r) => r + 1)}
                  trigger={
                    <AppButton
                      variant="outline"
                      shape="pill"
                      className="px-5 py-2.5 bg-white dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] border border-black/10 dark:border-white/10 font-medium text-xs sm:text-sm shadow-xs h-10"
                      leftIcon={<Upload className="h-4 w-4 text-[#0071e3]" />}
                    >
                      <span>Upload Syllabus PDF</span>
                    </AppButton>
                  }
                />
                <AppButton
                  asChild
                  variant="primary"
                  shape="pill"
                  className="px-5 py-2.5 font-medium text-xs sm:text-sm shadow-xs h-10"
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  <Link href={`/course/${courseId}/sessions/new`}>
                    <span>New AI Lecture</span>
                  </Link>
                </AppButton>
              </>
            )}
          </div>
        </div>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4 focus-visible:outline-none">
          <SessionList courseId={courseId} isLecturer={isLecturer} />
        </TabsContent>

        {/* Materials Tab */}
        <TabsContent value="materials" className="space-y-4 focus-visible:outline-none">
          <MaterialList courseId={courseId} isLecturer={isLecturer} refreshTrigger={materialRefresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
