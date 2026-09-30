import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeDb } from "./fakeDb";
import { toGreekUpperCase } from "@/lib/transliterate";

const h = vi.hoisted(() => ({ db: null as any }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => h.db.client }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  searchDirectory, searchDirectoryByNumber, addDirectoryPlayerToRoster, addPlayerToRoster, removeRosterEntry,
} from "@/app/captain/[token]/actions";

const C = "comp1", C2 = "comp2";
// Οι στήλες epitheto_key/onoma_key είναι "generated" στη βάση (κεφαλαία, χωρίς τόνους) — εδώ τις
// υπολογίζουμε με τον ίδιο κανόνα, αφού η προσομοίωση δεν έχει generated columns.
const keyOf = (s: string) => toGreekUpperCase(s);
const dirRow = (id: string, epitheto: string, onoma: string, over: Record<string, any> = {}) => ({
  id, eso_id: id.replace(/\D/g, "") || null, fide_id: null, epitheto, onoma, club: "ΣΟ ΠΟΛΙΧΝΗΣ",
  epitheto_key: keyOf(epitheto), onoma_key: keyOf(onoma),
  birthday: "17/08/2012", rating_eso: "1500", rating_fide_standard: null, rating_fide_rapid: null, rating_fide_blitz: null,
  ...over,
});

function seed(opts: { rosterSize?: number; lockedTeam2?: boolean } = {}) {
  const directory = [
    dirRow("PLR-00017", "ΤΣΟΥΡΟΣ", "ΓΕΩΡΓΙΟΣ", { fide_id: "4200330", rating_fide_standard: "2162", birthday: "17/08/2012" }),
    dirRow("PLR-00018", "ΠΑΠΑΔΟΠΟΥΛΟΥ", "ΜΑΡΙΑ-ΕΛΕΝΗ", { birthday: "03/03/2013", rating_eso: "0" }),
    dirRow("PLR-00019", "ΜΠΑΜΠΗΣ", "ΝΙΚΟΛΑΟΣ", { birthday: "" }),
    dirRow("PLR-00020", "ΓΕΩΡΓΙΟΥ", "ΑΝΝΑ", { birthday: "01/01/2011" }),
    // όπως οι ~17 γραμμές του πραγματικού καταλόγου που έχουν τόνο ή πεζά στην πηγή
    dirRow("PLR-00021", "ΠΟΛΊΧΝΗΣ", "ΕΛΈΝΗ", { birthday: "05/05/2012" }),
    dirRow("PLR-00022", "Λευκά", "Άννα", { birthday: "06/06/2012" }),
    ...Array.from({ length: 20 }, (_, i) => dirRow(`PLR-1${String(i).padStart(4, "0")}`, "ΚΟΥΛΙΝΑΣ", `ΟΝΟΜΑ${String.fromCharCode(65 + i)}`, { birthday: `01/01/${2000 + i}` })),
  ];
  return createFakeDb({
    seed: {
      competitions: [{ id: C, name: "Α" }, { id: C2, name: "Β" }],
      roster_rules: [{
        competition_id: C, assignment_mode: "strength_order", roster_size: opts.rosterSize ?? 6, match_board_count: 4,
        board_rules: [{ board: 1, constraints: [] }],
      }],
      clubs_schools: [{ id: "c1", name: "ΣΟ ΠΟΛΙΧΝΗΣ" }, { id: "c2", name: "ΟΣ ΤΡΙΑΝΔΡΙΑΣ" }],
      teams: [
        { id: "team1", competition_id: C, club_or_school_id: "c1", captain_access_token: "tok1", roster_locked: false, roster_lock_deadline: null },
        { id: "team2", competition_id: C, club_or_school_id: "c2", captain_access_token: "tok2", roster_locked: !!opts.lockedTeam2, roster_lock_deadline: null },
        { id: "team3", competition_id: C2, club_or_school_id: "c1", captain_access_token: "tok3", roster_locked: false, roster_lock_deadline: null },
      ],
      players_directory: directory,
      players: [], roster_entries: [],
    },
    relations: { teams: { competitions: { table: "competitions", fk: "competition_id" } } },
    uniques: { roster_entries: [["team_id", "player_id"], ["team_id", "declared_order"]] },
  });
}

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const rosterOf = (team: string) => h.db.T("roster_entries").filter((r: any) => r.team_id === team);
const playerOf = (id: string) => h.db.T("players").find((p: any) => p.id === id);

beforeEach(() => { h.db = seed(); });

