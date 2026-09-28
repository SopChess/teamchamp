"use server";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
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
 * 2. Αν ναι, και ΜΟΝΟ αν έχουν οριστεί RESEND_API_KEY και
 *    SUPABASE_SERVICE_ROLE_KEY (μόνο server-side, όχι NEXT_PUBLIC), διαβάζει
 *    το token με το service key και το στέλνει με email.
 * 3. Το "sent" επιστρέφεται μόνο όταν το Resend επιβεβαίωσε την αποστολή.
 *
 * Γνωστός περιορισμός: δεν υπάρχει ακόμα περιορισμός συχνότητας αιτημάτων.
 */
export async function requestAccessLink(rawEmail: string): Promise<AccessRequestResult> {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) return { status: "invalid_email" };

  const supabase = createClient();
  const { data: exists, error } = await supabase.rpc("access_email_exists", { p_email: email });
  if (error) {
    console.error("access_email_exists error:", error.message);
    return { status: "send_failed" };
  }
  if (!exists) return { status: "not_member" };

  const resendKey = process.env.RESEND_API_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!resendKey || !serviceKey) return { status: "sending_disabled" };

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
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.ACCESS_MAIL_FROM || "Team ALMA <onboarding@resend.dev>",
        to: [email],
        subject: "Το προσωπικό σας link πρόσβασης — Team ALMA",
        text:
          `Ακολουθεί το προσωπικό σας link πρόσβασης στο Team ALMA:\n\n${link}\n\n` +
          `Ανοίξτε το μία φορά σε κάθε συσκευή που θέλετε να χρησιμοποιήσετε. ` +
          `Είναι προσωπικό — παρακαλούμε μην το προωθήσετε σε τρίτους.`,
        html:
          `<p>Ακολουθεί το προσωπικό σας link πρόσβασης στο <b>Team ALMA</b>:</p>` +
          `<p><a href="${link}">${link}</a></p>` +
          `<p>Ανοίξτε το μία φορά σε κάθε συσκευή που θέλετε να χρησιμοποιήσετε. ` +
          `Είναι προσωπικό — παρακαλούμε μην το προωθήσετε σε τρίτους.</p>`,
      }),
    });
    if (!response.ok) {
      console.error("Resend error:", response.status, await response.text());
      return { status: "send_failed" };
    }
    return { status: "sent" };
  } catch (e) {
    console.error("Resend fetch failed:", e);
    return { status: "send_failed" };
  }
}
