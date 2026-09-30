import { allowsFreeEntry, clubTypeFor, nextTeamNumber, type AudienceType } from "./teams";

export interface ResolveClubResult {
  clubOrSchoolId: string;
  teamNumber: number;
}

/**
 * Κοινή λογική επιλογής/δημιουργίας συλλόγου-σχολείου και αρίθμησης ομάδας,
 * χρησιμοποιείται και από τη δημόσια εγγραφή και από την επεξεργασία ομάδας
 * του admin. Πετάει Error με φιλικό μήνυμα σε κάθε αποτυχία — το καλούν
 * μέσα από callSafely (βλ. @/lib/actions/safeAction) όσες φορές χρειάζεται
 * το πραγματικό μήνυμα να φτάσει στον χρήστη.
 */
export async function resolveClubAndNumber(
  db: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  competitionId: string,
  audienceType: AudienceType,
  maxTeamsPerClub: number,
  clubOrSchoolIdInput: string,
  newNameInput: string,
  /** Εξαιρεί αυτή την ομάδα από τον έλεγχο αρίθμησης (επεξεργασία υπάρχουσας ομάδας). */
  excludeTeamId?: string
): Promise<ResolveClubResult> {
  let clubOrSchoolId = clubOrSchoolIdInput;
  const newName = newNameInput.trim().toUpperCase();

  if (!clubOrSchoolId && newName) {
    if (!allowsFreeEntry(audienceType)) {
      throw new Error("Σε αυτή τη διοργάνωση δεν επιτρέπεται ελεύθερη επωνυμία — επιλέξτε από τη λίστα.");
    }
    const { data: created, error: createError } = await db
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

  let q = db.from("teams").select("team_number").eq("competition_id", competitionId).eq("club_or_school_id", clubOrSchoolId);
  if (excludeTeamId) q = q.neq("id", excludeTeamId);
  const { data: existingTeams } = await q;

  const existingNumbers = (existingTeams ?? []).map((t: { team_number: number }) => t.team_number);
  if (existingNumbers.length > 0 && audienceType !== "eso_club") {
    throw new Error("Αυτός ο σύλλογος/σχολείο έχει ήδη ομάδα σε αυτή τη διοργάνωση.");
  }
  const teamNumber = nextTeamNumber(existingNumbers, audienceType === "eso_club" ? maxTeamsPerClub : 1);
  if (teamNumber === null) {
    throw new Error(
      `Έχει φτάσει το μέγιστο επιτρεπόμενων ομάδων για αυτόν τον σύλλογο σε αυτή τη διοργάνωση (${maxTeamsPerClub}).`
    );
  }

  return { clubOrSchoolId, teamNumber };
}
