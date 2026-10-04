"use client";

import { useState } from "react";
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
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please provide a course title.");
      return;
    }

    setIsLoading(true);
    try {
      await api.createCourse({
        title: title.trim(),
        description: description.trim() || undefined,
      });

      toast.success("Course created successfully!");
      setTitle("");
      setDescription("");
      setOpen(false);
      if (onCreated) onCreated();
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
 <DialogContent className="max-w-md ">
 <DialogHeader className="">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-1">
            <BookPlus className="h-5 w-5" />
          </div>
 <DialogTitle className="">Add Academic Course</DialogTitle>
 <DialogDescription className="">
            Set up a new course subject to upload syllabus PDFs and host live AI lectures.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
 <Label htmlFor="course-title" className="">
              Course Title *
            </Label>
            <Input
              id="course-title"
              placeholder="e.g. Distributed Systems & Cloud Computing"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              required
 className=" h-11"
            />
          </div>

          <div className="space-y-2">
 <Label htmlFor="course-desc" className="">
              Description (Optional)
            </Label>
            <Textarea
              id="course-desc"
              placeholder="Brief summary of modules and core objectives..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
 className=" min-h-[90px] resize-none"
            />
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
