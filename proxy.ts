import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const createRedirectResponse = (url: URL | string) => {
    const redirectResponse = NextResponse.redirect(new URL(url, request.url));
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  };

  const pathname = request.nextUrl.pathname;
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");

  // If Supabase redirected OAuth or recovery code to root '/', route through auth callback
  if (code && pathname === "/") {
    const callbackUrl = new URL("/auth/callback", request.url);
    callbackUrl.searchParams.set("code", code);
    const authType = searchParams.get("type");
    if (authType === "recovery") {
      callbackUrl.searchParams.set("next", "/reset-password");
    } else {
      callbackUrl.searchParams.set("next", "/dashboard");
    }
    return createRedirectResponse(callbackUrl);
  }

  // Fast check: If there are no Supabase auth cookies in the request,
  // the visitor is unauthenticated, so avoid invoking GoTrue token refresh.
  const allCookies = request.cookies.getAll();
  const hasAuthCookies = allCookies.some(
    (cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")
  );

  let user = null;

  if (hasAuthCookies) {
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

    try {
      const { data, error: authError } = await supabase.auth.getUser();

      if (authError) {
        // If refresh token is expired, missing, or revoked, explicitly clear all Supabase auth cookies
        const isRefreshTokenError =
          authError.code === "refresh_token_not_found" ||
          authError.code === "refresh_token_already_used" ||
          authError.status === 400 ||
          authError.message?.toLowerCase().includes("refresh token");

        if (isRefreshTokenError) {
          request.cookies.getAll().forEach((cookie) => {
            if (cookie.name.startsWith("sb-")) {
              request.cookies.delete(cookie.name);
              response.cookies.set(cookie.name, "", {
                maxAge: 0,
                path: "/",
              });
            }
          });
        }
      } else {
        user = data?.user ?? null;
      }
    } catch {
      // In case of unexpected rejection, clear stale auth cookies
      request.cookies.getAll().forEach((cookie) => {
        if (cookie.name.startsWith("sb-")) {
          request.cookies.delete(cookie.name);
          response.cookies.set(cookie.name, "", {
            maxAge: 0,
            path: "/",
          });
        }
      });
    }
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
    return createRedirectResponse("/dashboard");
  }

  if (!user && isProtectedPage) {
    return createRedirectResponse("/login");
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