describe("αναζήτηση — τόνοι και πεζά/κεφαλαία στην πηγή", () => {
  it("βρίσκει επώνυμο που στην πηγή έχει τόνο, ακόμη κι αν ο χρήστης γράψει χωρίς τόνο", async () => {
    const hits = await searchDirectory("tok1", undefined, "ΠΟΛΙΧΝΗΣ", "");
    expect(hits.map((h) => h.epitheto)).toEqual(["ΠΟΛΊΧΝΗΣ"]);
  });
  it("βρίσκει και όταν ο χρήστης γράψει με τόνο ή πεζά", async () => {
    expect((await searchDirectory("tok1", undefined, "Πολίχνης", "")).map((h) => h.id)).toEqual(["PLR-00021"]);
    expect((await searchDirectory("tok1", undefined, "πολιχνησ", "")).map((h) => h.id)).toEqual(["PLR-00021"]);
  });
  it("βρίσκει επώνυμο και όνομα γραμμένα με πεζά στην πηγή", async () => {
    expect((await searchDirectory("tok1", undefined, "ΛΕΥΚΑ", "ΑΝΝΑ")).map((h) => h.id)).toEqual(["PLR-00022"]);
  });
  it("ο χαρακτήρας % δεν λειτουργεί ως μπαλαντέρ (δεν επιστρέφει όλο τον κατάλογο)", async () => {
    expect(await searchDirectory("tok1", undefined, "%%", "")).toEqual([]);
    expect(await searchDirectory("tok1", undefined, "ΤΣ_ΡΟΣ", "")).toEqual([]);
  });
});

describe("αναζήτηση στον κατάλογο", () => {
  it("βρίσκει με επώνυμο και επιστρέφει μόνο τα απαραίτητα (έτος, όχι πλήρη γενέθλια)", async () => {
    const hits = await searchDirectory("tok1", undefined, "τσουρος", "");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ epitheto: "ΤΣΟΥΡΟΣ", onoma: "ΓΕΩΡΓΙΟΣ", birthYear: 2012, rating: 2162 });
    const json = JSON.stringify(hits);
    expect(json).not.toContain("17/08");
    expect(json).not.toContain("4200330"); // ούτε το FIDE ID
  });

  it("δουλεύει με πεζά και τόνους (Τσούρος)", async () => {
    expect((await searchDirectory("tok1", undefined, "Τσούρος", "")).map((x) => x.id)).toEqual(["PLR-00017"]);
  });

  it("το όνομα στενεύει τα αποτελέσματα", async () => {
    const hits = await searchDirectory("tok1", undefined, "ΓΕΩΡΓΙΟ", "ΑΝΝΑ");
    expect(hits.map((x) => x.id)).toEqual(["PLR-00020"]);
  });

  it("επώνυμο κάτω από 2 γράμματα δεν επιστρέφει τίποτα", async () => {
    expect(await searchDirectory("tok1", undefined, "Τ", "")).toEqual([]);
    expect(await searchDirectory("tok1", undefined, "", "")).toEqual([]);
  });

  it("ΠΟΤΕ περισσότερα από 15 αποτελέσματα (δεν 'κατεβαίνει' ο κατάλογος)", async () => {
    const hits = await searchDirectory("tok1", undefined, "ΚΟΥΛΙΝΑΣ", "");
    expect(hits).toHaveLength(15);
  });

  it("χωρίς έγκυρο link αρχηγού δεν επιστρέφει τίποτα (ο κατάλογος δεν είναι δημόσιος)", async () => {
    expect(await searchDirectory("λάθος", undefined, "ΤΣΟΥΡΟΣ", "")).toEqual([]);
    expect(await searchDirectory("", undefined, "ΤΣΟΥΡΟΣ", "")).toEqual([]);
  });

  it("χαρακτήρες φίλτρων στον όρο δεν σπάνε ούτε αλλάζουν το ερώτημα", async () => {
    expect(await searchDirectory("tok1", undefined, "ΤΣΟΥΡΟΣ%,eso_id.eq.1)(", "")).toEqual([]);
    expect(await searchDirectory("tok1", undefined, "%%", "")).toEqual([]);
  });

  it("αναζήτηση με ΑΜ ΕΣΟ και με FIDE ID", async () => {
    expect((await searchDirectoryByNumber("tok1", undefined, "00017"))?.id ?? (await searchDirectoryByNumber("tok1", undefined, "17"))?.id).toBe("PLR-00017");
    expect((await searchDirectoryByNumber("tok1", undefined, "4200330"))?.id).toBe("PLR-00017");
    expect(await searchDirectoryByNumber("tok1", undefined, "99999999")).toBeNull();
    expect(await searchDirectoryByNumber("tok1", undefined, "abc")).toBeNull();
    expect(await searchDirectoryByNumber("λάθος", undefined, "4200330")).toBeNull();
  });
});

