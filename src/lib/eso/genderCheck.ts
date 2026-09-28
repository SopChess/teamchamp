/**
 * Έλεγχος ασυμφωνίας: το φύλο που δήλωσε ο υπεύθυνος ομάδας ΔΕΝ ταυτίζεται με την
 * ένδειξη της λίστας ΕΣΟ. Ο υπεύθυνος αποφασίζει πάντα ο ίδιος· αυτό είναι μόνο
 * προειδοποίηση προς τον admin.
 *
 * Η ΕΣΟ σημειώνει ΜΟΝΟ τις γυναίκες ("f"). Γι' αυτό:
 *  - Δηλωμένος Άνδρας ενώ η ΕΣΟ σημειώνει Γυναίκα → ισχυρή προειδοποίηση.
 *  - Δηλωμένη Γυναίκα ενώ η ΕΣΟ δεν το σημειώνει → ήπια προειδοποίηση (μπορεί απλώς να λείπει
 *    το σήμα), και μόνο αν έχει εφαρμοστεί ήδη λίστα ΕΣΟ (αλλιώς η στήλη είναι άδεια για όλους).
 */
export interface AthleteGender {
  team: string;
  name: string;
  declared: "M" | "F" | null;
  directoryId: string | null;
}

export interface GenderMismatch {
  team: string;
  name: string;
  severity: "strong" | "soft";
  message: string;
}

export function genderMismatches(
  athletes: AthleteGender[],
  sexEsoByDirectoryId: Map<string, string | null>,
  importApplied: boolean
): GenderMismatch[] {
  const out: GenderMismatch[] = [];
  for (const a of athletes) {
    if (!a.directoryId || !a.declared || !sexEsoByDirectoryId.has(a.directoryId)) continue;
    const eso = sexEsoByDirectoryId.get(a.directoryId) === "F" ? "F" : null;
    if (a.declared === "M" && eso === "F") {
      out.push({ team: a.team, name: a.name, severity: "strong", message: "Δηλώθηκε Άνδρας, ενώ η ΕΣΟ σημειώνει Γυναίκα." });
    } else if (a.declared === "F" && eso === null && importApplied) {
      out.push({ team: a.team, name: a.name, severity: "soft", message: "Δηλώθηκε Γυναίκα, ενώ η ΕΣΟ δεν το σημειώνει." });
    }
  }
  return out.sort((x, y) => (x.severity === y.severity ? x.team.localeCompare(y.team, "el") : x.severity === "strong" ? -1 : 1));
}
