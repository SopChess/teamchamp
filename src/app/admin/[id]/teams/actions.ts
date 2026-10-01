"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveClubAndNumber } from "@/lib/teams/resolveClub";
import { type AudienceType } from "@/lib/teams/teams";
import { isEntryFeeStatus } from "@/lib/attendance/attendance";
import { findDirectoryRowById } from "@/lib/players/server";
import { toPlayerFields, isGender, type Gender } from "@/lib/players/directory";
import { cleanName } from "@/lib/transliterate";
import { addAthleteToTeam, type AddAthleteResult } from "@/app/captain/[token]/actions";
import { sendTeamUpdatedEmail } from "@/lib/email";

const CERTIFICATE_BUCKET = "attendance-certificates";

/**
 * Επεξεργασία ομάδας από τον admin/υπεύθυνο πρωταθλήματος: σύλλογος/σχολείο
 * και κλείδωμα σύνθεσης. Η ΔΗΜΙΟΥΡΓΙΑ ομάδας γίνεται ΜΟΝΟ από τον ίδιο τον
 * υπεύθυνο ομάδας, μέσω της δημόσιας φόρμας εγγραφής (επιβεβαιωμένο) — εδώ
 * μόνο διόρθωση στοιχείων μιας ήδη δηλωμένης ομάδας.
 */
/**
 * Διόρθωση της επωνυμίας συλλόγου/σχολείου απευθείας στο κείμενο (επιβεβαιωμένο:
 * αντικαθιστά το παλιό dropdown επιλογής άλλου συλλόγου — σπάνια, μικρή
 * διόρθωση λάθους πληκτρολόγησης, όχι «μετακόμιση» σε άλλη εγγραφή). Στέλνει
 * επίσης ειδοποίηση στον υπεύθυνο (best-effort — δεν μπλοκάρει την αποθήκευση).
 */
export async function updateTeamClubName(competitionId: string, teamId: string, formData: FormData) {
  const supabase = createClient();
  const name = String(formData.get("club_name") ?? "").trim();
  if (!name) throw new Error("Η επωνυμία δεν μπορεί να είναι κενή.");

  const { data: team } = await supabase.from("teams").select("club_or_school_id").eq("id", teamId).maybeSingle();
  if (!team) throw new Error("Η ομάδα δεν βρέθηκε.");

  const { error } = await supabase.from("clubs_schools").update({ name }).eq("id", team.club_or_school_id);
  if (error) throw new Error(`Αποτυχία αποθήκευσης: ${error.message}`);

  const { data: captain } = await supabase.from("captains").select("email").eq("team_id", teamId).maybeSingle();
  if (captain?.email) {
    try {
      await sendTeamUpdatedEmail(captain.email, name);
    } catch (e) {
      console.error("Αποστολή ειδοποίησης αρχηγού απέτυχε:", e);
    }
  }

  revalidatePath(`/admin/${competitionId}/teams`);
}

export async function updateTeam(competitionId: string, teamId: string, formData: FormData) {
  const supabase = createClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("audience_type, max_teams_per_club")
    .eq("id", competitionId)
    .single();
  const audienceType = (competition?.audience_type as AudienceType) ?? "eso_club";
  const maxTeamsPerClub = competition?.max_teams_per_club ?? 1;

  const clubOrSchoolId = String(formData.get("club_or_school_id") ?? "");
  const rosterLocked = formData.get("roster_locked") === "on";

  const { clubOrSchoolId: resolvedClubId, teamNumber } = await resolveClubAndNumber(
    supabase, competitionId, audienceType, maxTeamsPerClub, clubOrSchoolId, "", undefined, teamId
  );

  const { error } = await supabase
    .from("teams")
    .update({ club_or_school_id: resolvedClubId, team_number: teamNumber, roster_locked: rosterLocked })
    .eq("id", teamId);

  if (error) {
    throw new Error(`Αποτυχία ενημέρωσης: ${error.message}`);
  }

  revalidatePath(`/admin/${competitionId}/teams`);
}

