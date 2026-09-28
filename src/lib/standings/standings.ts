/**
 * Ζωντανή κατάταξη ομάδων. ΔΕΝ είναι η επίσημη κατάταξη (αυτή βγαίνει από το
 * Swiss-Manager) — είναι η "τρέχουσα εικόνα" που ενημερώνεται σε κάθε
 * καταχωρημένο αποτέλεσμα σκακιέρας, ώστε οι θεατές να βλέπουν τις ομάδες να
 * αλλάζουν θέσεις όσο τελειώνουν οι παρτίδες.
 */

export type BoardResult = "1-0" | "0-1" | "1/2-1/2" | "forfeit_a" | "forfeit_b";
export const BOARD_RESULTS: BoardResult[] = ["1-0", "0-1", "1/2-1/2", "forfeit_a", "forfeit_b"];

export type TiebreakKey =
  | "head_to_head"
  | "board_points"
  | "board_order"
  | "sonneborn_berger"
  | "buchholz";

export const TIEBREAK_LABELS: Record<TiebreakKey, string> = {
  head_to_head: "Μεταξύ τους αποτέλεσμα",
  board_points: "Σύνολο πόντων σκακιέρων",
  board_order: "Πόντοι ανά σκακιέρα (1η, 2η, ...)",
  sonneborn_berger: "Sonneborn-Berger",
  buchholz: "Buchholz (βαθμοί αντιπάλων)",
};

/** Προεπιλογή όπως στο 24ο Σχολικό Θεσ/νίκης-Χαλκιδικής (§12.3 της προκήρυξης). */
export const DEFAULT_TIEBREAKS: TiebreakKey[] = ["head_to_head", "board_points", "board_order"];

export interface StandingsMatch {
  id: string;
  teamA: string;
  /** null = BYE */
  teamB: string | null;
  boardCount: number;
  /** ευρετήριο 0 = σκακιέρα 1· null = δεν έχει καταχωρηθεί ακόμα */
  results: (BoardResult | null)[];
}

export interface ScoringConfig {
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  /** Πόσοι βαθμοί αφαιρούνται από ομάδα που χάνει ΟΛΟΚΛΗΡΗ τη συνάντηση χωρίς αγώνα. */
  forfeitLossPenalty: number;
  byeMatchPoints: number;
  /** null = το μισό του αριθμού σκακιερών */
  byeBoardPoints: number | null;
  /** Αριθμός σκακιερών ανά συνάντηση, για τον υπολογισμό των πόντων του BYE. */
  defaultBoardCount: number;
  tiebreaks: TiebreakKey[];
}

export const DEFAULT_SCORING: ScoringConfig = {
  winPoints: 2,
  drawPoints: 1,
  lossPoints: 0,
  forfeitLossPenalty: 0,
  byeMatchPoints: 2,
  byeBoardPoints: null,
  defaultBoardCount: 4,
  tiebreaks: DEFAULT_TIEBREAKS,
};

export interface StandingRow {
  teamId: string;
  rank: number;
  matchPoints: number;
  boardPoints: number;
  played: number;
  /** true αν υπολογίζεται και από συναντήσεις που δεν έχουν ολοκληρωθεί */
  provisional: boolean;
}

/** Πόντοι σκακιέρας [ομάδα Α, ομάδα Β]. */
export function boardScore(result: BoardResult): [number, number] {
  switch (result) {
    case "1-0":
    case "forfeit_b":
      return [1, 0];
    case "0-1":
    case "forfeit_a":
      return [0, 1];
    case "1/2-1/2":
      return [0.5, 0.5];
  }
}

interface MatchOutcome {
  matchId: string;
  a: string;
  b: string;
  boardsA: number;
  boardsB: number;
  mpA: number;
  mpB: number;
  complete: boolean;
  /** ανά σκακιέρα [ευρετήριο 0 = σκακιέρα 1] */
  perBoardA: number[];
  perBoardB: number[];
  forfeitLoser: "a" | "b" | null;
}

