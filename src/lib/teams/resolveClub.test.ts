import { describe, it, expect } from "vitest";
import { createFakeDb } from "@/test/fakeDb";
import { resolveClubAndNumber } from "./resolveClub";
import { toGreekUpperCase } from "@/lib/transliterate";

function db(
  clubs: { id: string; name: string; type: string; eso_code?: string | null }[] = [],
  teams: { id: string; competition_id: string; club_or_school_id: string; team_number: number }[] = []
) {
  return createFakeDb({
    // name_key: το ίδιο κανονικοποιημένο κλειδί που υπολογίζει η βάση (generated column) —
    // εδώ το προσομοιώνουμε ρητά, όπως ήδη γίνεται για τον κατάλογο αθλητών.
    seed: { clubs_schools: clubs.map((c) => ({ eso_code: null, name_key: toGreekUpperCase(c.name), ...c })), teams },
    relations: {},
    uniques: { clubs_schools: [["name_key"]] },
  }).client;
}

const C = "comp-1";

describe("resolveClubAndNumber — ο υπεύθυνος γράφει πάντα το όνομα (καμία λίστα)", () => {
  it("eso_club: νέο όνομα ΜΕ κωδικό ΕΣΟ δημιουργεί σύλλογο", async () => {
    const d = db();
    const r = await resolveClubAndNumber(d, C, "eso_club", 1, "", "Σ.Ο. Νέος", "2137");
    expect(r.teamNumber).toBe(1);
    const created = await d.from("clubs_schools").select("*").eq("id", r.clubOrSchoolId).single();
    expect(created.data).toMatchObject({ name: "Σ.Ο. ΝΈΟΣ", type: "club", eso_code: "2137" });
  });

  it("eso_club: χωρίς κωδικό ΕΣΟ απορρίπτεται", async () => {
    await expect(resolveClubAndNumber(db(), C, "eso_club", 1, "", "Σ.Ο. Χωρίς Κωδικό", "")).rejects.toThrow(/κωδικός ΕΣΟ/);
    await expect(resolveClubAndNumber(db(), C, "eso_club", 1, "", "Σ.Ο. Χωρίς Κωδικό", "   ")).rejects.toThrow(/κωδικός ΕΣΟ/);
  });

  it("school: νέο όνομα ΧΩΡΙΣ κωδικό (δεν χρειάζεται)", async () => {
    const r = await resolveClubAndNumber(db(), C, "school", 1, "", "4ο Δημοτικό Πολίχνης");
    expect(r.teamNumber).toBe(1);
  });

  it("free_team: νέο όνομα, τύπος club", async () => {
    const r = await resolveClubAndNumber(db(), C, "free_team", 1, "", "Κασκαντέρ");
    expect(r.teamNumber).toBe(1);
  });

  it("κανένα όνομα ούτε επιλογή → σαφές μήνυμα", async () => {
    await expect(resolveClubAndNumber(db(), C, "eso_club", 1, "", "", "2137")).rejects.toThrow(/Γράψτε το όνομα/);
  });
});