/**
 * Διαγραφή ομάδας — επιτρέπεται ΜΟΝΟ πριν κληρωθεί έστω και σε έναν γύρο
 * (επιβεβαιωμένο: μόλις κληρωθεί, μένει όπως έχει). Οι roster_entries και ο
 * αρχηγός διαγράφονται αυτόματα (cascade)· τα pairings ΔΕΝ διαγράφονται ποτέ —
 * αν υπάρχουν, η βάση αρνείται τη διαγραφή και εμφανίζεται σαφές μήνυμα.
 */
async function deleteTeamCore(teamId: string): Promise<void> {
  const supabase = createClient();

  const { data: pairing } = await supabase
    .from("pairings")
    .select("id")
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
    .limit(1)
    .maybeSingle();

  if (pairing) {
    throw new Error("Η ομάδα έχει ήδη κληρωθεί σε γύρο και δεν μπορεί να διαγραφεί.");
  }

  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  if (error) {
    if (error.code === "23503") {
      throw new Error("Η ομάδα έχει ήδη κληρωθεί σε γύρο και δεν μπορεί να διαγραφεί.");
    }
    throw new Error(`Αποτυχία διαγραφής: ${error.message}`);
  }
}

export async function deleteTeam(competitionId: string, teamId: string) {
  await deleteTeamCore(teamId);
  revalidatePath(`/admin/${competitionId}/teams`);
}

/** Ίδια διαγραφή, αλλά από τη σελίδα σύνθεσης ομάδας — μετά την επιτυχία γυρίζει στη λίστα Ομάδων. */
export async function adminDeleteTeamFromDetail(competitionId: string, teamId: string): Promise<void> {
  await deleteTeamCore(teamId);
  revalidatePath(`/admin/${competitionId}/teams`);
  redirect(`/admin/${competitionId}/teams`);
}

/** Μόνο ο διαχειριστής/υπεύθυνος πρωταθλήματος ορίζει την κατάσταση παραβόλου — ο αρχηγός δηλώνει μόνο τον τρόπο πληρωμής. */
export async function setEntryFeeStatus(competitionId: string, teamId: string, status: string) {
  if (!isEntryFeeStatus(status)) throw new Error("Μη έγκυρη κατάσταση παραβόλου.");
  const supabase = createClient();
  const { error } = await supabase.from("teams").update({ entry_fee_status: status }).eq("id", teamId);
  if (error) throw new Error(`Αποτυχία ενημέρωσης: ${error.message}`);
  revalidatePath(`/admin/${competitionId}/teams`);
}

/** Προσωρινό link λήψης της βεβαίωσης φοίτησης, για τον admin/υπεύθυνο πρωταθλήματος. */
export async function getCertificateUrlForAdmin(teamId: string): Promise<string | null> {
  const supabase = createClient();
  const { data: row } = await supabase
    .from("teams")
    .select("attendance_certificate_path")
    .eq("id", teamId)
    .maybeSingle();
  if (!row?.attendance_certificate_path) return null;
  const { data } = await supabase.storage.from(CERTIFICATE_BUCKET).createSignedUrl(row.attendance_certificate_path, 600);
  return data?.signedUrl ?? null;
}

/**
 * Επεξεργασία σύνθεσης ομάδας από τον admin/υπεύθυνο πρωταθλήματος (επιβεβαιωμένο:
 * "διορθώσεις σε κάθε ομάδα και στο σύνολο"). Σε αντίθεση με το Portal Αρχηγού, ΔΕΝ
 * ελέγχεται προθεσμία εγγραφών ούτε roster_locked — ο admin μπορεί πάντα να διορθώσει,
 * ακόμα και μετά τη λήξη. Το όριο μεγέθους ρόστερ και ο έλεγχος διπλής εγγραφής
 * παραμένουν (το ίδιο addAthleteToTeam με το Portal — καμία ξεχωριστή υλοποίηση).
 */
