import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeDb } from "./fakeDb";

const h = vi.hoisted(() => ({ db: null as any, access: null as any }));

vi.mock("@/lib/supabase/server", () => ({ createClient: () => h.db.client }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/access.server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/access.server")>("@/lib/access.server");
  return { ...actual, getCurrentAccess: async () => h.access };
});

import { submitRoundComposition } from "@/app/captain/[token]/actions";
import { recordBoardResult } from "@/app/r/[token]/actions";
import { extendSubmissionWindow } from "@/app/admin/[id]/rounds/actions";
import { loadCaptainRound, loadRoster, loadRules, finalizeExpiredCompositions } from "@/lib/rounds/server";
import { resolveScan } from "@/lib/rounds/scan";
import { validateComposition } from "@/lib/rosterRules/engine";

const C = "comp1";
const iso = (minAgo: number) => new Date(Date.now() - minAgo * 60_000).toISOString();

function seed() {
  const players: any[] = [];
  const roster: any[] = [];
  for (const [team, prefix] of [["team1", "a"], ["team2", "b"], ["team3", "c"]] as const) {
    for (let i = 1; i <= 6; i++) {
      const id = `${prefix}${i}`;
      players.push({
        id, first_name: `NAME${i}`, last_name: prefix.toUpperCase() + "LAST",
        gender: i % 2 === 0 ? "F" : "M", rating_national: 2000 - i * 50,
      });
      roster.push({ id: `re-${id}`, team_id: team, player_id: id, declared_order: i, default_board: null });
    }
  }
  return createFakeDb({
    seed: {
      competitions: [{ id: C, name: "Δοκιμαστικό" }],
      roster_rules: [{
        competition_id: C, assignment_mode: "strength_order", roster_size: 6, match_board_count: 4,
        reserve_count: 2, one_player_per_category: false,
        board_rules: [
          { board: 1, constraints: [] },
          { board: 2, constraints: [] },
          { board: 3, constraints: [] },
          { board: 4, constraints: [{ type: "gender", value: "F" }], exempt_from_order: true },
        ],
      }],
      clubs_schools: [
        { id: "club1", name: "ΣΟ ΠΟΛΙΧΝΗΣ" }, { id: "club2", name: "ΟΣ ΤΡΙΑΝΔΡΙΑΣ" }, { id: "club3", name: "ΣΑ ΜΟΥΔΑΝΙΩΝ" },
      ],
      teams: [
        { id: "team1", competition_id: C, club_or_school_id: "club1", captain_access_token: "tok1", roster_locked: true, roster_lock_deadline: null, status: "confirmed" },
        { id: "team2", competition_id: C, club_or_school_id: "club2", captain_access_token: "tok2", roster_locked: true, roster_lock_deadline: null, status: "confirmed" },
        { id: "team3", competition_id: C, club_or_school_id: "club3", captain_access_token: "tok3", roster_locked: true, roster_lock_deadline: null, status: "confirmed" },
      ],
      players,
      roster_entries: roster,
      meetings: [
        { id: "meet3", competition_id: C, meeting_number: 3, board_count: 4 },
        { id: "meet4", competition_id: C, meeting_number: 4, board_count: 4 },
        { id: "meet9", competition_id: C, meeting_number: 9, board_count: 4 },
      ],
      qr_tokens: [1, 2, 3, 4].flatMap((b) => [
        { id: `q3-${b}`, meeting_id: "meet3", board_number: b, token: `qr3-${b}` },
        { id: `q4-${b}`, meeting_id: "meet4", board_number: b, token: `qr4-${b}` },
        { id: `q9-${b}`, meeting_id: "meet9", board_number: b, token: `qr9-${b}` },
      ]),
      rounds: [{ id: "round1", competition_id: C, round_number: 1, pairing_published_at: iso(2), submission_window_minutes: 10 }],
      pairings: [
        { id: "pair1", round_id: "round1", team_a_id: "team1", team_b_id: "team2", meeting_id: "meet3" },
        { id: "pair2", round_id: "round1", team_a_id: "team3", team_b_id: null, meeting_id: "meet4" },
      ],
      round_compositions: [], board_assignments: [], board_results: [],
    },
    relations: {
      roster_entries: { players: { table: "players", fk: "player_id" } },
      teams: { clubs_schools: { table: "clubs_schools", fk: "club_or_school_id" } },
    },
    uniques: {
      round_compositions: [["round_id", "team_id"]],
      board_assignments: [["round_composition_id", "board_number"]],
      board_results: [["pairing_id", "board_number"]],
    },
  });
}