function evaluateMatch(m: StandingsMatch, cfg: ScoringConfig): MatchOutcome | null {
  if (m.teamB == null) return null;
  const recorded = m.results.filter((r): r is BoardResult => r != null);
  // Χωρίς κανένα αποτέλεσμα δεν μοιράζονται βαθμοί (όλες οι συναντήσεις ξεκινούν 0-0).
  if (recorded.length === 0) return null;

  const perBoardA: number[] = [];
  const perBoardB: number[] = [];
  let boardsA = 0;
  let boardsB = 0;
  for (let i = 0; i < m.boardCount; i++) {
    const r = m.results[i];
    const [sa, sb] = r ? boardScore(r) : [0, 0];
    perBoardA.push(sa);
    perBoardB.push(sb);
    boardsA += sa;
    boardsB += sb;
  }

  const complete = recorded.length >= m.boardCount;
  let mpA: number;
  let mpB: number;
  if (boardsA > boardsB) {
    mpA = cfg.winPoints;
    mpB = cfg.lossPoints;
  } else if (boardsB > boardsA) {
    mpA = cfg.lossPoints;
    mpB = cfg.winPoints;
  } else {
    mpA = cfg.drawPoints;
    mpB = cfg.drawPoints;
  }

  let forfeitLoser: "a" | "b" | null = null;
  if (complete) {
    if (recorded.every((r) => r === "forfeit_a")) forfeitLoser = "a";
    else if (recorded.every((r) => r === "forfeit_b")) forfeitLoser = "b";
  }

  return {
    matchId: m.id, a: m.teamA, b: m.teamB, boardsA, boardsB, mpA, mpB, complete,
    perBoardA, perBoardB, forfeitLoser,
  };
}

interface TeamAggregate {
  matchPoints: number;
  boardPoints: number;
  played: number;
  provisional: boolean;
  perBoard: number[];
  opponents: { id: string; boardPointsAgainst: number }[];
}

function compareVectors(x: number[], y: number[]): number {
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) {
    const d = (y[i] ?? 0) - (x[i] ?? 0); // φθίνουσα
    if (d !== 0) return d;
  }
  return 0;
}