describe("resolveClubAndNumber — ΕΥΡΕΣΗ αντί για σφάλμα διπλότυπου (επιβεβαιωμένο)", () => {
  it("ίδιο όνομα που υπάρχει ήδη → ΒΡΙΣΚΕΤΑΙ, δεν πετάει σφάλμα, δεν φτιάχνει δεύτερη εγγραφή", async () => {
    const d = db([{ id: "club-1", name: "Σ.Ο. ΥΠΑΡΧΕΙ", type: "club", eso_code: "9999" }]);
    const r = await resolveClubAndNumber(d, C, "eso_club", 2, "", "σ.ο. υπαρχει", "2137"); // πεζά/τόνοι διαφέρουν
    expect(r.clubOrSchoolId).toBe("club-1");
    const rows = await d.from("clubs_schools").select("id");
    expect(rows.data).toHaveLength(1);
  });

  it("αν ο υπάρχων σύλλογος ΔΕΝ είχε κωδικό, συμπληρώνεται από τη νέα εγγραφή", async () => {
    const d = db([{ id: "club-1", name: "Σ.Ο. Χωρίς Κωδικό", type: "club", eso_code: null }]);
    await resolveClubAndNumber(d, C, "eso_club", 1, "", "Σ.Ο. Χωρίς Κωδικό", "5555");
    const row = await d.from("clubs_schools").select("eso_code").eq("id", "club-1").single();
    expect(row.data.eso_code).toBe("5555");
  });

  it("αν ο υπάρχων σύλλογος ΗΔΗ έχει κωδικό, ΔΕΝ αντικαθίσταται από νέα εγγραφή", async () => {
    const d = db([{ id: "club-1", name: "Σ.Ο. ΜΕ ΚΩΔΙΚΟ", type: "club", eso_code: "1111" }]);
    await resolveClubAndNumber(d, C, "eso_club", 1, "", "Σ.Ο. Με Κωδικό", "9999");
    const row = await d.from("clubs_schools").select("eso_code").eq("id", "club-1").single();
    expect(row.data.eso_code).toBe("1111");
  });

  it("επιλογή με clubOrSchoolId (π.χ. επεξεργασία από admin) παρακάμπτει την αναζήτηση ονόματος", async () => {
    const d = db([{ id: "club-1", name: "Σ.Ο. Α", type: "club" }]);
    const r = await resolveClubAndNumber(d, C, "eso_club", 1, "club-1", "");
    expect(r.clubOrSchoolId).toBe("club-1");
  });

  it("ΒΡΙΣΚΕΤΑΙ ακόμη κι όταν η μία γραφή έχει τόνους και η άλλη όχι (το toUpperCase() του JS ΔΕΝ αφαιρεί τόνους από μόνο του)", async () => {
    const d = db([{ id: "club-1", name: "Σ.Ο. ΧΩΡΙΣ ΤΟΝΟΥΣ", type: "club" }]);
    const r = await resolveClubAndNumber(d, C, "eso_club", 1, "", "Σ.Ο. Χωρίς Τόνους", "2137");
    expect(r.clubOrSchoolId).toBe("club-1");
    expect((await d.from("clubs_schools").select("id")).data).toHaveLength(1);
  });
});

describe("resolveClubAndNumber — αρίθμηση ομάδων (αμετάβλητη λογική)", () => {
  it("eso_club: δεύτερη ομάδα με όριο 1 → μπλοκάρεται (μήνυμα ορίου)", async () => {
    const d = db([{ id: "club-1", name: "Σ.Ο. Α", type: "club" }], [{ id: "t1", competition_id: C, club_or_school_id: "club-1", team_number: 1 }]);
    await expect(resolveClubAndNumber(d, C, "eso_club", 1, "club-1", "")).rejects.toThrow(/μέγιστο/);
  });
  it("eso_club: δεύτερη ομάδα με όριο 2 → team_number 2", async () => {
    const d = db([{ id: "club-1", name: "Σ.Ο. Α", type: "club" }], [{ id: "t1", competition_id: C, club_or_school_id: "club-1", team_number: 1 }]);
    const r = await resolveClubAndNumber(d, C, "eso_club", 2, "", "Σ.Ο. Α", "2137");
    expect(r.teamNumber).toBe(2);
  });
  it("school: δεύτερη ομάδα του ίδιου σχολείου → «ήδη ομάδα»", async () => {
    const d = db([{ id: "sch-1", name: "1ο Δημοτικό", type: "school" }], [{ id: "t1", competition_id: C, club_or_school_id: "sch-1", team_number: 1 }]);
    await expect(resolveClubAndNumber(d, C, "school", 5, "", "1ο Δημοτικό")).rejects.toThrow(/ήδη ομάδα/);
  });
  it("excludeTeamId: η ίδια η ομάδα δεν μετράει ενάντια στο όριό της", async () => {
    const d = db([{ id: "club-1", name: "Σ.Ο. Α", type: "club" }], [{ id: "t1", competition_id: C, club_or_school_id: "club-1", team_number: 1 }]);
    const r = await resolveClubAndNumber(d, C, "eso_club", 1, "club-1", "", undefined, "t1");
    expect(r.teamNumber).toBe(1);
  });
  it("ο ίδιος σύλλογος σε ΑΛΛΗ διοργάνωση δεν μετράει", async () => {
    const d = db([{ id: "club-1", name: "Σ.Ο. Α", type: "club" }], [{ id: "t1", competition_id: "άλλη-διοργάνωση", club_or_school_id: "club-1", team_number: 1 }]);
    const r = await resolveClubAndNumber(d, C, "eso_club", 1, "", "Σ.Ο. Α", "2137");
    expect(r.teamNumber).toBe(1);
  });
});
