"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveClubAndNumber } from "@/lib/teams/resolveClub";
import { teamDisplayName, type AudienceType } from "@/lib/teams/teams";
import { registrationStatus } from "@/lib/competitions/registration";
import { findOrCreateCaptainAccount } from "@/lib/captain/account";
import { isValidPhone } from "@/lib/captain/identity";
import { isValidEmail, normalizeEmail } from "@/lib/accessRequest";
import { cleanName } from "@/lib/transliterate";
import { sendCaptainAccessEmail } from "@/lib/email";

/**
 * Δημόσια εγγραφή ομάδας από τον ίδιο τον υπεύθυνο (επιβεβαιωμένο). Συλλέγει
 * σύλλογο/σχολείο (ή ελεύθερη επωνυμία) και στοιχεία υπευθύνου· οι αθλητές
 * προστίθενται ΑΜΕΣΩΣ ΜΕΤΑ μέσα στο ίδιο το Portal Αρχηγού (ήδη πλήρες: αναζήτηση
 * στον κατάλογο, ζωντανός έλεγχος κανόνων, χειροκίνητη προσθήκη) — η εγγραφή
 * ΔΕΝ ξαναφτιάχνει αυτή τη λειτουργικότητα, απλά οδηγεί εκεί.
 *
 * Ταυτοποίηση υπευθύνου: email + τηλέφωνο ΜΑΖΙ (επιβεβαιωμένο). Αν ταιριάζουν
 * και τα δύο με ήδη υπάρχοντα λογαριασμό, η νέα ομάδα προστίθεται εκεί — το
 * ίδιο link θα δείχνει πλέον όλες τις ομάδες του.
 */
export async function registerTeam(competitionId: string, formData: FormData): Promise<void> {
  const supabase = createClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("audience_type, max_teams_per_club, registration_deadline")
    .eq("id", competitionId)
    .single();
  if (!competition) throw new Error("Η διοργάνωση δεν βρέθηκε.");
  if (registrationStatus(competition.registration_deadline) === "closed") {
    throw new Error("Οι εγγραφές για αυτή τη διοργάνωση έχουν κλείσει.");
  }
  const audienceType = (competition.audience_type as AudienceType) ?? "eso_club";
  const maxTeamsPerClub = competition.max_teams_per_club ?? 1;

  const clubOrSchoolId = String(formData.get("club_or_school_id") ?? "");
  const newName = String(formData.get("new_team_name") ?? "");

  const firstName = cleanName(String(formData.get("first_name") ?? ""));
  const lastName = cleanName(String(formData.get("last_name") ?? ""));
  const phone = String(formData.get("phone") ?? "").trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));

  if (!firstName || !lastName) throw new Error("Όνομα και επώνυμο υπευθύνου (λατινικά) είναι υποχρεωτικά.");
  if (!isValidPhone(phone)) throw new Error("Το τηλέφωνο δεν είναι έγκυρο.");
  if (!isValidEmail(email)) throw new Error("Το email δεν είναι έγκυρο.");

  const { clubOrSchoolId: resolvedClubId, teamNumber } = await resolveClubAndNumber(
    supabase, competitionId, audienceType, maxTeamsPerClub, clubOrSchoolId, newName
  );

  const account = await findOrCreateCaptainAccount(supabase, email, phone);

  const { data: team, error } = await supabase
    .from("teams")
    .insert({
      competition_id: competitionId,
      club_or_school_id: resolvedClubId,
      team_number: teamNumber,
      captain_account_id: account.id,
      status: "declared",
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Αυτή η ομάδα υπάρχει ήδη σε αυτή τη διοργάνωση.");
    throw new Error(`Αποτυχία εγγραφής: ${error.message}`);
  }

  await supabase.from("captains").insert({ team_id: team.id, first_name: firstName, last_name: lastName, phone, email });

  const { data: club } = await supabase.from("clubs_schools").select("name").eq("id", resolvedClubId).maybeSingle();
  const displayName = teamDisplayName(club?.name ?? "η ομάδα σας", teamNumber);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://teamchamp.vercel.app";
  const portalPath = `/captain/${account.access_token}`;
  try {
    await sendCaptainAccessEmail(email, firstName, displayName, `${siteUrl}${portalPath}`);
  } catch (e) {
    console.error("Αποστολή email εγγραφής απέτυχε:", e); // η εγγραφή έχει ήδη σωθεί κανονικά
  }

  redirect(portalPath);
}
