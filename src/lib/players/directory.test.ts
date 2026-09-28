import { describe, it, expect } from "vitest";
import {
  parseBirthday, nationalRating, fideRating, displayRating, toHit, toPlayerFields,
  titleCaseLatin, normalizeQuery, sameAthlete, isGender, type DirectoryRow,
} from "./directory";
import { normalizeName, elot743 } from "@/lib/transliterate";

const row = (over: Partial<DirectoryRow> = {}): DirectoryRow => ({
  id: "PLR-00017", eso_id: "20", fide_id: "4200330", epitheto: "ΤΣΟΥΡΟΣ", onoma: "ΓΕΩΡΓΙΟΣ",
  club: "ΑΣ ΠΑΠΑΓΟΥ", birthday: "01/01/1946", rating_eso: "2055", rating_fide_standard: "2162",
  rating_fide_rapid: null, rating_fide_blitz: null, ...over,
});

describe("μεταγραφή ΕΛΟΤ 743 (ο κώδικας του SopRegSB)", () => {
  // Το elot743 διατηρεί το "σχήμα" των γραμμάτων (π.χ. ΜΠ → Mp), γι' αυτό συγκρίνουμε κεφαλαία,
  // όπως κάνει και το normalizeName του SopRegSB. Ό,τι αποθηκεύεται περνά από τα toPlayerFields.
  const up = (s: string) => elot743(s).toUpperCase();
  it("δίνει τις σωστές λατινικές μορφές", () => {
    expect(up("ΠΑΠΑΔΟΠΟΥΛΟΣ")).toBe("PAPADOPOULOS");
    expect(up("ΓΕΩΡΓΙΟΣ")).toBe("GEORGIOS");
    expect(up("ΧΡΗΣΤΟΣ")).toBe("CHRISTOS");
    expect(up("ΜΠΑΜΠΗΣ")).toBe("MPAMPIS");
    expect(up("ΕΥΑΓΓΕΛΟΣ")).toBe("EVANGELOS");
    expect(up("ΑΥΓΟΥΣΤΟΣ")).toBe("AVGOUSTOS");
    expect(up("ΘΕΟΔΩΡΟΣ")).toBe("THEODOROS");
    expect(up("ΨΑΡΡΑΣ")).toBe("PSARRAS");
  });
  it("τα λατινικά περνούν αναλλοίωτα και η κανονικοποίηση είναι ίδια για ελληνικά/λατινικά", () => {
    expect(normalizeName("Παπαδόπουλος")).toBe(normalizeName("PAPADOPOULOS"));
  });
});

describe("τα ονόματα που πράγματι αποθηκεύονται (toPlayerFields)", () => {
  const f = (epitheto: string, onoma: string) => toPlayerFields(row({ epitheto, onoma }), "M");
  it("επώνυμο ΚΕΦΑΛΑΙΑ, όνομα με αρχικό κεφαλαίο — χωρίς ανάμικτα σχήματα", () => {
    expect(f("ΜΠΑΜΠΗΣ", "ΓΕΩΡΓΙΟΣ")).toMatchObject({ last_name: "MPAMPIS", first_name: "Georgios" });
    expect(f("ΠΑΠΑΔΟΠΟΥΛΟΥ", "ΜΑΡΙΑ")).toMatchObject({ last_name: "PAPADOPOULOU", first_name: "Maria" });
    expect(f("ΝΤΑΛΑΚΟΥΡΑΣ", "ΘΕΟΔΩΡΟΣ")).toMatchObject({ last_name: "NTALAKOURAS", first_name: "Theodoros" });
    expect(f("ΑΥΓΟΥΣΤΗΣ", "ΕΥΑΓΓΕΛΙΑ").last_name).toBe("AVGOUSTIS");
  });
  it("δεν υπάρχουν πεζά στο επώνυμο και μόνο ο πρώτος χαρακτήρας κεφαλαίος στο όνομα", () => {
    for (const [e, o] of [["ΜΠΑΜΠΗΣ", "ΜΠΑΜΠΗΣ"], ["ΓΚΟΥΜΑΣ", "ΓΚΙΩΡΓΚΟΣ"], ["ΧΡΙΣΤΟΔΟΥΛΟΥ", "ΝΤΙΝΑ"]]) {
      const r = f(e, o);
      expect(r.last_name).toBe(r.last_name.toUpperCase());
      expect(r.first_name).toMatch(/^[A-Z][a-z]+$/);
    }
  });
});

