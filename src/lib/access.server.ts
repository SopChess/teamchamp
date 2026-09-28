import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { ACCESS_COOKIE, type Access } from "./access";

/**
 * Ο χρήστης που είναι συνδεδεμένος (μέσω του μόνιμου cookie), ή null.
 * Χρησιμοποιεί την ίδια συνάρτηση βάσης με το middleware (verify_access_token),
 * που δουλεύει και με το anon key και μετά το κλείσιμο ασφάλειας.
 */
export async function getCurrentAccess(): Promise<Access | null> {
  const token = cookies().get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  const { data, error } = await supabase.rpc("verify_access_token", { p_token: token });
  if (error) return null;
  return ((Array.isArray(data) ? data[0] : data) as Access | undefined) ?? null;
}

/** Έχει ο χρήστης δικαίωμα να καταχωρεί/βλέπει αποτελέσματα αυτής της διοργάνωσης; */
export function canScoreCompetition(access: Access | null, competitionId: string): boolean {
  if (!access) return false;
  if (access.role === "super_admin") return true;
  if (access.role === "referee" || access.role === "tournament_admin") {
    return (access.competition_ids ?? []).includes(competitionId);
  }
  return false;
}