describe("προσθήκη από τον κατάλογο — φύλο υποχρεωτικό", () => {
  it("χωρίς φύλο ή με άκυρο φύλο απορρίπτεται και δεν γράφεται τίποτα", async () => {
    for (const g of ["", "X", "m", "Άνδρας"]) {
      const r = await addDirectoryPlayerToRoster("tok1", undefined, "PLR-00017", g);
      expect(r.ok).toBe(false);
    }
    expect(h.db.T("players")).toHaveLength(0);
    expect(rosterOf("team1")).toHaveLength(0);
  });

  it("προσθέτει με λατινικά ονόματα, το φύλο που επέλεξε ο υπεύθυνος, και τα στοιχεία από τον κατάλογο", async () => {
    const r = await addDirectoryPlayerToRoster("tok1", undefined, "PLR-00018", "F");
    expect(r).toEqual({ ok: true });
    const entry = rosterOf("team1")[0];
    expect(entry.declared_order).toBe(1);
    expect(playerOf(entry.player_id)).toMatchObject({
      last_name: "PAPADOPOULOU", first_name: "Maria-Eleni", gender: "F",
      birth_date: "2013-03-03", rating_national: null, directory_id: "PLR-00018",
    });
  });

  it("το φύλο είναι ΑΚΡΙΒΩΣ αυτό που επιλέχθηκε, ακόμα κι αν το όνομα 'δείχνει' άλλο", async () => {
    await addDirectoryPlayerToRoster("tok1", undefined, "PLR-00019", "F"); // ΝΙΚΟΛΑΟΣ ως Γυναίκα (επιλογή υπευθύνου)
    expect(playerOf(rosterOf("team1")[0].player_id).gender).toBe("F");
  });

  it("διαβάζει βαθμούς από τον κατάλογο: FIDE και εθνικός, το 0 ως χωρίς βαθμό", async () => {
    await addDirectoryPlayerToRoster("tok1", undefined, "PLR-00017", "M");
    expect(playerOf(rosterOf("team1")[0].player_id)).toMatchObject({ rating_fide: 2162, rating_national: 1500, fide_id: "4200330" });
  });

  it("αθλητής χωρίς γενέθλια προστίθεται με birth_date null", async () => {
    await addDirectoryPlayerToRoster("tok1", undefined, "PLR-00019", "M");
    expect(playerOf(rosterOf("team1")[0].player_id).birth_date).toBeNull();
  });

  it("άγνωστος κωδικός καταλόγου", async () => {
    const r = await addDirectoryPlayerToRoster("tok1", undefined, "PLR-ΔΕΝ-ΥΠΑΡΧΕΙ", "M");
    expect(r).toEqual({ ok: false, message: "Ο αθλητής δεν βρέθηκε στον κατάλογο." });
  });

  it("άκυρο link αρχηγού", async () => {
    const r = await addDirectoryPlayerToRoster("λάθος", undefined, "PLR-00017", "M");
    expect(r.ok).toBe(false);
    expect(h.db.T("players")).toHaveLength(0);
  });
});

describe("έλεγχος διπλής εγγραφής σε όλη τη διοργάνωση", () => {
  it("ο ίδιος αθλητής δεν μπαίνει δύο φορές στην ίδια ομάδα", async () => {
    await addDirectoryPlayerToRoster("tok1", undefined, "PLR-00017", "M");
    const again = await addDirectoryPlayerToRoster("tok1", undefined, "PLR-00017", "M");
    expect(again).toEqual({ ok: false, message: "Ο αθλητής είναι ήδη στη βασική σύνθεση της ομάδας σας." });
    expect(rosterOf("team1")).toHaveLength(1);
  });

  it("ο ίδιος αθλητής δεν μπαίνει σε άλλη ομάδα της ΙΔΙΑΣ διοργάνωσης", async () => {
    await addDirectoryPlayerToRoster("tok1", undefined, "PLR-00017", "M");
    const other = await addDirectoryPlayerToRoster("tok2", undefined, "PLR-00017", "M");
    expect(other).toEqual({ ok: false, message: "Ο αθλητής είναι ήδη δηλωμένος σε άλλη ομάδα της διοργάνωσης." });
    expect(rosterOf("team2")).toHaveLength(0);
  });

  it("μπορεί όμως να μπει σε ομάδα ΑΛΛΗΣ διοργάνωσης, με επαναχρησιμοποίηση της εγγραφής του", async () => {
    await addDirectoryPlayerToRoster("tok1", undefined, "PLR-00017", "M");
    const r = await addDirectoryPlayerToRoster("tok3", undefined, "PLR-00017", "M");
    expect(r).toEqual({ ok: true });
    expect(h.db.T("players")).toHaveLength(1); // μία εγγραφή αθλητή, όχι δύο
    expect(rosterOf("team3")).toHaveLength(1);
  });

  it("η χειροκίνητη καταχώρηση του ίδιου αθλητή (λατινικά) αναγνωρίζεται ως διπλή", async () => {
    await addDirectoryPlayerToRoster("tok1", undefined, "PLR-00017", "M"); // ΤΣΟΥΡΟΣ ΓΕΩΡΓΙΟΣ, γεν. 2012
    await expect(
      addPlayerToRoster("tok2", undefined, fd({ first_name: "Georgios", last_name: "Tsouros", birth_date: "2012-01-01", gender: "M" }))
    ).rejects.toThrow(/ήδη δηλωμένος σε άλλη ομάδα/);
  });

  it("ίδιο ονοματεπώνυμο με ΔΙΑΦΟΡΕΤΙΚΟ έτος γέννησης είναι άλλος αθλητής", async () => {
    await addDirectoryPlayerToRoster("tok1", undefined, "PLR-00017", "M");
    await addPlayerToRoster("tok2", undefined, fd({ first_name: "Georgios", last_name: "Tsouros", birth_date: "1946-01-01", gender: "M" }));
    expect(rosterOf("team2")).toHaveLength(1);
  });
});