export function computeStandings(
  teamIds: string[],
  matches: StandingsMatch[],
  config: Partial<ScoringConfig> = {}
): StandingRow[] {
  const cfg: ScoringConfig = { ...DEFAULT_SCORING, ...config };
  if (!cfg.tiebreaks || cfg.tiebreaks.length === 0) cfg.tiebreaks = DEFAULT_TIEBREAKS;

  const maxBoards = Math.max(cfg.defaultBoardCount, ...matches.map((m) => m.boardCount), 1);
  const agg = new Map<string, TeamAggregate>();
  for (const id of teamIds) {
    agg.set(id, {
      matchPoints: 0, boardPoints: 0, played: 0, provisional: false,
      perBoard: Array(maxBoards).fill(0), opponents: [],
    });
  }

  const outcomes: MatchOutcome[] = [];
  for (const m of matches) {
    if (m.teamB == null) {
      const t = agg.get(m.teamA);
      if (!t) continue;
      t.matchPoints += cfg.byeMatchPoints;
      t.boardPoints += cfg.byeBoardPoints ?? m.boardCount / 2;
      t.played += 1;
      continue;
    }
    const o = evaluateMatch(m, cfg);
    if (!o) continue;
    outcomes.push(o);
    const ta = agg.get(o.a);
    const tb = agg.get(o.b);
    if (!ta || !tb) continue;

    ta.matchPoints += o.mpA;
    tb.matchPoints += o.mpB;
    ta.boardPoints += o.boardsA;
    tb.boardPoints += o.boardsB;
    ta.played += 1;
    tb.played += 1;
    if (!o.complete) {
      ta.provisional = true;
      tb.provisional = true;
    }
    o.perBoardA.forEach((v, i) => (ta.perBoard[i] += v));
    o.perBoardB.forEach((v, i) => (tb.perBoard[i] += v));
    ta.opponents.push({ id: o.b, boardPointsAgainst: o.boardsA });
    tb.opponents.push({ id: o.a, boardPointsAgainst: o.boardsB });
  }

  // Βαθμοί ΠΡΙΝ την ποινή — χρησιμοποιούνται στα κριτήρια ισοβαθμίας.
  const baseMp = new Map<string, number>();
  for (const [id, t] of agg) baseMp.set(id, t.matchPoints);

  // Ποινή ήττας χωρίς αγώνα (εφαρμόζεται στην τελική βαθμολογία).
  const penalty = Math.abs(cfg.forfeitLossPenalty);
  if (penalty > 0) {
    for (const o of outcomes) {
      if (o.forfeitLoser === "a") agg.get(o.a)!.matchPoints -= penalty;
      if (o.forfeitLoser === "b") agg.get(o.b)!.matchPoints -= penalty;
    }
  }

  const tiebreakValue = (key: TiebreakKey, id: string, group: string[]): number[] => {
    const t = agg.get(id)!;
    switch (key) {
      case "board_points":
        return [t.boardPoints];
      case "board_order":
        return t.perBoard;
      case "buchholz":
        return [t.opponents.reduce((s, o) => s + (baseMp.get(o.id) ?? 0), 0)];
      case "sonneborn_berger":
        return [t.opponents.reduce((s, o) => s + (baseMp.get(o.id) ?? 0) * o.boardPointsAgainst, 0)];
      case "head_to_head": {
        let pts = 0;
        for (const o of outcomes) {
          if (o.a === id && group.includes(o.b)) pts += o.mpA;
          if (o.b === id && group.includes(o.a)) pts += o.mpB;
        }
        return [pts];
      }
    }
  };

  // Αναδρομική ταξινόμηση: πρώτα βαθμοί, μετά κάθε κριτήριο μόνο ανάμεσα σε όσους παραμένουν ισόβαθμοι.
  const orderGroup = (group: string[], keys: TiebreakKey[]): string[][] => {
    if (group.length <= 1 || keys.length === 0) return [group];
    const [key, ...rest] = keys;
    const withValues = group.map((id) => ({ id, v: tiebreakValue(key, id, group) }));
    withValues.sort((p, q) => compareVectors(p.v, q.v));
    const subgroups: string[][] = [];
    for (const item of withValues) {
      const last = subgroups[subgroups.length - 1];
      if (last && compareVectors(withValues.find((w) => w.id === last[0])!.v, item.v) === 0) {
        last.push(item.id);
      } else {
        subgroups.push([item.id]);
      }
    }
    return subgroups.flatMap((g) => orderGroup(g, rest));
  };

  const byMp = new Map<number, string[]>();
  for (const id of teamIds) {
    const mp = agg.get(id)!.matchPoints;
    byMp.set(mp, [...(byMp.get(mp) ?? []), id]);
  }
  const mpLevels = [...byMp.keys()].sort((x, y) => y - x);

  const rows: StandingRow[] = [];
  for (const mp of mpLevels) {
    const tiedGroups = orderGroup(byMp.get(mp)!, cfg.tiebreaks);
    for (const g of tiedGroups) {
      const rank = rows.length + 1;
      for (const id of g) {
        const t = agg.get(id)!;
        rows.push({
          teamId: id, rank, matchPoints: t.matchPoints, boardPoints: t.boardPoints,
          played: t.played, provisional: t.provisional,
        });
      }
    }
  }
  return rows;
}

/** Εμφάνιση πόντων με ½: 2,5 → "2½", 0,5 → "½", 3 → "3". */
export function formatPoints(n: number): string {
  const whole = Math.floor(n);
  const half = Math.abs(n - whole - 0.5) < 1e-9;
  if (half) return whole === 0 ? "½" : `${whole}½`;
  return String(n);
}