export async function adminAddPlayerToRoster(competitionId: string, teamId: string, formData: FormData): Promise<void> {
  const firstName = cleanName(String(formData.get("first_name") ?? ""));
  const lastName = cleanName(String(formData.get("last_name") ?? ""));
  const gender = String(formData.get("gender") ?? "");
  const birthDate = String(formData.get("birth_date") ?? "") || null;
  const num = (name: string) => {
    const raw = String(formData.get(name) ?? "").trim();
    const n = Number(raw);
    return raw !== "" && Number.isFinite(n) ? n : null;
  };
  if (!firstName || !lastName) throw new Error("Όνομα και επώνυμο (λατινικά) είναι υποχρεωτικά.");
  if (!isGender(gender)) throw new Error("Επιλέξτε το φύλο του αθλητή (Άνδρας ή Γυναίκα).");

  const result = await addAthleteToTeam(
    { id: teamId, competition_id: competitionId },
    {
      first_name: firstName, last_name: lastName, birth_date: birthDate, gender,
      rating_national: num("rating_national"), rating_fide: num("rating_fide"),
      national_id: String(formData.get("national_id") ?? "").trim() || null,
      fide_id: String(formData.get("fide_id") ?? "").trim() || null,
      directory_id: null,
    }
  );
  if (!result.ok) throw new Error(result.message);
  revalidatePath(`/admin/${competitionId}/teams/${teamId}`);
}

export async function adminAddDirectoryPlayerToRoster(
  competitionId: string, teamId: string, directoryId: string, gender: Gender | string
): Promise<AddAthleteResult> {
  if (!isGender(gender)) return { ok: false, message: "Επιλέξτε το φύλο του αθλητή (Άνδρας ή Γυναίκα)." };
  const supabase = createClient();
  const row = await findDirectoryRowById(supabase, directoryId);
  if (!row) return { ok: false, message: "Ο αθλητής δεν βρέθηκε στον κατάλογο." };
  const result = await addAthleteToTeam({ id: teamId, competition_id: competitionId }, toPlayerFields(row, gender));
  if (result.ok) revalidatePath(`/admin/${competitionId}/teams/${teamId}`);
  return result;
}

export async function adminRemoveRosterEntry(competitionId: string, teamId: string, entryId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("roster_entries").delete().eq("id", entryId).eq("team_id", teamId);
  if (error) throw new Error(`Αποτυχία αφαίρεσης: ${error.message}`);
  revalidatePath(`/admin/${competitionId}/teams/${teamId}`);
}

export async function adminMoveRosterEntry(competitionId: string, teamId: string, entryId: string, direction: "up" | "down"): Promise<void> {
  const supabase = createClient();
  const { data: entries } = await supabase.from("roster_entries").select("id, declared_order").eq("team_id", teamId).order("declared_order", { ascending: true });
  if (!entries) return;
  const index = entries.findIndex((e) => e.id === entryId);
  if (index < 0) return;
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= entries.length) return;

  const a = entries[index]!, b = entries[swapWith]!;
  await supabase.from("roster_entries").update({ declared_order: -1 }).eq("id", a.id); // αποφυγή σύγκρουσης unique(team_id, declared_order)
  await supabase.from("roster_entries").update({ declared_order: a.declared_order }).eq("id", b.id);
  await supabase.from("roster_entries").update({ declared_order: b.declared_order }).eq("id", a.id);
  revalidatePath(`/admin/${competitionId}/teams/${teamId}`);
}

/** Στοιχεία αρχηγού — επεξεργασία από τον admin/υπεύθυνο πρωταθλήματος. */
export async function adminSaveCaptainInfo(competitionId: string, teamId: string, formData: FormData): Promise<void> {
  const supabase = createClient();
  const firstName = cleanName(String(formData.get("first_name") ?? ""));
  const lastName = cleanName(String(formData.get("last_name") ?? ""));
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!firstName || !lastName) throw new Error("Όνομα και επώνυμο αρχηγού (λατινικά) είναι υποχρεωτικά.");

  const { data: existing } = await supabase.from("captains").select("id").eq("team_id", teamId).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("captains").update({ first_name: firstName, last_name: lastName, phone, email }).eq("id", existing.id);
    if (error) throw new Error(`Αποτυχία αποθήκευσης: ${error.message}`);
  } else {
    const { error } = await supabase.from("captains").insert({ team_id: teamId, first_name: firstName, last_name: lastName, phone, email });
    if (error) throw new Error(`Αποτυχία αποθήκευσης: ${error.message}`);
  }
  revalidatePath(`/admin/${competitionId}/teams/${teamId}`);
}
