export type ConstraintType =
  | "gender"
  | "birth_after"
  | "birth_before"
  | "birth_year_from"
  | "birth_year_until"
  | "rating_min"
  | "rating_max"
  | "alternates_allowed";

export interface BoardConstraint {
  type: ConstraintType;
  /**
   * "M" | "F" | "any" for gender, ISO date for birth_after/birth_before,
   * calendar YEAR (number, e.g. 2014) for birth_year_from/birth_year_until —
   * "από το έτος Χ" means from 1/1/X onward, "έως το έτος Χ" means through
   * 31/12/X (whole calendar year, επιβεβαιωμένο) — number for rating_*,
   * string[] of player ids for alternates_allowed
   */
  value: string | number | string[];
}

export interface BoardRule {
  board: number;
  constraints: BoardConstraint[];
  /** When true, this board is excluded from the strength_order relative-order check. */
  exempt_from_order?: boolean;
}

export type AssignmentMode = "strength_order" | "fixed_category";

export interface RosterRules {
  assignment_mode: AssignmentMode;
  /** Max players in the declared roster (6, 10, ...), or null when unlimited (δείγμα #3). */
  roster_size: number | null;
  /** How many boards are actually played per round — can be smaller than roster_size (δείγμα #2/#4: 6-player roster, 4-board matches). */
  match_board_count?: number;
  board_rules: BoardRule[];
  reserve_count?: number;
  /** fixed_category only: exactly one player per category/board. */
  one_player_per_category?: boolean;
}

export interface Player {
  id: string;
  first_name: string;
  last_name: string;
  /** ISO yyyy-mm-dd */
  birth_date?: string;
  gender?: "M" | "F";
  rating_national?: number;
  rating_fide?: number;
}

export interface RosterEntry {
  player_id: string;
  /** Position 1..N in the declared basic roster. */
  declared_order: number;
  /**
   * Optional default board for this player, used as the fallback assignment
   * when a team misses a round's submission window ("χρησιμοποιείται η
   * βασική σύνθεση όπως δηλώθηκε" — §3 of the architecture doc). Required
   * for fixed_category boards; optional for strength_order exempt boards.
   */
  default_board?: number;
}

export interface BoardAssignment {
  board: number;
  player_id: string;
}

export interface ValidationIssue {
  board?: number;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}
