import { describe, it, expect } from "vitest";
import { convertBirthday, listDateFromSheetName, parseEsoRows, splitName } from "./parse";

const HEADER = ["ID_No", "Fide_No", "Name", "Fathername", "Sex", "Fed", "Title_gr", "Clubnumber", "ClubName", "Birthday",
  "Rtg_Nat", "Games", "Games_Rated", "Rtg_Nat_Previous", "Rtg_Change", "Lastname_En", "Fistname_En", "Cz_Flag"];
// Μορφή γραμμής όπως στο πραγματικό αρχείο της ΕΣΟ
const row = (o: Partial<Record<string, unknown>>): unknown[] => {
  const base: Record<string, unknown> = {
    ID_No: 1, Fide_No: "", Name: "ΠΑΠΑΝΙΚΟΛΑΟΥ, ΓΕΩΡΓΙΟΣ", Fathername: "ΑΘΑΝΑΣΙΟΣ", Sex: "", Fed: "GRE", Title_gr: "",
    Clubnumber: 408, ClubName: "ΦΟ ΤΡΙΠΟΛΕΩΣ                        ", Birthday: "1951/01/01", Rtg_Nat: 1340, Games: 0,
    Games_Rated: 0, Rtg_Nat_Previous: 1340, Rtg_Change: 0, Lastname_En: "", Fistname_En: "", Cz_Flag: "", ...o,
  };
  return HEADER.map((h) => base[h]);
};
const parse = (rows: unknown[][], sheet: string | null = "ratings_20260109") => parseEsoRows([HEADER, ...rows], sheet);

describe("parseEsoRows — μορφή της πραγματικής λίστας", () => {
  it("διαβάζει μια κανονική γραμμή", () => {
    const { rows, issues } = parse([row({})]);
    expect(issues).toEqual([]);
    expect(rows[0]).toEqual({
      eso_id: "1", fide_id: null, epitheto: "ΠΑΠΑΝΙΚΟΛΑΟΥ", onoma: "ΓΕΩΡΓΙΟΣ", club: "ΦΟ ΤΡΙΠΟΛΕΩΣ",
      birthday: "01/01/1951", rating: 1340, sex: null, lastname_en: null, firstname_en: null,
    });
  });

  it("βρίσκει την επικεφαλίδα ακόμη κι αν υπάρχουν γραμμές τίτλου από πάνω", () => {
    const grid = [["Λίστα ΕΣΟ"], [], HEADER, row({ ID_No: 5 })];
    expect(parseEsoRows(grid, "x").rows.map((r) => r.eso_id)).toEqual(["5"]);
  });

  it("οι αριθμοί (ΑΜ, FIDE ID, βαθμός) έρχονται ως δεκαδικοί και γίνονται σωστοί ακέραιοι", () => {
    const { rows } = parse([row({ ID_No: 3.0, Fide_No: 25864734.0, Rtg_Nat: 1744.0 })]);
    expect(rows[0]).toMatchObject({ eso_id: "3", fide_id: "25864734", rating: 1744 });
  });

  it("το ClubName χάνει τα κενά στο τέλος και τα διπλά κενά", () => {
    expect(parse([row({ ClubName: "  ΑΕ   ΠΟΛΥΚΑΣΤΡΟΥ            " })]).rows[0].club).toBe("ΑΕ ΠΟΛΥΚΑΣΤΡΟΥ");
  });
});

describe("ονοματεπώνυμο", () => {
  it("χωρίζει στο πρώτο κόμμα", () => {
    expect(splitName("ΚΟΝΤΟΣ, ΣΤΑΥΡΟΣ")).toEqual({ epitheto: "ΚΟΝΤΟΣ", onoma: "ΣΤΑΥΡΟΣ" });
  });
  it("ξένα ονόματα με κόμματα ανάμεσα στα μικρά ονόματα (όπως στο αρχείο)", () => {
    expect(splitName("BACROT, ETIENNE,PRIMO,CARLOS")).toEqual({ epitheto: "BACROT", onoma: "ETIENNE PRIMO CARLOS" });
  });
  it("κόμμα χωρίς κενό", () => {
    expect(splitName("ΠΑΠΑΣ,ΝΙΚΟΣ")).toEqual({ epitheto: "ΠΑΠΑΣ", onoma: "ΝΙΚΟΣ" });
  });
  it("χωρίς κόμμα ή με κενό μέρος → null", () => {
    expect(splitName("ΠΑΠΑΣ ΝΙΚΟΣ")).toBeNull();
    expect(splitName("ΠΑΠΑΣ, ")).toBeNull();
    expect(splitName(", ΝΙΚΟΣ")).toBeNull();
    expect(splitName("")).toBeNull();
  });
  it("γραμμή με άκυρο όνομα παραλείπεται με σαφές μήνυμα", () => {
    const { rows, issues } = parse([row({ ID_No: 9, Name: "ΧΩΡΙΣ ΚΟΜΜΑ" })]);
    expect(rows).toHaveLength(0);
    expect(issues[0]).toMatchObject({ eso_id: "9", row: 2 });
    expect(issues[0].message).toMatch(/ΕΠΩΝΥΜΟ, ΟΝΟΜΑ/);
  });
});

