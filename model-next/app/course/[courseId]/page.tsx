"use client";

import { useEffect, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Course } from "@/lib/supabase/types";
import { useAuth } from "@/features/auth";
import { api } from "@/lib/api";
import { MaterialList, FileUploadDialog } from "@/features/materials";
import { SessionList } from "@/features/sessions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BookOpen, Presentation, FileText, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { useIsMounted } from "@/hooks/useIsMounted";

export default function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") === "materials" ? "materials" : "sessions";

  const hasMounted = useIsMounted();

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

  if (!hasMounted || !course) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="flex items-center justify-between">
 <Skeleton className="h-8 w-36 " />
        </div>

        <div className="p-8 rounded-3xl border border-black/5 dark:border-white/5 bg-muted dark:bg-card shadow-xs space-y-4">
          <div className="flex items-center gap-3">
 <Skeleton className="w-12 h-12 shrink-0" />
            <div className="space-y-2">
 <Skeleton className="h-7 w-64 " />
 <Skeleton className="h-3 w-32 " />
            </div>
          </div>
 <Skeleton className="h-4 w-full max-w-2xl " />
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-4">
            <div className="flex gap-2">
 <Skeleton className="h-10 w-44 " />
 <Skeleton className="h-10 w-44 " />
            </div>
 <Skeleton className="h-10 w-36 " />
          </div>

          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-5 rounded-2xl border border-black/5 dark:border-white/5 bg-muted dark:bg-card"
              >
                <div className="flex items-center gap-3.5 flex-1">
 <Skeleton className="w-11 h-11 shrink-0" />
                  <div className="space-y-2 flex-1 max-w-md">
 <Skeleton className="h-4 w-52 " />
 <Skeleton className="h-3 w-28 " />
                  </div>
                </div>
 <Skeleton className="h-9 w-32 shrink-0" />
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
        <Button
          variant="secondary"
          size="xs"
          onClick={() => router.push("/dashboard")}
 className=""
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Dashboard</span>
        </Button>
      </div>

      {/* ── 2. Elevated macOS Course Header Card ──────────────────────── */}
      <div className="p-6 sm:p-8 rounded-3xl border border-black/5 dark:border-white/5 bg-muted dark:bg-card shadow-xs space-y-3">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/10 flex items-center justify-center text-primary shadow-xs shrink-0">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground dark:text-foreground">
              {course.title}
            </h1>
            <span className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
              Course Space &bull; Active Curriculum
            </span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground dark:text-muted-foreground max-w-3xl leading-relaxed">
          {course.description || "Interactive AI course space for real-time lecturing, syllabus synthesis, and student inquiries."}
        </p>
      </div>

      {/* ── 3. Apple-Style Segmented Control & Buttons ────────────────── */}
 <Tabs defaultValue={defaultTab} className="">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-black/5 dark:border-white/10 pb-4">
          {/* Segmented Control Track */}
 <TabsList className=" h-auto">
            <TabsTrigger
              value="sessions"
 className=" cursor-pointer"
            >
              <Presentation className="h-3.5 w-3.5 text-primary" />
              <span>Lectures &amp; Broadcasts</span>
            </TabsTrigger>
            <TabsTrigger
              value="materials"
 className=" cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5 text-primary" />
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
                    <Button
                      variant="outline"
 className=" h-10"
                    >
                      <Upload className="h-4 w-4 text-primary" />
                      <span>Upload Syllabus PDF</span>
                    </Button>
                  }
                />
                <Button
                  asChild
                  variant="default"
 className=" h-10"
                >
                  <Link href={`/course/${courseId}/sessions/new`} className="inline-flex items-center justify-center gap-2">
                    <Plus className="h-4 w-4" />
                    <span>New AI Lecture</span>
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Sessions Tab */}
 <TabsContent value="sessions" className="">
          <SessionList courseId={courseId} isLecturer={isLecturer} />
        </TabsContent>

        {/* Materials Tab */}
 <TabsContent value="materials" className="">
          <MaterialList courseId={courseId} isLecturer={isLecturer} refreshTrigger={materialRefresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
