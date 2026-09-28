import { createClient } from "@/lib/supabase/server";
import { computeDefaultAssignment } from "@/lib/rosterRules/engine";
import type { Player, RosterEntry, RosterRules } from "@/lib/rosterRules/types";
import { submissionWindow } from "./window";

type Db = ReturnType<typeof createClient>;

type PlayerRow = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  gender: "M" | "F" | null;
  rating_national: number | null;
  rating_fide: number | null;
};

function one<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : (value ?? undefined);
}

export async function loadRules(db: Db, competitionId: string): Promise<RosterRules | null> {
  const { data } = await db
    .from("roster_rules")
    .select("assignment_mode, roster_size, match_board_count, board_rules, reserve_count, one_player_per_category")
    .eq("competition_id", competitionId)
    .maybeSingle();
  return (data as RosterRules | null) ?? null;
}

export interface LoadedRoster {
  roster: RosterEntry[];
  players: Record<string, Player>;
}

/** Η δηλωμένη βασική σύνθεση μιας ομάδας: σειρά + στοιχεία παικτών. */
export async function loadRoster(db: Db, teamId: string): Promise<LoadedRoster> {
  const { data } = await db
    .from("roster_entries")
    .select(
      "player_id, declared_order, default_board, players(id, first_name, last_name, birth_date, gender, rating_national, rating_fide)"
    )
    .eq("team_id", teamId)
    .order("declared_order", { ascending: true });

  const roster: RosterEntry[] = [];
  const players: Record<string, Player> = {};
  for (const row of data ?? []) {
    const p = one(row.players as PlayerRow | PlayerRow[] | null);
    roster.push({
      player_id: row.player_id,
      declared_order: row.declared_order,
      default_board: row.default_board ?? undefined,
    });
    if (p) {
      players[p.id] = {
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        birth_date: p.birth_date ?? undefined,
        gender: p.gender ?? undefined,
        rating_national: p.rating_national ?? undefined,
        rating_fide: p.rating_fide ?? undefined,
      };
    }
  }
  return { roster, players };
}

/**
 * Για κάθε ομάδα ενός γύρου που ΔΕΝ έχει καταθέσει σύνθεση και της έχει λήξει
 * το παράθυρο (και η τυχόν παράταση), δημιουργεί την εφεδρική σύνθεση
 * ("βασική σύνθεση όπως δηλώθηκε") με κατάσταση used_default.
 *
 * Καλείται τεμπέλικα (όταν ανοίγει η σελίδα διαιτητή/admin/live), όχι από
 * χρονοδιακόπτη — ίδιο αποτέλεσμα, χωρίς επιπλέον υποδομή. Είναι ασφαλές να
 * τρέχει πολλές φορές: δεν πειράζει ποτέ ήδη υποβληθείσες συνθέσεις.
 */
export async function finalizeExpiredCompositions(roundId: string): Promise<void> {
  const db = createClient();

  const { data: round } = await db
    .from("rounds")
    .select("id, competition_id, pairing_published_at, submission_window_minutes")
    .eq("id", roundId)
    .maybeSingle();
  if (!round?.pairing_published_at) return;

  const rules = await loadRules(db, round.competition_id);
  if (!rules) return;

  const { data: pairings } = await db
    .from("pairings")
    .select("team_a_id, team_b_id")
    .eq("round_id", roundId);

  const teamIds = new Set<string>();
  for (const p of pairings ?? []) {
    if (!p.team_b_id) continue; // BYE: δεν παίζει, δεν χρειάζεται σύνθεση
    teamIds.add(p.team_a_id);
    teamIds.add(p.team_b_id);
  }

  const { data: comps } = await db
    .from("round_compositions")
    .select("id, team_id, status, extended_until")
    .eq("round_id", roundId);

  for (const teamId of teamIds) {
    const comp = (comps ?? []).find((c) => c.team_id === teamId);
    if (comp && comp.status !== "open") continue;

    const win = submissionWindow({
      publishedAt: round.pairing_published_at,
      windowMinutes: round.submission_window_minutes,
      extendedUntil: comp?.extended_until ?? null,
    });
    if (!win.expired) continue;

    const { roster, players } = await loadRoster(db, teamId);
    const assignments = computeDefaultAssignment(rules, roster, players);

    let compositionId = comp?.id as string | undefined;
    if (compositionId) {
      await db
        .from("round_compositions")
        .update({ status: "used_default", submitted_at: new Date().toISOString(), submitted_by: "system_fallback" })
        .eq("id", compositionId);
    } else {
      const { data: created } = await db
        .from("round_compositions")
        .insert({
          round_id: roundId,
          team_id: teamId,
          status: "used_default",
          submitted_at: new Date().toISOString(),
          submitted_by: "system_fallback",
        })
        .select("id")
        .single();
      compositionId = created?.id;
    }
    if (!compositionId) continue;

    await db.from("board_assignments").delete().eq("round_composition_id", compositionId);
    if (assignments.length > 0) {
      await db.from("board_assignments").insert(
        assignments.map((a) => ({
          round_composition_id: compositionId,
          board_number: a.board,
          player_id: a.player_id,
        }))
      );
    }
  }
}

