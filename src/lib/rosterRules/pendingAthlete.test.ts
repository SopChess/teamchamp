import { describe, it, expect } from "vitest";
import { parsePendingAthletes } from "./pendingAthlete";

describe("parsePendingAthletes", () => {
  it("κενή/απούσα λίστα → άδειος πίνακας", () => {
    expect(parsePendingAthletes("")).toEqual([]);
    expect(parsePendingAthletes("[]")).toEqual([]);
  });

  it("άκυρο JSON → σαφές μήνυμα", () => {
    expect(() => parsePendingAthletes("{όχι json")).toThrow(/Μη έγκυρη λίστα/);
  });

  it("όχι πίνακας → σαφές μήνυμα", () => {
    expect(() => parsePendingAthletes('{"a":1}')).toThrow(/Μη έγκυρη λίστα/);
  });

  it("αθλητής από κατάλογο: πλήρες", () => {
    const r = parsePendingAthletes(JSON.stringify([{ source: "directory", directoryId: "PLR-1", gender: "M", label: "Παπάς Γιώργος" }]));
    expect(r).toEqual([{ source: "directory", directoryId: "PLR-1", gender: "M", label: "Παπάς Γιώργος" }]);
  });

  it("αθλητής από κατάλογο χωρίς κωδικό → σαφές μήνυμα με αριθμό γραμμής", () => {
    expect(() => parsePendingAthletes(JSON.stringify([{ source: "directory", directoryId: "", gender: "M" }]))).toThrow(/Αθλητής 1.*κωδικός/);
  });

  it("χειροκίνητος αθλητής: πλήρης", () => {
    const r = parsePendingAthletes(JSON.stringify([{ source: "manual", gender: "F", first_name: "Maria", last_name: "K", birth_date: "2012-01-01", rating_national: "1200", rating_fide: "" }]));
    expect(r).toEqual([{ source: "manual", gender: "F", first_name: "Maria", last_name: "K", birth_date: "2012-01-01", rating_national: 1200, rating_fide: null, label: "K Maria" }]);
  });

  it("χειροκίνητος χωρίς όνομα/επώνυμο → σαφές μήνυμα", () => {
    expect(() => parsePendingAthletes(JSON.stringify([{ source: "manual", gender: "M", first_name: "", last_name: "K" }]))).toThrow(/Αθλητής 1.*υποχρεωτικά/);
  });

  it("άκυρο ή απόν φύλο → σαφές μήνυμα", () => {
    expect(() => parsePendingAthletes(JSON.stringify([{ source: "manual", first_name: "A", last_name: "B" }]))).toThrow(/φύλο/);
    expect(() => parsePendingAthletes(JSON.stringify([{ source: "manual", gender: "X", first_name: "A", last_name: "B" }]))).toThrow(/φύλο/);
  });

  it("κενά γενέθλια/βαθμοί γίνονται null, όχι σφάλμα", () => {
    const r = parsePendingAthletes(JSON.stringify([{ source: "manual", gender: "M", first_name: "A", last_name: "B" }]));
    expect(r[0]).toMatchObject({ birth_date: null, rating_national: null, rating_fide: null });
  });

  it("μη αριθμητικός βαθμός γίνεται null σιωπηλά (δεν σκάει)", () => {
    const r = parsePendingAthletes(JSON.stringify([{ source: "manual", gender: "M", first_name: "A", last_name: "B", rating_national: "abc" }]));
    expect(r[0]).toMatchObject({ rating_national: null });
  });

  it("το μήνυμα σφάλματος αναφέρει τη ΣΩΣΤΗ γραμμή σε λίστα πολλών αθλητών", () => {
    const rows = [
      { source: "directory", directoryId: "PLR-1", gender: "M" },
      { source: "manual", gender: "M", first_name: "", last_name: "B" },
    ];
    expect(() => parsePendingAthletes(JSON.stringify(rows))).toThrow(/Αθλητής 2/);
  });

  it("μη-αντικείμενο μέσα στη λίστα → σαφές μήνυμα", () => {
    expect(() => parsePendingAthletes(JSON.stringify(["όχι αντικείμενο"]))).toThrow(/Αθλητής 1/);
    expect(() => parsePendingAthletes(JSON.stringify([null]))).toThrow(/Αθλητής 1/);
  });
});
