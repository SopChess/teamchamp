import { createClient } from "@/lib/supabase/server";
import type { Player } from "@/lib/rosterRules/types";
import type { BoardResult } from "@/lib/standings/standings";
import { finalizeExpiredCompositions, loadRoster } from "./server";

export interface ScanSide {
  teamId: string;
  teamName: string;
  /** null = δεν έχει ακόμα σύνθεση (το παράθυρο κατάθεσης είναι ανοιχτό) */
  player: { name: string; rating: number | null } | null;
  compositionStatus: "submitted" | "used_default" | "locked" | "open" | "missing";
}

export type ScanState =
  | { kind: "unknown_token" }
  | { kind: "no_round"; competitionId: string; meetingNumber: number; boardNumber: number }
  | { kind: "bye"; competitionId: string; meetingNumber: number; boardNumber: number; roundNumber: number; teamName: string }
  | {
      kind: "board";
      competitionId: string;
      meetingNumber: number;
      boardNumber: number;
      roundNumber: number;
      pairingId: string;
      a: ScanSide;
      b: ScanSide;
      /** το τρέχον καταχωρημένο αποτέλεσμα, ή null */
      result: BoardResult | null;
      /** μπορούν να καταχωρηθούν αποτελέσματα μόνο όταν και οι δύο συνθέσεις υπάρχουν */
      ready: boolean;
    };

type ClubRef = { name: string } | { name: string }[] | null;
const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : (v ?? undefined));
const label = (p?: Player) => (p ? `${p.last_name} ${p.first_name}` : "—");

/**
 * Από ένα QR token βρίσκει: ποια Συνάντηση/Σκακιέρα είναι, ποιος είναι ο τρέχων
 * γύρος σε αυτή τη Συνάντηση, ποιες ομάδες κάθονται και ποιοι παίκτες παίζουν
 * ακριβώς σε αυτή τη σκακιέρα (από τις συνθέσεις των δύο ομάδων).
 */
export async function resolveScan(qrToken: string): Promise<ScanState> {
  const db = createClient();

  const { data: qr } = await db
    .from("qr_tokens")
    .select("meeting_id, board_number")
    .eq("token", qrToken)
    .maybeSingle();
  if (!qr) return { kind: "unknown_token" };

  const { data: meeting } = await db
    .from("meetings")
    .select("id, competition_id, meeting_number")
    .eq("id", qr.meeting_id)
    .maybeSingle();
  if (!meeting) return { kind: "unknown_token" };

  const base = {
    competitionId: meeting.competition_id as string,
    meetingNumber: meeting.meeting_number as number,
    boardNumber: qr.board_number as number,
  };

  const { data: pairings } = await db
    .from("pairings")
    .select("id, round_id, team_a_id, team_b_id")
    .eq("meeting_id", meeting.id);
  if (!pairings?.length) return { kind: "no_round", ...base };

  const { data: rounds } = await db
    .from("rounds")
    .select("id, round_number, pairing_published_at")
    .in("id", pairings.map((p) => p.round_id))
    .not("pairing_published_at", "is", null)
    .order("round_number", { ascending: false });
  const round = rounds?.[0];
  if (!round) return { kind: "no_round", ...base };
  const pairing = pairings.find((p) => p.round_id === round.id)!;

  const teamName = async (teamId: string) => {
    const { data } = await db.from("teams").select("id, clubs_schools(name)").eq("id", teamId).maybeSingle();
    return one(data?.clubs_schools as ClubRef)?.name ?? "Ομάδα";
  };

  if (!pairing.team_b_id) {
    return { kind: "bye", ...base, roundNumber: round.round_number, teamName: await teamName(pairing.team_a_id) };
  }

  await finalizeExpiredCompositions(round.id);

  const side = async (teamId: string): Promise<ScanSide> => {
    const { data: comp } = await db
      .from("round_compositions")
      .select("id, status")
      .eq("round_id", round.id)
      .eq("team_id", teamId)
      .maybeSingle();

    let player: ScanSide["player"] = null;
    if (comp && comp.status !== "open") {
      const { data: assign } = await db
        .from("board_assignments")
        .select("player_id")
        .eq("round_composition_id", comp.id)
        .eq("board_number", qr.board_number)
        .maybeSingle();
      if (assign) {
        const { players } = await loadRoster(db, teamId);
        const p = players[assign.player_id];
        player = { name: label(p), rating: p?.rating_fide ?? p?.rating_national ?? null };
      }
    }
    return {
      teamId,
      teamName: await teamName(teamId),
      player,
      compositionStatus: comp ? (comp.status as ScanSide["compositionStatus"]) : "missing",
    };
  };

  const [a, b] = await Promise.all([side(pairing.team_a_id), side(pairing.team_b_id)]);

  const { data: res } = await db
    .from("board_results")
    .select("result")
    .eq("pairing_id", pairing.id)
    .eq("board_number", qr.board_number)
    .maybeSingle();

  return {
    kind: "board",
    ...base,
    roundNumber: round.round_number,
    pairingId: pairing.id,
    a,
    b,
    result: (res?.result as BoardResult | null) ?? null,
    ready: !!a.player && !!b.player,
  };
}
