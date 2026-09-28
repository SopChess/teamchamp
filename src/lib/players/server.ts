import { createClient } from "@/lib/supabase/server";
import {
  DIRECTORY_SELECT, SEARCH_LIMIT, normalizeQuery, sameAthlete,
  type AthleteIdentity, type DirectoryRow,
} from "./directory";

type Db = ReturnType<typeof createClient>;

/**
 * Αναζήτηση στον κατάλογο: επώνυμο (τουλάχιστον 2 γράμματα) και προαιρετικά όνομα,
 * όπως στο SopRegSB. ΠΑΝΤΑ το πολύ SEARCH_LIMIT αποτελέσματα — σε αντίθεση με το
 * SopRegSB (που επιστρέφει έως 500 όταν δοθεί μόνο επώνυμο), γιατί εδώ πρόκειται για
 * στοιχεία παιδιών και δεν πρέπει να μπορεί κανείς να "κατεβάσει" τον κατάλογο.
 */
export async function searchDirectoryRows(db: Db, epithetoRaw: string, onomaRaw: string): Promise<DirectoryRow[]> {
  const epitheto = normalizeQuery(epithetoRaw);
  const onoma = normalizeQuery(onomaRaw);
  if (epitheto.length < 2) return [];

  // Αναζήτηση στα κλειδιά epitheto_key/onoma_key (κεφαλαία, χωρίς τόνους, υπολογισμένα από
  // τη βάση) ώστε να βρίσκονται και εγγραφές που στην πηγή έχουν τόνο ή πεζά. Ο όρος έχει
  // ήδη καθαριστεί από χαρακτήρες με ειδική σημασία (%, _, \\).
  let q = db.from("players_directory").select(DIRECTORY_SELECT).like("epitheto_key", `%${epitheto}%`);
  if (onoma.length >= 2) q = q.like("onoma_key", `%${onoma}%`);
  const { data, error } = await q.order("epitheto_key").order("onoma_key").limit(SEARCH_LIMIT);
  if (error) {
    console.error("players_directory search error:", error.message);
    return [];
  }
  return (data ?? []) as DirectoryRow[];
}

/** Αναζήτηση με ΑΜ ΕΣΟ ή FIDE ID (μόνο ψηφία), όπως στο SopRegSB. */
export async function findDirectoryRowByNumber(db: Db, raw: string): Promise<DirectoryRow | null> {
  const idnum = (raw ?? "").replace(/\D/g, "");
  if (!idnum) return null;
  const { data, error } = await db
    .from("players_directory")
    .select(DIRECTORY_SELECT)
    .or(`eso_id.eq.${idnum},fide_id.eq.${idnum}`)
    .limit(1);
  if (error) {
    console.error("players_directory lookup error:", error.message);
    return null;
  }
  return ((data ?? [])[0] as DirectoryRow | undefined) ?? null;
}

export async function findDirectoryRowById(db: Db, id: string): Promise<DirectoryRow | null> {
  const { data } = await db.from("players_directory").select(DIRECTORY_SELECT).eq("id", id).maybeSingle();
  return (data as DirectoryRow | null) ?? null;
}

/**
 * Είναι ήδη δηλωμένος αυτός ο αθλητής σε κάποια ομάδα της ΙΔΙΑΣ διοργάνωσης;
 * Επιστρέφει την ομάδα όπου βρέθηκε, ώστε να ξεχωρίζουμε "ήδη στη δική σας ομάδα"
 * από "δηλωμένος σε άλλη ομάδα".
 */
export async function findAthleteInCompetition(
  db: Db,
  competitionId: string,
  candidate: AthleteIdentity
): Promise<{ teamId: string } | null> {
  const { data: teams } = await db.from("teams").select("id").eq("competition_id", competitionId);
  const teamIds = (teams ?? []).map((t) => t.id);
  if (teamIds.length === 0) return null;

  const { data: entries } = await db.from("roster_entries").select("team_id, player_id").in("team_id", teamIds);
  if (!entries?.length) return null;

  const { data: players } = await db
    .from("players")
    .select("id, first_name, last_name, birth_date, national_id, directory_id")
    .in("id", entries.map((e) => e.player_id));

  for (const e of entries) {
    const p = (players ?? []).find((x) => x.id === e.player_id);
    if (p && sameAthlete(candidate, p)) return { teamId: e.team_id };
  }
  return null;
}

/**
 * Επόμενη θέση στη δηλωμένη σειρά. Χρησιμοποιεί το μέγιστο + 1 (ΟΧΙ το πλήθος + 1):
 * αν αφαιρεθεί αθλητής από τη μέση, το πλήθος + 1 συγκρούεται με υπάρχουσα θέση και
 * το unique(team_id, declared_order) απορρίπτει την προσθήκη.
 */
export async function nextDeclaredOrder(db: Db, teamId: string): Promise<number> {
  const { data } = await db
    .from("roster_entries")
    .select("declared_order")
    .eq("team_id", teamId)
    .order("declared_order", { ascending: false })
    .limit(1);
  return ((data ?? [])[0]?.declared_order ?? 0) + 1;
}
