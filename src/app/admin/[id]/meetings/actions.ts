"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Δημιουργεί ΠΟΛΛΕΣ συναντήσεις μαζί (π.χ. "θέλω QR για 5 συναντήσεις") —
 * επιβεβαιωμένο 2026-09-27. Ο αριθμός σκακιερών ανά συνάντηση ΔΕΝ ξαναρωτιέται
 * εδώ — έρχεται αυτόματα από το match_board_count των Κανόνων Σύνθεσης της
 * διοργάνωσης. Κάθε συνάντηση παίρνει αμέσως τα δικά της μόνιμα QR (ένα ανά
 * σκακιέρα), που δεν ξαναδημιουργούνται ποτέ.
 */
export async function createMeetings(competitionId: string, formData: FormData) {
  const supabase = createClient();

  const count = Number(formData.get("count"));
  if (!count || count < 1) {
    throw new Error("Ο αριθμός συναντήσεων είναι υποχρεωτικός.");
  }

  const { data: rules } = await supabase
    .from("roster_rules")
    .select("match_board_count")
    .eq("competition_id", competitionId)
    .maybeSingle<{ match_board_count: number | null }>();

  if (!rules?.match_board_count) {
    throw new Error(
      'Ορίστε πρώτα τις "Σκακιέρες ανά αγώνα" στους Κανόνες Σύνθεσης της διοργάνωσης.'
    );
  }
  const boardCount = rules.match_board_count;

  const { data: existing } = await supabase
    .from("meetings")
    .select("meeting_number")
    .eq("competition_id", competitionId)
    .order("meeting_number", { ascending: false })
    .limit(1);

  const startFrom = (existing?.[0]?.meeting_number ?? 0) + 1;

  for (let i = 0; i < count; i++) {
    const meetingNumber = startFrom + i;

    const { data: meeting, error } = await supabase
      .from("meetings")
      .insert({ competition_id: competitionId, meeting_number: meetingNumber, board_count: boardCount })
      .select("id")
      .single();

    if (error) {
      throw new Error(`Αποτυχία δημιουργίας Συνάντησης ${meetingNumber}: ${error.message}`);
    }

    const tokens = Array.from({ length: boardCount }, (_, b) => ({
      meeting_id: meeting.id,
      board_number: b + 1,
      token: randomBytes(12).toString("hex"),
    }));

    const { error: tokensError } = await supabase.from("qr_tokens").insert(tokens);
    if (tokensError) {
      throw new Error(`Συνάντηση ${meetingNumber} δημιουργήθηκε αλλά τα QR απέτυχαν: ${tokensError.message}`);
    }
  }

  revalidatePath(`/admin/${competitionId}/meetings`);
}
