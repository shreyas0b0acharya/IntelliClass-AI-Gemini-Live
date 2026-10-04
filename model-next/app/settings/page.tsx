"use client";

import Link from "next/link";
import { AccountProfileSettings } from "@/features/settings";
import { useAuth } from "@/features/auth";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  User,
  ArrowLeft,
  Bot,
  ChevronRight,
  UserCheck,
} from "lucide-react";

export default function SettingsPage() {
  const { isLecturer } = useAuth();

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Navigation Breadcrumb Bar with Apple Back Button ────────── */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="ghost"
            size="xs"
 className=" h-8 "
          >
            <Link href={isLecturer ? "/dashboard" : "/"} className="inline-flex items-center justify-center gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </Link>
          </Button>

          <div className="h-3.5 w-px bg-black/10 dark:bg-white/10" />

 <Breadcrumb className="">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={isLecturer ? "/dashboard" : "/"} className="hover:text-primary transition-colors">
                    {isLecturer ? "Faculty Studio" : "Home"}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
 <BreadcrumbPage className="">
                  Account &amp; Role Settings
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Quick Shortcut to AI Avatar Studio (Lecturers only) */}
        {isLecturer && (
          <Button
            asChild
            variant="secondary"
            size="xs"
 className=" h-8 "
          >
            <Link href="/settings/avatar" className="inline-flex items-center justify-center gap-1.5">
              <Bot className="h-3.5 w-3.5 text-primary" />
              <span>AI Avatar &amp; Voice Studio</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            </Link>
          </Button>
        )}
      </div>

      {/* ── Apple Inset Header Card ─────────────────────────────────── */}
      <div className="bg-white dark:bg-card rounded-2xl border border-black/5 dark:border-white/10 shadow-xs p-6">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${isLecturer
              ? "bg-primary/10 dark:bg-primary/20 text-primary"
              : "bg-chart-2/10 dark:bg-chart-2/20 text-chart-2 dark:text-chart-2"
            }`}>
            {isLecturer ? <User className="h-6 w-6" /> : <UserCheck className="h-6 w-6" />}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground dark:text-foreground">
              Account &amp; Profile Settings
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Manage your personal identity, switch your account role between Lecturer and Student, or manage your data.
            </p>
          </div>
        </div>
      </div>

      {/* ── Account Settings & Role Switcher Canvas ─────────────────── */}
      <AccountProfileSettings />
    </div>
  );
}