describe("parseBirthday", () => {
  it("διαβάζει ηη/μμ/εεεε", () => {
    expect(parseBirthday("15/03/2012")).toEqual({ iso: "2012-03-15", year: 2012 });
    expect(parseBirthday("01/01/1946")).toEqual({ iso: "1946-01-01", year: 1946 });
  });
  it("απορρίπτει κενά, άκυρες μορφές και ανύπαρκτες ημερομηνίες", () => {
    expect(parseBirthday("")).toBeNull();
    expect(parseBirthday(null)).toBeNull();
    expect(parseBirthday("2012-03-15")).toBeNull();
    expect(parseBirthday("31/02/2012")).toBeNull();
    expect(parseBirthday("15/13/2012")).toBeNull();
  });
});

describe("βαθμολογίες", () => {
  it("το 0 στον ΕΣΟ σημαίνει χωρίς βαθμό", () => {
    expect(nationalRating(row({ rating_eso: "0" }))).toBeNull();
    expect(nationalRating(row({ rating_eso: "1000" }))).toBe(1000);
    expect(nationalRating(row({ rating_eso: null }))).toBeNull();
  });
  it("προτεραιότητα FIDE standard, μετά ΕΣΟ", () => {
    expect(displayRating(row())).toBe(2162);
    expect(displayRating(row({ rating_fide_standard: null }))).toBe(2055);
    expect(displayRating(row({ rating_fide_standard: null, rating_eso: "0" }))).toBeNull();
    expect(fideRating(row({ rating_fide_standard: "" }))).toBeNull();
  });
});

describe("toHit — τι φτάνει στον browser", () => {
  it("περιέχει έτος γέννησης, ΟΧΙ πλήρη ημερομηνία ούτε FIDE ID", () => {
    const hit = toHit(row({ birthday: "17/08/2012" }));
    expect(hit.birthYear).toBe(2012);
    expect(JSON.stringify(hit)).not.toContain("17/08");
    expect(JSON.stringify(hit)).not.toContain("2012-08");
    expect(Object.keys(hit).sort()).toEqual(["birthYear", "club", "epitheto", "eso_id", "id", "onoma", "rating", "sexEso"]);
  });
  it("δέχεται παίκτη χωρίς γενέθλια", () => {
    expect(toHit(row({ birthday: "" })).birthYear).toBeNull();
  });
  it("η υπόδειξη φύλου ΕΣΟ: «F» μόνο όταν η λίστα σημειώνει γυναίκα, αλλιώς null", () => {
    expect(toHit(row({ sex_eso: "F" })).sexEso).toBe("F");
    expect(toHit(row({ sex_eso: null })).sexEso).toBeNull();
    expect(toHit(row({})).sexEso).toBeNull();
    expect(toHit(row({ sex_eso: "M" })).sexEso).toBeNull(); // δεν υπάρχει τέτοια τιμή στη λίστα· δεν την προωθούμε
  });
  it("η υπόδειξη δεν επηρεάζει το φύλο που θα αποθηκευτεί (το δίνει πάντα ο υπεύθυνος)", () => {
    expect(toPlayerFields(row({ sex_eso: "F" }), "M").gender).toBe("M");
  });
});

