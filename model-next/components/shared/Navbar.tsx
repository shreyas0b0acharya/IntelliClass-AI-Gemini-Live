"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles, Presentation } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { NavUser } from "@/components/shared/NavUser";
import { AppButton } from "@/components/app/AppButton";
import { Skeleton } from "@/components/ui/skeleton";

interface NavbarProps {
  className?: string;
  showLinks?: boolean;
}

const emptySubscribe = () => () => {};

export function Navbar({ className = "", showLinks = true }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, isLecturer, isLoading } = useAuth();

  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const isClassroom = pathname.startsWith("/classroom/");
  const isAuthPage = pathname === "/login" || pathname === "/register";

  return (
    <header
      className={`sticky top-0 z-50 w-full h-14 backdrop-blur-xl bg-white/80 dark:bg-black/80 border-b border-[#d2d2d7]/40 dark:border-[#424245]/40 transition-colors ${className}`}
    >
      <div className="h-full max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-6">
          <Link
            href={mounted && user ? "/dashboard" : "/"}
            className="flex items-center gap-2 font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight hover:opacity-80 transition-opacity shrink-0"
          >
            <div className="w-7 h-7 rounded-xl bg-[#0071e3] flex items-center justify-center text-white shadow-xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-[15px] font-bold">IntelliClass AI</span>
          </Link>

          {/* Nav Links & Meeting Join for Desktop */}
          {showLinks && !isClassroom && (
            <div className="hidden md:flex items-center gap-3 pl-2">
              <nav className="flex items-center gap-1 text-[13px] font-medium text-[#86868b] dark:text-[#a1a1a6]">
                {mounted && isLecturer && (
                  <Link
                    href="/dashboard"
                    className={`px-3 py-1.5 rounded-full transition-colors ${
                      pathname === "/dashboard" || pathname.startsWith("/course/")
                        ? "bg-[#f5f5f7] dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold"
                        : "hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]"
                    }`}
                  >
                    Faculty Studio
                  </Link>
                )}
                <Link
                  href="/showcase"
                  className={`px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${
                    pathname === "/showcase"
                      ? "bg-[#f5f5f7] dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold"
                      : "hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]"
                  }`}
                >
                  <Presentation className="h-3.5 w-3.5 text-[#0071e3]" />
                  <span>Avatar Lab</span>
                </Link>
              </nav>

              {/* Quick Code Join Pill */}
              {pathname !== "/" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const target = e.currentTarget.elements.namedItem("navCode") as HTMLInputElement;
                    const val = target?.value?.trim();
                    if (val) {
                      router.push(`/session/${encodeURIComponent(val)}`);
                    }
                  }}
                  className="flex items-center gap-1 bg-[#f5f5f7] dark:bg-[#1c1c1e] border border-[#d2d2d7]/60 dark:border-[#3a3a3c] rounded-full px-3 py-1 focus-within:border-[#0071e3] focus-within:ring-2 focus-within:ring-[#0071e3]/20 transition-all"
                >
                  <input
                    name="navCode"
                    placeholder="Enter session code..."
                    className="bg-transparent text-xs w-28 sm:w-32 outline-none font-medium text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#86868b] dark:placeholder:text-[#a1a1a6]"
                  />
                  <AppButton
                    type="submit"
                    variant="link"
                    size="xs"
                    className="text-[11px] font-bold uppercase tracking-wider text-[#0071e3] hover:text-[#0077ed] px-1 no-underline hover:no-underline"
                  >
                    Join
                  </AppButton>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Right Actions & Profile */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Auth State Control */}
          {!mounted || (isLoading && !profile && !user) ? (
            <Skeleton className="h-8 w-8 rounded-full" />
          ) : user ? (
            <NavUser />
          ) : (
            !isAuthPage && (
              <div className="flex items-center gap-2">
                <AppButton
                  variant="ghost"
                  size="sm"
                  shape="pill"
                  asChild
                  className="text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-[#f5f5f7] dark:hover:bg-[#1c1c1e]"
                >
                  <Link href="/login">Sign In</Link>
                </AppButton>
                <AppButton
                  variant="primary"
                  size="sm"
                  shape="pill"
                  asChild
                  className="text-[13px] font-semibold px-4 py-1.5 shadow-xs"
                >
                  <Link href="/register">Get Started</Link>
                </AppButton>
              </div>
            )
          )}
        </div>
      </div>
    </header>
  );
}
