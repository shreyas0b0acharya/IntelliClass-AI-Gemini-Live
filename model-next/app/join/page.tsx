"use client";

import { Navbar, SessionCodeInput } from "@/components/shared";
import { useAuth } from "@/features/auth";
import { Presentation, KeyRound } from "lucide-react";
import Link from "next/link";

export default function JoinPage() {
  const { profile } = useAuth();

  return (
    <div className="min-h-screen w-full bg-white dark:bg-black text-foreground dark:text-foreground flex flex-col antialiased selection:bg-primary selection:text-white">
      <Navbar showLinks={false} />

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-md mx-auto text-center space-y-8 animate-in fade-in zoom-in-95 duration-300">
          {/* Header Icon */}
          <div className="w-16 h-16 rounded-3xl bg-muted dark:bg-card border border-border dark:border-border flex items-center justify-center mx-auto text-primary shadow-xs">
            <KeyRound className="h-8 w-8" />
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground dark:text-foreground">
              Join Live Class
            </h1>
            <p className="text-base text-muted-foreground dark:text-muted-foreground leading-relaxed">
              {profile?.name ? `Welcome, ${profile.name}. ` : ""}
              Enter the code provided by your professor to enter the live AI classroom.
            </p>
          </div>

          {/* Reusable Clean Input Form */}
          <div className="flex justify-center">
            <SessionCodeInput
              autoFocus
              size="large"
              buttonText="Join"
              placeholder="Enter meeting code..."
              className="w-full justify-between"
            />
          </div>

          {/* Sub-actions */}
          <div className="pt-4 border-t border-border dark:border-border flex flex-col items-center gap-3 text-xs text-muted-foreground dark:text-muted-foreground">
            <Link
              href="/showcase"
              className="hover:text-primary dark:hover:text-primary flex items-center gap-1.5 transition-colors font-medium"
            >
              <Presentation className="h-3.5 w-3.5" />
              Test 3D Avatar &amp; Audio Lab
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-6 border-t border-border dark:border-border text-center text-xs text-muted-foreground">
        IntelliClass AI &bull; Student Portal
      </footer>
    </div>
  );
}
