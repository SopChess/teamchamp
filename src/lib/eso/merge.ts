import type { EsoRow } from "./parse";
import { parseBirthday } from "@/lib/players/directory";

/** Μια εγγραφή του πίνακα players_directory, με τις στήλες που αφορά η ενημέρωση. */
export interface DirectoryRecord {
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
  sex_eso: string | null;
  lastname_en: string | null;
  firstname_en: string | null;
}

/** Αλλαγές που ΕΦΑΡΜΟΖΟΝΤΑΙ */
export type ChangeKind =
  | "rating_up" | "rating_down" | "rating_new"
  | "club" | "name_fixed" | "birthday_filled" | "fide_filled" | "sex" | "latin";

/** Διαφορές που ΔΕΝ εφαρμόζονται αυτόματα και εμφανίζονται για έλεγχο */
export type FlagKind = "rating_lost" | "name_diff" | "birthday_diff" | "fide_diff";

export interface Change { kind: ChangeKind; detail: string }
export interface Flag { kind: FlagKind; detail: string }

export interface MergeResult {
  action: "insert" | "update" | "unchanged";
  record: DirectoryRecord;
  changes: Change[];
  flags: Flag[];
}

/** Κεφαλαία, χωρίς τόνους, με μαζεμένα κενά — για συγκρίσεις που δεν πρέπει να επηρεάζονται από τη γραφή. */
export function compareKey(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

const hasBrokenChars = (s: string): boolean => s.includes("\uFFFD");

function ratingOf(raw: string | null | undefined): number {
  const s = (raw ?? "").trim();
  return /^\d+$/.test(s) ? Number(s) : 0;
}

/** Επόμενος κωδικός καταλόγου, στη μορφή PLR-00001 (το διαδοχικό σύστημα του SopRegSB). */
export function nextPlrId(maxId: string | null | undefined): string {
  const n = Number((maxId ?? "").replace(/\D/g, "")) || 0;
  return `PLR-${String(n + 1).padStart(5, "0")}`;
}

/**
 * Πώς μια γραμμή της λίστας ΕΣΟ ενημερώνει τον κατάλογο. Η λίστα είναι η πηγή για
 * όσα πεδία φέρει (βαθμός, σύλλογος, φύλο, λατινικά ονόματα). Τρεις προστασίες, όπου
 * η κατά γράμμα εφαρμογή θα κατέστρεφε δεδομένα:
 *  - βαθμός που στη λίστα γίνεται 0 ΔΕΝ μηδενίζεται αυτόματα (εμφανίζεται για έλεγχο),
 *  - υπάρχον FIDE ID δεν σβήνεται όταν η λίστα δεν έχει,
 *  - έγκυρα γενέθλια και ονοματεπώνυμο δεν αντικαθίστανται (μόνο όταν λείπουν ή έχουν
 *    χαλασμένο χαρακτήρα "�") — οι διαφορές εμφανίζονται για έλεγχο.
 * Η εφαρμογή της ίδιας λίστας δεύτερη φορά δεν αλλάζει τίποτα.
 */
export function mergeEsoRow(existing: DirectoryRecord | null, incoming: EsoRow, newId?: string): MergeResult {
  if (!existing) {
    if (!newId) throw new Error("Χρειάζεται κωδικός καταλόγου για νέο αθλητή.");
    return {
      action: "insert",
      changes: [],
      flags: [],
      record: {
        id: newId,
        eso_id: incoming.eso_id,
        fide_id: incoming.fide_id,
        epitheto: incoming.epitheto,
        onoma: incoming.onoma,
        club: incoming.club || null,
        birthday: incoming.birthday,
        rating_eso: String(incoming.rating ?? 0),
        rating_fide_standard: null,
        rating_fide_rapid: null,
        rating_fide_blitz: null,
        sex_eso: incoming.sex,
        lastname_en: incoming.lastname_en,
        firstname_en: incoming.firstname_en,
      },
    };
  }

  const record: DirectoryRecord = { ...existing };
  const changes: Change[] = [];
  const flags: Flag[] = [];

  // --- βαθμός ΕΣΟ ---
  const before = ratingOf(existing.rating_eso);
  if (incoming.rating !== null) {
    if (incoming.rating > 0) {
      if (before === 0) {
        changes.push({ kind: "rating_new", detail: `χωρίς βαθμό → ${incoming.rating}` });
        record.rating_eso = String(incoming.rating);
      } else if (incoming.rating !== before) {
        changes.push({ kind: incoming.rating > before ? "rating_up" : "rating_down", detail: `${before} → ${incoming.rating}` });
        record.rating_eso = String(incoming.rating);
      }
    } else if (before > 0) {
      flags.push({ kind: "rating_lost", detail: `ο βαθμός ${before} γίνεται 0 στη λίστα (διατηρήθηκε ο ${before})` });
    }
  }

  // --- σύλλογος ---
  if (incoming.club && compareKey(incoming.club) !== compareKey(existing.club)) {
    changes.push({ kind: "club", detail: `${(existing.club ?? "").trim() || "—"} → ${incoming.club}` });
    record.club = incoming.club;
  }

  // --- ονοματεπώνυμο ---
  const existingName = `${existing.epitheto} ${existing.onoma}`;
  const brokenOrEmpty = !existing.epitheto.trim() || !existing.onoma.trim() || hasBrokenChars(existingName);
  const sameName =
    compareKey(existing.epitheto) === compareKey(incoming.epitheto) &&
    compareKey(existing.onoma) === compareKey(incoming.onoma);
  if (brokenOrEmpty) {
    if (!sameName) {
      changes.push({ kind: "name_fixed", detail: `${existingName.trim() || "—"} → ${incoming.epitheto} ${incoming.onoma}` });
      record.epitheto = incoming.epitheto;
      record.onoma = incoming.onoma;
    }
  } else if (!sameName) {
    flags.push({ kind: "name_diff", detail: `${existingName} ↔ λίστα: ${incoming.epitheto} ${incoming.onoma}` });
  }

  // --- γενέθλια ---
  if (incoming.birthday) {
    if (!parseBirthday(existing.birthday)) {
      changes.push({ kind: "birthday_filled", detail: `${existing.birthday?.trim() || "—"} → ${incoming.birthday}` });
      record.birthday = incoming.birthday;
    } else if (existing.birthday!.trim() !== incoming.birthday) {
      flags.push({ kind: "birthday_diff", detail: `${existing.birthday} ↔ λίστα: ${incoming.birthday}` });
    }
  }

  // --- FIDE ID ---
  const existingFide = (existing.fide_id ?? "").trim();
  if (incoming.fide_id) {
    if (!existingFide) {
      changes.push({ kind: "fide_filled", detail: `— → ${incoming.fide_id}` });
      record.fide_id = incoming.fide_id;
    } else if (existingFide !== incoming.fide_id) {
      flags.push({ kind: "fide_diff", detail: `${existingFide} ↔ λίστα: ${incoming.fide_id}` });
    }
  }

  // --- φύλο ΕΣΟ (στοιχείο αναφοράς: η λίστα σημειώνει μόνο τις γυναίκες) ---
  if ((existing.sex_eso ?? null) !== incoming.sex) {
    changes.push({ kind: "sex", detail: `${existing.sex_eso ?? "—"} → ${incoming.sex ?? "—"}` });
    record.sex_eso = incoming.sex;
  }

  // --- επίσημα λατινικά ονόματα ---
  const newLast = incoming.lastname_en ?? existing.lastname_en;
  const newFirst = incoming.firstname_en ?? existing.firstname_en;
  if (newLast !== existing.lastname_en || newFirst !== existing.firstname_en) {
    changes.push({ kind: "latin", detail: `${existing.lastname_en ?? "—"} ${existing.firstname_en ?? ""}`.trim() + ` → ${newLast ?? "—"} ${newFirst ?? ""}`.trimEnd() });
    record.lastname_en = newLast;
    record.firstname_en = newFirst;
  }

  return { action: changes.length > 0 ? "update" : "unchanged", record, changes, flags };
}
