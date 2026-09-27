"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Δημιουργεί ένα meeting (σταθερή φυσική θέση, π.χ. "Συνάντηση 3") και
 * ΑΜΕΣΩΣ όλα τα qr_tokens του (ένα ανά board 1..board_count) — τα QR είναι
 * μόνιμα, τυπώνονται μία φορά, δεν ξαναδημιουργούνται ποτέ ανά γύρο
 * (επιβεβαιωμένο 2026-09-27, §4/§6 του document).
 */
export async function createMeeting(competitionId: string, formData: FormData) {
  const supabase = createClient();

  const meetingNumber = Number(formData.get("meeting_number"));
  const boardCount = Number(formData.get("board_count"));

  if (!meetingNumber || !boardCount) {
    throw new Error("Αριθμός συνάντησης και αριθμός σκακιερών είναι υποχρεωτικά.");
  }

  const { data: meeting, error } = await supabase
    .from("meetings")
    .insert({
      competition_id: competitionId,
      meeting_number: meetingNumber,
      board_count: boardCount,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Αποτυχία δημιουργίας συνάντησης: ${error.message}`);
  }

  const tokens = Array.from({ length: boardCount }, (_, i) => ({
    meeting_id: meeting.id,
    board_number: i + 1,
    token: randomBytes(12).toString("hex"),
  }));

  const { error: tokensError } = await supabase.from("qr_tokens").insert(tokens);

  if (tokensError) {
    throw new Error(`Η συνάντηση δημιουργήθηκε αλλά τα QR απέτυχαν: ${tokensError.message}`);
  }

  revalidatePath(`/admin/${competitionId}/meetings`);
}