const setPublished = (minAgo: number) => {
  h.db.T("rounds")[0].pairing_published_at = iso(minAgo);
};
const VALID_T1 = JSON.stringify([
  { board: 1, player_id: "a1" }, { board: 2, player_id: "a3" }, { board: 3, player_id: "a5" }, { board: 4, player_id: "a2" },
]);
const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };

beforeEach(() => {
  h.db = seed();
  h.access = { role: "super_admin", label: "Isaak", competition_ids: [] };
});

describe("Στάδιο 2 — ο αρχηγός βλέπει τον γύρο", () => {
  it("βρίσκει αντίπαλο, βασική σύνθεση αντιπάλου και ανοιχτό παράθυρο", async () => {
    const r = await loadCaptainRound("team1", C);
    expect(r.kind).toBe("play");
    if (r.kind !== "play") return;
    expect(r.roundNumber).toBe(1);
    expect(r.opponentName).toBe("ΟΣ ΤΡΙΑΝΔΡΙΑΣ");
    expect(r.opponentRoster).toHaveLength(6);
    expect(r.opponentRoster[0].order).toBe(1);
    expect(r.composition).toBeNull();
    expect(r.window.open).toBe(true);
  });

  it("η ομάδα με bye δεν χρειάζεται σύνθεση", async () => {
    const r = await loadCaptainRound("team3", C);
    expect(r).toEqual({ kind: "bye", roundNumber: 1 });
  });

  it("πριν δημοσιευτεί η κλήρωση δεν υπάρχει γύρος", async () => {
    h.db.T("rounds")[0].pairing_published_at = null;
    expect(await loadCaptainRound("team1", C)).toEqual({ kind: "none" });
  });
});

