"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, BookPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CreateCourseDialogProps {
  onCreated?: () => void;
  trigger?: React.ReactNode;
}

export function CreateCourseDialog({ onCreated, trigger }: CreateCourseDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [teachingInstructions, setTeachingInstructions] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please provide a course title.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.createCourse({
        title: title.trim(),
        description: description.trim() || undefined,
        teaching_instructions: teachingInstructions.trim() || undefined,
      });

      toast.success("Course Space created successfully!");
      setTitle("");
      setDescription("");
      setTeachingInstructions("");
      setOpen(false);
      if (onCreated) onCreated();
      if (res.course?.id) {
        router.push(`/course/${res.course.id}`);
      }
    } catch (err: unknown) {
      console.error("Create course error:", err);
      const msg = err instanceof Error ? err.message : "Failed to create course.";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button
            variant="default"
 className=" inline-flex items-center "
          >
            <Plus className="h-4 w-4" />
            <span>Create New Course</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex flex-col">
 <DialogHeader className="">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-1">
            <BookPlus className="h-5 w-5" />
          </div>
 <DialogTitle className="">Add Academic Course</DialogTitle>
 <DialogDescription className="">
            Set up a new course subject to upload syllabus PDFs and host live AI lectures.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col justify-between pt-4 space-y-4">
          <div className="space-y-2 shrink-0">
            <Label htmlFor="course-title">
              Course Title *
            </Label>
            <Input
              id="course-title"
              placeholder="e.g. Distributed Systems & Cloud Computing"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              required
              className="h-11"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
            <div className="space-y-2 flex flex-col min-h-0">
              <Label htmlFor="course-desc">
                Description (Optional)
              </Label>
              <Textarea
                id="course-desc"
                placeholder="Course overview and intended outcomes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
                className="flex-1 min-h-[140px] resize-none"
              />
            </div>

            <div className="space-y-2 flex flex-col min-h-0">
              <Label htmlFor="course-instructions">
                Teaching instructions (Optional)
              </Label>
              <Textarea
                id="course-instructions"
                placeholder="Preferred teaching style, level, language, and constraints..."
                value={teachingInstructions}
                onChange={(e) => setTeachingInstructions(e.target.value)}
                disabled={isLoading}
                className="flex-1 min-h-[140px] resize-none"
              />
            </div>
          </div>

 <DialogFooter className="">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
 className=""
            >
              <span>Cancel</span>
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={isLoading}
 className=" inline-flex items-center "
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Course</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
