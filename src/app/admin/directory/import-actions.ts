"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAccess } from "@/lib/access.server";
import {
  mergeEsoRow,
  nextPlrId,
  type ChangeKind,
  type DirectoryRecord,
  type FlagKind,
} from "@/lib/eso/merge";
import type { EsoRow } from "@/lib/eso/parse";

/**
 * Ενημέρωση του καταλόγου από τη λίστα ΕΣΟ. Το Excel διαβάζεται στον browser (14 MB, ξεπερνά
 * το όριο του Vercel) και εδώ έρχονται μικρά πακέτα γραμμών. ΜΟΝΟ super_admin.
 * Ο browser δεν εμπιστεύεται: κάθε πακέτο ελέγχεται ξανά και οι συγχωνεύσεις υπολογίζονται
 * στον server από την πραγματική κατάσταση της βάσης.
 */

const MAX_BATCH = 1000;

const RECORD_COLUMNS =
  "id, eso_id, fide_id, epitheto, onoma, club, birthday, rating_eso, rating_fide_standard, rating_fide_rapid, rating_fide_blitz, sex_eso, lastname_en, firstname_en";

export type Fail = { ok: false; message: string };

export interface Sample {
  kind: ChangeKind | FlagKind | "insert";
  eso_id: string;
  name: string;
  detail: string;
}

export interface BatchAnalysis {
  ok: true;
  inserted: number;
  updated: number;
  unchanged: number;
  changes: Partial<Record<ChangeKind, number>>;
  flags: Partial<Record<FlagKind, number>>;
  samples: Sample[];
}

export interface BatchApplied {
  ok: true;
  inserted: number;
  updated: number;
  unchanged: number;
}

const SAMPLES_PER_KIND_PER_BATCH = 12;

async function requireSuperAdmin(): Promise<{ label: string } | Fail> {
  const access = await getCurrentAccess();
  if (!access || access.role !== "super_admin") {
    return { ok: false, message: "Η ενέργεια επιτρέπεται μόνο στον διαχειριστή." };
  }
  return { label: access.label };
}

const short = (v: unknown, max: number): boolean => v === null || (typeof v === "string" && v.length <= max);

function validateRows(input: unknown): EsoRow[] | Fail {
  if (!Array.isArray(input) || input.length === 0) return { ok: false, message: "Το πακέτο είναι κενό." };
  if (input.length > MAX_BATCH) return { ok: false, message: `Το πακέτο ξεπερνά τις ${MAX_BATCH} γραμμές.` };
  const rows: EsoRow[] = [];
  for (const r of input as Record<string, unknown>[]) {
    const okShape =
      r &&
      typeof r.eso_id === "string" && /^\d{1,9}$/.test(r.eso_id) &&
      (r.fide_id === null || (typeof r.fide_id === "string" && /^\d{1,10}$/.test(r.fide_id))) &&
      typeof r.epitheto === "string" && r.epitheto.length > 0 && r.epitheto.length <= 120 &&
      typeof r.onoma === "string" && r.onoma.length > 0 && r.onoma.length <= 120 &&
      typeof r.club === "string" && r.club.length <= 200 &&
      (r.birthday === null || (typeof r.birthday === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(r.birthday))) &&
      (r.rating === null || (typeof r.rating === "number" && Number.isInteger(r.rating) && r.rating >= 0 && r.rating <= 3500)) &&
      (r.sex === null || r.sex === "F") &&
      short(r.lastname_en, 120) && short(r.firstname_en, 120);
    if (!okShape) return { ok: false, message: "Το πακέτο περιέχει γραμμή με μη έγκυρα στοιχεία." };
    rows.push(r as unknown as EsoRow);
  }
  return rows;
}

const MISSING_COLUMNS = "Λείπουν οι νέες στήλες του καταλόγου. Τρέξτε πρώτα το supabase/setup_players.sql στο Supabase του teamchamp και ξαναδοκιμάστε.";

async function loadExisting(esoIds: string[]): Promise<Map<string, DirectoryRecord> | Fail> {
  const db = createClient();
  const map = new Map<string, DirectoryRecord>();
  for (let i = 0; i < esoIds.length; i += 500) {
    const { data, error } = await db
      .from("players_directory")
      .select(RECORD_COLUMNS)
      .in("eso_id", esoIds.slice(i, i + 500));
    if (error) {
      return { ok: false, message: error.code === "42703" ? MISSING_COLUMNS : `Αποτυχία ανάγνωσης του καταλόγου: ${error.message}` };
    }
    for (const rec of (data ?? []) as unknown as DirectoryRecord[]) if (rec.eso_id) map.set(rec.eso_id.trim(), rec);
  }
  return map;
}

