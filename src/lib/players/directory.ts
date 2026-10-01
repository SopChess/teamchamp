import { elot743, normalizeName, toGreekUpperCase, cleanName } from "@/lib/transliterate";

/** Μια γραμμή του πίνακα players_directory (όλα text, όπως στο CSV του SopRegSB). */
export interface DirectoryRow {
  id: string;
  eso_id: string | null;
  fide_id: string | null;
  epitheto: string;
  onoma: string;
  club: string | null;
  birthday: string | null;
  rating_eso: string | null;
  rating_fide_standard: string | null;
  rating_fide_rapid: string | null;
  rating_fide_blitz: string | null;
  /** Από τη λίστα ΕΣΟ: 'F' αν σημειώνεται γυναίκα. Δεν υπάρχει πριν την πρώτη ενημέρωση. */
  sex_eso?: string | null;
  /** Επίσημα λατινικά ονόματα της ΕΣΟ (όπου υπάρχουν) */
  lastname_en?: string | null;
  firstname_en?: string | null;
}

/**
 * Ό,τι επιστρέφεται στον browser από την αναζήτηση. ΣΚΟΠΙΜΑ ΜΟΝΟ το έτος γέννησης
 * (όχι ολόκληρη η ημερομηνία): πρόκειται για στοιχεία παιδιών, και η πλήρης
 * ημερομηνία αντιγράφεται μόνο στον server όταν επιλεγεί ο αθλητής.
 */
export interface DirectoryHit {
  id: string;
  epitheto: string;
  onoma: string;
  club: string;
  birthYear: number | null;
  eso_id: string | null;
  rating: number | null;
  /** Υπόδειξη από την ΕΣΟ: "F" αν η λίστα σημειώνει γυναίκα. Ο υπεύθυνος ομάδας επιλέγει πάντα ο ίδιος. */
  sexEso: "F" | null;
}

const LEGACY_COLUMNS =
  "id, eso_id, fide_id, epitheto, onoma, club, birthday, rating_eso, rating_fide_standard, rating_fide_rapid, rating_fide_blitz";
export const DIRECTORY_SELECT = `${LEGACY_COLUMNS}, sex_eso, lastname_en, firstname_en`;
/** Χωρίς τις στήλες της ΕΣΟ: για την περίπτωση που το SQL δεν έχει ξανατρέξει μετά την ενημέρωση του κώδικα. */
export const DIRECTORY_SELECT_LEGACY = LEGACY_COLUMNS;

/** Πάντα το πολύ 15 αποτελέσματα — δεν μπορεί να "κατεβάσει" κανείς τον κατάλογο. */
export const SEARCH_LIMIT = 15;

