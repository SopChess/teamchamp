import type { RosterRules, RosterEntry, Player } from "./types";
import { computeDefaultAssignment } from "./engine";
import { CONSTRAINT_LABELS } from "./builder";

/**
 * Έλεγχος της ΒΑΣΙΚΗΣ σύνθεσης (Στάδιο 1) έναντι των κανόνων της διοργάνωσης —
 * όχι σύνθεσης συγκεκριμένου γύρου. Χρησιμοποιείται στη δημόσια εγγραφή και
 * στο Portal Αρχηγού, για να δείχνει τι λείπει ΠΡΙΝ επιτρέψει την υποβολή.
 * Δανείζεται τον υπολογισμό του computeDefaultAssignment: αν καλύπτονται όλες
 * οι σκακιέρες του αγώνα με τον δηλωμένο κατάλογο, ο κατάλογος επαρκεί.
 */
export function validateBasicRoster(
  rules: RosterRules,
  roster: RosterEntry[],
  players: Record<string, Player>
): string[] {
  const errors: string[] = [];
  const boardCount = rules.match_board_count ?? rules.board_rules.length;

  if (roster.length < boardCount) {
    errors.push(`Χρειάζονται τουλάχιστον ${boardCount} αθλητές για να καλυφθούν όλες οι σκακιέρες (έχετε ${roster.length}).`);
    return errors; // δεν έχει νόημα ο έλεγχος ανά σκακιέρα με λιγότερους αθλητές απ' όσους χρειάζονται
  }

  const assignment = computeDefaultAssignment(rules, roster, players);
  const filledBoards = new Set(assignment.map((a) => a.board));
  const boards =
    rules.assignment_mode === "fixed_category"
      ? rules.board_rules.map((b) => b.board).sort((x, y) => x - y)
      : Array.from({ length: boardCount }, (_, i) => i + 1);

  for (const board of boards) {
    if (filledBoards.has(board)) continue;
    const rule = rules.board_rules.find((b) => b.board === board);
    const constraintText = (rule?.constraints ?? [])
      .map((c) => `${CONSTRAINT_LABELS[c.type]}${c.type === "gender" ? `: ${c.value === "F" ? "Γυναίκα" : c.value === "M" ? "Άνδρας" : ""}` : ""}`)
      .filter(Boolean)
      .join(", ");
    errors.push(
      constraintText
        ? `Σκακιέρα ${board}: δεν υπάρχει αθλητής/τρια στον κατάλογο που να πληροί τον όρο (${constraintText}).`
        : `Σκακιέρα ${board}: δεν καλύπτεται.`
    );
  }

  return errors;
}
