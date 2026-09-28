"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RosterRules, BoardAssignment } from "@/lib/rosterRules/types";
import { validateComposition } from "@/lib/rosterRules/engine";
import { submissionWindow } from "@/lib/rounds/window";
import { loadRoster, loadRules } from "@/lib/rounds/server";
import { cleanName } from "@/lib/transliterate";
import {
  isGender, toHit, toPlayerFields, type DirectoryHit, type Gender, type PlayerFields,
} from "@/lib/players/directory";
import {
  findAthleteInCompetition, findDirectoryRowById, findDirectoryRowByNumber,
  nextDeclaredOrder, searchDirectoryRows,
} from "@/lib/players/server";

/**
 * Κάθε action εδώ επαληθεύει το token ΞΑΝΑ από την αρχή — δεν εμπιστευόμαστε
 * καμία κατάσταση session, γιατί ο αρχηγός αυθεντικοποιείται αποκλειστικά
 * μέσω αυτού του token-in-URL (§2 του document), όχι μέσω Supabase Auth.
 */
async function getTeamByToken(token: string) {
  const supabase = createClient();
  const { data: team, error } = await supabase
    .from("teams")
    .select("id, competition_id, status, roster_lock_deadline, roster_locked")
    .eq("captain_access_token", token)
    .maybeSingle();

  if (error || !team) {
    throw new Error("Άκυρο ή ληγμένο link.");
  }
  return team;
}

function assertRosterEditable(team: { roster_locked: boolean; roster_lock_deadline: string | null }) {
  if (team.roster_locked) {
    throw new Error("Η βασική σύνθεση είναι ήδη κλειδωμένη.");
  }
  if (team.roster_lock_deadline && new Date(team.roster_lock_deadline) < new Date()) {
    throw new Error("Η προθεσμία κατάθεσης βασικής σύνθεσης έχει λήξει.");
  }
}

export type AddAthleteResult = { ok: true } | { ok: false; message: string };

/**
 * Κοινός κώδικας προσθήκης αθλητή στη βασική σύνθεση — και για τη χειροκίνητη
 * καταχώρηση και για την επιλογή από τον κατάλογο. Ελέγχει: όριο αθλητών,
 * ΔΙΠΛΗ ΕΓΓΡΑΦΗ σε όλη τη διοργάνωση (όχι μόνο στη δική σας ομάδα), και υπολογίζει
 * σωστά την επόμενη θέση.
 */
async function addAthleteToTeam(
  team: { id: string; competition_id: string },
  fields: Omit<PlayerFields, "directory_id"> & { directory_id: string | null }
): Promise<AddAthleteResult> {
  const supabase = createClient();

  const { data: rules } = await supabase
    .from("roster_rules")
    .select("roster_size")
    .eq("competition_id", team.competition_id)
    .maybeSingle<Pick<RosterRules, "roster_size">>();

  const { count } = await supabase
    .from("roster_entries")
    .select("id", { count: "exact", head: true })
    .eq("team_id", team.id);

  if (rules?.roster_size != null && (count ?? 0) >= rules.roster_size) {
    return { ok: false, message: `Η βασική σύνθεση επιτρέπει το πολύ ${rules.roster_size} αθλητές.` };
  }

  const duplicate = await findAthleteInCompetition(supabase, team.competition_id, fields);
  if (duplicate) {
    return {
      ok: false,
      message:
        duplicate.teamId === team.id
          ? "Ο αθλητής είναι ήδη στη βασική σύνθεση της ομάδας σας."
          : "Ο αθλητής είναι ήδη δηλωμένος σε άλλη ομάδα της διοργάνωσης.",
    };
  }

  // Ίδιος αθλητής του καταλόγου από προηγούμενη διοργάνωση: επαναχρησιμοποιείται η εγγραφή του.
  let playerId: string | undefined;
  let createdHere = false;
  if (fields.directory_id) {
    const { data: existing } = await supabase
      .from("players")
      .select("id")
      .eq("directory_id", fields.directory_id)
      .limit(1)
      .maybeSingle();
    if (existing) {
      playerId = existing.id;
      await supabase.from("players").update(fields).eq("id", playerId);
    }
  }
  if (!playerId) {
    const { data: created, error } = await supabase.from("players").insert(fields).select("id").single();
    if (error || !created) {
      return { ok: false, message: `Αποτυχία καταχώρησης αθλητή: ${error?.message ?? "άγνωστο σφάλμα"}` };
    }
    playerId = created.id;
    createdHere = true;
  }

  const order = await nextDeclaredOrder(supabase, team.id);
  const { error: entryError } = await supabase.from("roster_entries").insert({
    team_id: team.id,
    player_id: playerId,
    declared_order: order,
  });
  if (entryError) {
    if (createdHere) await supabase.from("players").delete().eq("id", playerId);
    return { ok: false, message: `Αποτυχία προσθήκης στη σύνθεση: ${entryError.message}` };
  }

  return { ok: true };
}