/** Προεπισκόπηση πακέτου: τι θα άλλαζε, χωρίς να γραφτεί τίποτα. */
export async function analyzeEsoBatch(input: unknown): Promise<BatchAnalysis | Fail> {
  const who = await requireSuperAdmin();
  if ("ok" in who) return who;
  const rows = validateRows(input);
  if ("ok" in rows) return rows;

  const existing = await loadExisting(rows.map((r) => r.eso_id));
  if ("ok" in existing) return existing;

  const out: BatchAnalysis = { ok: true, inserted: 0, updated: 0, unchanged: 0, changes: {}, flags: {}, samples: [] };
  const perKind: Record<string, number> = {};
  const addSample = (kind: Sample["kind"], row: EsoRow, detail: string) => {
    if ((perKind[kind] = (perKind[kind] ?? 0) + 1) <= SAMPLES_PER_KIND_PER_BATCH) {
      out.samples.push({ kind, eso_id: row.eso_id, name: `${row.epitheto} ${row.onoma}`, detail });
    }
  };

  for (const row of rows) {
    const res = mergeEsoRow(existing.get(row.eso_id) ?? null, row, "PLR-00000");
    if (res.action === "insert") {
      out.inserted++;
      addSample("insert", row, `${row.club || "—"} · ΕΛΟ ${row.rating ?? 0}`);
    } else if (res.action === "update") out.updated++;
    else out.unchanged++;
    for (const c of res.changes) {
      out.changes[c.kind] = (out.changes[c.kind] ?? 0) + 1;
      // Το φύλο ΕΣΟ και τα λατινικά αλλάζουν σε μαζική κλίμακα την πρώτη φορά· δεν χρειάζονται δείγμα
      if (c.kind !== "sex" && c.kind !== "latin") addSample(c.kind, row, c.detail);
    }
    for (const f of res.flags) {
      out.flags[f.kind] = (out.flags[f.kind] ?? 0) + 1;
      addSample(f.kind, row, f.detail);
    }
  }
  return out;
}

/** Εφαρμογή πακέτου. Οι νέοι αθλητές μπαίνουν με insert (ποτέ πάνω σε υπάρχουσα εγγραφή). */
export async function applyEsoBatch(input: unknown): Promise<BatchApplied | Fail> {
  const who = await requireSuperAdmin();
  if ("ok" in who) return who;
  const rows = validateRows(input);
  if ("ok" in rows) return rows;

  const db = createClient();
  const existing = await loadExisting(rows.map((r) => r.eso_id));
  if ("ok" in existing) return existing;

  // Επόμενος κωδικός: μετά τον μεγαλύτερο υπάρχοντα (PLR-00001, PLR-00002, ...)
  const { data: top } = await db.from("players_directory").select("id").order("id", { ascending: false }).limit(1);
  let lastId: string | null = ((top ?? [])[0] as { id: string } | undefined)?.id ?? null;

  const toInsert: DirectoryRecord[] = [];
  const toUpdate: DirectoryRecord[] = [];
  let unchanged = 0;
  for (const row of rows) {
    const current = existing.get(row.eso_id) ?? null;
    const newId = current ? undefined : nextPlrId(lastId);
    const res = mergeEsoRow(current, row, newId);
    if (res.action === "insert") {
      toInsert.push(res.record);
      lastId = res.record.id;
    } else if (res.action === "update") toUpdate.push(res.record);
    else unchanged++;
  }

  if (toInsert.length > 0) {
    const { error } = await db.from("players_directory").insert(toInsert);
    if (error) return { ok: false, message: `Αποτυχία προσθήκης νέων αθλητών: ${error.message}` };
  }
  if (toUpdate.length > 0) {
    const { error } = await db.from("players_directory").upsert(toUpdate, { onConflict: "id" });
    if (error) return { ok: false, message: `Αποτυχία ενημέρωσης: ${error.message}` };
  }
  return { ok: true, inserted: toInsert.length, updated: toUpdate.length, unchanged };
}

export interface ImportMeta {
  fileName: string;
  listName: string | null;
  listDate: string | null;
  totalRows: number;
  inserted: number;
  updated: number;
  unchanged: number;
}

/** Καταγραφή της ενημέρωσης στο ιστορικό (ποια λίστα, πότε, πόσες αλλαγές). */
export async function finishEsoImport(meta: ImportMeta): Promise<{ ok: true } | Fail> {
  const who = await requireSuperAdmin();
  if ("ok" in who) return who;
  const num = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : 0);
  const { error } = await createClient().from("eso_imports").insert({
    list_name: typeof meta.listName === "string" ? meta.listName.slice(0, 120) : null,
    list_date: typeof meta.listDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(meta.listDate) ? meta.listDate : null,
    file_name: typeof meta.fileName === "string" ? meta.fileName.slice(0, 200) : null,
    total_rows: num(meta.totalRows),
    inserted: num(meta.inserted),
    updated: num(meta.updated),
    unchanged: num(meta.unchanged),
    applied_by: who.label,
  });
  if (error) return { ok: false, message: `Η ενημέρωση εφαρμόστηκε, αλλά δεν καταγράφηκε στο ιστορικό: ${error.message}` };
  revalidatePath("/admin/directory");
  return { ok: true };
}
