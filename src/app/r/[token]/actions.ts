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

  revalidatePath(`/r/${qrToken}`);
  revalidatePath(`/championships/${scan.competitionId}`);
}