/** Χειροκίνητη προσθήκη (όταν ο αθλητής δεν βρίσκεται στον κατάλογο). Το φύλο είναι υποχρεωτικό. */
export async function addPlayerToRoster(token: string, formData: FormData) {
  const team = await getTeamByToken(token);
  assertRosterEditable(team);

  const firstName = cleanName(String(formData.get("first_name") ?? ""));
  const lastName = cleanName(String(formData.get("last_name") ?? ""));
  const gender = String(formData.get("gender") ?? "");
  const birthDate = String(formData.get("birth_date") ?? "") || null;
  const numberOrNull = (name: string) => {
    const raw = String(formData.get(name) ?? "").trim();
    const n = Number(raw);
    return raw !== "" && Number.isFinite(n) ? n : null;
  };

  if (!firstName || !lastName) {
    throw new Error("Όνομα και επώνυμο (λατινικά) είναι υποχρεωτικά.");
  }
  if (!isGender(gender)) {
    throw new Error("Επιλέξτε το φύλο του αθλητή (Άνδρας ή Γυναίκα).");
  }

  const result = await addAthleteToTeam(team, {
    first_name: firstName,
    last_name: lastName,
    birth_date: birthDate,
    gender,
    rating_national: numberOrNull("rating_national"),
    rating_fide: numberOrNull("rating_fide"),
    national_id: String(formData.get("national_id") ?? "").trim() || null,
    fide_id: String(formData.get("fide_id") ?? "").trim() || null,
    directory_id: null,
  });
  if (!result.ok) throw new Error(result.message);

  revalidatePath(`/captain/${token}`);
}

/**
 * Αναζήτηση στον κατάλογο. Απαιτεί έγκυρο link αρχηγού, ώστε ο κατάλογος (που έχει
 * στοιχεία ανηλίκων) να μην είναι δημόσια προσβάσιμος. Επιστρέφει μόνο ό,τι χρειάζεται
 * για την επιλογή: όχι πλήρη γενέθλια.
 */
export async function searchDirectory(token: string, epitheto: string, onoma: string): Promise<DirectoryHit[]> {
  try {
    await getTeamByToken(token);
  } catch {
    return [];
  }
  const rows = await searchDirectoryRows(createClient(), epitheto, onoma);
  return rows.map(toHit);
}

export async function searchDirectoryByNumber(token: string, number: string): Promise<DirectoryHit | null> {
  try {
    await getTeamByToken(token);
  } catch {
    return null;
  }
  const row = await findDirectoryRowByNumber(createClient(), number);
  return row ? toHit(row) : null;
}

/**
 * Προσθήκη αθλητή που επιλέχθηκε από τον κατάλογο. Τα στοιχεία (όνομα, γενέθλια,
 * βαθμοί) διαβάζονται ΞΑΝΑ στον server από τον κατάλογο — ο browser στέλνει μόνο τον
 * κωδικό και το φύλο. Το φύλο είναι υποχρεωτικό και το επιλέγει ο υπεύθυνος.
 */
export async function addDirectoryPlayerToRoster(
  token: string,
  directoryId: string,
  gender: Gender | string
): Promise<AddAthleteResult> {
  try {
    const team = await getTeamByToken(token);
    assertRosterEditable(team);
    if (!isGender(gender)) {
      return { ok: false, message: "Επιλέξτε το φύλο του αθλητή (Άνδρας ή Γυναίκα)." };
    }
    const row = await findDirectoryRowById(createClient(), directoryId);
    if (!row) return { ok: false, message: "Ο αθλητής δεν βρέθηκε στον κατάλογο." };

    const result = await addAthleteToTeam(team, toPlayerFields(row, gender));
    if (result.ok) revalidatePath(`/captain/${token}`);
    return result;
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Άγνωστο σφάλμα." };
  }
}

