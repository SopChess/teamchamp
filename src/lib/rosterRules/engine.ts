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
 * Fallback assignment when a team misses the round submission window:
 * "χρησιμοποιείται η βασική σύνθεση όπως δηλώθηκε" (επιβεβαιωμένο, §3).
 * Applies to BOTH assignment_modes.
 */
export function computeDefaultAssignment(
  rules: RosterRules,
  roster: RosterEntry[]
): BoardAssignment[] {
  const sorted = [...roster].sort((a, b) => a.declared_order - b.declared_order);
  const assignments: BoardAssignment[] = [];

  const explicit = sorted.filter((r) => r.default_board != null);
  for (const r of explicit) {
    assignments.push({ board: r.default_board as number, player_id: r.player_id });
  }

  if (rules.assignment_mode === "fixed_category") {
    return assignments;
  }

  const nonExemptBoards = rules.board_rules
    .filter((b) => !b.exempt_from_order)
    .map((b) => b.board)
    .sort((a, b) => a - b);

  const explicitIds = new Set(explicit.map((r) => r.player_id));
  const candidates = sorted.filter((r) => !explicitIds.has(r.player_id));

  let i = 0;
  for (const board of nonExemptBoards) {
    if (assignments.some((a) => a.board === board)) continue;
    const candidate = candidates[i];
    if (candidate) {
      assignments.push({ board, player_id: candidate.player_id });
      i++;
    }
  }

  return assignments;
}
