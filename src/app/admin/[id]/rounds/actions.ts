"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createRound(competitionId: string, formData: FormData) {
  const supabase = createClient();

  const roundNumber = Number(formData.get("round_number"));
  const submissionWindowMinutes = Number(formData.get("submission_window_minutes")) || 10;

  if (!roundNumber) {
    throw new Error("Ο αριθμός γύρου είναι υποχρεωτικός.");
  }

  const { error } = await supabase.from("rounds").insert({
    competition_id: competitionId,
    round_number: roundNumber,
    submission_window_minutes: submissionWindowMinutes,
  });

  if (error) {
    throw new Error(`Αποτυχία δημιουργίας γύρου: ${error.message}`);
  }

  revalidatePath(`/admin/${competitionId}/rounds`);
}

/**
 * Η "αντιστοίχηση" που κάνει ο υπεύθυνος κληρώσεων μετά το ανέβασμα Swiss:
 * ποιες ομάδες κάθονται σε ποια (μόνιμη) Συνάντηση, αυτόν τον γύρο.
 */
export async function createPairing(
  competitionId: string,
  roundId: string,
  formData: FormData
) {
  const supabase = createClient();

  const teamAId = String(formData.get("team_a_id") ?? "");
  const teamBId = String(formData.get("team_b_id") ?? "") || null; // κενό = bye
  const meetingId = String(formData.get("meeting_id") ?? "");

  if (!teamAId || !meetingId) {
    throw new Error("Ομάδα Α και Συνάντηση είναι υποχρεωτικά.");
  }

  const { error } = await supabase.from("pairings").insert({
    round_id: roundId,
    team_a_id: teamAId,
    team_b_id: teamBId,
    meeting_id: meetingId,
  });

  if (error) {
    // η unique(round_id, meeting_id) πιάνει διπλή χρήση της ίδιας Συνάντησης
    throw new Error(`Αποτυχία αντιστοίχισης: ${error.message}`);
  }

  revalidatePath(`/admin/${competitionId}/rounds`);
}
