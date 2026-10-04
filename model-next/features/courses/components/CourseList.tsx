"use client";

import { useCallback, useEffect, useState } from "react";
import type { Course } from "@/lib/supabase/types";
import { useAuth } from "@/features/auth";
import { api } from "@/lib/api";
import { CourseCard } from "./CourseCard";
import { CreateCourseDialog } from "./CreateCourseDialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, BookOpen } from "lucide-react";

export function CourseList() {
  const [courses, setCourses] = useState<Course[]>([]);
  const { isLecturer } = useAuth();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchCourses = useCallback(async () => {
    try {
      const { courses: fetchedCourses } = await api.getCourses();
      if (fetchedCourses) setCourses(fetchedCourses);
    } catch (err) {
      console.error("Failed to load courses:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.getCourses()
      .then(({ courses: fetchedCourses }) => {
        if (active && fetchedCourses) setCourses(fetchedCourses);
      })
      .catch((err) => {
        console.error("Failed to load courses:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredCourses = courses.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search courses and subjects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
 className=" h-11 "
          />
        </div>

        {isLecturer && <CreateCourseDialog onCreated={fetchCourses} />}
      </div>

      {/* Grid or Skeletons or Empty State */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-6 rounded-3xl border border-border/40 bg-card/40 space-y-4">
 <Skeleton className="h-10 w-10 " />
 <Skeleton className="h-6 w-3/4 " />
 <Skeleton className="h-4 w-full " />
 <Skeleton className="h-10 w-full mt-4" />
            </div>
          ))}
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl border border-dashed border-border/80 bg-muted/20">
          <div className="w-14 h-14 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mb-4">
            <BookOpen className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">
            {search ? "No matching courses found" : "No courses available yet"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mb-6">
            {search
              ? "Try adjusting your search terms or keywords."
              : isLecturer
              ? "Get started by creating your first academic course to upload syllabus documents."
              : "Your enrolled courses and live lectures will appear here once published."}
          </p>
          {isLecturer && !search && <CreateCourseDialog onCreated={fetchCourses} />}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <CourseCard key={course.id} course={course} isLecturer={isLecturer} />
          ))}
        </div>
      )}
    </div>
  );
}