describe("ημερομηνίες γέννησης", () => {
  it("εεεε/μμ/ηη → ηη/μμ/εεεε", () => {
    expect(convertBirthday("2012/08/17")).toBe("17/08/2012");
    expect(convertBirthday("1951/01/01")).toBe("01/01/1951");
  });
  it("απορρίπτει το λάθος έτος 0016 που υπάρχει στο πραγματικό αρχείο", () => {
    expect(convertBirthday("0016/09/02")).toBeNull();
  });
  it("απορρίπτει αδύνατες ημερομηνίες, μελλοντικά και πολύ παλιά έτη", () => {
    expect(convertBirthday("2010/02/31")).toBeNull();
    expect(convertBirthday("2010/13/01")).toBeNull();
    expect(convertBirthday("2099/01/01", 2026)).toBeNull();
    expect(convertBirthday("1850/01/01")).toBeNull();
  });
  it("κενό → null και ΧΩΡΙΣ αναφορά προβλήματος", () => {
    const { rows, issues } = parse([row({ Birthday: "" })]);
    expect(rows[0].birthday).toBeNull();
    expect(issues).toEqual([]);
  });
  it("άκυρη μη κενή ημερομηνία → null και αναφέρεται (η γραμμή μένει)", () => {
    const { rows, issues } = parse([row({ ID_No: 7, Birthday: "0016/09/02" })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].birthday).toBeNull();
    expect(issues[0].message).toMatch(/0016\/09\/02/);
  });
});

describe("βαθμός, φύλο, λατινικά", () => {
  it("το 0 μένει 0 (χωρίς βαθμό)", () => {
    expect(parse([row({ Rtg_Nat: 0 })]).rows[0].rating).toBe(0);
  });
  it("άκυρος βαθμός → null και αναφορά", () => {
    const { rows, issues } = parse([row({ ID_No: 2, Rtg_Nat: "abc" })]);
    expect(rows[0].rating).toBeNull();
    expect(issues[0].message).toMatch(/Άκυρος βαθμός/);
  });
  it("το φύλο: μόνο το «f» σημαίνει γυναίκα, το κενό δίνει null (όχι «άνδρας»)", () => {
    expect(parse([row({ Sex: "f" })]).rows[0].sex).toBe("F");
    expect(parse([row({ Sex: "F" })]).rows[0].sex).toBe("F");
    expect(parse([row({ Sex: "" })]).rows[0].sex).toBeNull();
    expect(parse([row({ Sex: "m" })]).rows[0].sex).toBeNull();
  });
  it("τα επίσημα λατινικά ονόματα γίνονται κεφαλαία και δεν χρειάζονται και τα δύο", () => {
    const { rows } = parse([row({ Lastname_En: "Chamogiorgakis", Fistname_En: "GEORGIOS" })]);
    expect(rows[0]).toMatchObject({ lastname_en: "CHAMOGIORGAKIS", firstname_en: "GEORGIOS" });
    expect(parse([row({})]).rows[0]).toMatchObject({ lastname_en: null, firstname_en: null });
  });
  it("δέχεται και τη σωστή γραφή της επικεφαλίδας Firstname_En", () => {
    const header = HEADER.map((h) => (h === "Fistname_En" ? "Firstname_En" : h));
    const r = row({ Lastname_En: "X", Fistname_En: "Y" });
    expect(parseEsoRows([header, r]).rows[0].firstname_en).toBe("Y");
  });
});

describe("προβληματικές γραμμές και επικεφαλίδα", () => {
  it("παραλείπει γραμμή χωρίς ΑΜ και επανάληψη του ίδιου ΑΜ", () => {
    const { rows, issues, totalRows } = parse([row({ ID_No: 1 }), row({ ID_No: "" }), row({ ID_No: 1, Name: "ΑΛΛΟΣ, ΕΝΑΣ" })]);
    expect(rows).toHaveLength(1);
    expect(issues).toHaveLength(2);
    expect(totalRows).toBe(3);
  });
  it("αγνοεί τελείως κενές γραμμές", () => {
    expect(parse([row({}), Array(18).fill(""), row({ ID_No: 2 })]).totalRows).toBe(2);
  });
  it("λείπει απαραίτητη στήλη → σαφές σφάλμα", () => {
    const header = HEADER.filter((h) => h !== "Rtg_Nat");
    expect(() => parseEsoRows([header, header.map(() => 1)])).toThrow(/Rtg_Nat/);
  });
  it("δεν είναι λίστα ΕΣΟ → σαφές σφάλμα", () => {
    expect(() => parseEsoRows([["a", "b"], [1, 2]])).toThrow(/ID_No/);
    expect(() => parseEsoRows([])).toThrow(/ID_No/);
  });
});

describe("ημερομηνία της λίστας από το όνομα του φύλλου", () => {
  it("ratings_20260109 → 2026-01-09", () => {
    expect(listDateFromSheetName("ratings_20260109")).toBe("2026-01-09");
    expect(parse([row({})], "ratings_20260109").listDate).toBe("2026-01-09");
  });
  it("άκυρο ή απόν όνομα → null", () => {
    expect(listDateFromSheetName("Sheet1")).toBeNull();
    expect(listDateFromSheetName("ratings_20261399")).toBeNull();
    expect(listDateFromSheetName(null)).toBeNull();
  });
});