export async function removeRosterEntry(token: string, entryId: string) {
  const supabase = createClient();
  const team = await getTeamByToken(token);
  assertRosterEditable(team);

  const { error } = await supabase
    .from("roster_entries")
    .delete()
    .eq("id", entryId)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(`Αποτυχία αφαίρεσης: ${error.message}`);
  }

  revalidatePath(`/captain/${token}`);
}

export async function moveRosterEntry(token: string, entryId: string, direction: "up" | "down") {
  const supabase = createClient();
  const team = await getTeamByToken(token);
  assertRosterEditable(team);

  const { data: entries } = await supabase
    .from("roster_entries")
    .select("id, declared_order")
    .eq("team_id", team.id)
    .order("declared_order", { ascending: true });

  if (!entries) return;

  const index = entries.findIndex((e) => e.id === entryId);
  const swapWith = direction === "up" ? index - 1 : index + 1;

  if (index === -1 || swapWith < 0 || swapWith >= entries.length) {
    return; // already at the edge — no-op
  }

  const a = entries[index];
  const b = entries[swapWith];

  // Swap via a temporary order value to avoid the unique(team_id, declared_order) conflict.
  await supabase.from("roster_entries").update({ declared_order: -1 }).eq("id", a.id);
  await supabase.from("roster_entries").update({ declared_order: a.declared_order }).eq("id", b.id);
  await supabase.from("roster_entries").update({ declared_order: b.declared_order }).eq("id", a.id);

  revalidatePath(`/captain/${token}`);
}

export async function saveCaptainInfo(token: string, formData: FormData) {
  const supabase = createClient();
  const team = await getTeamByToken(token);

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!firstName || !lastName) {
    throw new Error("Όνομα και επώνυμο αρχηγού (λατινικά) είναι υποχρεωτικά.");
  }

  const { data: existing } = await supabase
    .from("captains")
    .select("id")
    .eq("team_id", team.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("captains")
      .update({ first_name: firstName, last_name: lastName, phone })
      .eq("id", existing.id);
    if (error) throw new Error(`Αποτυχία αποθήκευσης αρχηγού: ${error.message}`);
  } else {
    const { error } = await supabase.from("captains").insert({
      team_id: team.id,
      first_name: firstName,
      last_name: lastName,
      phone,
    });
    if (error) throw new Error(`Αποτυχία αποθήκευσης αρχηγού: ${error.message}`);
  }

  revalidatePath(`/captain/${token}`);
}

export async function confirmRoster(token: string) {
  const supabase = createClient();
  const team = await getTeamByToken(token);
  assertRosterEditable(team);

  const { count } = await supabase
    .from("roster_entries")
    .select("id", { count: "exact", head: true })
    .eq("team_id", team.id);

  if (!count) {
    throw new Error("Προσθέστε τουλάχιστον έναν αθλητή πριν την επιβεβαίωση.");
  }

  const { error } = await supabase
    .from("teams")
    .update({ status: "confirmed", roster_locked: true })
    .eq("id", team.id);

  if (error) {
    throw new Error(`Αποτυχία επιβεβαίωσης: ${error.message}`);
  }

  revalidatePath(`/captain/${token}`);
}

export type SubmitCompositionResult = { ok: true } | { ok: false; message: string };

/**
 * Υποβολή σύνθεσης γύρου από τον αρχηγό (Στάδιο 2). Όλοι οι έλεγχοι γίνονται
 * ΞΑΝΑ στον server (δεν εμπιστευόμαστε τον browser): έγκυρο token, ο γύρος έχει
 * δημοσιευτεί και η ομάδα παίζει σε αυτόν, το παράθυρο είναι ακόμα ανοιχτό,
 * δεν έχει ήδη υποβληθεί σύνθεση (μόλις υποβληθεί, δεν αλλάζει), και η σύνθεση
 * πληροί τους κανόνες της διοργάνωσης.
 *
 * Επιστρέφει αποτέλεσμα αντί να πετάει σφάλμα: στην παραγωγή τα μηνύματα
 * σφαλμάτων των server actions κρύβονται, και ο αρχηγός πρέπει να βλέπει τι
 * ακριβώς χρειάζεται διόρθωση.
 */
