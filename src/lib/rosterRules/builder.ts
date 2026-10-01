import type { BoardConstraint, BoardRule, ConstraintType } from "./types";

export const CONSTRAINT_LABELS: Record<ConstraintType, string> = {
  gender: "Φύλο",
  birth_after: "Γεννημένος μετά από (ακριβής ημερομηνία)",
  birth_before: "Γεννημένος πριν από (ακριβής ημερομηνία)",
  birth_year_from: "Γεννημένοι από το έτος",
  birth_year_until: "Γεννημένοι έως το έτος",
  rating_min: "Ελάχιστος βαθμός",
  rating_max: "Μέγιστος βαθμός",
  alternates_allowed: "Επιτρέπονται κοινοτικοί παίκτες",
};

export const CONSTRAINT_TYPES: ConstraintType[] = [
  "gender", "birth_after", "birth_before", "birth_year_from", "birth_year_until",
  "rating_min", "rating_max", "alternates_allowed",
];

export function emptyBoardRule(board: number): BoardRule {
  return { board, constraints: [] };
}

export function emptyConstraint(type: ConstraintType = "gender"): BoardConstraint {
  if (type === "gender") return { type, value: "any" };
  if (type === "alternates_allowed") return { type, value: [] };
  return { type, value: "" };
}

const CURRENT_YEAR = new Date().getFullYear();

/** Ένα σφάλμα ανά προβληματική σκακιέρα/όρο, για εμφάνιση δίπλα στο αντίστοιχο πεδίο. */
export function validateBoardRules(rules: BoardRule[]): string[] {
  const errors: string[] = [];
  const seen = new Set<number>();
  for (const r of rules) {
    if (!Number.isInteger(r.board) || r.board < 1) errors.push(`Μη έγκυρος αριθμός σκακιέρας: ${r.board}`);
    if (seen.has(r.board)) errors.push(`Η σκακιέρα ${r.board} εμφανίζεται περισσότερες από μία φορά.`);
    seen.add(r.board);
    for (const c of r.constraints) {
      if ((c.type === "birth_after" || c.type === "birth_before") && !/^\d{4}-\d{2}-\d{2}$/.test(String(c.value))) {
        errors.push(`Σκακιέρα ${r.board}: η ημερομηνία πρέπει να είναι μορφής εεεε-μμ-ηη.`);
      }
      if (c.type === "birth_year_from" || c.type === "birth_year_until") {
        const y = Number(c.value);
        if (!Number.isInteger(y) || y < 1900 || y > CURRENT_YEAR) {
          errors.push(`Σκακιέρα ${r.board}: το έτος γέννησης πρέπει να είναι έγκυρο (1900–${CURRENT_YEAR}).`);
        }
      }
      if ((c.type === "rating_min" || c.type === "rating_max") && (c.value === "" || Number.isNaN(Number(c.value)))) {
        errors.push(`Σκακιέρα ${r.board}: ο βαθμός πρέπει να είναι αριθμός.`);
      }
    }
  }
  return errors;
}
