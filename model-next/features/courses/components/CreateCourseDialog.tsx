"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { AppButton } from "@/components/app/AppButton";
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
import { Plus, BookPlus } from "lucide-react";
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
          <AppButton
            variant="primary"
            shape="rounded"
            className="font-semibold shadow-md"
            leftIcon={<Plus className="h-4 w-4" />}
          >
            <span>Create New Course</span>
          </AppButton>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-3xl p-6">
        <DialogHeader className="space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-1">
            <BookPlus className="h-5 w-5" />
          </div>
          <DialogTitle className="text-xl font-bold">Add Academic Course</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Set up a new course subject to upload syllabus PDFs and host live AI lectures.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="course-title" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Course Title *
            </Label>
            <Input
              id="course-title"
              placeholder="e.g. Distributed Systems & Cloud Computing"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              required
              className="rounded-xl h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-desc" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Description (Optional)
            </Label>
            <Textarea
              id="course-desc"
              placeholder="Brief summary of modules and core objectives..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              className="rounded-xl min-h-[90px] resize-none"
            />
          </div>

          <DialogFooter className="pt-2">
            <AppButton
              type="button"
              variant="outline"
              shape="rounded"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              <span>Cancel</span>
            </AppButton>
            <AppButton
              type="submit"
              variant="primary"
              shape="rounded"
              disabled={isLoading}
              isLoading={isLoading}
              loadingText="Creating..."
              className="font-semibold"
            >
              <span>Create Course</span>
            </AppButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