export async function submitRoundComposition(
  token: string,
  roundId: string,
  assignmentsJson: string
): Promise<SubmitCompositionResult> {
  try {
    const supabase = createClient();
    const team = await getTeamByToken(token);

    const { data: round } = await supabase
      .from("rounds")
      .select("id, competition_id, round_number, pairing_published_at, submission_window_minutes")
      .eq("id", roundId)
      .maybeSingle();

    if (!round || round.competition_id !== team.competition_id || !round.pairing_published_at) {
      return { ok: false, message: "Ο γύρος δεν είναι διαθέσιμος για κατάθεση σύνθεσης." };
    }

    const { data: pairings } = await supabase
      .from("pairings")
      .select("team_a_id, team_b_id")
      .eq("round_id", roundId);
    const plays = (pairings ?? []).some(
      (p) => p.team_b_id && (p.team_a_id === team.id || p.team_b_id === team.id)
    );
    if (!plays) {
      return { ok: false, message: "Η ομάδα σας δεν αγωνίζεται σε αυτόν τον γύρο." };
    }

    const { data: existing } = await supabase
      .from("round_compositions")
      .select("id, status, extended_until")
      .eq("round_id", roundId)
      .eq("team_id", team.id)
      .maybeSingle();

    if (existing && existing.status !== "open") {
      return { ok: false, message: "Η σύνθεση για αυτόν τον γύρο έχει ήδη υποβληθεί και δεν αλλάζει." };
    }

    const win = submissionWindow({
      publishedAt: round.pairing_published_at,
      windowMinutes: round.submission_window_minutes,
      extendedUntil: existing?.extended_until ?? null,
    });
    if (!win.open) {
      return { ok: false, message: "Το χρονικό παράθυρο κατάθεσης σύνθεσης έχει λήξει." };
    }

    let assignments: BoardAssignment[];
    try {
      const parsed = JSON.parse(assignmentsJson);
      if (!Array.isArray(parsed)) throw new Error("not array");
      assignments = parsed.map((a: { board: unknown; player_id: unknown }) => ({
        board: Number(a.board),
        player_id: String(a.player_id),
      }));
      if (assignments.some((a) => !Number.isInteger(a.board) || a.board < 1)) throw new Error("bad board");
    } catch {
      return { ok: false, message: "Η σύνθεση δεν είναι έγκυρη. Παρακαλούμε δοκιμάστε ξανά." };
    }

    const rules = await loadRules(supabase, team.competition_id);
    if (!rules) {
      return { ok: false, message: "Δεν έχουν οριστεί ακόμα κανόνες σύνθεσης για τη διοργάνωση." };
    }
    const { roster, players } = await loadRoster(supabase, team.id);

    const check = validateComposition(rules, roster, players, assignments);
    if (!check.valid) {
      return { ok: false, message: check.issues.map((i) => i.message).join(" ") };
    }

    let compositionId = existing?.id as string | undefined;
    const nowIso = new Date().toISOString();
    if (compositionId) {
      const { error } = await supabase
        .from("round_compositions")
        .update({ status: "submitted", submitted_at: nowIso, submitted_by: "captain" })
        .eq("id", compositionId);
      if (error) return { ok: false, message: `Αποτυχία αποθήκευσης: ${error.message}` };
    } else {
      const { data: created, error } = await supabase
        .from("round_compositions")
        .insert({
          round_id: roundId,
          team_id: team.id,
          status: "submitted",
          submitted_at: nowIso,
          submitted_by: "captain",
        })
        .select("id")
        .single();
      if (error || !created) {
        return { ok: false, message: `Αποτυχία αποθήκευσης: ${error?.message ?? "άγνωστο σφάλμα"}` };
      }
      compositionId = created.id;
    }

    await supabase.from("board_assignments").delete().eq("round_composition_id", compositionId);
    const { error: assignError } = await supabase.from("board_assignments").insert(
      assignments.map((a) => ({
        round_composition_id: compositionId,
        board_number: a.board,
        player_id: a.player_id,
      }))
    );
    if (assignError) {
      return { ok: false, message: `Αποτυχία αποθήκευσης σκακιερών: ${assignError.message}` };
    }

    revalidatePath(`/captain/${token}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Άγνωστο σφάλμα." };
  }
}
