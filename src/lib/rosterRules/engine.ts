import type {
  BoardAssignment,
  BoardConstraint,
  BoardRule,
  Player,
  RosterEntry,
  RosterRules,
  ValidationResult,
} from "./types";

/**
 * FIDE → εθνικό ΕΣΟ → 800 fallback (δείγμα #1 §4.6, δείγμα #3 §7.3).
 * Used only where a rating constraint or ranking calc needs one number;
 * validateComposition itself does not call this except via rating_min/max.
 */
export function effectiveRating(player: Player): number {
  if (player.rating_fide != null) return player.rating_fide;
  if (player.rating_national != null) return player.rating_national;
  return 800;
}

/** Έτος γέννησης από ISO ημερομηνία (yyyy-mm-dd) — ανθεκτικό σε λανθασμένη μορφή. */
function birthYearOf(isoDate: string): number {
  return Number(isoDate.slice(0, 4));
}

function satisfiesConstraint(player: Player, constraint: BoardConstraint): boolean {
  switch (constraint.type) {
    case "gender": {
      if (constraint.value === "any") return true;
      return player.gender === constraint.value;
    }
    case "birth_after": {
      if (!player.birth_date) return false;
      return player.birth_date >= (constraint.value as string);
    }
    case "birth_before": {
      if (!player.birth_date) return false;
      return player.birth_date <= (constraint.value as string);
    }
    case "birth_year_from": {
      // "Γεννημένοι από το έτος Χ" = από 1/1/Χ και μετά (επιβεβαιωμένο: ολόκληρο το
      // ημερολογιακό έτος Χ μετράει, όχι μόνο μετά από αυτό).
      if (!player.birth_date) return false;
      return birthYearOf(player.birth_date) >= (constraint.value as number);
    }
    case "birth_year_until": {
      // "Γεννημένοι έως το έτος Χ" = μέχρι και 31/12/Χ (ολόκληρο το έτος Χ μετράει).
      if (!player.birth_date) return false;
      return birthYearOf(player.birth_date) <= (constraint.value as number);
    }
    case "rating_min":
      return effectiveRating(player) >= (constraint.value as number);
    case "rating_max":
      return effectiveRating(player) <= (constraint.value as number);
    case "alternates_allowed": {
      const allowed = constraint.value as string[];
      return allowed.includes(player.id);
    }
    default:
      return true;
  }
}

/**
 * A board rule is satisfied if the player matches every constraint, EXCEPT
 * that an "alternates_allowed" constraint acts as an override: a player
 * named in that list satisfies the board regardless of its other
 * constraints (δείγμα #3 — κοινοτικός παίκτης, εναλλάξιμος ανά συνάντηση).
 */
export function satisfiesBoardRule(player: Player, rule: BoardRule): boolean {
  const altConstraint = rule.constraints.find((c) => c.type === "alternates_allowed");
  if (altConstraint && satisfiesConstraint(player, altConstraint)) {
    return true;
  }
  return rule.constraints
    .filter((c) => c.type !== "alternates_allowed")
    .every((c) => satisfiesConstraint(player, c));
}

/**
 * Ένας αθλητής "ταιριάζει" στη βασική σύνθεση αν πληροί τους όρους τουλάχιστον
 * ΜΙΑΣ σκακιέρας (επιβεβαιωμένο: αντιστρέφει το παλιότερο "Σχέδιο Α" που
 * επέτρεπε κάθε προσθήκη χωρίς έλεγχο) — μια σκακιέρα χωρίς κανέναν όρο
 * ικανοποιείται πάντα (κενή λίστα όρων), όπως και η κενή λίστα σκακιερών.
 */
export function satisfiesAnyBoard(player: Player, rules: RosterRules): boolean {
  if (rules.board_rules.length === 0) return true;
  return rules.board_rules.some((rule) => satisfiesBoardRule(player, rule));
}

/**
 * Validates one round's board assignments against a competition's
 * roster_rules and a team's declared roster. Deliberately generic — it must
 * never encode a specific competition's rules, only interpret them.
 */
