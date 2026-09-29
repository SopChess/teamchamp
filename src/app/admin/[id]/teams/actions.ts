"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  allowsFreeEntry,
  clubTypeFor,
  nextTeamNumber,
  type AudienceType,
} from "@/lib/teams/teams";
import { isEntryFeeStatus } from "@/lib/attendance/attendance";

const CERTIFICATE_BUCKET = "attendance-certificates";

/**
 * Δημιουργία ομάδας. Η συμπεριφορά εξαρτάται από το audience_type της
 * διοργάνωσης (επιβεβαιωμένο):
 *  - school / eso_club: ΜΟΝΟ επιλογή από υπάρχοντα σύλλογο/σχολείο — καμία
 *    ελεύθερη επωνυμία. Για eso_club επιτρέπονται πολλαπλές ομάδες από τον
 *    ίδιο σύλλογο μέχρι το όριο της διοργάνωσης (max_teams_per_club),
 *    εμφανίζονται ως "Όνομα", "Όνομα-2", "Όνομα-3"...
 *  - free_team: επιτρέπεται είτε επιλογή υπάρχοντος, είτε νέο όνομα επιτόπου
 *    (δημιουργείται αυτόματα η εγγραφή στον κατάλογο συλλόγων/σχολείων).
 */
export async function createTeam(competitionId: string, formData: FormData) {
  const supabase = createClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("audience_type, max_teams_per_club")
    .eq("id", competitionId)
    .single();
  const audienceType = (competition?.audience_type as AudienceType) ?? "eso_club";
  const maxTeamsPerClub = competition?.max_teams_per_club ?? 1;

  let clubOrSchoolId = String(formData.get("club_or_school_id") ?? "");
  const newName = String(formData.get("new_team_name") ?? "").trim().toUpperCase();
  const rosterLockDeadline = String(formData.get("roster_lock_deadline") ?? "") || null;

  if (!clubOrSchoolId && newName) {
    if (!allowsFreeEntry(audienceType)) {
      throw new Error("Σε αυτή τη διοργάνωση δεν επιτρέπεται ελεύθερη επωνυμία — επιλέξτε από τη λίστα.");
    }
    const { data: created, error: createError } = await supabase
      .from("clubs_schools")
      .insert({ name: newName, type: clubTypeFor(audienceType) })
      .select("id")
      .single();
    if (createError) {
      if (createError.code === "23505") {
        throw new Error(`Υπάρχει ήδη ομάδα/σύλλογος με το όνομα «${newName}» — επιλέξτε τον από τη λίστα.`);
      }
      throw new Error(`Αποτυχία δημιουργίας ομάδας: ${createError.message}`);
    }
    clubOrSchoolId = created.id;
  }

  if (!clubOrSchoolId) {
    throw new Error("Επιλέξτε σύλλογο/σχολείο, ή γράψτε νέο όνομα ομάδας.");
  }

  const { data: existingTeams } = await supabase
    .from("teams")
    .select("team_number")
    .eq("competition_id", competitionId)
    .eq("club_or_school_id", clubOrSchoolId);

  const existingNumbers = (existingTeams ?? []).map((t) => t.team_number as number);
  if (existingNumbers.length > 0 && audienceType !== "eso_club") {
    throw new Error("Αυτός ο σύλλογος/σχολείο έχει ήδη ομάδα σε αυτή τη διοργάνωση.");
  }
  const teamNumber = nextTeamNumber(existingNumbers, audienceType === "eso_club" ? maxTeamsPerClub : 1);
  if (teamNumber === null) {
    throw new Error(
      `Έχει φτάσει το μέγιστο επιτρεπόμενων ομάδων για αυτόν τον σύλλογο σε αυτή τη διοργάνωση (${maxTeamsPerClub}).`
    );
  }

  const captainAccessToken = randomBytes(16).toString("hex");

  const { error } = await supabase.from("teams").insert({
    competition_id: competitionId,
    club_or_school_id: clubOrSchoolId,
    team_number: teamNumber,
    roster_lock_deadline: rosterLockDeadline,
    captain_access_token: captainAccessToken,
    status: "declared",
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("Αυτή η ομάδα υπάρχει ήδη σε αυτή τη διοργάνωση.");
    }
    throw new Error(`Αποτυχία δημιουργίας ομάδας: ${error.message}`);
  }

  revalidatePath(`/admin/${competitionId}/teams`);
}

/**
 * Διαγραφή ομάδας — επιτρέπεται ΜΟΝΟ πριν κληρωθεί έστω και σε έναν γύρο
 * (επιβεβαιωμένο: μόλις κληρωθεί, μένει όπως έχει). Οι roster_entries και ο
 * αρχηγός διαγράφονται αυτόματα (cascade)· τα pairings ΔΕΝ διαγράφονται ποτέ —
 * αν υπάρχουν, η βάση αρνείται τη διαγραφή και εμφανίζεται σαφές μήνυμα.
 */
export async function deleteTeam(competitionId: string, teamId: string) {
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

  revalidatePath(`/admin/${competitionId}/teams`);
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