/** ηη/μμ/εεεε → ISO (εεεε-μμ-ηη) και έτος. Άκυρη ή κενή ημερομηνία → null. */
export function parseBirthday(raw: string | null | undefined): { iso: string; year: number } | null {
  const m = (raw ?? "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = Number(dd), mo = Number(mm), y = Number(yyyy);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return { iso: `${yyyy}-${mm}-${dd}`, year: y };
}

function positiveInt(raw: string | null | undefined): number | null {
  const v = (raw ?? "").trim();
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n > 0 ? n : null;
}

/** Το 0 στη βαθμολογία ΕΣΟ σημαίνει "χωρίς βαθμό" (27% του καταλόγου), όχι βαθμός 0. */
export function nationalRating(row: DirectoryRow): number | null {
  return positiveInt(row.rating_eso);
}
export function fideRating(row: DirectoryRow): number | null {
  return positiveInt(row.rating_fide_standard);
}
/** Ίδια προτεραιότητα με το SopRegSB: διεθνής (FIDE standard) πρώτα, μετά εθνικός. */
export function displayRating(row: DirectoryRow): number | null {
  return fideRating(row) ?? nationalRating(row);
}

export function toHit(row: DirectoryRow): DirectoryHit {
  return {
    id: row.id,
    epitheto: row.epitheto,
    onoma: row.onoma,
    club: row.club ?? "",
    birthYear: parseBirthday(row.birthday)?.year ?? null,
    eso_id: row.eso_id,
    rating: displayRating(row),
    sexEso: row.sex_eso === "F" ? "F" : null,
  };
}

/** Πρώτο γράμμα κεφαλαίο, τα υπόλοιπα πεζά, και μετά από κενό ή παύλα (π.χ. "Maria-Eleni"). */
export function titleCaseLatin(s: string): string {
  return s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

export type Gender = "M" | "F";
export function isGender(v: unknown): v is Gender {
  return v === "M" || v === "F";
}

/** Τα πεδία του αθλητή της διοργάνωσης, όπως αντιγράφονται από τον κατάλογο. */
export interface PlayerFields {
  first_name: string;
  last_name: string;
  birth_date: string | null;
  gender: Gender;
  rating_national: number | null;
  rating_fide: number | null;
  national_id: string | null;
  fide_id: string | null;
  directory_id: string;
}

/**
 * Ονόματα ΛΑΤΙΝΙΚΑ (ΕΛΟΤ 743, ο κώδικας του SopRegSB), επώνυμο κεφαλαία και όνομα με
 * αρχικό κεφαλαίο. Το φύλο δίνεται πάντα από τον υπεύθυνο ομάδας — ΔΕΝ εκτιμάται
 * ποτέ από το όνομα.
 */
export function toPlayerFields(row: DirectoryRow, gender: Gender): PlayerFields {
  // Προτιμώνται τα ΕΠΙΣΗΜΑ λατινικά ονόματα της ΕΣΟ (όπου υπάρχουν, ~99% στους νέους)·
  // αλλιώς μεταγραφή ΕΛΟΤ 743.
  const officialLast = cleanName(row.lastname_en ?? "");
  const officialFirst = cleanName(row.firstname_en ?? "");
  return {
    first_name: officialFirst ? titleCaseLatin(officialFirst) : titleCaseLatin(elot743(cleanName(row.onoma))),
    last_name: officialLast ? officialLast.toUpperCase() : elot743(cleanName(row.epitheto)).toUpperCase(),
    birth_date: parseBirthday(row.birthday)?.iso ?? null,
    gender,
    rating_national: nationalRating(row),
    rating_fide: fideRating(row),
    national_id: row.eso_id?.trim() || null,
    fide_id: row.fide_id?.trim() || null,
    directory_id: row.id,
  };
}

/** Καθαρισμός όρου αναζήτησης: κεφαλαία χωρίς τόνους, χωρίς χαρακτήρες με ειδική σημασία στα φίλτρα. */
export function normalizeQuery(s: string): string {
  return toGreekUpperCase(cleanName(s)).replace(/[%_\\,()*"']/g, "").trim();
}

export interface AthleteIdentity {
  first_name: string;
  last_name: string;
  birth_date?: string | null;
  national_id?: string | null;
  directory_id?: string | null;
}

/**
 * Είναι ο ίδιος αθλητής; Κατά προτεραιότητα ο αριθμός μητρώου (ίδιος κωδικός καταλόγου
 * ή ίδιο ΑΜ ΕΣΟ) — επιβεβαιωμένο. Χωρίς αριθμό μητρώου και στους δύο, απαιτείται ΚΑΙ το
 * ονοματεπώνυμο (μορφή ΕΛΟΤ 743, άρα ίδιο είτε γράφτηκε ελληνικά είτε λατινικά) ΚΑΙ η
 * ακριβής ημερομηνία γέννησης μαζί (επιβεβαιωμένο: όχι μόνο το έτος) — πολύ κοινά
 * ονόματα στην Ελλάδα, το όνομα από μόνο του δεν αρκεί. Αν λείπει η ημερομηνία γέννησης
 * από τον έναν ή και τους δύο, ΔΕΝ θεωρούνται ο ίδιος αθλητής από αυτόν τον έλεγχο —
 * προτιμάται να περάσει σπάνια ένας πραγματικός διπλός αθλητής χωρίς ημερομηνία, παρά να
 * μπλοκαριστεί κατά λάθος κάποιος άλλος με κοινό όνομα.
 */
export function sameAthlete(a: AthleteIdentity, b: AthleteIdentity): boolean {
  if (a.directory_id && b.directory_id && a.directory_id === b.directory_id) return true;
  if (a.national_id && b.national_id && a.national_id === b.national_id) return true;
  const sameName =
    normalizeName(a.last_name) === normalizeName(b.last_name) &&
    normalizeName(a.first_name) === normalizeName(b.first_name);
  if (!sameName) return false;
  if (a.birth_date && b.birth_date) return a.birth_date === b.birth_date;
  return false;
}
