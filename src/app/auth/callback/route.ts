import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Magic-link callback. Exchanges the ?code= param (PKCE flow) for a session.
 *
 * IMPORTANT: exchangeCodeForSession's error is checked and surfaced via
 * ?error=... rather than silently ignored — the tournament-ops-platform
 * auth-saga lost a lot of time to a callback that swallowed this error.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/admin";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("auth/callback exchangeCodeForSession error:", error.message);
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`
      );
    }

    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Missing code")}`
  );
}