describe("Στάδιο 2 — υποβολή σύνθεσης", () => {
  it("δέχεται έγκυρη σύνθεση και τη γράφει (σύνθεση + 4 σκακιέρες)", async () => {
    const res = await submitRoundComposition("tok1", "round1", VALID_T1);
    expect(res).toEqual({ ok: true });
    const comp = h.db.T("round_compositions");
    expect(comp).toHaveLength(1);
    expect(comp[0]).toMatchObject({ team_id: "team1", status: "submitted", submitted_by: "captain" });
    const assigns = h.db.T("board_assignments").filter((a: any) => a.round_composition_id === comp[0].id);
    expect(assigns.map((a: any) => [a.board_number, a.player_id]).sort()).toEqual([[1, "a1"], [2, "a3"], [3, "a5"], [4, "a2"]]);
  });

  it("μόλις υποβληθεί, δεν αλλάζει", async () => {
    await submitRoundComposition("tok1", "round1", VALID_T1);
    const again = await submitRoundComposition("tok1", "round1", VALID_T1);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.message).toMatch(/έχει ήδη υποβληθεί/);
    expect(h.db.T("round_compositions")).toHaveLength(1);
  });

  it("απορρίπτει αγόρι στη γυναικεία σκακιέρα, με σαφές μήνυμα", async () => {
    const bad = JSON.stringify([
      { board: 1, player_id: "a1" }, { board: 2, player_id: "a3" }, { board: 3, player_id: "a5" }, { board: 4, player_id: "a1x" },
    ]);
    const res = await submitRoundComposition("tok1", "round1", bad);
    expect(res.ok).toBe(false);
    expect(h.db.T("round_compositions")).toHaveLength(0);
  });

  it("απορρίπτει παραβίαση της δηλωμένης σειράς", async () => {
    const bad = JSON.stringify([
      { board: 1, player_id: "a3" }, { board: 2, player_id: "a1" }, { board: 3, player_id: "a5" }, { board: 4, player_id: "a2" },
    ]);
    const res = await submitRoundComposition("tok1", "round1", bad);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/σειρά/);
  });

  it("απορρίπτει αγόρι στη σκακιέρα 4 (a1 = αγόρι)", async () => {
    const bad = JSON.stringify([
      { board: 1, player_id: "a3" }, { board: 2, player_id: "a5" }, { board: 3, player_id: "a2x" }, { board: 4, player_id: "a1" },
    ]);
    const res = await submitRoundComposition("tok1", "round1", bad);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/δεν πληροί/);
  });

  it("απορρίπτει παίκτη άλλης ομάδας", async () => {
    const bad = JSON.stringify([
      { board: 1, player_id: "b1" }, { board: 2, player_id: "a3" }, { board: 3, player_id: "a5" }, { board: 4, player_id: "a2" },
    ]);
    const res = await submitRoundComposition("tok1", "round1", bad);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/δεν ανήκει/);
  });

  it("μετά τη λήξη του παραθύρου δεν δέχεται υποβολή", async () => {
    setPublished(30);
    const res = await submitRoundComposition("tok1", "round1", VALID_T1);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/έχει λήξει/);
  });

  it("άκυρο token → σφάλμα, όχι εγγραφή", async () => {
    const res = await submitRoundComposition("λάθος", "round1", VALID_T1);
    expect(res.ok).toBe(false);
    expect(h.db.T("round_compositions")).toHaveLength(0);
  });

  it("ομάδα με bye δεν μπορεί να υποβάλει", async () => {
    const res = await submitRoundComposition("tok3", "round1", VALID_T1);
    expect(res.ok).toBe(false);
  });

  it("μη έγκυρο JSON → σαφές μήνυμα", async () => {
    const res = await submitRoundComposition("tok1", "round1", "{όχι json");
    expect(res.ok).toBe(false);
  });
});

describe("Λήξη παραθύρου — εφαρμογή της βασικής σύνθεσης", () => {
  it("η ομάδα που δεν υπέβαλε παίρνει εφεδρική σύνθεση που περνά τους κανόνες", async () => {
    setPublished(30);
    const r = await loadCaptainRound("team2", C);
    expect(r.kind).toBe("play");
    if (r.kind !== "play") return;
    expect(r.composition?.status).toBe("used_default");
    expect(r.composition?.assignments).toHaveLength(4);

    const rules = (await loadRules(h.db.client as any, C))!;
    const { roster, players } = await loadRoster(h.db.client as any, "team2");
    const comp = h.db.T("round_compositions").find((c: any) => c.team_id === "team2");
    const assignments = h.db.T("board_assignments")
      .filter((a: any) => a.round_composition_id === comp.id)
      .map((a: any) => ({ board: a.board_number, player_id: a.player_id }));
    expect(validateComposition(rules, roster, players, assignments).valid).toBe(true);
  });

  it("δεν πειράζει σύνθεση που είχε ήδη υποβληθεί εγκαίρως", async () => {
    await submitRoundComposition("tok1", "round1", VALID_T1);
    setPublished(30);
    await finalizeExpiredCompositions("round1");
    const t1 = h.db.T("round_compositions").find((c: any) => c.team_id === "team1");
    expect(t1.status).toBe("submitted");
    const assigns = h.db.T("board_assignments").filter((a: any) => a.round_composition_id === t1.id);
    expect(assigns.find((a: any) => a.board_number === 2).player_id).toBe("a3");
  });

  it("είναι ασφαλές να τρέξει πολλές φορές (δεν διπλογράφει)", async () => {
    setPublished(30);
    await finalizeExpiredCompositions("round1");
    await finalizeExpiredCompositions("round1");
    await finalizeExpiredCompositions("round1");
    expect(h.db.T("round_compositions")).toHaveLength(2); // team1 + team2 (όχι η team3 με bye)
    expect(h.db.T("board_assignments")).toHaveLength(8);
  });

  it("δεν εφαρμόζει εφεδρική όσο το παράθυρο είναι ακόμα ανοιχτό", async () => {
    await finalizeExpiredCompositions("round1");
    expect(h.db.T("round_compositions")).toHaveLength(0);
  });
});

