/**
 * Ανάγνωση της λίστας βαθμολογιών της ΕΣΟ (Excel). Η συνάρτηση παίρνει τον πίνακα
 * κελιών (γραμμές × στήλες) όπως τον δίνει το SheetJS, ώστε να τρέχει και στον
 * browser (όπου διαβάζεται το αρχείο, γιατί είναι 14 MB) και στα tests.
 *
 * Δεν "μαντεύει" στήλες: ψάχνει τις επικεφαλίδες της ΕΣΟ (ID_No, Name, ClubName,
 * Birthday, Rtg_Nat, Sex, Lastname_En, Fistname_En, Fide_No) και σταματά με σαφές
 * μήνυμα αν λείπει κάποια απαραίτητη.
 */

export interface EsoRow {
  eso_id: string;
  fide_id: string | null;
  epitheto: string;
  onoma: string;
  club: string;
  /** ηη/μμ/εεεε — μόνο αν είναι έγκυρη ημερομηνία */
  birthday: string | null;
  /** 0 = χωρίς βαθμό· null = άκυρη τιμή στο αρχείο */
  rating: number | null;
  /** Η ΕΣΟ σημειώνει μόνο τις γυναίκες ("f"). Κενό ≠ βέβαιο ότι είναι άνδρας. */
  sex: "F" | null;
  lastname_en: string | null;
  firstname_en: string | null;
}

export interface ParseIssue {
  /** αριθμός γραμμής στο Excel (1 = επικεφαλίδα) */
  row: number;
  eso_id: string | null;
  message: string;
}

export interface ParsedEsoList {
  /** π.χ. "ratings_20260109" */
  listName: string | null;
  /** ISO ημερομηνία της λίστας, από το όνομα του φύλλου */
  listDate: string | null;
  rows: EsoRow[];
  issues: ParseIssue[];
  /** γραμμές δεδομένων στο αρχείο (πριν τον αποκλεισμό προβληματικών) */
  totalRows: number;
}

const norm = (s: unknown): string => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const collapse = (s: string): string => s.replace(/\s+/g, " ").trim();

type ColumnKey =
  | "id" | "fide" | "name" | "sex" | "club" | "birthday" | "rating" | "lastEn" | "firstEn";

const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  id: ["idno"],
  fide: ["fideno"],
  name: ["name"],
  sex: ["sex"],
  club: ["clubname"],
  birthday: ["birthday"],
  rating: ["rtgnat"],
  lastEn: ["lastnameen"],
  // Η ΕΣΟ γράφει "Fistname_En" (τυπογραφικό)· δεχόμαστε και τη σωστή γραφή.
  firstEn: ["fistnameen", "firstnameen"],
};

const REQUIRED: { key: ColumnKey; label: string }[] = [
  { key: "id", label: "ID_No" },
  { key: "name", label: "Name" },
  { key: "club", label: "ClubName" },
  { key: "rating", label: "Rtg_Nat" },
];

