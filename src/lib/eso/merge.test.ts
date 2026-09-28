import { describe, it, expect } from "vitest";
import { compareKey, mergeEsoRow, nextPlrId, type DirectoryRecord } from "./merge";
import type { EsoRow } from "./parse";

const dir = (o: Partial<DirectoryRecord> = {}): DirectoryRecord => ({
  id: "PLR-00001", eso_id: "1", fide_id: null, epitheto: "ΠΑΠΑΝΙΚΟΛΑΟΥ", onoma: "ΓΕΩΡΓΙΟΣ", club: "ΦΟ ΤΡΙΠΟΛΕΩΣ",
  birthday: "01/01/1951", rating_eso: "1340", rating_fide_standard: null, rating_fide_rapid: null, rating_fide_blitz: null,
  sex_eso: null, lastname_en: null, firstname_en: null, ...o,
});
const eso = (o: Partial<EsoRow> = {}): EsoRow => ({
  eso_id: "1", fide_id: null, epitheto: "ΠΑΠΑΝΙΚΟΛΑΟΥ", onoma: "ΓΕΩΡΓΙΟΣ", club: "ΦΟ ΤΡΙΠΟΛΕΩΣ", birthday: "01/01/1951",
  rating: 1340, sex: null, lastname_en: null, firstname_en: null, ...o,
});
const kinds = (r: ReturnType<typeof mergeEsoRow>) => r.changes.map((c) => c.kind);
const flagKinds = (r: ReturnType<typeof mergeEsoRow>) => r.flags.map((f) => f.kind);

describe("νέος αθλητής", () => {
  it("δημιουργείται με όλα τα στοιχεία της λίστας και τον νέο κωδικό", () => {
    const r = mergeEsoRow(null, eso({ eso_id: "64111", fide_id: "999", sex: "F", lastname_en: "LIARAKOS", firstname_en: "ILIAS", rating: 0 }), "PLR-64554");
    expect(r.action).toBe("insert");
    expect(r.record).toMatchObject({
      id: "PLR-64554", eso_id: "64111", fide_id: "999", rating_eso: "0", sex_eso: "F",
      lastname_en: "LIARAKOS", firstname_en: "ILIAS", rating_fide_standard: null,
    });
  });
  it("χωρίς κωδικό δεν δημιουργείται", () => {
    expect(() => mergeEsoRow(null, eso())).toThrow();
  });
});

describe("βαθμός", () => {
  it("αύξηση και μείωση εφαρμόζονται", () => {
    const up = mergeEsoRow(dir(), eso({ rating: 1400 }));
    expect(kinds(up)).toEqual(["rating_up"]);
    expect(up.record.rating_eso).toBe("1400");
    const down = mergeEsoRow(dir(), eso({ rating: 1300 }));
    expect(kinds(down)).toEqual(["rating_down"]);
    expect(down.record.rating_eso).toBe("1300");
  });
  it("πρώτος βαθμός σε αθλητή χωρίς βαθμό", () => {
    const r = mergeEsoRow(dir({ rating_eso: "0" }), eso({ rating: 1000 }));
    expect(kinds(r)).toEqual(["rating_new"]);
    expect(r.record.rating_eso).toBe("1000");
  });
  it("ΠΡΟΣΤΑΣΙΑ: βαθμός που στη λίστα γίνεται 0 ΔΕΝ μηδενίζεται — εμφανίζεται για έλεγχο", () => {
    const r = mergeEsoRow(dir({ rating_eso: "830" }), eso({ rating: 0 }));
    expect(r.record.rating_eso).toBe("830");
    expect(flagKinds(r)).toEqual(["rating_lost"]);
    expect(r.action).toBe("unchanged");
  });
  it("0 και στα δύο → καμία αλλαγή, καμία σημαία", () => {
    const r = mergeEsoRow(dir({ rating_eso: "0" }), eso({ rating: 0 }));
    expect(r.changes).toEqual([]);
    expect(r.flags).toEqual([]);
  });
  it("άκυρος βαθμός στη λίστα (null) δεν αλλάζει τίποτα", () => {
    expect(mergeEsoRow(dir(), eso({ rating: null })).record.rating_eso).toBe("1340");
  });
  it("ο βαθμός FIDE δεν αγγίζεται ποτέ", () => {
    const r = mergeEsoRow(dir({ rating_fide_standard: "2162", rating_fide_rapid: "2000" }), eso({ rating: 1500 }));
    expect(r.record.rating_fide_standard).toBe("2162");
    expect(r.record.rating_fide_rapid).toBe("2000");
  });
});

