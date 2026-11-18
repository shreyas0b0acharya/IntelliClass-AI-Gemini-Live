import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { User, SupabaseClient } from "@supabase/supabase-js";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component context may throw when writing cookies
          }
        },
      },
    }
  );
}

/**
 * Universal server-side authentication resolver.
 * Inspects both `Authorization: Bearer <token>` header (used by fetchApi)
 * and session cookies (SSR/browser navigation), returning the validated User.
 */
export async function getAuthenticatedUser(
  request?: Request | NextRequest
): Promise<{ user: User | null; supabase: SupabaseClient }> {
  const supabase = await createClient();

  if (request) {
    const authHeader =
      request.headers.get("Authorization") ||
      request.headers.get("authorization");

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "").trim();
      if (token) {
        try {
          const { data, error } = await supabase.auth.getUser(token);
          if (data?.user && !error) {
            return { user: data.user, supabase };
          }
        } catch {
          // Fall through to cookie auth
        }
      }
    }
  }

  try {
    const { data, error } = await supabase.auth.getUser();
    if (data?.user && !error) {
      return { user: data.user, supabase };
    }
  } catch {
    // Both header and cookie failed
  }

  return { user: null, supabase };
}
