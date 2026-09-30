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
import { parsePendingAthletes } from "@/lib/rosterRules/pendingAthlete";
import { findDirectoryRowById } from "@/lib/players/server";
import { toPlayerFields } from "@/lib/players/directory";
import { addAthleteToTeam } from "@/app/captain/[token]/actions";

/**
 * Δημόσια εγγραφή ομάδας από τον ίδιο τον υπεύθυνο (επιβεβαιωμένο): μία
 * ενιαία υποβολή — στοιχεία ομάδας/υπευθύνου ΚΑΙ αθλητές μαζί, όχι ξεχωριστό
 * βήμα μετά. Ο υπεύθυνος γράφει ΠΑΝΤΑ ο ίδιος το όνομα ομάδας/συλλόγου/
 * σχολείου (καμία λίστα προς επιλογή σε αυτή τη φάση) — για σύλλογο ΕΣΟ
 * απαιτείται και κωδικός. Η προσθήκη κάθε αθλητή περνάει από το ΙΔΙΟ
 * addAthleteToTeam που χρησιμοποιεί και το Portal Αρχηγού (όριο ρόστερ,
 * έλεγχος διπλής εγγραφής) — όχι ξεχωριστή υλοποίηση.
 *
 * Ταυτοποίηση υπευθύνου: email + τηλέφωνο ΜΑΖΙ (επιβεβαιωμένο). Αν ταιριάζουν
 * και τα δύο με ήδη υπάρχοντα λογαριασμό, η νέα ομάδα προστίθεται εκεί — το
 * ίδιο link θα δείχνει πλέον όλες τις ομάδες του.
 */
export async function registerTeam(competitionId: string, formData: FormData): Promise<void> {
  const supabase = createClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("name, starts_on, ends_on, venue, audience_type, max_teams_per_club, registration_deadline")
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
  const esoCode = String(formData.get("eso_code") ?? "");

  const firstName = cleanName(String(formData.get("first_name") ?? ""));
  const lastName = cleanName(String(formData.get("last_name") ?? ""));
  const phone = String(formData.get("phone") ?? "").trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));

  if (!firstName || !lastName) throw new Error("Όνομα και επώνυμο υπευθύνου (λατινικά) είναι υποχρεωτικά.");
  if (!isValidPhone(phone)) throw new Error("Το τηλέφωνο δεν είναι έγκυρο.");
  if (!isValidEmail(email)) throw new Error("Το email δεν είναι έγκυρο.");

  // Όλη η λίστα αθλητών ελέγχεται εδώ, ΠΡΙΝ γραφτεί οτιδήποτε στη βάση — αν κάποια
  // γραμμή είναι προβληματική, δεν δημιουργείται καθόλου ομάδα (μία ενιαία αποθήκευση).
  const athletes = parsePendingAthletes(String(formData.get("athletes_json") ?? "[]"));

  const { clubOrSchoolId: resolvedClubId, teamNumber } = await resolveClubAndNumber(
    supabase, competitionId, audienceType, maxTeamsPerClub, clubOrSchoolId, newName, esoCode
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
    .select("id, competition_id")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Αυτή η ομάδα υπάρχει ήδη σε αυτή τη διοργάνωση.");
    throw new Error(`Αποτυχία εγγραφής: ${error.message}`);
  }

  await supabase.from("captains").insert({ team_id: team.id, first_name: firstName, last_name: lastName, phone, email });

  const failedAthletes: string[] = [];
  for (const a of athletes) {
    const fields =
      a.source === "directory"
        ? await (async () => {
            const row = await findDirectoryRowById(supabase, a.directoryId);
            if (!row) return null;
            return toPlayerFields(row, a.gender);
          })()
        : {
            first_name: a.first_name,
            last_name: a.last_name,
            birth_date: a.birth_date,
            gender: a.gender,
            rating_national: a.rating_national,
            rating_fide: a.rating_fide,
            national_id: null,
            fide_id: null,
            directory_id: null,
          };
    if (!fields) {
      failedAthletes.push(`${a.label || "άγνωστος"}: δεν βρέθηκε στον κατάλογο`);
      continue;
    }
    const result = await addAthleteToTeam(team, fields);
    if (!result.ok) failedAthletes.push(`${a.label || `${fields.last_name} ${fields.first_name}`}: ${result.message}`);
  }

  const { data: club } = await supabase.from("clubs_schools").select("name").eq("id", resolvedClubId).maybeSingle();
  const displayName = teamDisplayName(club?.name ?? "η ομάδα σας", teamNumber);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://teamchamp.vercel.app";
  const portalPath = `/captain/${account.access_token}`;
  try {
    await sendCaptainAccessEmail(email, firstName, {
      teamName: displayName,
      competitionName: competition.name,
      startsOn: competition.starts_on,
      endsOn: competition.ends_on,
      venue: competition.venue,
      portalUrl: `${siteUrl}${portalPath}`,
    });
  } catch (e) {
    console.error("Αποστολή email εγγραφής απέτυχε:", e); // η εγγραφή έχει ήδη σωθεί κανονικά
  }

  // Αν κάποιος αθλητής δεν μπόρεσε να προστεθεί (π.χ. ήδη δηλωμένος αλλού), η
  // εγγραφή της ΟΜΑΔΑΣ έχει ήδη ολοκληρωθεί κανονικά — ο υπεύθυνος το βλέπει/
  // διορθώνει στο δικό του Portal, δεν μπλοκάρει τη ροή.
  const suffix = failedAthletes.length > 0 ? `?athleteIssues=${encodeURIComponent(failedAthletes.join(" · "))}` : "";
  redirect(`${portalPath}${suffix}`);
}
