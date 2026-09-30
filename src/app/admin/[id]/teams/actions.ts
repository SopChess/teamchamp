"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveClubAndNumber } from "@/lib/teams/resolveClub";
import { type AudienceType } from "@/lib/teams/teams";
import { isEntryFeeStatus } from "@/lib/attendance/attendance";

const CERTIFICATE_BUCKET = "attendance-certificates";

/**
 * Επεξεργασία ομάδας από τον admin/υπεύθυνο πρωταθλήματος: σύλλογος/σχολείο
 * και κλείδωμα σύνθεσης. Η ΔΗΜΙΟΥΡΓΙΑ ομάδας γίνεται ΜΟΝΟ από τον ίδιο τον
 * υπεύθυνο ομάδας, μέσω της δημόσιας φόρμας εγγραφής (επιβεβαιωμένο) — εδώ
 * μόνο διόρθωση στοιχείων μιας ήδη δηλωμένης ομάδας.
 */
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
