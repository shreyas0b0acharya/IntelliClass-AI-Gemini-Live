import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/register");
  const isProtectedPage =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/course") ||
    pathname.startsWith("/classroom");

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!user && isProtectedPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Exclude static assets, auth-free API routes, and time-sensitive endpoints
    // from the Supabase auth middleware (each hit runs auth.getUser() → network round-trip).
    // api/time  — SNTP clock sync: must be sub-10ms, cannot afford an auth RTT
    // api/tts   — TTS synthesis: auth not required, already excluded
    // api/audio — audio media: auth not required
    // api/media — media assets: auth not required
    // generated — static built assets
    "/((?!_next/static|_next/image|favicon.ico|api/tts|api/audio|api/time|api/media|generated|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb|bin|wav)$).*)",
  ],
};