describe("επίσημα λατινικά ονόματα της ΕΣΟ", () => {
  it("χρησιμοποιούνται όταν υπάρχουν (επώνυμο κεφαλαία, όνομα με αρχικό κεφαλαίο)", () => {
    const f = toPlayerFields(row({ epitheto: "ΧΑΜΟΓΙΩΡΓΑΚΗΣ", onoma: "ΓΕΩΡΓΙΟΣ", lastname_en: "CHAMOGIORGAKIS", firstname_en: "GEORGIOS" }), "M");
    expect(f.last_name).toBe("CHAMOGIORGAKIS");
    expect(f.first_name).toBe("Georgios");
  });
  it("διαφέρουν από τη μεταγραφή όταν η ΕΣΟ γράφει αλλιώς (η επίσημη γραφή υπερισχύει)", () => {
    const f = toPlayerFields(row({ epitheto: "ΓΙΑΝΝΟΠΟΥΛΟΣ", onoma: "ΙΩΑΝΝΗΣ", lastname_en: "GIANOPOULOS", firstname_en: "IOANNIS" }), "M");
    expect(f.last_name).toBe("GIANOPOULOS"); // η μεταγραφή θα έδινε GIANNOPOULOS
  });
  it("σύνθετα και με παύλα ονόματα", () => {
    expect(toPlayerFields(row({ lastname_en: "PAPA-DOPOULOS", firstname_en: "MARIA-ELENI" }), "F").first_name).toBe("Maria-Eleni");
  });
  it("χωρίς επίσημα ονόματα μένει η μεταγραφή ΕΛΟΤ 743", () => {
    const f = toPlayerFields(row({ epitheto: "ΤΣΟΥΡΟΣ", onoma: "ΓΕΩΡΓΙΟΣ", lastname_en: null, firstname_en: null }), "M");
    expect(f.last_name).toBe("TSOUROS");
    expect(f.first_name).toBe("Georgios");
  });
  it("μόνο το επώνυμο επίσημο: το όνομα μεταγράφεται", () => {
    const f = toPlayerFields(row({ epitheto: "ΤΣΟΥΡΟΣ", onoma: "ΓΕΩΡΓΙΟΣ", lastname_en: "TSOUROS", firstname_en: "" }), "M");
    expect(f.last_name).toBe("TSOUROS");
    expect(f.first_name).toBe("Georgios");
  });
  it("κενά ή κενές τιμές δεν θεωρούνται επίσημα ονόματα", () => {
    const f = toPlayerFields(row({ epitheto: "ΤΣΟΥΡΟΣ", onoma: "ΓΕΩΡΓΙΟΣ", lastname_en: "   ", firstname_en: "  " }), "M");
    expect(f.last_name).toBe("TSOUROS");
  });
});

describe("toPlayerFields — αντιγραφή στον αθλητή της διοργάνωσης", () => {
  it("ονόματα λατινικά (επώνυμο κεφαλαία, όνομα με αρχικό κεφαλαίο)", () => {
    const f = toPlayerFields(row({ epitheto: "ΠΑΠΑΔΟΠΟΥΛΟΥ", onoma: "ΜΑΡΙΑ-ΕΛΕΝΗ" }), "F");
    expect(f.last_name).toBe("PAPADOPOULOU");
    expect(f.first_name).toBe("Maria-Eleni");
  });
  it("το φύλο είναι ακριβώς αυτό που δόθηκε", () => {
    expect(toPlayerFields(row({ onoma: "ΝΙΚΟΛΑΟΣ" }), "F").gender).toBe("F");
    expect(toPlayerFields(row({ onoma: "ΜΑΡΙΑ" }), "M").gender).toBe("M");
  });
  it("γενέθλια σε ISO, βαθμοί ως αριθμοί, κωδικοί", () => {
    const f = toPlayerFields(row({ birthday: "17/08/2012", rating_eso: "1500", rating_fide_standard: null }), "M");
    expect(f).toMatchObject({
      birth_date: "2012-08-17", rating_national: 1500, rating_fide: null,
      national_id: "20", fide_id: "4200330", directory_id: "PLR-00017",
    });
  });
  it("χωρίς γενέθλια/βαθμό δίνει null", () => {
    const f = toPlayerFields(row({ birthday: null, rating_eso: "0", rating_fide_standard: null, fide_id: "" }), "M");
    expect(f.birth_date).toBeNull();
    expect(f.rating_national).toBeNull();
    expect(f.fide_id).toBeNull();
  });
  it("καθαρίζει διπλά κενά στα ονόματα", () => {
    expect(toPlayerFields(row({ epitheto: "  ΜΑΥΡΟΜΜΑΤΗΣ   ΚΕΣΙΔΗΣ " }), "M").last_name).toBe("MAVROMMATIS KESIDIS");
  });
});

