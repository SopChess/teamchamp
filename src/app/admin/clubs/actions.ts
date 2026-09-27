"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createClubOrSchool(formData: FormData) {
  const supabase = createClient();

  const name = String(formData.get("name") ?? "").trim().toUpperCase();
  const type = String(formData.get("type") ?? "club");
  const contactEmail = String(formData.get("contact_email") ?? "") || null;
  const contactPhone = String(formData.get("contact_phone") ?? "") || null;

  if (!name) {
    throw new Error("Το όνομα (ΕΛΛΗΝΙΚΑ ΚΕΦΑΛΑΙΑ) είναι υποχρεωτικό.");
  }

  const { error } = await supabase.from("clubs_schools").insert({
    name,
    type,
    contact_email: contactEmail,
    contact_phone: contactPhone,
  });

  if (error) {
    throw new Error(`Αποτυχία δημιουργίας: ${error.message}`);
  }

  revalidatePath("/admin/clubs");
}
