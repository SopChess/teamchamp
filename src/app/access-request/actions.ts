"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { sendStaffAccessEmail } from "@/lib/email";
import {
  isValidEmail,
  normalizeEmail,
  type AccessRequestResult,
} from "@/lib/accessRequest";

/**
 * Αίτηση προσωπικού link πρόσβασης με email (αρχική σελίδα → "Πρόσβαση").
 *
 * 1. Ελέγχει αν το email ανήκει σε ΕΝΕΡΓΟ χρήστη — μέσω access_email_exists,
 *    που επιστρέφει μόνο true/false, ΠΟΤΕ token.
 * 2. Αν ναι, και ΜΟΝΟ αν έχουν οριστεί GMAIL_USER/GMAIL_APP_PASSWORD και
 *    SUPABASE_SERVICE_ROLE_KEY (μόνο server-side, όχι NEXT_PUBLIC), διαβάζει
 *    το token με το service key και το στέλνει με email (μέσω Gmail — βλ.
 *    @/lib/email).
 * 3. Το "sent" επιστρέφεται μόνο όταν η αποστολή πράγματι έγινε.
 *
 * Περιορισμός συχνότητας: μέγιστο 3 αιτήματα ανά email και 30 συνολικά ανά
 * ώρα (συνάρτηση access_request_allowed της βάσης). Εφαρμόζεται σε ΟΛΑ τα
 * αιτήματα, ώστε να μη γίνεται ούτε "σκανάρισμα" emails ούτε πλημμύρα
 * μηνυμάτων σε καταχωρημένα μέλη.
 */
export async function requestAccessLink(rawEmail: string): Promise<AccessRequestResult> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) return { status: "invalid_email" };

  const supabase = createClient();

  const { data: allowed, error: limitError } = await supabase.rpc("access_request_allowed", {
    p_email: email,
  });
  if (limitError) {
    console.error("access_request_allowed error:", limitError.message);
    return { status: "send_failed" };
  }
  if (!allowed) return { status: "rate_limited" };

  const { data: exists, error } = await supabase.rpc("access_email_exists", { p_email: email });
  if (error) {
    console.error("access_email_exists error:", error.message);
    return { status: "send_failed" };
  }
  if (!exists) return { status: "not_member" };

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD || !serviceKey) {
    return { status: "sending_disabled" };
  }

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false },
  });
  const escaped = email.replace(/[%_\\]/g, "\\$&");
  const { data: row } = await admin
    .from("access_links")
    .select("token")
    .ilike("email", escaped)
    .eq("active", true)
    .maybeSingle<{ token: string }>();

  if (!row) return { status: "not_member" };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://teamchamp.vercel.app";
  const link = `${siteUrl}/access/${row.token}`;

  try {
    const ok = await sendStaffAccessEmail(email, link);
    return { status: ok ? "sent" : "send_failed" };
  } catch (e) {
    console.error("Αποστολή email απέτυχε:", e);
    return { status: "send_failed" };
  }
}
