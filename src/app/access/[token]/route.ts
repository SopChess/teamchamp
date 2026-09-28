import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, type Access } from "@/lib/access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Μόνιμο προσωπικό link πρόσβασης: /access/<token>. Ελέγχει το token στη
 * βάση, βάζει μόνιμο cookie (1 χρόνο, httpOnly) και στέλνει στην αρχική του
 * ρόλου. Το token ΔΕΝ "καταναλώνεται" — μπορεί να ανοίξει ξανά σε άλλη
 * συσκευή, και ένα αυτόματο prefetch (π.χ. από email client) δεν το χαλάει.
 */
export async function GET(request: Request, { params }: { params: { token: string } }) {
  const { origin } = new URL(request.url);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await supabase.rpc("verify_access_token", { p_token: params.token });
  const access = (Array.isArray(data) ? data[0] : data) as Access | undefined;

  if (error || !access) {
    return NextResponse.redirect(`${origin}/login?error=invalid`);
  }

  await supabase.rpc("touch_access_token", { p_token: params.token });

  const destination = access.role === "referee" ? "/referee" : "/admin";
  const response = NextResponse.redirect(`${origin}${destination}`);
  response.cookies.set(ACCESS_COOKIE, params.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