export interface CaptainRoundPlay {
  kind: "play";
  roundId: string;
  roundNumber: number;
  opponentName: string;
  opponentRoster: { order: number; name: string; rating: number | null }[];
  composition: null | {
    status: "submitted" | "used_default" | "locked";
    assignments: { board: number; playerName: string }[];
  };
  window: { endsAt: string | null; open: boolean; expired: boolean };
}
export type CaptainRound =
  | { kind: "none" }
  | { kind: "bye"; roundNumber: number }
  | CaptainRoundPlay;

const playerLabel = (p?: Player) => (p ? `${p.last_name} ${p.first_name}` : "—");

/**
 * Ο τρέχων γύρος για μια ομάδα: ο τελευταίος γύρος με δημοσιευμένη κλήρωση στον
 * οποίο εμφανίζεται. Πρώτα ολοκληρώνει τις εφεδρικές συνθέσεις που έχουν λήξει.
 */
export async function loadCaptainRound(teamId: string, competitionId: string): Promise<CaptainRound> {
  const db = createClient();

  const { data: rounds } = await db
    .from("rounds")
    .select("id, round_number, pairing_published_at, submission_window_minutes")
    .eq("competition_id", competitionId)
    .not("pairing_published_at", "is", null)
    .order("round_number", { ascending: false });
  if (!rounds?.length) return { kind: "none" };

  const { data: pairings } = await db
    .from("pairings")
    .select("round_id, team_a_id, team_b_id")
    .in("round_id", rounds.map((r) => r.id))
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`);

  for (const round of rounds) {
    const pairing = (pairings ?? []).find((p) => p.round_id === round.id);
    if (!pairing) continue;
    if (!pairing.team_b_id) return { kind: "bye", roundNumber: round.round_number };

    await finalizeExpiredCompositions(round.id);

    const opponentId = pairing.team_a_id === teamId ? pairing.team_b_id : pairing.team_a_id;
    const { data: opp } = await db
      .from("teams")
      .select("id, clubs_schools(name)")
      .eq("id", opponentId)
      .maybeSingle();
    const club = one(opp?.clubs_schools as { name: string } | { name: string }[] | null);
    const opponentData = await loadRoster(db, opponentId);
    const opponentRoster = opponentData.roster.map((r) => ({
      order: r.declared_order,
      name: playerLabel(opponentData.players[r.player_id]),
      rating:
        opponentData.players[r.player_id]?.rating_fide ??
        opponentData.players[r.player_id]?.rating_national ??
        null,
    }));

    const { data: comp } = await db
      .from("round_compositions")
      .select("id, status, extended_until")
      .eq("round_id", round.id)
      .eq("team_id", teamId)
      .maybeSingle();

    let composition: CaptainRoundPlay["composition"] = null;
    if (comp && comp.status !== "open") {
      const mine = await loadRoster(db, teamId);
      const { data: assigns } = await db
        .from("board_assignments")
        .select("board_number, player_id")
        .eq("round_composition_id", comp.id)
        .order("board_number", { ascending: true });
      composition = {
        status: comp.status as "submitted" | "used_default" | "locked",
        assignments: (assigns ?? []).map((a) => ({
          board: a.board_number,
          playerName: playerLabel(mine.players[a.player_id]),
        })),
      };
    }

    const win = submissionWindow({
      publishedAt: round.pairing_published_at,
      windowMinutes: round.submission_window_minutes,
      extendedUntil: comp?.extended_until ?? null,
    });

    return {
      kind: "play",
      roundId: round.id,
      roundNumber: round.round_number,
      opponentName: club?.name ?? "Αντίπαλος",
      opponentRoster,
      composition,
      window: { endsAt: win.endsAt ? win.endsAt.toISOString() : null, open: win.open, expired: win.expired },
    };
  }
  return { kind: "none" };
}
