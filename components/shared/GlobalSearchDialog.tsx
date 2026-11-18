"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { api } from "@/lib/api";
import type { Course } from "@/lib/supabase/types";
import { BookOpen, Presentation, Sparkles, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GlobalSearchDialog() {
  const [open, setOpen] = React.useState(false);
  const [courses, setCourses] = React.useState<Course[]>([]);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  React.useEffect(() => {
    if (open) {
      api.getCourses().then((res) => {
        if (res?.courses) setCourses(res.courses);
      }).catch(() => {});
    }
  }, [open]);

  const handleSelect = (callback: () => void) => {
    setOpen(false);
    callback();
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-9 px-3 text-xs text-muted-foreground flex items-center gap-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border-black/5 dark:border-white/10 hover:border-primary/40"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Search Course Spaces...</span>
        <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          Ctrl K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search course spaces, topics, or materials..." />
        <CommandList>
          <CommandEmpty>No matching course spaces found.</CommandEmpty>
          <CommandGroup heading="Course Spaces">
            {courses.map((c) => (
              <CommandItem
                key={c.id}
                onSelect={() => handleSelect(() => router.push(`/course/${c.id}`))}
                className="flex items-center gap-2.5 p-2.5 cursor-pointer"
              >
                <BookOpen className="h-4 w-4 text-primary" />
                <div className="flex flex-col">
                  <span className="font-semibold text-xs">{c.title}</span>
                  {c.description && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-sm">
                      {c.description}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