describe("σύλλογος", () => {
  it("πραγματική αλλαγή εφαρμόζεται", () => {
    const r = mergeEsoRow(dir({ club: "ΑΟ ΤΡΕΙΣ ΑΣΤΕΡΕΣ" }), eso({ club: "ΠΣ ΠΑΤΗΣΙΩΝ" }));
    expect(kinds(r)).toEqual(["club"]);
    expect(r.record.club).toBe("ΠΣ ΠΑΤΗΣΙΩΝ");
  });
  it("διαφορά μόνο σε τόνους/κενά/πεζά δεν είναι αλλαγή", () => {
    const r = mergeEsoRow(dir({ club: "Φο  Τριπολέως " }), eso({ club: "ΦΟ ΤΡΙΠΟΛΕΩΣ" }));
    expect(r.changes).toEqual([]);
  });
  it("κενός σύλλογος στη λίστα δεν σβήνει τον υπάρχοντα", () => {
    expect(mergeEsoRow(dir(), eso({ club: "" })).record.club).toBe("ΦΟ ΤΡΙΠΟΛΕΩΣ");
  });
});

describe("ονοματεπώνυμο", () => {
  it("το χαλασμένο «�» διορθώνεται από τη λίστα", () => {
    const r = mergeEsoRow(dir({ epitheto: "ΔΗΜΗΤΡΙΟΥ", onoma: "ΑΙ\uFFFD\uFFFDΑΤΕΡΙΝΗ" }), eso({ epitheto: "ΔΗΜΗΤΡΙΟΥ", onoma: "ΑΙΚΑΤΕΡΙΝΗ" }));
    expect(kinds(r)).toContain("name_fixed");
    expect(r.record.onoma).toBe("ΑΙΚΑΤΕΡΙΝΗ");
  });
  it("ΠΡΟΣΤΑΣΙΑ: υγιές όνομα που διαφέρει δεν αλλάζει — γίνεται σημαία", () => {
    const r = mergeEsoRow(dir({ epitheto: "ΚΑΕ", onoma: "ΕΜΜΑΝΟΥΕΛ" }), eso({ epitheto: "KAE", onoma: "EMMANUEL" }));
    expect(r.record.epitheto).toBe("ΚΑΕ");
    expect(flagKinds(r)).toEqual(["name_diff"]);
  });
  it("διαφορά μόνο σε τόνους/πεζά δεν σημαίνεται", () => {
    expect(mergeEsoRow(dir({ epitheto: "Παπανικολάου", onoma: "Γεώργιος" }), eso()).flags).toEqual([]);
  });
  it("κενό όνομα συμπληρώνεται", () => {
    const r = mergeEsoRow(dir({ epitheto: "", onoma: "" }), eso());
    expect(r.record.epitheto).toBe("ΠΑΠΑΝΙΚΟΛΑΟΥ");
  });
});

describe("γενέθλια", () => {
  it("συμπληρώνονται όταν λείπουν ή είναι άκυρα", () => {
    expect(mergeEsoRow(dir({ birthday: null }), eso({ birthday: "05/05/2012" })).record.birthday).toBe("05/05/2012");
    expect(mergeEsoRow(dir({ birthday: "31/02/2010" }), eso({ birthday: "05/05/2012" })).record.birthday).toBe("05/05/2012");
  });
  it("ΠΡΟΣΤΑΣΙΑ: έγκυρη ημερομηνία δεν αντικαθίσταται (η λίστα έχει 01/01 ενώ ο κατάλογος πλήρη ημερομηνία)", () => {
    const r = mergeEsoRow(dir({ birthday: "10/03/1955" }), eso({ birthday: "01/01/1955" }));
    expect(r.record.birthday).toBe("10/03/1955");
    expect(flagKinds(r)).toEqual(["birthday_diff"]);
  });
  it("η λίστα χωρίς γενέθλια (ή με άκυρα, που έγιναν null) δεν σβήνει τα υπάρχοντα", () => {
    expect(mergeEsoRow(dir({ birthday: "02/09/2016" }), eso({ birthday: null })).record.birthday).toBe("02/09/2016");
  });
});

