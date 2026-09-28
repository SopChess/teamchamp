"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseSwissTeamPairings, normalizeTeamName, type ParsedPairing } from "@/lib/swissImport/parsePairings";

type ClubRef = { name: string } | { name: string }[] | null;
function clubName(raw: ClubRef): string | undefined {
  const club = Array.isArray(raw) ? raw[0] : raw;
  return club?.name;
}

async function buildTeamNameMaps(competitionId: string) {
  const supabase = createClient();

  const { data: teams } = await supabase
    .from("teams")
    .select("id, clubs_schools(name)")
    .eq("competition_id", competitionId);

  const nameToTeamId = new Map<string, string>();
  for (const t of teams ?? []) {
    const name = clubName(t.clubs_schools as ClubRef);
    if (name) nameToTeamId.set(normalizeTeamName(name), t.id);
  }

  const { data: aliases } = await supabase
    .from("team_name_aliases")
    .select("excel_name, team_id")
    .eq("competition_id", competitionId);

  const aliasToTeamId = new Map<string, string>();
  for (const a of aliases ?? []) {
    aliasToTeamId.set(a.excel_name, a.team_id);
  }

  return { nameToTeamId, aliasToTeamId };
}

function resolveTeamId(
  rawName: string,
  nameToTeamId: Map<string, string>,
  aliasToTeamId: Map<string, string>
): string | null {
  const normalized = normalizeTeamName(rawName);
  return nameToTeamId.get(normalized) ?? aliasToTeamId.get(normalized) ?? null;
}

async function commitPairings(
  competitionId: string,
  roundId: string,
  pairings: ParsedPairing[],
  meetingNumberToId: Map<number, string>,
  nameToTeamId: Map<string, string>,
  aliasToTeamId: Map<string, string>
) {
  const supabase = createClient();

  const rows = pairings.map((p) => ({
    round_id: roundId,
    team_a_id: resolveTeamId(p.teamAName, nameToTeamId, aliasToTeamId)!,
    team_b_id: p.teamBName ? resolveTeamId(p.teamBName, nameToTeamId, aliasToTeamId) : null,
    meeting_id: meetingNumberToId.get(p.meetingNumber)!,
  }));

  await supabase.from("pairings").delete().eq("round_id", roundId);
  const { error } = await supabase.from("pairings").insert(rows);
  if (error) {
    throw new Error(`Αποτυχία εισαγωγής κλήρωσης: ${error.message}`);
  }
  await supabase.from("round_import_staging").delete().eq("round_id", roundId);

  // Η δημοσίευση της κλήρωσης ανοίγει αυτόματα το παράθυρο κατάθεσης σύνθεσης.
  // Ορίζεται ΜΟΝΟ την πρώτη φορά: μια διορθωτική επανεισαγωγή δεν το ξαναρχίζει.
  await supabase
    .from("rounds")
    .update({ pairing_published_at: new Date().toISOString() })
    .eq("id", roundId)
    .is("pairing_published_at", null);
}

export async function uploadPairingsFile(competitionId: string, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Επιλέξτε το αρχείο κλήρωσης (.xls/.xlsx) του Swiss-Manager.");
  }

  const buffer = await file.arrayBuffer();
  const { roundNumber, pairings } = parseSwissTeamPairings(buffer);

  const supabase = createClient();

  let { data: round } = await supabase
    .from("rounds")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("round_number", roundNumber)
    .maybeSingle();

  if (!round) {
    const { data: newRound, error } = await supabase
      .from("rounds")
      .insert({ competition_id: competitionId, round_number: roundNumber })
      .select("id")
      .single();
    if (error) throw new Error(`Αποτυχία δημιουργίας Γύρου ${roundNumber}: ${error.message}`);
    round = newRound;
  }

  const { data: meetings } = await supabase
    .from("meetings")
    .select("id, meeting_number")
    .eq("competition_id", competitionId);
  const meetingNumberToId = new Map<number, string>();
  for (const m of meetings ?? []) meetingNumberToId.set(m.meeting_number, m.id);

  const missingMeetings = [...new Set(pairings.map((p) => p.meetingNumber))].filter(
    (n) => !meetingNumberToId.has(n)
  );
  if (missingMeetings.length > 0) {
    throw new Error(
      `Το αρχείο αναφέρεται σε Συναντήσεις που δεν έχουν δημιουργηθεί ακόμα: ${missingMeetings.join(", ")}. Δημιουργήστε πρώτα αρκετές Συναντήσεις στη σελίδα "Συναντήσεις & QR".`
    );
  }

  const { nameToTeamId, aliasToTeamId } = await buildTeamNameMaps(competitionId);

  const unresolvedNames = new Set<string>();
  for (const p of pairings) {
    if (!resolveTeamId(p.teamAName, nameToTeamId, aliasToTeamId)) unresolvedNames.add(p.teamAName);
    if (p.teamBName && !resolveTeamId(p.teamBName, nameToTeamId, aliasToTeamId)) {
      unresolvedNames.add(p.teamBName);
    }
  }

  if (unresolvedNames.size > 0) {
    await supabase
      .from("round_import_staging")
      .upsert({ round_id: round.id, raw_pairings: pairings }, { onConflict: "round_id" });
    redirect(`/admin/${competitionId}/rounds/${round.id}/resolve`);
  }

  await commitPairings(competitionId, round.id, pairings, meetingNumberToId, nameToTeamId, aliasToTeamId);
  revalidatePath(`/admin/${competitionId}/rounds`);
}

