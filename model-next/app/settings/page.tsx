"use client";

import Link from "next/link";
import { AccountProfileSettings } from "@/components/settings/AccountProfileSettings";
import { useAuth } from "@/lib/auth/AuthContext";
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
            size="sm"
            className="rounded-full h-8 px-2.5 gap-1.5 text-xs text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors"
          >
            <Link href={isLecturer ? "/dashboard" : "/"}>
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </Link>
          </Button>

          <div className="h-3.5 w-px bg-black/10 dark:bg-white/10" />

          <Breadcrumb className="text-xs">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={isLecturer ? "/dashboard" : "/"} className="hover:text-[#0071e3] transition-colors">
                    {isLecturer ? "Faculty Studio" : "Home"}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
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
            variant="outline"
            size="sm"
            className="rounded-full h-8 px-3.5 text-xs gap-1.5 font-medium border-0 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer transition-all shadow-none"
          >
            <Link href="/settings/avatar">
              <Bot className="h-3.5 w-3.5 text-[#0071e3]" />
              <span>AI Avatar &amp; Voice Studio</span>
              <ChevronRight className="h-3 w-3 text-[#86868b]" />
            </Link>
          </Button>
        )}
      </div>

      {/* ── Apple Inset Header Card ─────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/5 dark:border-white/10 shadow-xs p-6">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
            isLecturer 
              ? "bg-[#0071e3]/10 dark:bg-[#0071e3]/20 text-[#0071e3]" 
              : "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
          }`}>
            {isLecturer ? <User className="h-6 w-6" /> : <UserCheck className="h-6 w-6" />}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
              Account &amp; Profile Settings
            </h1>
            <p className="text-xs text-[#86868b] mt-0.5 leading-relaxed">
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
