"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAccess } from "@/lib/access.server";

/**
 * Μόνο ο διαχειριστής μπορεί να προσθέτει/διαγράφει συλλόγους — ο υπεύθυνος
 * πρωταθλήματος βλέπει τη σελίδα (επιτρέπεται από το middleware) αλλά όχι τη
 * φόρμα δημιουργίας, και οι ενέργειες το ξαναελέγχουν εδώ.
 */
async function requireSuperAdmin(): Promise<void> {
  const access = await getCurrentAccess();
  if (!access || access.role !== "super_admin") {
    throw new Error("Η ενέργεια επιτρέπεται μόνο στον διαχειριστή.");
  }
}

export async function createClubOrSchool(formData: FormData) {
  await requireSuperAdmin();
  const supabase = createClient();

  const name = String(formData.get("name") ?? "").trim().toUpperCase();
  const type = String(formData.get("type") ?? "club");
  const esoCode = String(formData.get("eso_code") ?? "").trim() || null;
  const contactEmail = String(formData.get("contact_email") ?? "") || null;
  const contactPhone = String(formData.get("contact_phone") ?? "") || null;

  if (!name) {
    throw new Error("Το όνομα (ΕΛΛΗΝΙΚΑ ΚΕΦΑΛΑΙΑ) είναι υποχρεωτικό.");
  }

  const { error } = await supabase.from("clubs_schools").insert({
    name,
    type,
    eso_code: esoCode,
    contact_email: contactEmail,
    contact_phone: contactPhone,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error(`Υπάρχει ήδη σύλλογος/σχολείο με το όνομα «${name}».`);
    }
    throw new Error(`Αποτυχία δημιουργίας: ${error.message}`);
  }

  revalidatePath("/admin/clubs");
}