describe("Χειροκίνητη παράταση από τον υπεύθυνο κληρώσεων", () => {
  it("ξανανοίγει το παράθυρο ομάδας που είχε πάρει εφεδρική σύνθεση", async () => {
    setPublished(30);
    await loadCaptainRound("team2", C); // εφαρμόζεται η εφεδρική
    expect(h.db.T("round_compositions").find((c: any) => c.team_id === "team2").status).toBe("used_default");

    await extendSubmissionWindow(C, "round1", "team2", fd({ minutes: "10" }));

    const comp = h.db.T("round_compositions").find((c: any) => c.team_id === "team2");
    expect(comp.status).toBe("open");
    expect(new Date(comp.extended_until).getTime()).toBeGreaterThan(Date.now());
    expect(h.db.T("board_assignments").filter((a: any) => a.round_composition_id === comp.id)).toHaveLength(0);

    const r = await loadCaptainRound("team2", C);
    if (r.kind !== "play") throw new Error("αναμενόταν play");
    expect(r.window.open).toBe(true);
    expect(r.composition).toBeNull(); // δεν ξαναεφαρμόζεται εφεδρική όσο ισχύει η παράταση
  });

  it("μετά την παράταση ο αρχηγός μπορεί να υποβάλει κανονικά", async () => {
    setPublished(30);
    await extendSubmissionWindow(C, "round1", "team1", fd({ minutes: "5" }));
    const res = await submitRoundComposition("tok1", "round1", VALID_T1);
    expect(res).toEqual({ ok: true });
  });

  it("δεν επιτρέπεται παράταση σε ομάδα που έχει ήδη υποβάλει", async () => {
    await submitRoundComposition("tok1", "round1", VALID_T1);
    await expect(extendSubmissionWindow(C, "round1", "team1", fd({ minutes: "5" }))).rejects.toThrow(/έχει ήδη υποβάλει/);
  });

  it("απορρίπτει παράνομη διάρκεια", async () => {
    await expect(extendSubmissionWindow(C, "round1", "team1", fd({ minutes: "0" }))).rejects.toThrow();
    await expect(extendSubmissionWindow(C, "round1", "team1", fd({ minutes: "500" }))).rejects.toThrow();
  });
});

describe("Σάρωση QR από τον διαιτητή", () => {
  async function bothReady() {
    await submitRoundComposition("tok1", "round1", VALID_T1);
    setPublished(30); // λήγει το παράθυρο της team2 → εφεδρική
  }

  it("άγνωστο QR", async () => {
    expect((await resolveScan("δεν-υπάρχει")).kind).toBe("unknown_token");
  });

  it("Συνάντηση χωρίς κλήρωση", async () => {
    expect((await resolveScan("qr9-1")).kind).toBe("no_round");
  });

  it("Συνάντηση με bye", async () => {
    const s = await resolveScan("qr4-1");
    expect(s.kind).toBe("bye");
    if (s.kind === "bye") expect(s.teamName).toBe("ΣΑ ΜΟΥΔΑΝΙΩΝ");
  });

  it("δείχνει Συνάντηση, Σκακιέρα και τους σωστούς παίκτες και των δύο ομάδων", async () => {
    await bothReady();
    const s = await resolveScan("qr3-2");
    expect(s.kind).toBe("board");
    if (s.kind !== "board") return;
    expect(s.meetingNumber).toBe(3);
    expect(s.boardNumber).toBe(2);
    expect(s.roundNumber).toBe(1);
    expect(s.a.teamName).toBe("ΣΟ ΠΟΛΙΧΝΗΣ");
    expect(s.a.player?.name).toBe("ALAST NAME3"); // a3 στη σκακιέρα 2 (υποβλήθηκε)
    expect(s.b.teamName).toBe("ΟΣ ΤΡΙΑΝΔΡΙΑΣ");
    expect(s.b.player).not.toBeNull(); // εφεδρική σύνθεση της team2
    expect(s.ready).toBe(true);
    expect(s.result).toBeNull();
  });

  it("η γυναικεία σκακιέρα 4 δείχνει την υποβληθείσα αθλήτρια", async () => {
    await bothReady();
    const s = await resolveScan("qr3-4");
    if (s.kind !== "board") throw new Error("αναμενόταν board");
    expect(s.a.player?.name).toBe("ALAST NAME2");
  });

  it("όσο η άλλη ομάδα δεν έχει σύνθεση (παράθυρο ανοιχτό), δεν είναι έτοιμο για αποτέλεσμα", async () => {
    await submitRoundComposition("tok1", "round1", VALID_T1);
    const s = await resolveScan("qr3-1");
    if (s.kind !== "board") throw new Error("αναμενόταν board");
    expect(s.a.player).not.toBeNull();
    expect(s.b.player).toBeNull();
    expect(s.ready).toBe(false);
  });
});

