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
import { AppButton } from "@/components/app";
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
    return <Skeleton className="h-8 w-8 rounded-full" />;
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
        <AppButton
          variant="secondary"
          size="icon-sm"
          shape="pill"
          className="border border-[#d2d2d7]/50 dark:border-[#424245]/50 text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-xs shadow-xs focus-visible:ring-2 focus-visible:ring-[#0071e3]/30 p-0"
        >
          {initials ? initials : <User className="h-4 w-4 text-[#86868b] dark:text-[#a1a1a6]" />}
        </AppButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 rounded-2xl p-1.5 shadow-2xl border border-[#e5e5ea] dark:border-[#2c2c2e] bg-white dark:bg-[#1c1c1e]"
        align="end"
        sideOffset={8}
      >
        <DropdownMenuLabel className="p-2.5 font-normal">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0071e3] font-bold text-xs text-white shadow-xs">
              {initials ? initials : <User className="h-4 w-4" />}
            </div>
            <div className="grid flex-1 text-left text-xs leading-tight">
              <span className="truncate font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">{profile?.name || "User"}</span>
              <span className="truncate text-[10px] text-[#86868b] dark:text-[#a1a1a6]">
                {user?.email || (isLecturer ? "Faculty Member" : "Student")}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-[#e5e5ea] dark:bg-[#2c2c2e]" />
        {isLecturer ? (
          <>
            <DropdownMenuItem
              onClick={() => router.push("/dashboard")}
              className="rounded-xl cursor-pointer py-2 text-xs font-semibold hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e]"
            >
              <Sparkles className="mr-2 size-4 text-[#0071e3]" />
              <span>Faculty Studio</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push("/settings")}
              className="rounded-xl cursor-pointer py-2 text-xs font-semibold hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e]"
            >
              <User className="mr-2 size-4 text-[#86868b]" />
              <span>Account &amp; Role</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push("/settings/avatar")}
              className="rounded-xl cursor-pointer py-2 text-xs font-semibold hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e]"
            >
              <Sparkles className="mr-2 size-4 text-[#0071e3]" />
              <span>AI Avatar &amp; Voice</span>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem
              onClick={() => router.push("/")}
              className="rounded-xl cursor-pointer py-2 text-xs font-semibold hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e]"
            >
              <Sparkles className="mr-2 size-4 text-[#0071e3]" />
              <span>Join AI Lecture</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push("/settings")}
              className="rounded-xl cursor-pointer py-2 text-xs font-semibold hover:bg-[#f5f5f7] dark:hover:bg-[#2c2c2e]"
            >
              <User className="mr-2 size-4 text-[#86868b]" />
              <span>Account &amp; Role</span>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator className="bg-[#e5e5ea] dark:bg-[#2c2c2e]" />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-500/10 rounded-xl cursor-pointer py-2 text-xs font-semibold"
        >
          <LogOut className="mr-2 size-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
