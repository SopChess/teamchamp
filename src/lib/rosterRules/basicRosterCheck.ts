import type { RosterRules, RosterEntry, Player, BoardConstraint } from "./types";
import { computeDefaultAssignment } from "./engine";
import { describeConstraintsShort } from "./boardNotation";

/** Σύντομη, ανθρώπινη περιγραφή ενός όρου σκακιέρας — "Γυναίκα", "Από το 2014", "Βαθμός ≥ 1200". */
export function describeConstraint(c: BoardConstraint): string {
  switch (c.type) {
    case "gender":
      return c.value === "F" ? "Γυναίκα" : c.value === "M" ? "Άνδρας" : "";
    case "birth_after":
      return `Γεννημένος/η μετά από ${c.value}`;
    case "birth_before":
      return `Γεννημένος/η πριν από ${c.value}`;
    case "birth_year_from":
      return `Γεννημένος/η από το ${c.value}`;
    case "birth_year_until":
      return `Γεννημένος/η έως το ${c.value}`;
    case "rating_min":
      return `Βαθμός ≥ ${c.value}`;
    case "rating_max":
      return `Βαθμός ≤ ${c.value}`;
    case "alternates_allowed":
      return "";
    default:
      return "";
  }
}

function describeConstraints(constraints: BoardConstraint[]): string {
  return constraints.map(describeConstraint).filter(Boolean).join(", ");
}

function boardsInOrder(rules: RosterRules, boardCount: number): number[] {
  return rules.assignment_mode === "fixed_category"
    ? rules.board_rules.map((b) => b.board).sort((x, y) => x - y)
    : Array.from({ length: boardCount }, (_, i) => i + 1);
}

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

  for (const board of boardsInOrder(rules, boardCount)) {
    if (filledBoards.has(board)) continue;
    const rule = rules.board_rules.find((b) => b.board === board);
    const constraintText = describeConstraints(rule?.constraints ?? []);
    errors.push(
      constraintText
        ? `Σκακιέρα ${board}: δεν υπάρχει αθλητής/τρια στον κατάλογο που να πληροί τον όρο (${constraintText}).`
        : `Σκακιέρα ${board}: δεν καλύπτεται.`
    );
  }

  return errors;
}

export interface BoardCoverage {
  board: number;
  /** Κενό αν η σκακιέρα δεν έχει κανέναν όρο (οποιοσδήποτε αθλητής επιτρέπεται). */
  label: string;
  /** Σύντομη σκακιστική σημειογραφία (επιβεβαιωμένο) — "U16", "F" κ.λπ. αντί για πλήρη πρόταση. */
  shortLabel: string;
  covered: boolean;
}

/**
 * Ζωντανή κατάσταση κάλυψης ανά σκακιέρα, για τις κάρτες του Portal Αρχηγού
 * (Σχέδιο Α, επιβεβαιωμένο): ΚΑΘΟΔΗΓΕΙ, δεν μπλοκάρει καμία προσθήκη αθλητή.
 * "covered" σημαίνει ότι ΚΑΠΟΙΟΣ στον τρέχοντα κατάλογο πληροί αυτή τη
 * σκακιέρα — όχι απαραίτητα ότι θα παίξει εκεί στην πράξη.
 */
export function boardCoverageStatus(
  rules: RosterRules,
  roster: RosterEntry[],
  players: Record<string, Player>,
  referenceYear: number = new Date().getFullYear()
): BoardCoverage[] {
  const boardCount = rules.match_board_count ?? rules.board_rules.length;
  const assignment = computeDefaultAssignment(rules, roster, players);
  const filledBoards = new Set(assignment.map((a) => a.board));

  return boardsInOrder(rules, boardCount).map((board) => {
    const rule = rules.board_rules.find((b) => b.board === board);
    const constraints = rule?.constraints ?? [];
    return {
      board,
      label: describeConstraints(constraints),
      shortLabel: describeConstraintsShort(constraints, referenceYear),
      covered: filledBoards.has(board),
    };
  });
}
