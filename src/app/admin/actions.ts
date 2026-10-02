"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RosterRules } from "@/lib/rosterRules/types";
import { TIEBREAK_LABELS, type TiebreakKey } from "@/lib/standings/standings";
import type { AudienceType } from "@/lib/teams/teams";
import { isValidTournamentStatus, type TournamentStatus } from "@/lib/competitions/tournamentStatus";
import { isTournamentCategory, type TournamentCategory } from "@/lib/competitions/category";
import { isTournamentFormat, type TournamentFormat } from "@/lib/competitions/format";

const AUDIENCE_TYPES: AudienceType[] = ["school", "eso_club", "free_team"];

/**
 * Ο αριθμός σκακιερών (match_board_count) ζει στο roster_rules, όχι στο competitions —
 * επιβεβαιωμένο: εμφανίζεται πλέον και στα βασικά στοιχεία διοργάνωσης για ευκολία, αλλά
 * αποθηκεύεται πάντα εκεί. Αν δεν υπάρχει ακόμα γραμμή roster_rules (ο admin δεν έχει
 * επισκεφτεί ακόμα τους Κανόνες Σύνθεσης), δημιουργείται μία ελάχιστη, ασφαλής — με
 * λογική προεπιλογή assignment_mode που ο admin μπορεί να αλλάξει αργότερα εκεί.
 */
async function upsertMatchBoardCount(
  supabase: ReturnType<typeof createClient>,
  competitionId: string,
  matchBoardCount: number | null
): Promise<void> {
  if (matchBoardCount == null) return;
  const { data: existing } = await supabase
    .from("roster_rules")
    .select("competition_id")
    .eq("competition_id", competitionId)
    .maybeSingle();
  if (existing) {
    await supabase.from("roster_rules").update({ match_board_count: matchBoardCount }).eq("competition_id", competitionId);
  } else {
    await supabase.from("roster_rules").insert({
      competition_id: competitionId,
      assignment_mode: "strength_order",
      match_board_count: matchBoardCount,
      board_rules: [],
    });
  }
}

