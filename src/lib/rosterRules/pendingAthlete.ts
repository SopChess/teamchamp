import { isGender, type Gender } from "@/lib/players/directory";

/** Ένας αθλητής όπως τον έχει προσθέσει ο υπεύθυνος στη φόρμα εγγραφής, πριν αποθηκευτεί. */
export type PendingAthlete =
  | { source: "directory"; directoryId: string; gender: Gender; label: string }
  | {
      source: "manual";
      gender: Gender;
      first_name: string;
      last_name: string;
      birth_date: string | null;
      rating_national: number | null;
      rating_fide: number | null;
      label: string;
    };

/**
 * Ανάλυση του JSON που στέλνει η φόρμα εγγραφής (πεδίο athletes_json). Πετάει
 * Error με σαφές μήνυμα σε κάθε προβληματική γραμμή — δεν αγνοεί σιωπηλά.
 */
export function parsePendingAthletes(raw: string): PendingAthlete[] {
  let list: unknown;
  try {
    list = JSON.parse(raw || "[]");
  } catch {
    throw new Error("Μη έγκυρη λίστα αθλητών.");
  }
  if (!Array.isArray(list)) throw new Error("Μη έγκυρη λίστα αθλητών.");

  return list.map((item, i) => {
    const n = i + 1;
    if (!item || typeof item !== "object") throw new Error(`Αθλητής ${n}: μη έγκυρα στοιχεία.`);
    const o = item as Record<string, unknown>;
    const gender = String(o.gender ?? "");
    if (!isGender(gender)) throw new Error(`Αθλητής ${n}: επιλέξτε φύλο (Άνδρας ή Γυναίκα).`);

    if (o.source === "directory") {
      const directoryId = String(o.directoryId ?? "").trim();
      if (!directoryId) throw new Error(`Αθλητής ${n}: λείπει ο κωδικός καταλόγου.`);
      return { source: "directory", directoryId, gender, label: String(o.label ?? "") };
    }

    const firstName = String(o.first_name ?? "").trim();
    const lastName = String(o.last_name ?? "").trim();
    if (!firstName || !lastName) throw new Error(`Αθλητής ${n}: όνομα και επώνυμο (λατινικά) είναι υποχρεωτικά.`);
    const num = (v: unknown) => {
      const s = String(v ?? "").trim();
      const x = Number(s);
      return s !== "" && Number.isFinite(x) ? x : null;
    };
    return {
      source: "manual",
      gender,
      first_name: firstName,
      last_name: lastName,
      birth_date: String(o.birth_date ?? "").trim() || null,
      rating_national: num(o.rating_national),
      rating_fide: num(o.rating_fide),
      label: `${lastName} ${firstName}`,
    };
  });
}
