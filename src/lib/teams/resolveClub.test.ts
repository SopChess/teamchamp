import { describe, it, expect } from "vitest";
import { createFakeDb } from "@/test/fakeDb";
import { resolveClubAndNumber } from "./resolveClub";

function db(clubs: { id: string; name: string; type: string }[] = [], teams: { id: string; competition_id: string; club_or_school_id: string; team_number: number }[] = []) {
  return createFakeDb({
    seed: { clubs_schools: clubs, teams },
    relations: {},
    uniques: { clubs_schools: [["name"]] },
  }).client;
}

const C = "comp-1";

describe("resolveClubAndNumber — eso_club / school (καμία ελεύθερη επωνυμία)", () => {
  it("επιλογή υπάρχοντος συλλόγου, πρώτη ομάδα → team_number 1", async () => {
    const d = db([{ id: "club-1", name: "Σ.Ο. Α", type: "club" }]);
    const r = await resolveClubAndNumber(d, C, "eso_club", 1, "club-1", "");
    expect(r).toEqual({ clubOrSchoolId: "club-1", teamNumber: 1 });
  });

  it("νέο όνομα απορρίπτεται", async () => {
    const d = db();
    await expect(resolveClubAndNumber(d, C, "eso_club", 1, "", "Νέος Σύλλογος")).rejects.toThrow(/δεν επιτρέπεται ελεύθερη επωνυμία/);
    await expect(resolveClubAndNumber(d, C, "school", 1, "", "Νέο Σχολείο")).rejects.toThrow(/δεν επιτρέπεται ελεύθερη επωνυμία/);
  });

  it("χωρίς καμία επιλογή → σαφές μήνυμα", async () => {
    await expect(resolveClubAndNumber(db(), C, "eso_club", 1, "", "")).rejects.toThrow(/Επιλέξτε σύλλογο/);
  });

  it("δεύτερη ομάδα του ίδιου συλλόγου με όριο 1 → μπλοκάρεται (μήνυμα ορίου)", async () => {
    const d = db([{ id: "club-1", name: "Σ.Ο. Α", type: "club" }], [{ id: "t1", competition_id: C, club_or_school_id: "club-1", team_number: 1 }]);
    await expect(resolveClubAndNumber(d, C, "eso_club", 1, "club-1", "")).rejects.toThrow(/μέγιστο/);
  });
  it("school: δεύτερη ομάδα του ίδιου σχολείου → «ήδη ομάδα» (όχι μήνυμα ορίου)", async () => {
    const d = db([{ id: "sch-1", name: "1ο Δημοτικό", type: "school" }], [{ id: "t1", competition_id: C, club_or_school_id: "sch-1", team_number: 1 }]);
    await expect(resolveClubAndNumber(d, C, "school", 5, "sch-1", "")).rejects.toThrow(/ήδη ομάδα/);
  });

  it("δεύτερη ομάδα με όριο 2 → team_number 2", async () => {
    const d = db([{ id: "club-1", name: "Σ.Ο. Α", type: "club" }], [{ id: "t1", competition_id: C, club_or_school_id: "club-1", team_number: 1 }]);
    const r = await resolveClubAndNumber(d, C, "eso_club", 2, "club-1", "");
    expect(r.teamNumber).toBe(2);
  });
});

describe("resolveClubAndNumber — free_team (ελεύθερη επωνυμία)", () => {
  it("νέο όνομα δημιουργεί σύλλογο τύπου club", async () => {
    const d = db();
    const r = await resolveClubAndNumber(d, C, "free_team", 1, "", "Κασκαντέρ");
    expect(r.teamNumber).toBe(1);
    const created = await d.from("clubs_schools").select("*").eq("id", r.clubOrSchoolId).single();
    expect(created.data).toMatchObject({ name: "ΚΑΣΚΑΝΤΈΡ", type: "club" });
  });

  it("διπλότυπο νέο όνομα → σαφές μήνυμα", async () => {
    const d = db([{ id: "existing", name: "ΚΑΣΚΑΝΤΈΡ", type: "club" }]);
    await expect(resolveClubAndNumber(d, C, "free_team", 1, "", "Κασκαντέρ")).rejects.toThrow(/Υπάρχει ήδη/);
  });
});

describe("resolveClubAndNumber — excludeTeamId (επεξεργασία υπάρχουσας ομάδας)", () => {
  it("η ίδια η ομάδα δεν μετράει ενάντια στο όριό της", async () => {
    const d = db([{ id: "club-1", name: "Σ.Ο. Α", type: "club" }], [{ id: "t1", competition_id: C, club_or_school_id: "club-1", team_number: 1 }]);
    const r = await resolveClubAndNumber(d, C, "eso_club", 1, "club-1", "", "t1");
    expect(r.teamNumber).toBe(1); // ξαναπαίρνει το 1, όχι μπλοκάρισμα ούτε 2
  });
});
