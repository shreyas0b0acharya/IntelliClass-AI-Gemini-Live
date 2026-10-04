"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles, Presentation } from "lucide-react";
import { useAuth } from "@/features/auth";
import { ThemeToggle } from "./ThemeToggle";
import { NavUser } from "./NavUser";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface NavbarProps {
  className?: string;
  showLinks?: boolean;
}

const emptySubscribe = () => () => { };

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
      className={`sticky top-0 z-50 w-full h-14 backdrop-blur-xl bg-white/80 dark:bg-black/80 border-b border-border/40 dark:border-border/40 transition-colors ${className}`}
    >
      <div className="h-full max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-6">
          <Link
            href={mounted && user ? "/dashboard" : "/"}
            className="flex items-center gap-2 font-semibold text-foreground dark:text-foreground tracking-tight hover:opacity-80 transition-opacity shrink-0"
          >
            <div className="w-7 h-7 rounded-xl bg-primary flex items-center justify-center text-white shadow-xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-base font-bold">IntelliClass AI</span>
          </Link>

          {/* Nav Links & Meeting Join for Desktop */}
          {showLinks && !isClassroom && (
            <div className="hidden md:flex items-center gap-3 pl-2">
              <nav className="flex items-center gap-1 text-sm font-medium text-muted-foreground dark:text-muted-foreground">
                {mounted && isLecturer && (
                  <Link
                    href="/dashboard"
                    className={`px-3 py-1.5 rounded-full transition-colors ${pathname === "/dashboard" || pathname.startsWith("/course/")
                        ? "bg-muted dark:bg-card text-foreground dark:text-foreground font-semibold"
                        : "hover:text-foreground dark:hover:text-foreground"
                      }`}
                  >
                    Faculty Studio
                  </Link>
                )}
                <Link
                  href="/showcase"
                  className={`px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${pathname === "/showcase"
                      ? "bg-muted dark:bg-card text-foreground dark:text-foreground font-semibold"
                      : "hover:text-foreground dark:hover:text-foreground"
                    }`}
                >
                  <Presentation className="h-3.5 w-3.5 text-primary" />
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
                  className="flex items-center gap-1 bg-muted dark:bg-card border border-border/60 dark:border-border rounded-full px-3 py-1 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20 transition-all"
                >
                  <input
                    name="navCode"
                    placeholder="Enter session code..."
                    className="bg-transparent text-xs w-28 sm:w-32 outline-none font-medium text-foreground dark:text-foreground placeholder:text-muted-foreground dark:placeholder:text-muted-foreground"
                  />
                  <Button
                    type="submit"
                    variant="link"
                    size="xs"
 className=""
                  >
                    Join
                  </Button>
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
 <Skeleton className="h-8 w-8 " />
          ) : user ? (
            <NavUser />
          ) : (
            !isAuthPage && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
 className=""
                >
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  asChild
 className=""
                >
                  <Link href="/register">Get Started</Link>
                </Button>
              </div>
            )
          )}
        </div>
      </div>
    </header>
  );
}