export async function createCompetition(formData: FormData) {
  const supabase = createClient();

  const name = String(formData.get("name") ?? "").trim();
  const formatRaw = String(formData.get("format") ?? "swiss");
  const format: TournamentFormat = isTournamentFormat(formatRaw) ? formatRaw : "swiss";
  const roundsCount = Number(formData.get("rounds_count") ?? 0) || null;
  const startsOn = String(formData.get("starts_on") ?? "") || null;
  const endsOn = String(formData.get("ends_on") ?? "") || null;
  const venue = String(formData.get("venue") ?? "").trim() || null;
  const audienceTypeRaw = String(formData.get("audience_type") ?? "eso_club");
  const audienceType: AudienceType = AUDIENCE_TYPES.includes(audienceTypeRaw as AudienceType)
    ? (audienceTypeRaw as AudienceType)
    : "eso_club";
  const maxTeamsPerClub = Math.max(1, Number(formData.get("max_teams_per_club") ?? 1) || 1);
  const announcementUrl = String(formData.get("announcement_url") ?? "").trim() || null;
  const venueMapsUrl = String(formData.get("venue_maps_url") ?? "").trim() || null;
  const chessResultsUrl = String(formData.get("chess_results_url") ?? "").trim() || null;
  const registrationDeadlineRaw = String(formData.get("registration_deadline") ?? "");
  const registrationDeadline = registrationDeadlineRaw ? new Date(registrationDeadlineRaw).toISOString() : null;
  const entryFeeAmountRaw = String(formData.get("entry_fee_amount") ?? "").trim();
  const entryFeeAmount = entryFeeAmountRaw && Number.isFinite(Number(entryFeeAmountRaw)) ? Number(entryFeeAmountRaw) : null;
  const entryFeeNote = String(formData.get("entry_fee_note") ?? "").trim() || null;
  const timeControl = String(formData.get("time_control") ?? "").trim() || null;
  const entryFeeDeadlineRaw = String(formData.get("entry_fee_deadline") ?? "").trim();
  const entryFeeDeadline = entryFeeDeadlineRaw ? new Date(entryFeeDeadlineRaw).toISOString() : null;
  const statusRaw = String(formData.get("status") ?? "open");
  const status: TournamentStatus = isValidTournamentStatus(statusRaw) ? statusRaw : "open";
  const requiresCertificate = formData.get("requires_certificate") === "on";
  const organizer = String(formData.get("organizer") ?? "").trim() || null;
  const categoryRaw = String(formData.get("category") ?? "other");
  const category: TournamentCategory = isTournamentCategory(categoryRaw) ? categoryRaw : "other";
  const matchBoardCountRaw = String(formData.get("match_board_count") ?? "").trim();
  const matchBoardCount = matchBoardCountRaw && Number.isFinite(Number(matchBoardCountRaw)) ? Number(matchBoardCountRaw) : null;

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
      audience_type: audienceType,
      max_teams_per_club: maxTeamsPerClub,
      announcement_url: announcementUrl,
      venue_maps_url: venueMapsUrl,
      chess_results_url: chessResultsUrl,
      registration_deadline: registrationDeadline,
      entry_fee_amount: entryFeeAmount,
      entry_fee_note: entryFeeNote,
      time_control: timeControl,
      entry_fee_deadline: entryFeeDeadline,
      status,
      requires_certificate: requiresCertificate,
      organizer,
      category,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Αποτυχία δημιουργίας διοργάνωσης: ${error.message}`);
  }

  await upsertMatchBoardCount(supabase, data.id, matchBoardCount);

  revalidatePath("/admin");
  redirect(`/admin/${data.id}`);
}

/** Επεξεργασία στοιχείων υπάρχουσας διοργάνωσης. */
export async function updateCompetition(competitionId: string, formData: FormData) {
  const supabase = createClient();

  const name = String(formData.get("name") ?? "").trim();
  const formatRaw = String(formData.get("format") ?? "swiss");
  const format: TournamentFormat = isTournamentFormat(formatRaw) ? formatRaw : "swiss";
  const roundsCount = Number(formData.get("rounds_count") ?? 0) || null;
  const startsOn = String(formData.get("starts_on") ?? "") || null;
  const endsOn = String(formData.get("ends_on") ?? "") || null;
  const venue = String(formData.get("venue") ?? "").trim() || null;
  const audienceTypeRaw = String(formData.get("audience_type") ?? "eso_club");
  const audienceType: AudienceType = AUDIENCE_TYPES.includes(audienceTypeRaw as AudienceType)
    ? (audienceTypeRaw as AudienceType)
    : "eso_club";
  const maxTeamsPerClub = Math.max(1, Number(formData.get("max_teams_per_club") ?? 1) || 1);
  const announcementUrl = String(formData.get("announcement_url") ?? "").trim() || null;
  const venueMapsUrl = String(formData.get("venue_maps_url") ?? "").trim() || null;
  const chessResultsUrl = String(formData.get("chess_results_url") ?? "").trim() || null;
  const registrationDeadlineRaw = String(formData.get("registration_deadline") ?? "");
  const registrationDeadline = registrationDeadlineRaw ? new Date(registrationDeadlineRaw).toISOString() : null;
  const entryFeeAmountRaw = String(formData.get("entry_fee_amount") ?? "").trim();
  const entryFeeAmount = entryFeeAmountRaw && Number.isFinite(Number(entryFeeAmountRaw)) ? Number(entryFeeAmountRaw) : null;
  const entryFeeNote = String(formData.get("entry_fee_note") ?? "").trim() || null;
  const timeControl = String(formData.get("time_control") ?? "").trim() || null;
  const entryFeeDeadlineRaw = String(formData.get("entry_fee_deadline") ?? "").trim();
  const entryFeeDeadline = entryFeeDeadlineRaw ? new Date(entryFeeDeadlineRaw).toISOString() : null;
  const statusRaw = String(formData.get("status") ?? "open");
  const status: TournamentStatus = isValidTournamentStatus(statusRaw) ? statusRaw : "open";
  const requiresCertificate = formData.get("requires_certificate") === "on";
  const organizer = String(formData.get("organizer") ?? "").trim() || null;
  const categoryRaw = String(formData.get("category") ?? "other");
  const category: TournamentCategory = isTournamentCategory(categoryRaw) ? categoryRaw : "other";
  const matchBoardCountRaw = String(formData.get("match_board_count") ?? "").trim();
  const matchBoardCount = matchBoardCountRaw && Number.isFinite(Number(matchBoardCountRaw)) ? Number(matchBoardCountRaw) : null;

  if (!name) {
    throw new Error("Το όνομα διοργάνωσης είναι υποχρεωτικό.");
  }

  const { error } = await supabase
    .from("competitions")
    .update({
      name,
      format,
      rounds_count: roundsCount,
      starts_on: startsOn,
      ends_on: endsOn,
      venue,
      audience_type: audienceType,
      max_teams_per_club: maxTeamsPerClub,
      announcement_url: announcementUrl,
      venue_maps_url: venueMapsUrl,
      chess_results_url: chessResultsUrl,
      registration_deadline: registrationDeadline,
      entry_fee_amount: entryFeeAmount,
      entry_fee_note: entryFeeNote,
      time_control: timeControl,
      entry_fee_deadline: entryFeeDeadline,
      status,
      requires_certificate: requiresCertificate,
      organizer,
      category,
    })
    .eq("id", competitionId);

  if (error) {
    throw new Error(`Αποτυχία ενημέρωσης διοργάνωσης: ${error.message}`);
  }

  await upsertMatchBoardCount(supabase, competitionId, matchBoardCount);

  revalidatePath(`/admin/${competitionId}`);
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

function numberField(formData: FormData, name: string, fallback: number): number {
  const raw = String(formData.get(name) ?? "").trim().replace(",", ".");
  if (raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Το πεδίο "${name}" πρέπει να είναι αριθμός.`);
  return n;
}

