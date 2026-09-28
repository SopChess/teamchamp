import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, isPathAllowed, type Access } from "@/lib/access";

/**
 * Φρουρός πρόσβασης για /admin και /referee. Ελέγχει το μόνιμο cookie
 * (προσωπικό token) ΣΕ ΚΑΘΕ αίτημα απέναντι στη βάση, μέσω της συνάρτησης
 * verify_access_token — έτσι μια ανάκληση link (active=false) κόβει την
 * πρόσβαση αμέσως. Καλύπτει και τα server actions (γίνονται POST στο ίδιο path).
 *
 * Το /captain/[token] ΔΕΝ περνά από εδώ — έχει δικό του token στο URL.
 */
export async function middleware(request: NextRequest) {
  const deny = () => {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "denied");
    return NextResponse.redirect(url);
  };

  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return deny();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await supabase.rpc("verify_access_token", { p_token: token });
  const access = (Array.isArray(data) ? data[0] : data) as Access | undefined;

  if (error || !access) return deny();
  if (!isPathAllowed(access, request.nextUrl.pathname)) return deny();

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/referee/:path*"],
};
