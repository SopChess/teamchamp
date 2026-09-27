"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createTeam(competitionId: string, formData: FormData) {
  const supabase = createClient();

  const clubOrSchoolId = String(formData.get("club_or_school_id") ?? "");
  const rosterLockDeadline = String(formData.get("roster_lock_deadline") ?? "") || null;

  if (!clubOrSchoolId) {
    throw new Error("Επίλεξε σύλλογο/σχολείο.");
  }

  const captainAccessToken = randomBytes(16).toString("hex");

  const { error } = await supabase.from("teams").insert({
    competition_id: competitionId,
    club_or_school_id: clubOrSchoolId,
    roster_lock_deadline: rosterLockDeadline,
    captain_access_token: captainAccessToken,
    status: "declared",
  });

  if (error) {
    throw new Error(`Αποτυχία δημιουργίας ομάδας: ${error.message}`);
  }

  revalidatePath(`/admin/${competitionId}/teams`);
}
