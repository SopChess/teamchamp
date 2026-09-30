import { clubTypeFor, nextTeamNumber, requiresEsoCode, type AudienceType } from "./teams";
import { toGreekUpperCase } from "@/lib/transliterate";

export interface ResolveClubResult {
  clubOrSchoolId: string;
  teamNumber: number;
}

/**
 * Κοινή λογική επιλογής/δημιουργίας συλλόγου-σχολείου και αρίθμησης ομάδας.
 * Ο υπεύθυνος γράφει ΠΑΝΤΑ ο ίδιος το όνομα (επιβεβαιωμένο, καμία λίστα προς
 * επιλογή στην εγγραφή): αν το ίδιο όνομα υπάρχει ήδη, το ΒΡΙΣΚΕΙ και το
 * ξαναχρησιμοποιεί (π.χ. δεύτερη ομάδα του ίδιου συλλόγου, ή επιστροφή σε νέα
 * διοργάνωση) — δεν πετάει σφάλμα διπλότυπου, όπως θα έκανε ο admin όταν
 * προσθέτει σύλλογο χειροκίνητα στο /admin/clubs.
 *
 * excludeTeamId: εξαιρεί αυτή την ομάδα από τον έλεγχο αρίθμησης (επεξεργασία
 * υπάρχουσας ομάδας από τον admin, όπου δίνεται ήδη clubOrSchoolId χωρίς νέο όνομα).
 */
export async function resolveClubAndNumber(
  db: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  competitionId: string,
  audienceType: AudienceType,
  maxTeamsPerClub: number,
  clubOrSchoolIdInput: string,
  newNameInput: string,
  esoCode?: string,
  excludeTeamId?: string
): Promise<ResolveClubResult> {
  let clubOrSchoolId = clubOrSchoolIdInput;
  const newName = newNameInput.trim().toUpperCase();

  if (!clubOrSchoolId && newName) {
    if (requiresEsoCode(audienceType) && !esoCode?.trim()) {
      throw new Error("Ο κωδικός ΕΣΟ του συλλόγου είναι υποχρεωτικός.");
    }

    // Αναζήτηση με το κανονικοποιημένο κλειδί (χωρίς τόνους, κεφαλαία — στήλη name_key
    // της βάσης, setup_teams_v2.sql), ώστε "Χωρίς" και "ΧΩΡΙΣ" να αναγνωρίζονται ως το
    // ίδιο όνομα ακόμη κι αν το JS toUpperCase() δεν αφαιρεί τόνους.
    const { data: existing } = await db
      .from("clubs_schools")
      .select("id")
      .eq("name_key", toGreekUpperCase(newName))
      .maybeSingle();

    if (existing) {
      clubOrSchoolId = existing.id;
      if (esoCode?.trim()) {
        await db.from("clubs_schools").update({ eso_code: esoCode.trim() }).eq("id", existing.id).is("eso_code", null);
      }
    } else {
      const { data: created, error: createError } = await db
        .from("clubs_schools")
        .insert({ name: newName, type: clubTypeFor(audienceType), eso_code: esoCode?.trim() || null })
        .select("id")
        .single();
      if (createError) {
        if (createError.code === "23505") {
          // Σπάνιο (ταυτόχρονη εγγραφή του ίδιου ονόματος) — ξαναδιαβάζουμε αντί να αποτύχουμε.
          const { data: retry } = await db.from("clubs_schools").select("id").eq("name_key", toGreekUpperCase(newName)).single();
          if (!retry) throw new Error(`Αποτυχία δημιουργίας ομάδας: ${createError.message}`);
          clubOrSchoolId = retry.id;
        } else {
          throw new Error(`Αποτυχία δημιουργίας ομάδας: ${createError.message}`);
        }
      } else {
        clubOrSchoolId = created.id;
      }
    }
  }

  if (!clubOrSchoolId) {
    throw new Error("Γράψτε το όνομα της ομάδας/συλλόγου/σχολείου.");
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