describe("όριο αθλητών και σειρά", () => {
  it("δεν υπερβαίνει τον αριθμό αθλητών της βασικής σύνθεσης", async () => {
    h.db = seed({ rosterSize: 2 });
    expect((await addDirectoryPlayerToRoster("tok1", undefined, "PLR-00017", "M")).ok).toBe(true);
    expect((await addDirectoryPlayerToRoster("tok1", undefined, "PLR-00018", "F")).ok).toBe(true);
    const third = await addDirectoryPlayerToRoster("tok1", undefined, "PLR-00020", "F");
    expect(third).toEqual({ ok: false, message: "Η βασική σύνθεση επιτρέπει το πολύ 2 αθλητές." });
    expect(rosterOf("team1")).toHaveLength(2);
  });

  it("ΔΙΟΡΘΩΣΗ ΛΑΘΟΥΣ: μετά από αφαίρεση αθλητή από τη μέση, η νέα προσθήκη δεν συγκρούεται με θέση", async () => {
    await addDirectoryPlayerToRoster("tok1", undefined, "PLR-00017", "M");
    await addDirectoryPlayerToRoster("tok1", undefined, "PLR-00018", "F");
    await addDirectoryPlayerToRoster("tok1", undefined, "PLR-00020", "F");
    const middle = rosterOf("team1").find((r: any) => r.declared_order === 2);
    await removeRosterEntry("tok1", undefined, middle.id); // μένουν οι θέσεις 1 και 3
    const r = await addDirectoryPlayerToRoster("tok1", undefined, "PLR-00019", "M");
    expect(r).toEqual({ ok: true }); // πριν τη διόρθωση: πλήθος+1 = 3 → σύγκρουση με την υπάρχουσα θέση 3
    expect(rosterOf("team1").map((x: any) => x.declared_order).sort()).toEqual([1, 3, 4]);
  });

  it("κλειδωμένη βασική σύνθεση δεν δέχεται προσθήκες", async () => {
    h.db = seed({ lockedTeam2: true });
    const r = await addDirectoryPlayerToRoster("tok2", undefined, "PLR-00017", "M");
    expect(r).toEqual({ ok: false, message: "Η βασική σύνθεση είναι ήδη κλειδωμένη." });
    expect(rosterOf("team2")).toHaveLength(0);
  });
});

describe("χειροκίνητη προσθήκη — φύλο υποχρεωτικό", () => {
  const base = { first_name: "Nikos", last_name: "Alexiou", birth_date: "2011-04-04" };

  it("χωρίς φύλο απορρίπτεται", async () => {
    await expect(addPlayerToRoster("tok1", undefined, fd({ ...base }))).rejects.toThrow(/φύλο/);
    await expect(addPlayerToRoster("tok1", undefined, fd({ ...base, gender: "" }))).rejects.toThrow(/φύλο/);
    await expect(addPlayerToRoster("tok1", undefined, fd({ ...base, gender: "X" }))).rejects.toThrow(/φύλο/);
    expect(h.db.T("players")).toHaveLength(0);
  });

  it("με φύλο περνά και αποθηκεύει σωστά", async () => {
    await addPlayerToRoster("tok1", undefined, fd({ ...base, gender: "F", rating_national: "1400", national_id: "555" }));
    expect(playerOf(rosterOf("team1")[0].player_id)).toMatchObject({
      first_name: "Nikos", last_name: "Alexiou", gender: "F", rating_national: 1400, national_id: "555",
    });
  });

  it("απαιτεί όνομα και επώνυμο", async () => {
    await expect(addPlayerToRoster("tok1", undefined, fd({ first_name: "", last_name: "X", gender: "M" }))).rejects.toThrow(/υποχρεωτικά/);
  });
});
