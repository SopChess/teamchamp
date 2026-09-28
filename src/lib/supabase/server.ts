import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client (Server Components, Route Handlers).
 *
 * Same flowType: 'pkce' requirement as client.ts — see the comment there.
 * Both sides must agree on the flow type or the magic-link callback breaks.
 */
export function createClient() {
  // Αν έχει οριστεί SUPABASE_SERVICE_ROLE_KEY (μόνο server-side), ΟΛΗ η
  // πρόσβαση της εφαρμογής στα δεδομένα γίνεται με αυτό — το κλείσιμο
  // ασφάλειας (harden.sql) βασίζεται σε αυτό. Χωρίς αυτό, χρησιμοποιείται το
  // δημόσιο anon key όπως πριν. Το κλειδί δεν φτάνει ποτέ στον browser.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "pkce",
      },
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Called from a Server Component — safe to ignore when
            // middleware is refreshing sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // Same as above.
          }
        },
      },
    }
  );
}