describe("FIDE ID", () => {
  it("συμπληρώνεται όταν λείπει από τον κατάλογο", () => {
    expect(kinds(mergeEsoRow(dir(), eso({ fide_id: "25864734" })))).toContain("fide_filled");
  });
  it("ΠΡΟΣΤΑΣΙΑ: υπάρχον FIDE ID δεν σβήνεται όταν η λίστα δεν έχει (315 στο πραγματικό αρχείο)", () => {
    const r = mergeEsoRow(dir({ fide_id: "4200330" }), eso({ fide_id: null }));
    expect(r.record.fide_id).toBe("4200330");
    expect(r.flags).toEqual([]);
  });
  it("διαφορετικό FIDE ID στα δύο → σημαία, μένει το υπάρχον", () => {
    const r = mergeEsoRow(dir({ fide_id: "111" }), eso({ fide_id: "222" }));
    expect(r.record.fide_id).toBe("111");
    expect(flagKinds(r)).toEqual(["fide_diff"]);
  });
});

describe("φύλο ΕΣΟ και λατινικά", () => {
  it("το φύλο ΕΣΟ είναι στοιχείο αναφοράς και ακολουθεί τη λίστα", () => {
    expect(mergeEsoRow(dir(), eso({ sex: "F" })).record.sex_eso).toBe("F");
    expect(mergeEsoRow(dir({ sex_eso: "F" }), eso({ sex: null })).record.sex_eso).toBeNull();
  });
  it("τα επίσημα λατινικά ονόματα εφαρμόζονται και δεν σβήνονται αν η λίστα δεν τα έχει", () => {
    const r = mergeEsoRow(dir(), eso({ lastname_en: "PAPANIKOLAOU", firstname_en: "GEORGIOS" }));
    expect(r.record).toMatchObject({ lastname_en: "PAPANIKOLAOU", firstname_en: "GEORGIOS" });
    const keep = mergeEsoRow(dir({ lastname_en: "OLD", firstname_en: "NAME" }), eso());
    expect(keep.record).toMatchObject({ lastname_en: "OLD", firstname_en: "NAME" });
    expect(keep.changes).toEqual([]);
  });
});

describe("ιδιότητες", () => {
  it("ΙΔΙΟΔΥΝΑΜΙΑ: η δεύτερη εφαρμογή της ίδιας λίστας δεν αλλάζει τίποτα", () => {
    const incoming = eso({ rating: 1500, club: "ΝΕΟΣ ΣΥΛΛΟΓΟΣ", sex: "F", lastname_en: "PAPA", firstname_en: "NIKI", fide_id: "5", birthday: "05/05/2012" });
    const first = mergeEsoRow(dir({ birthday: null }), incoming);
    expect(first.action).toBe("update");
    const second = mergeEsoRow(first.record, incoming);
    expect(second.action).toBe("unchanged");
    expect(second.changes).toEqual([]);
  });
  it("δεν αλλάζει το αρχικό αντικείμενο και κρατά όλες τις άλλες στήλες", () => {
    const existing = dir({ rating_fide_blitz: "1900" });
    const copy = JSON.stringify(existing);
    const r = mergeEsoRow(existing, eso({ rating: 1500 }));
    expect(JSON.stringify(existing)).toBe(copy);
    expect(r.record.rating_fide_blitz).toBe("1900");
    expect(r.record.id).toBe("PLR-00001");
  });
});

describe("βοηθητικά", () => {
  it("nextPlrId συνεχίζει το διαδοχικό σύστημα", () => {
    expect(nextPlrId("PLR-64553")).toBe("PLR-64554");
    expect(nextPlrId(null)).toBe("PLR-00001");
    expect(nextPlrId("PLR-00009")).toBe("PLR-00010");
  });
  it("compareKey αγνοεί τόνους, πεζά και διπλά κενά", () => {
    expect(compareKey("  Πολίχνης  Α ")).toBe("ΠΟΛΙΧΝΗΣ Α");
    expect(compareKey(null)).toBe("");
  });
});