/**
 * Καταθέτει τις χειροκίνητες αντιστοιχίσεις ονομάτων → ομάδων. Αποθηκεύονται
 * ΜΟΝΙΜΑ σε team_name_aliases (ανά διοργάνωση) — δεν ξαναρωτάει ποτέ για το
 * ίδιο όνομα σε επόμενο γύρο της ίδιας διοργάνωσης.
 */
export async function resolveTeamMapping(competitionId: string, roundId: string, formData: FormData) {
  const supabase = createClient();

  const { data: staging } = await supabase
    .from("round_import_staging")
    .select("raw_pairings")
    .eq("round_id", roundId)
    .maybeSingle<{ raw_pairings: ParsedPairing[] }>();

  if (!staging) {
    throw new Error("Δεν βρέθηκαν εκκρεμή δεδομένα εισαγωγής για αυτόν τον γύρο.");
  }

  const newAliases: { competition_id: string; excel_name: string; team_id: string }[] = [];
  for (let i = 0; ; i++) {
    const name = formData.get(`names[${i}]`);
    if (name == null) break;
    const teamId = String(formData.get(`teams[${i}]`) ?? "");
    if (!teamId) {
      throw new Error(`Δεν επιλέχθηκε ομάδα για "${name}".`);
    }
    newAliases.push({
      competition_id: competitionId,
      excel_name: normalizeTeamName(String(name)),
      team_id: teamId,
    });
  }

  if (newAliases.length > 0) {
    const { error } = await supabase
      .from("team_name_aliases")
      .upsert(newAliases, { onConflict: "competition_id,excel_name" });
    if (error) throw new Error(`Αποτυχία αποθήκευσης αντιστοιχίας: ${error.message}`);
  }

  const { data: meetings } = await supabase
    .from("meetings")
    .select("id, meeting_number")
    .eq("competition_id", competitionId);
  const meetingNumberToId = new Map<number, string>();
  for (const m of meetings ?? []) meetingNumberToId.set(m.meeting_number, m.id);

  const { nameToTeamId, aliasToTeamId } = await buildTeamNameMaps(competitionId);

  await commitPairings(
    competitionId,
    roundId,
    staging.raw_pairings,
    meetingNumberToId,
    nameToTeamId,
    aliasToTeamId
  );

  revalidatePath(`/admin/${competitionId}/rounds`);
  redirect(`/admin/${competitionId}/rounds`);
}

/**
 * Χειροκίνητη παράταση του παραθύρου κατάθεσης σύνθεσης για μία ομάδα
 * (υπεύθυνος κληρώσεων / admin). Η παράταση μετράει από ΤΩΡΑ.
 *  - Αν η ομάδα δεν έχει υποβάλει: ανοίγει/παρατείνεται το παράθυρο.
 *  - Αν είχε ήδη εφαρμοστεί η εφεδρική σύνθεση (δεν υπέβαλε εγκαίρως): ξανανοίγει,
 *    ώστε ο αρχηγός να υποβάλει κανονικά.
 *  - Αν η ομάδα έχει ΥΠΟΒΑΛΕΙ σύνθεση: δεν επιτρέπεται (μόλις υποβληθεί δεν αλλάζει).
 */
export async function extendSubmissionWindow(
  competitionId: string,
  roundId: string,
  teamId: string,
  formData: FormData
) {
  const supabase = createClient();
  const minutes = Number(formData.get("minutes"));
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 120) {
    throw new Error("Η παράταση πρέπει να είναι από 1 έως 120 λεπτά.");
  }
  const until = new Date(Date.now() + minutes * 60_000).toISOString();

  const { data: comp } = await supabase
    .from("round_compositions")
    .select("id, status")
    .eq("round_id", roundId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (comp && (comp.status === "submitted" || comp.status === "locked")) {
    throw new Error("Η ομάδα έχει ήδη υποβάλει σύνθεση, δεν επιτρέπεται παράταση.");
  }

  if (!comp) {
    const { error } = await supabase
      .from("round_compositions")
      .insert({ round_id: roundId, team_id: teamId, status: "open", extended_until: until });
    if (error) throw new Error(`Αποτυχία παράτασης: ${error.message}`);
  } else {
    if (comp.status === "used_default") {
      await supabase.from("board_assignments").delete().eq("round_composition_id", comp.id);
    }
    const { error } = await supabase
      .from("round_compositions")
      .update({ status: "open", submitted_at: null, submitted_by: null, extended_until: until })
      .eq("id", comp.id);
    if (error) throw new Error(`Αποτυχία παράτασης: ${error.message}`);
  }

  revalidatePath(`/admin/${competitionId}/rounds`);
}
