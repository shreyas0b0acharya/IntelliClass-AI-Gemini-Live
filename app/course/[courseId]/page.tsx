"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Course, CourseFile, ClassroomSession, CourseStudent } from "@/lib/supabase/types";
import { useAuth } from "@/features/auth";
import { api } from "@/lib/api";
import { MaterialList, FileUploadDialog } from "@/features/materials";
import { SessionList, CreateSessionDialog } from "@/features/sessions";
import {
  CourseOverviewTab,
  RoadmapManagementTab,
  StudentsTab,
} from "@/features/courses";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  BookOpen,
  LayoutDashboard,
  MapPin,
  FileText,
  Users,
  Presentation,
  Plus,
  Upload,
} from "lucide-react";
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

  // Tab State: overview | roadmaps | materials | students | classes
  const tabParam = searchParams.get("tab");
  const initialTab =
    tabParam === "materials"
      ? "materials"
      : tabParam === "roadmaps"
      ? "roadmaps"
      : tabParam === "students"
      ? "students"
      : tabParam === "classes" || tabParam === "sessions"
      ? "classes"
      : "overview";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set([initialTab]));
  const hasMounted = useIsMounted();
  const { isLecturer } = useAuth();

  // Data State
  const [course, setCourse] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<ClassroomSession[]>([]);
  const [materials, setMaterials] = useState<CourseFile[]>([]);
  const [students, setStudents] = useState<CourseStudent[]>([]);
  const [requests, setRequests] = useState<CourseStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [materialRefresh, setMaterialRefresh] = useState(0);

  // Sync tab with URL and load tab data on-demand
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    setVisitedTabs((prev) => {
      if (prev.has(newTab)) return prev;
      const next = new Set(prev);
      next.add(newTab);
      return next;
    });

    if (newTab === "materials") {
      loadMaterials();
    } else if (newTab === "classes") {
      loadSessions();
    } else if (newTab === "students") {
      loadStudents();
    }

    const url = new URL(window.location.href);
    if (newTab === "overview") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", newTab);
    }
    window.history.replaceState({}, "", url.toString());
  };

  // Load Course Details
  const loadCourse = useCallback(async () => {
    try {
      const { course: fetchedCourse } = await api.getCourse(courseId);
      if (fetchedCourse) setCourse(fetchedCourse);
    } catch (err) {
      console.error("Error loading course:", err);
    }
  }, [courseId]);

  // Load Sessions
  const loadSessions = useCallback(async () => {
    try {
      const { sessions: fetchedSessions } = await api.getCourseSessions(courseId);
      if (fetchedSessions) {
        setSessions(fetchedSessions.filter((s) => (s.status as string) !== "deleted"));
      }
    } catch (err) {
      console.error("Error loading sessions:", err);
    }
  }, [courseId]);

  // Load Materials
  const loadMaterials = useCallback(async () => {
    try {
      const { files: fetchedFiles } = await api.getCourseFiles(courseId);
      if (fetchedFiles) setMaterials(fetchedFiles);
    } catch (err) {
      console.error("Error loading materials:", err);
    }
  }, [courseId]);

  // Load Students
  const loadStudents = useCallback(async () => {
    try {
      const res = await api.getCourseStudents(courseId);
      if (res.students) setStudents(res.students);
      if (res.requests) setRequests(res.requests);
    } catch (err) {
      console.error("Error loading course students:", err);
    }
  }, [courseId]);

  useEffect(() => {
    let active = true;
    loadCourse().finally(() => {
      if (active) setLoading(false);
    });

    // Load materials and sessions for overview summary cards and tab badges
    loadMaterials();
    loadSessions();

    const handleMaterialsUpdated = () => {
      loadMaterials();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("intelliclass:materials-updated", handleMaterialsUpdated);
    }

    return () => {
      active = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("intelliclass:materials-updated", handleMaterialsUpdated);
      }
    };
  }, [courseId, loadCourse, loadMaterials, loadSessions, materialRefresh]);

  if (!hasMounted || loading || !course) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-36" />
        </div>

        <div className="p-8 rounded-3xl border border-black/5 dark:border-white/5 bg-muted dark:bg-card shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 shrink-0 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>

        <div className="space-y-6">
          <Skeleton className="h-12 w-full max-w-md rounded-2xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-3xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* ── 1. Compact Course Space Header Bar ───────────────────────── */}
      <div className="flex items-center justify-between gap-4 p-3 sm:px-4 rounded-2xl border border-black/5 dark:border-white/5 bg-card/60 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => router.push("/dashboard")}
            className="h-8 w-8 rounded-xl shrink-0 text-muted-foreground hover:text-foreground"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <BookOpen className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground truncate">
                {course.title}
              </h1>
              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                Course Space
              </span>
            </div>
            {course.description && (
              <p className="text-xs text-muted-foreground truncate max-w-xl hidden sm:block">
                {course.description}
              </p>
            )}
          </div>
        </div>

        {isLecturer && (
          <div className="flex items-center gap-2 shrink-0">
            <Button asChild size="xs" variant="default" className="font-semibold text-xs h-8">
              <Link href={`/course/${courseId}/sessions/new`}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                <span>New Class</span>
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* ── 3. Five-Area Tab Navigation (Overview, Roadmaps, Materials, Students, Classes) ── */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-black/5 dark:border-white/10 pb-4">
          {/* Segmented Control Track with all 5 areas */}
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="overview" className="cursor-pointer">
              <LayoutDashboard className="h-3.5 w-3.5 mr-1.5 text-primary" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="roadmaps" className="cursor-pointer">
              <MapPin className="h-3.5 w-3.5 mr-1.5 text-chart-4" />
              <span>Roadmaps</span>
            </TabsTrigger>
            <TabsTrigger value="materials" className="cursor-pointer">
              <FileText className="h-3.5 w-3.5 mr-1.5 text-sky-500" />
              <span>Materials ({materials.length})</span>
            </TabsTrigger>
            <TabsTrigger value="students" className="cursor-pointer">
              <Users className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
              <span>Students ({students.length})</span>
              {requests.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                  {requests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="classes" className="cursor-pointer">
              <Presentation className="h-3.5 w-3.5 mr-1.5 text-primary" />
              <span>Classes ({sessions.length})</span>
            </TabsTrigger>
          </TabsList>

          {/* Action CTAs for Lecturers */}
          <div className="flex flex-wrap items-center gap-2.5">
            {isLecturer && (
              <>
                <FileUploadDialog
                  courseId={courseId}
                  onUploaded={() => {
                    setMaterialRefresh((r) => r + 1);
                    loadMaterials();
                  }}
                  trigger={
                    <Button variant="outline" className="h-9 font-semibold">
                      <Upload className="h-4 w-4 mr-1.5 text-primary" />
                      <span>Upload Syllabus</span>
                    </Button>
                  }
                />
                <Button asChild variant="default" className="h-9 font-semibold">
                  <Link href={`/course/${courseId}/sessions/new`}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    <span>New AI Class</span>
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Tab 1: Course Space Overview */}
        {visitedTabs.has("overview") && (
          <TabsContent value="overview">
            <CourseOverviewTab
              course={course}
              isLecturer={isLecturer}
              sessions={sessions}
              materials={materials}
              students={students}
              pendingRequestsCount={requests.length}
              onTabChange={handleTabChange}
              onRefreshCourse={loadCourse}
              onRefreshMaterials={loadMaterials}
              onRefreshSessions={loadSessions}
            />
          </TabsContent>
        )}

        {/* Tab 2: Roadmap Management */}
        {visitedTabs.has("roadmaps") && (
          <TabsContent value="roadmaps">
            <RoadmapManagementTab
              courseId={courseId}
              isLecturer={isLecturer}
              materials={materials}
            />
          </TabsContent>
        )}

        {/* Tab 3: Materials Library */}
        {visitedTabs.has("materials") && (
          <TabsContent value="materials">
            <MaterialList
              courseId={courseId}
              isLecturer={isLecturer}
              refreshTrigger={materialRefresh}
              onMaterialsUpdated={loadMaterials}
            />
          </TabsContent>
        )}

        {/* Tab 4: Students Roster */}
        {visitedTabs.has("students") && (
          <TabsContent value="students">
            <StudentsTab
              courseId={courseId}
              isLecturer={isLecturer}
              students={students}
              requests={requests}
              onRefresh={loadStudents}
            />
          </TabsContent>
        )}

        {/* Tab 5: Classes & Sessions */}
        {visitedTabs.has("classes") && (
          <TabsContent value="classes">
            <SessionList courseId={courseId} isLecturer={isLecturer} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
