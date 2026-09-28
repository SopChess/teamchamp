"use server";

import { createClient } from "@/lib/supabase/server";
import { toHit, type DirectoryHit } from "@/lib/players/directory";
import { searchDirectoryRows } from "@/lib/players/server";

/**
 * Δοκιμαστική αναζήτηση για τον admin. Είναι ενέργεια μέσα στο /admin, άρα τη
 * φρουρεί το middleware (χρειάζεται σύνδεση διαχειριστή) — δεν υπάρχει δημόσια
 * διεύθυνση αναζήτησης στον κατάλογο.
 */
export async function adminSearchDirectory(epitheto: string, onoma: string): Promise<DirectoryHit[]> {
  const rows = await searchDirectoryRows(createClient(), epitheto, onoma);
  return rows.map(toHit);
}