/** Ημερομηνία λίστας από το όνομα φύλλου τύπου ratings_20260109 → 2026-01-09. */
export function listDateFromSheetName(name: string | null | undefined): string | null {
  const m = String(name ?? "").match(/(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (date.getUTCFullYear() !== Number(y) || date.getUTCMonth() !== Number(mo) - 1 || date.getUTCDate() !== Number(d)) {
    return null;
  }
  return `${y}-${mo}-${d}`;
}

/** εεεε/μμ/ηη → ηη/μμ/εεεε. Επιστρέφει null για αδύνατη ημερομηνία ή απίθανο έτος (π.χ. 0016). */
export function convertBirthday(raw: unknown, currentYear = new Date().getFullYear()): string | null {
  const m = String(raw ?? "").trim().match(/^(\d{4})[/-](\d{2})[/-](\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const year = Number(y);
  if (year < 1900 || year > currentYear) return null;
  const date = new Date(Date.UTC(year, Number(mo) - 1, Number(d)));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== Number(mo) - 1 || date.getUTCDate() !== Number(d)) {
    return null;
  }
  return `${d}/${mo}/${y}`;
}

function wholeNumberString(raw: unknown): string | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 && Number.isInteger(raw) ? String(raw) : null;
  const s = String(raw ?? "").trim();
  return /^\d+$/.test(s) && Number(s) > 0 ? String(Number(s)) : null;
}

/** "ΕΠΩΝΥΜΟ, ΟΝΟΜΑ" → { epitheto, onoma }. Ξένα ονόματα έχουν κόμματα και ανάμεσα στα μικρά ονόματα. */
export function splitName(raw: unknown): { epitheto: string; onoma: string } | null {
  const s = String(raw ?? "");
  let idx = s.indexOf(", ");
  if (idx < 0) idx = s.indexOf(",");
  if (idx < 0) return null;
  const epitheto = collapse(s.slice(0, idx));
  const onoma = collapse(s.slice(idx + 1).replace(/,/g, " "));
  if (!epitheto || !onoma) return null;
  return { epitheto, onoma };
}

function latin(raw: unknown): string | null {
  const s = collapse(String(raw ?? "")).toUpperCase();
  return s || null;
}

export function parseEsoRows(grid: unknown[][], sheetName: string | null = null): ParsedEsoList {
  const headerIndex = grid.findIndex((row) => (row ?? []).some((c) => norm(c) === "idno"));
  if (headerIndex < 0) {
    throw new Error("Δεν βρέθηκε η επικεφαλίδα ID_No. Βεβαιωθείτε ότι ανεβάσατε τη λίστα βαθμολογιών της ΕΣΟ.");
  }

  const cols: Partial<Record<ColumnKey, number>> = {};
  (grid[headerIndex] ?? []).forEach((cell, i) => {
    const n = norm(cell);
    for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [ColumnKey, string[]][]) {
      if (aliases.includes(n) && cols[key] === undefined) cols[key] = i;
    }
  });
  for (const req of REQUIRED) {
    if (cols[req.key] === undefined) throw new Error(`Λείπει η στήλη ${req.label} από το αρχείο.`);
  }

  const cell = (row: unknown[], key: ColumnKey): unknown => (cols[key] === undefined ? "" : row[cols[key]!]);

  const rows: EsoRow[] = [];
  const issues: ParseIssue[] = [];
  const seen = new Set<string>();
  let total = 0;

  for (let i = headerIndex + 1; i < grid.length; i++) {
    const row = grid[i] ?? [];
    if (row.every((c) => String(c ?? "").trim() === "")) continue; // κενή γραμμή
    total++;
    const excelRow = i + 1;

    const id = wholeNumberString(cell(row, "id"));
    if (!id) {
      issues.push({ row: excelRow, eso_id: null, message: "Λείπει ή είναι άκυρος ο ΑΜ ΕΣΟ (ID_No). Η γραμμή παραλείπεται." });
      continue;
    }
    if (seen.has(id)) {
      issues.push({ row: excelRow, eso_id: id, message: "Ο ΑΜ ΕΣΟ εμφανίζεται ξανά στο αρχείο. Η επανάληψη παραλείπεται." });
      continue;
    }

    const name = splitName(cell(row, "name"));
    if (!name) {
      issues.push({ row: excelRow, eso_id: id, message: "Το όνομα δεν έχει τη μορφή «ΕΠΩΝΥΜΟ, ΟΝΟΜΑ». Η γραμμή παραλείπεται." });
      continue;
    }
    seen.add(id);

    const rawBirthday = String(cell(row, "birthday") ?? "").trim();
    const birthday = convertBirthday(rawBirthday);
    if (rawBirthday && !birthday) {
      issues.push({ row: excelRow, eso_id: id, message: `Άκυρη ημερομηνία γέννησης «${rawBirthday}». Αγνοείται.` });
    }

    const rawRating = cell(row, "rating");
    let rating: number | null;
    if (typeof rawRating === "number") rating = Number.isFinite(rawRating) && rawRating >= 0 ? Math.round(rawRating) : null;
    else if (String(rawRating ?? "").trim() === "") rating = 0;
    else rating = /^\d+$/.test(String(rawRating).trim()) ? Number(String(rawRating).trim()) : null;
    if (rating === null) {
      issues.push({ row: excelRow, eso_id: id, message: `Άκυρος βαθμός «${String(rawRating)}». Ο βαθμός αγνοείται.` });
    }

    rows.push({
      eso_id: id,
      fide_id: wholeNumberString(cell(row, "fide")),
      epitheto: name.epitheto,
      onoma: name.onoma,
      club: collapse(String(cell(row, "club") ?? "")),
      birthday,
      rating,
      sex: String(cell(row, "sex") ?? "").trim().toLowerCase() === "f" ? "F" : null,
      lastname_en: latin(cell(row, "lastEn")),
      firstname_en: latin(cell(row, "firstEn")),
    });
  }

  return {
    listName: sheetName,
    listDate: listDateFromSheetName(sheetName),
    rows,
    issues,
    totalRows: total,
  };
}
