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
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");

  // If Supabase redirected recovery code to root '/', route through auth callback to /reset-password
  if (code && pathname === "/") {
    const callbackUrl = new URL("/auth/callback", request.url);
    callbackUrl.searchParams.set("code", code);
    callbackUrl.searchParams.set("next", "/reset-password");
    return NextResponse.redirect(callbackUrl);
  }

  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password");

  const isProtectedPage =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/course") ||
    pathname.startsWith("/classroom") ||
    pathname.startsWith("/settings");

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
    // Exclude static assets, generated files, and ALL API routes from middleware.
    // Each API route (/api/*) authenticates independently inside its own handler,
    // so running auth.getUser() in middleware creates a redundant 1-6s cloud network roundtrip.
    "/((?!_next/static|_next/image|favicon.ico|api/|generated|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb|bin|wav)$).*)",
  ],
};
