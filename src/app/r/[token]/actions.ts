"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canScoreCompetition, getCurrentAccess } from "@/lib/access.server";
import { resolveScan } from "@/lib/rounds/scan";
import { BOARD_RESULTS, type BoardResult } from "@/lib/standings/standings";

/**
 * Καταχώρηση/διόρθωση αποτελέσματος σκακιέρας από διαιτητή (ή admin).
 * Όλοι οι έλεγχοι ξανατρέχουν στον server: έγκυρη συνεδρία, δικαίωμα στη
 * συγκεκριμένη διοργάνωση, έγκυρη τιμή, και ότι οι συνθέσεις και των δύο
 * ομάδων υπάρχουν (αλλιώς δεν ξέρουμε ποιοι παίκτες παίζουν).
 */
export async function recordBoardResult(qrToken: string, result: string) {
  if (!BOARD_RESULTS.includes(result as BoardResult)) {
    throw new Error("Μη έγκυρο αποτέλεσμα.");
  }

  const scan = await resolveScan(qrToken);
  if (scan.kind !== "board") {
    throw new Error("Δεν υπάρχει ενεργή παρτίδα σε αυτή τη σκακιέρα.");
  }

  const access = await getCurrentAccess();
  if (!canScoreCompetition(access, scan.competitionId)) {
    throw new Error("Δεν έχετε δικαίωμα καταχώρησης αποτελεσμάτων σε αυτή τη διοργάνωση.");
  }
  if (!scan.ready) {
    throw new Error("Οι συνθέσεις των ομάδων δεν έχουν ολοκληρωθεί ακόμα.");
  }

  const db = createClient();

  // Ιστορικό διορθώσεων: κρατάμε την προηγούμενη τιμή πριν γράψουμε τη νέα.
  const { data: existing } = await db
    .from("board_results")
    .select("result")
    .eq("pairing_id", scan.pairingId)
    .eq("board_number", scan.boardNumber)
    .maybeSingle();

  const { error } = await db.from("board_results").upsert(
    {
      pairing_id: scan.pairingId,
      board_number: scan.boardNumber,
      result,
      entered_at: new Date().toISOString(),
    },
    { onConflict: "pairing_id,board_number" }
  );
  if (error) throw new Error(`Αποτυχία καταχώρησης: ${error.message}`);

  const { error: histError } = await db.from("board_results_history").insert({
    pairing_id: scan.pairingId,
    board_number: scan.boardNumber,
    old_result: existing?.result ?? null,
    new_result: result,
    changed_by: access?.label ?? null,
  });
  if (histError) console.error("board_results_history insert failed:", histError.message);

  revalidatePath(`/r/${qrToken}`);
  revalidatePath(`/championships/${scan.competitionId}`);
}

export interface ResultHistoryEntry {
  old_result: string | null;
  new_result: string;
  changed_by: string | null;
  changed_at: string;
}

/** Ιστορικό διορθώσεων για μία σκακιέρα — πιο πρόσφατο πρώτο. */
export async function getResultHistory(qrToken: string): Promise<ResultHistoryEntry[]> {
  const scan = await resolveScan(qrToken);
  if (scan.kind !== "board") return [];

  const access = await getCurrentAccess();
  if (!canScoreCompetition(access, scan.competitionId)) return [];

  const db = createClient();
  const { data } = await db
    .from("board_results_history")
    .select("old_result, new_result, changed_by, changed_at")
    .eq("pairing_id", scan.pairingId)
    .eq("board_number", scan.boardNumber)
    .order("changed_at", { ascending: false });

  return (data ?? []) as ResultHistoryEntry[];
}
