"use server";

import { createClient } from "@/lib/supabase/server";
import { searchDirectoryRows, findDirectoryRowByNumber } from "@/lib/players/server";
import { toHit, type DirectoryHit } from "@/lib/players/directory";

/**
 * Αναζήτηση στον κατάλογο αθλητών ΚΑΤΑ ΤΗΝ ΕΓΓΡΑΦΗ — πριν υπάρχει καν ομάδα, άρα
 * χωρίς token αρχηγού να την προστατεύει (σε αντίθεση με searchDirectory του
 * Portal). Ίδιοι περιορισμοί με εκεί ώστε να μην αλλάζει το επίπεδο προστασίας:
 * τουλάχιστον 2 γράμματα, το πολύ SEARCH_LIMIT αποτελέσματα, όχι πλήρη γενέθλια.
 */
export async function searchDirectoryForRegistration(epitheto: string, onoma: string): Promise<DirectoryHit[]> {
  const rows = await searchDirectoryRows(createClient(), epitheto, onoma);
  return rows.map(toHit);
}

export async function searchDirectoryByNumberForRegistration(number: string): Promise<DirectoryHit | null> {
  const row = await findDirectoryRowByNumber(createClient(), number);
  return row ? toHit(row) : null;
}