describe("Καταχώρηση αποτελέσματος", () => {
  async function bothReady() {
    await submitRoundComposition("tok1", "round1", VALID_T1);
    setPublished(30);
  }

  it("ο super_admin καταχωρεί αποτέλεσμα και φαίνεται στη σάρωση", async () => {
    await bothReady();
    await recordBoardResult("qr3-1", "1-0");
    const rows = h.db.T("board_results");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ pairing_id: "pair1", board_number: 1, result: "1-0" });
    const s = await resolveScan("qr3-1");
    if (s.kind === "board") expect(s.result).toBe("1-0");
  });

  it("η διόρθωση αποτελέσματος αντικαθιστά, δεν διπλογράφει", async () => {
    await bothReady();
    await recordBoardResult("qr3-1", "1-0");
    await recordBoardResult("qr3-1", "1/2-1/2");
    const rows = h.db.T("board_results");
    expect(rows).toHaveLength(1);
    expect(rows[0].result).toBe("1/2-1/2");
  });

  it("διαφορετικές σκακιέρες γράφουν ξεχωριστές γραμμές", async () => {
    await bothReady();
    await recordBoardResult("qr3-1", "1-0");
    await recordBoardResult("qr3-2", "0-1");
    expect(h.db.T("board_results")).toHaveLength(2);
  });

  it("απορρίπτει άκυρη τιμή αποτελέσματος", async () => {
    await bothReady();
    await expect(recordBoardResult("qr3-1", "3-0")).rejects.toThrow(/Μη έγκυρο/);
    expect(h.db.T("board_results")).toHaveLength(0);
  });

  it("χωρίς σύνδεση δεν καταχωρεί", async () => {
    await bothReady();
    h.access = null;
    await expect(recordBoardResult("qr3-1", "1-0")).rejects.toThrow(/δικαίωμα/);
    expect(h.db.T("board_results")).toHaveLength(0);
  });

  it("διαιτητής άλλης διοργάνωσης δεν καταχωρεί", async () => {
    await bothReady();
    h.access = { role: "referee", label: "Δ", competition_ids: ["άλλη-διοργάνωση"] };
    await expect(recordBoardResult("qr3-1", "1-0")).rejects.toThrow(/δικαίωμα/);
  });

  it("διαιτητής της διοργάνωσης καταχωρεί κανονικά", async () => {
    await bothReady();
    h.access = { role: "referee", label: "Δ", competition_ids: [C] };
    await recordBoardResult("qr3-3", "0-1");
    expect(h.db.T("board_results")[0]).toMatchObject({ board_number: 3, result: "0-1" });
  });

  it("δεν καταχωρεί όσο λείπει η σύνθεση μιας ομάδας", async () => {
    await submitRoundComposition("tok1", "round1", VALID_T1); // team2 ακόμα σε αναμονή
    await expect(recordBoardResult("qr3-1", "1-0")).rejects.toThrow(/συνθέσεις/);
  });

  it("δεν καταχωρεί σε Συνάντηση χωρίς παρτίδα (bye)", async () => {
    await expect(recordBoardResult("qr4-1", "1-0")).rejects.toThrow(/παρτίδα/);
  });
});
