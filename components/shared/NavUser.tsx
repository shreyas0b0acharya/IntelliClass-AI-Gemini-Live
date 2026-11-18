"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  Sparkles,
  User,
} from "lucide-react";
import { useAuth } from "@/features/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { Profile } from "@/lib/supabase/types";

export function NavUser({
  profile: propProfile,
}: {
  profile?: Profile | null;
}) {
  const router = useRouter();
  const { profile: authProfile, user, isLecturer: authIsLecturer, isLoading, signOut } = useAuth();
  const profile = propProfile !== undefined ? propProfile : authProfile;
  const isLecturer = profile ? profile.role === "lecturer" : authIsLecturer;

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully.");
    router.push("/login");
    router.refresh();
  };

  if (isLoading && !profile) {
 return <Skeleton className="h-8 w-8 " />;
  }

  const initials = profile?.name
    ? profile.name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
    : "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="icon-sm"
 className=""
        >
          {initials ? initials : <User className="h-4 w-4 text-muted-foreground dark:text-muted-foreground" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
 className="w-56 "
        align="end"
        sideOffset={8}
      >
 <DropdownMenuLabel className="">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-xs text-white shadow-xs">
              {initials ? initials : <User className="h-4 w-4" />}
            </div>
            <div className="grid flex-1 text-left text-xs leading-tight">
              <span className="truncate font-bold text-foreground dark:text-foreground">{profile?.name || "User"}</span>
              <span className="truncate text-xs text-muted-foreground dark:text-muted-foreground">
                {user?.email || (isLecturer ? "Faculty Member" : "Student")}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
 <DropdownMenuSeparator className="" />
        {isLecturer ? (
          <>
            <DropdownMenuItem
              onClick={() => router.push("/dashboard")}
 className=" cursor-pointer "
            >
              <Sparkles className="mr-2 size-4 text-primary" />
              <span>Faculty Studio</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push("/settings")}
 className=" cursor-pointer "
            >
              <User className="mr-2 size-4 text-muted-foreground" />
              <span>Account &amp; Role</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push("/settings/avatar")}
 className=" cursor-pointer "
            >
              <Sparkles className="mr-2 size-4 text-primary" />
              <span>AI Avatar &amp; Voice</span>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem
              onClick={() => router.push("/")}
 className=" cursor-pointer "
            >
              <Sparkles className="mr-2 size-4 text-primary" />
              <span>Join AI Lecture</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push("/settings")}
 className=" cursor-pointer "
            >
              <User className="mr-2 size-4 text-muted-foreground" />
              <span>Account &amp; Role</span>
            </DropdownMenuItem>
          </>
        )}
 <DropdownMenuSeparator className="" />
        <DropdownMenuItem
          onClick={handleSignOut}
 className=" cursor-pointer "
        >
          <LogOut className="mr-2 size-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
