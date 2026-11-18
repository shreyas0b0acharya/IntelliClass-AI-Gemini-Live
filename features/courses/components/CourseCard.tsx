"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, FileText, Video, ArrowRight, Calendar } from "lucide-react";
import type { Course } from "@/lib/supabase/types";

interface CourseCardProps {
  course: Course;
  isLecturer?: boolean;
}

export function CourseCard({ course, isLecturer = false }: CourseCardProps) {
  const formattedDate = new Date(course.created_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
 <Card className="group flex flex-col justify-between overflow-hidden">
 <CardHeader className="">
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
            <Calendar className="h-3 w-3" />
            {formattedDate}
          </span>
        </div>
 <CardTitle className="">
          {course.title}
        </CardTitle>
 <CardDescription className=" min-h-[32px]">
          {course.description || "No specific syllabus description provided."}
        </CardDescription>
      </CardHeader>

 <CardContent className="">
 <div className="flex items-center gap-4 px-3 rounded-2xl bg-muted/40 border border-border/40 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
            <FileText className="h-3.5 w-3.5 text-primary" />
            <span>Materials Ready</span>
          </div>
          <div className="h-3 w-[1px] bg-border/80" />
          <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
            <Video className="h-3.5 w-3.5 text-primary" />
            <span>Live AI Classroom</span>
          </div>
        </div>
      </CardContent>

 <CardFooter className="">
        <Button
          asChild
          variant="default"
 className="w-full "
        >
          <Link href={`/course/${course.id}`} className="inline-flex items-center justify-center gap-2">
            <span>{isLecturer ? "Manage & Broadcast" : "Enter Course Space"}</span>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
