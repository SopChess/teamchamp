"use server";

import { createClient } from "@/lib/supabase/server";
import { isValidEmail, normalizeEmail } from "@/lib/accessRequest";
import { isValidPhone, phoneKey, emailKey } from "@/lib/captain/identity";
import { sendStaffAccessEmail } from "@/lib/email";

/**
 * "Ξέχασα το link μου" για υπευθύνους ομάδας: email + τηλέφνο ΜΑΖΙ (ίδια
 * ταυτοποίηση με την εγγραφή) — αν ταιριάζουν με λογαριασμό, ξαναστέλνεται το
 * ΙΔΙΟ link (δεν αλλάζει ποτέ). Ίδιος περιορισμός συχνότητας με το αίτημα
 * link του επιτελείου, ώστε να μη γίνεται σκανάρισμα email/τηλεφώνων.
 */
export async function recoverCaptainLink(formData: FormData): Promise<void> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const phone = String(formData.get("phone") ?? "").trim();

  if (!isValidEmail(email)) throw new Error("Το email δεν είναι έγκυρο.");
  if (!isValidPhone(phone)) throw new Error("Το τηλέφωνο δεν είναι έγκυρο.");

  const supabase = createClient();
  const { data: allowed } = await supabase.rpc("access_request_allowed", { p_email: email });
  if (!allowed) throw new Error("Πολλά αιτήματα πρόσφατα — δοκιμάστε ξανά αργότερα.");

  const { data: account } = await supabase
    .from("captain_accounts")
    .select("access_token")
    .eq("email_key", emailKey(email))
    .eq("phone_key", phoneKey(phone))
    .maybeSingle();

  // Ίδιο μήνυμα είτε βρέθηκε είτε όχι — δεν αποκαλύπτουμε αν ένα email/τηλέφωνο υπάρχει.
  if (account) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://teamchamp.vercel.app";
    try {
      await sendStaffAccessEmail(email, `${siteUrl}/captain/${account.access_token}`);
    } catch (e) {
      console.error("Αποστολή email ανάκτησης απέτυχε:", e);
    }
  }
}