/** Ρυθμίσεις βαθμολογίας ανά διοργάνωση: βαθμοί, ποινή α.α., BYE, κριτήρια ισοβαθμίας. */
export async function saveScoringRules(competitionId: string, formData: FormData) {
  const supabase = createClient();

  const validKeys = Object.keys(TIEBREAK_LABELS) as TiebreakKey[];
  const tiebreaks: TiebreakKey[] = [];
  for (const name of ["tiebreak_1", "tiebreak_2", "tiebreak_3"]) {
    const v = String(formData.get(name) ?? "") as TiebreakKey;
    if (v && validKeys.includes(v) && !tiebreaks.includes(v)) tiebreaks.push(v);
  }

  const byeBoardRaw = String(formData.get("bye_board_points") ?? "").trim();

  const { error } = await supabase.from("scoring_rules").upsert(
    {
      competition_id: competitionId,
      win_points: numberField(formData, "win_points", 2),
      draw_points: numberField(formData, "draw_points", 1),
      loss_points: numberField(formData, "loss_points", 0),
      forfeit_loss_penalty: Math.abs(numberField(formData, "forfeit_loss_penalty", 0)),
      bye_match_points: numberField(formData, "bye_match_points", 2),
      bye_board_points: byeBoardRaw === "" ? null : numberField(formData, "bye_board_points", 0),
      tiebreak_criteria: tiebreaks,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "competition_id" }
  );

  if (error) {
    throw new Error(`Αποτυχία αποθήκευσης βαθμολογίας: ${error.message}`);
  }
  revalidatePath(`/admin/${competitionId}`);
}
