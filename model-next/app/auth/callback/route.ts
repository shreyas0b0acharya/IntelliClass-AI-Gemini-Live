import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Supports both "next" and "redirectTo" query parameters
  let next = searchParams.get("next") || searchParams.get("redirectTo") || "/dashboard";

  if (!next.startsWith("/")) {
    next = "/dashboard";
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      let destination = next;
      // Ensure user profile exists for Google OAuth sign-in
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("id, role")
            .eq("id", user.id)
            .maybeSingle();

          const requestedRole = searchParams.get("role") as "student" | "lecturer" | null;
          const userRole = existingProfile?.role || (requestedRole === "lecturer" ? "lecturer" : "student");

          if (!existingProfile) {
            const fullName =
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              user.email?.split("@")[0] ||
              (userRole === "lecturer" ? "Faculty" : "Student");

            await supabase.from("profiles").insert({
              id: user.id,
              name: fullName,
              role: userRole,
            });
          }

          // If no custom redirectTo was provided, students land on '/' and faculty on '/dashboard'
          if (!searchParams.get("next") && !searchParams.get("redirectTo")) {
            destination = userRole === "lecturer" ? "/dashboard" : "/";
          }
        }
      } catch (profileErr) {
        console.warn("OAuth profile setup warning:", profileErr);
      }

      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${destination}`);
      }

      if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${destination}`);
      }

      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  // Return to login with error parameter if code exchange failed
  return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
}