export function validateComposition(
  rules: RosterRules,
  roster: RosterEntry[],
  players: Record<string, Player>,
  assignments: BoardAssignment[]
): ValidationResult {
  const issues: ValidationResult["issues"] = [];
  const rosterIds = new Set(roster.map((r) => r.player_id));
  const orderByPlayer = new Map(roster.map((r) => [r.player_id, r.declared_order]));

  for (const a of assignments) {
    if (!rosterIds.has(a.player_id)) {
      issues.push({ board: a.board, message: "Ο παίκτης δεν ανήκει στο δηλωμένο ρόστερ." });
    }
  }

  const seenBoards = new Set<number>();
  const seenPlayers = new Set<string>();
  for (const a of assignments) {
    if (seenBoards.has(a.board)) {
      issues.push({ board: a.board, message: `Η σκακιέρα ${a.board} έχει ήδη ανάθεση.` });
    }
    seenBoards.add(a.board);
    if (seenPlayers.has(a.player_id)) {
      issues.push({ board: a.board, message: "Ο παίκτης έχει ανατεθεί σε παραπάνω από μία σκακιέρες." });
    }
    seenPlayers.add(a.player_id);
  }

  const expectedBoards =
    rules.assignment_mode === "fixed_category"
      ? rules.board_rules.map((b) => b.board)
      : Array.from(
          { length: rules.match_board_count ?? rules.board_rules.length },
          (_, i) => i + 1
        );

  for (const board of expectedBoards) {
    if (!seenBoards.has(board)) {
      issues.push({ board, message: `Λείπει ανάθεση για τη σκακιέρα ${board}.` });
    }
  }

  for (const a of assignments) {
    const rule = rules.board_rules.find((b) => b.board === a.board);
    const player = players[a.player_id];
    if (!rule || !player) continue;
    if (!satisfiesBoardRule(player, rule)) {
      issues.push({
        board: a.board,
        message: `${player.last_name} ${player.first_name} δεν πληροί τους όρους της σκακιέρας ${a.board}.`,
      });
    }
  }

  if (rules.assignment_mode === "strength_order") {
    const nonExempt = rules.board_rules
      .filter((b) => !b.exempt_from_order)
      .map((b) => b.board)
      .sort((x, y) => x - y);

    let lastOrder = -Infinity;
    for (const board of nonExempt) {
      const a = assignments.find((x) => x.board === board);
      if (!a) continue;
      const order = orderByPlayer.get(a.player_id);
      if (order == null) continue;
      if (order <= lastOrder) {
        issues.push({
          board,
          message: `Η σειρά της βασικής σύνθεσης δεν τηρείται στη σκακιέρα ${board}.`,
        });
      }
      lastOrder = order;
    }
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Εφεδρική σύνθεση όταν μια ομάδα δεν καταθέτει μέσα στο παράθυρο:
 * "χρησιμοποιείται η βασική σύνθεση όπως δηλώθηκε" (επιβεβαιωμένο, §3).
 * Ισχύει και για τα δύο assignment_mode.
 *
 * Σειρά κανόνων (ντετερμινιστική):
 * 1. Αν ένας παίκτης έχει ρητό default_board, παίρνει αυτή τη σκακιέρα.
 * 2. Σκακιέρες με δικό τους constraint (οι εξαιρεμένες από τη σειρά στο
 *    strength_order, ΟΛΕΣ στο fixed_category): παίρνει τον πρώτο κατά
 *    δηλωμένη σειρά ΕΠΙΛΕΞΙΜΟ παίκτη που δεν έχει ήδη χρησιμοποιηθεί
 *    (χρειάζεται το `players` για να ελεγχθούν τα constraints).
 * 3. Οι υπόλοιπες σκακιέρες του strength_order γεμίζουν με τη δηλωμένη σειρά.
 */
export function computeDefaultAssignment(
  rules: RosterRules,
  roster: RosterEntry[],
  players?: Record<string, Player>
): BoardAssignment[] {
  const sorted = [...roster].sort((a, b) => a.declared_order - b.declared_order);
  const assigned = new Map<number, string>();
  const used = new Set<string>();

  const boards =
    rules.assignment_mode === "fixed_category"
      ? rules.board_rules.map((b) => b.board).sort((x, y) => x - y)
      : Array.from({ length: rules.match_board_count ?? rules.board_rules.length }, (_, i) => i + 1);

  const ruleFor = (board: number) => rules.board_rules.find((b) => b.board === board);

  // 1. ρητά default_board
  for (const r of sorted) {
    if (r.default_board != null && boards.includes(r.default_board) && !assigned.has(r.default_board)) {
      assigned.set(r.default_board, r.player_id);
      used.add(r.player_id);
    }
  }

  // 2. σκακιέρες με δικό τους constraint
  const constrained =
    rules.assignment_mode === "fixed_category"
      ? boards
      : boards.filter((b) => ruleFor(b)?.exempt_from_order);

  for (const board of constrained) {
    if (assigned.has(board)) continue;
    const rule = ruleFor(board);
    const pick = sorted.find(
      (r) =>
        !used.has(r.player_id) &&
        (!players || !rule || !players[r.player_id] || satisfiesBoardRule(players[r.player_id], rule))
    );
    if (pick) {
      assigned.set(board, pick.player_id);
      used.add(pick.player_id);
    }
  }

  // 3. οι υπόλοιπες σκακιέρες του strength_order με τη δηλωμένη σειρά
  if (rules.assignment_mode === "strength_order") {
    const remaining = sorted.filter((r) => !used.has(r.player_id));
    let i = 0;
    for (const board of boards) {
      if (assigned.has(board) || ruleFor(board)?.exempt_from_order) continue;
      const next = remaining[i++];
      if (next) {
        assigned.set(board, next.player_id);
        used.add(next.player_id);
      }
    }
  }

  return [...assigned.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([board, player_id]) => ({ board, player_id }));
}
