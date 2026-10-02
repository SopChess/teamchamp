import type { BoardConstraint } from "./types";

/**
 * Έτος αναφοράς για τον υπολογισμό ηλικιακών κατηγοριών (U16, U12 κ.λπ.)
 * (επιβεβαιωμένο): το έτος έναρξης του τουρνουά, όχι το σημερινό ημερολογιακό
 * έτος — σταθερό ό,τι ώρα και να το δει κανείς, πριν ή μετά τη διοργάνωση.
 * Χωρίς ημερομηνία έναρξης, πέφτει πίσω στο τρέχον έτος.
 */
export function referenceYearOf(startsOn: string | null | undefined): number {
  if (startsOn) {
    const y = new Date(startsOn).getFullYear();
    if (!Number.isNaN(y)) return y;
  }
  return new Date().getFullYear();
}

/**
 * Σύντομη, γνωστή σκακιστική σημειογραφία ενός όρου σκακιέρας — "U16", "F",
 * "≥1200" — αντί για πλήρη πρόταση. Χρησιμοποιείται στις κάρτες κάλυψης
 * σκακιερών και στη σύνθεση γύρου (επιβεβαιωμένο).
 */
export function describeConstraintShort(c: BoardConstraint, referenceYear: number): string {
  switch (c.type) {
    case "gender":
      return c.value === "F" ? "F" : c.value === "M" ? "M" : "";
    case "birth_year_from": {
      const age = referenceYear - Number(c.value);
      return Number.isFinite(age) ? `U${age}` : "";
    }
    case "birth_year_until": {
      const age = referenceYear - Number(c.value);
      return Number.isFinite(age) ? `O${age}` : "";
    }
    case "birth_after":
      return `μετά ${c.value}`;
    case "birth_before":
      return `πριν ${c.value}`;
    case "rating_min":
      return `≥${c.value}`;
    case "rating_max":
      return `≤${c.value}`;
    case "alternates_allowed":
      return "";
    default:
      return "";
  }
}

export function describeConstraintsShort(constraints: BoardConstraint[], referenceYear: number): string {
  return constraints.map((c) => describeConstraintShort(c, referenceYear)).filter(Boolean).join(" · ");
}
