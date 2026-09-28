"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RosterRules } from "@/lib/rosterRules/types";

export async function createCompetition(formData: FormData) {
  const supabase = createClient();

  const name = String(formData.get("name") ?? "").trim();
  const format = String(formData.get("format") ?? "swiss");
  const roundsCount = Number(formData.get("rounds_count") ?? 0) || null;
  const startsOn = String(formData.get("starts_on") ?? "") || null;
  const endsOn = String(formData.get("ends_on") ?? "") || null;
  const venue = String(formData.get("venue") ?? "").trim() || null;

  if (!name) {
    throw new Error("Το όνομα διοργάνωσης είναι υποχρεωτικό.");
  }

  const { data, error } = await supabase
    .from("competitions")
    .insert({
      name,
      format,
      rounds_count: roundsCount,
      starts_on: startsOn,
      ends_on: endsOn,
      venue,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Αποτυχία δημιουργίας διοργάνωσης: ${error.message}`);
  }

  revalidatePath("/admin");
  redirect(`/admin/${data.id}`);
}

export async function saveRosterRules(competitionId: string, formData: FormData) {
  const supabase = createClient();

  const assignmentMode = String(formData.get("assignment_mode"));
  const rosterSizeRaw = String(formData.get("roster_size") ?? "");
  const matchBoardCountRaw = String(formData.get("match_board_count") ?? "");
  const reserveCountRaw = String(formData.get("reserve_count") ?? "");
  const onePlayerPerCategory = formData.get("one_player_per_category") === "on";
  const boardRulesJson = String(formData.get("board_rules_json") ?? "[]");

  let boardRules: RosterRules["board_rules"];
  try {
    boardRules = JSON.parse(boardRulesJson);
  } catch {
    throw new Error("Το board_rules JSON δεν είναι έγκυρο. Ελέγξτε τη σύνταξη.");
  }

  const payload: Partial<RosterRules> & { competition_id: string } = {
    competition_id: competitionId,
    assignment_mode: assignmentMode as RosterRules["assignment_mode"],
    roster_size: rosterSizeRaw ? Number(rosterSizeRaw) : null,
    match_board_count: matchBoardCountRaw ? Number(matchBoardCountRaw) : undefined,
    reserve_count: reserveCountRaw ? Number(reserveCountRaw) : undefined,
    one_player_per_category: onePlayerPerCategory,
    board_rules: boardRules,
  };

  const { error } = await supabase
    .from("roster_rules")
    .upsert(payload, { onConflict: "competition_id" });

  if (error) {
    throw new Error(`Αποτυχία αποθήκευσης κανόνων σύνθεσης: ${error.message}`);
  }

  revalidatePath(`/admin/${competitionId}`);
}