describe("titleCaseLatin", () => {
  it("κεφαλαιοποιεί μετά από κενό/παύλα", () => {
    expect(titleCaseLatin("GEORGIOS")).toBe("Georgios");
    expect(titleCaseLatin("ANNA MARIA")).toBe("Anna Maria");
    expect(titleCaseLatin("MARIA-ELENI")).toBe("Maria-Eleni");
  });
});

describe("normalizeQuery — ασφάλεια όρου αναζήτησης", () => {
  it("αφαιρεί τόνους, κάνει κεφαλαία, και βγάζει χαρακτήρες φίλτρων", () => {
    expect(normalizeQuery("  Παπαδόπουλος ")).toBe("ΠΑΠΑΔΟΠΟΥΛΟΣ");
    expect(normalizeQuery("Ά")).toBe("Α");
    // τα %, _, κόμμα και παρενθέσεις αφαιρούνται· η τελεία δεν έχει σημασία σε ilike
    expect(normalizeQuery("ΠΑΠΑ%,eso_id.eq.1)(")).toBe("ΠΑΠΑESOID.EQ.1");
  });
  it("δεν αφήνει χαρακτήρες που θα άλλαζαν το ερώτημα PostgREST", () => {
    const q = normalizeQuery('ΑΒ%_\\,()*"\'ΓΔ');
    expect(q).toBe("ΑΒΓΔ");
  });
});

describe("sameAthlete — έλεγχος διπλής εγγραφής", () => {
  const a = { first_name: "Georgios", last_name: "TSOUROS", birth_date: "2012-05-05", national_id: "20", directory_id: "PLR-1" };
  it("ίδιος κωδικός καταλόγου ή ίδιο ΑΜ ΕΣΟ", () => {
    expect(sameAthlete(a, { first_name: "X", last_name: "Y", directory_id: "PLR-1" })).toBe(true);
    expect(sameAthlete(a, { first_name: "X", last_name: "Y", national_id: "20" })).toBe(true);
  });
  it("ίδιο όνομα είτε ελληνικά είτε λατινικά, με ίδιο έτος", () => {
    expect(sameAthlete(a, { first_name: "ΓΕΩΡΓΙΟΣ", last_name: "ΤΣΟΥΡΟΣ", birth_date: "2012-09-09" })).toBe(true);
  });
  it("ίδιο όνομα αλλά διαφορετικό έτος = διαφορετικός αθλητής (π.χ. πατέρας/γιος)", () => {
    expect(sameAthlete(a, { first_name: "Georgios", last_name: "TSOUROS", birth_date: "1946-01-01" })).toBe(false);
  });
  it("ίδιο όνομα χωρίς έτος στον έναν → θεωρείται ίδιος (συντηρητικά)", () => {
    expect(sameAthlete(a, { first_name: "Georgios", last_name: "Tsouros" })).toBe(true);
  });
  it("διαφορετικό όνομα, διαφορετικοί κωδικοί → διαφορετικός", () => {
    expect(sameAthlete(a, { first_name: "Nikos", last_name: "TSOUROS", national_id: "21", directory_id: "PLR-2" })).toBe(false);
  });
});

describe("isGender", () => {
  it("δέχεται μόνο M ή F", () => {
    expect(isGender("M")).toBe(true);
    expect(isGender("F")).toBe(true);
    for (const v of ["", "m", "X", null, undefined, 1]) expect(isGender(v)).toBe(false);
  });
});
