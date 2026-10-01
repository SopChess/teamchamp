"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ACCESS_COOKIE } from "@/lib/access";
import { isValidEmail, normalizeEmail } from "@/lib/accessRequest";
import { sendRoleAccessEmail, type StaffRole } from "@/lib/email";

function isStaffRole(r: string): r is StaffRole {
  return r === "super_admin" || r === "tournament_admin" || r === "referee";
}

const ROLES = ["super_admin", "tournament_admin", "referee"];

function adminToken(): string {
  const token = cookies().get(ACCESS_COOKIE)?.value;
  if (!token) throw new Error("Δεν έχετε πρόσβαση για αυτή την ενέργεια.");
  return token;
}

/**
 * Δημιουργία χρήστη πρόσβασης. Οι συναρτήσεις της βάσης δέχονται ΜΟΝΟ token
 * ενεργού super_admin, άρα ακόμα κι αν κάποιος καλέσει απευθείας το API με το
 * δημόσιο anon key, δεν μπορεί να δημιουργήσει links χωρίς έγκυρο token.
 */
export async function createAccessUser(formData: FormData) {
  const supabase = createClient();

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const label = String(formData.get("label") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const competitionIds = formData.getAll("competition_ids").map(String);

  if (!isValidEmail(email)) throw new Error("Παρακαλούμε εισαγάγετε ένα έγκυρο email.");
  if (!label) throw new Error("Το όνομα ή η ετικέτα του χρήστη είναι υποχρεωτικό.");
  if (!ROLES.includes(role)) throw new Error("Επιλέξτε έγκυρο ρόλο.");
  if (role !== "super_admin" && competitionIds.length === 0) {
    throw new Error("Επιλέξτε τουλάχιστον ένα πρωτάθλημα για αυτόν τον ρόλο.");
  }

  const { data: newToken, error } = await supabase.rpc("admin_create_access", {
    p_admin_token: adminToken(),
    p_email: email,
    p_label: label,
    p_role: role,
    p_competition_ids: role === "super_admin" ? [] : competitionIds,
  });

  if (error) {
    if (error.message.includes("access_links_email_unique") || error.code === "23505") {
      throw new Error("Υπάρχει ήδη χρήστης με αυτό το email.");
    }
    throw new Error(`Αποτυχία δημιουργίας χρήστη: ${error.message}`);
  }

  // Η αποστολή είναι best-effort — ο χρήστης έχει ήδη δημιουργηθεί κανονικά ακόμα κι αν αποτύχει.
  if (newToken && isStaffRole(role)) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://teamchamp.vercel.app";
    try {
      await sendRoleAccessEmail(role, email, `${siteUrl}/access/${newToken}`);
    } catch (e) {
      console.error("Αποστολή email πρόσβασης απέτυχε:", e);
    }
  }

  revalidatePath("/admin/users");
}

/** Επαναποστολή του ΙΔΙΟΥ link — π.χ. αν ο χρήστης το έχασε. Δεν αλλάζει το token. */
export async function resendAccessEmail(id: string, token: string, email: string | null, role: string): Promise<void> {
  if (!email) throw new Error("Αυτός ο χρήστης δεν έχει καταχωρημένο email.");
  if (!isStaffRole(role)) throw new Error("Άγνωστος ρόλος.");
  void id; // δεν χρειάζεται εδώ (το token αρκεί) — κρατιέται στην υπογραφή για ευκρίνεια στο σημείο κλήσης
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://teamchamp.vercel.app";
  const ok = await sendRoleAccessEmail(role, email, `${siteUrl}/access/${token}`);
  if (!ok) throw new Error("Η αποστολή email δεν είναι ενεργή (λείπουν τα στοιχεία Gmail).");
}

export async function setAccessActive(id: string, active: boolean) {
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_set_access_active", {
    p_admin_token: adminToken(),
    p_id: id,
    p_active: active,
  });
  if (error) throw new Error(`Αποτυχία ενημέρωσης: ${error.message}`);
  revalidatePath("/admin/users");
}
