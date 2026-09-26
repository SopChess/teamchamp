import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 *
 * flowType: 'pkce' is REQUIRED here. Without it, magic-link emails return
 * implicit/hash tokens (#access_token=...) instead of ?code=..., which the
 * server can never read. This exact bug cost significant debugging time on
 * the tournament-ops-platform ("tournament" repo) auth-saga — keep this
 * explicit even though it may look redundant with defaults in some
 * @supabase/ssr versions.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "pkce",
      },
    }
  );
}
