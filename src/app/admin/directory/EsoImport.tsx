"use client";

import { useEffect, useRef, useState } from "react";
import { parseEsoRows, type ParsedEsoList } from "@/lib/eso/parse";
import {
  analyzeEsoBatch,
  applyEsoBatch,
  finishEsoImport,
  type Sample,
} from "./import-actions";

const BATCH = 500;
const SAMPLE_CAP = 25;

export interface LastImport {
  list_date: string | null;
  list_name: string | null;
  applied_at: string;
  inserted: number;
  updated: number;
}

type Stage = "idle" | "reading" | "parsed" | "analyzing" | "analyzed" | "applying" | "done";

interface Totals {
  inserted: number;
  updated: number;
  unchanged: number;
  changes: Record<string, number>;
  flags: Record<string, number>;
}
const emptyTotals = (): Totals => ({ inserted: 0, updated: 0, unchanged: 0, changes: {}, flags: {} });

const CHANGE_LABELS: Record<string, string> = {
  rating_up: "Αυξήσεις βαθμού",
  rating_down: "Μειώσεις βαθμού",
  rating_new: "Πρώτος βαθμός",
  club: "Αλλαγές συλλόγου",
  name_fixed: "Διορθώσεις ονόματος (χαλασμένος χαρακτήρας)",
  birthday_filled: "Συμπληρώσεις γενεθλίων",
  fide_filled: "Συμπληρώσεις FIDE ID",
  sex: "Ενημερώσεις φύλου ΕΣΟ",
  latin: "Επίσημα λατινικά ονόματα",
};
const FLAG_LABELS: Record<string, string> = {
  rating_lost: "Βαθμός που η λίστα μηδενίζει (διατηρήθηκε ο υπάρχων)",
  name_diff: "Διαφορές ονόματος (δεν αλλάχθηκαν)",
  birthday_diff: "Διαφορές γενεθλίων (δεν αλλάχθηκαν)",
  fide_diff: "Διαφορές FIDE ID (δεν αλλάχθηκαν)",
};
const SAMPLE_LABELS: Record<string, string> = { insert: "Νέοι αθλητές", ...CHANGE_LABELS, ...FLAG_LABELS };

const formatDate = (iso: string | null | undefined): string =>
  iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—";

const num = (n: number | undefined): string => (n ?? 0).toLocaleString("el-GR");

export default function EsoImport({ lastImport }: { lastImport: LastImport | null }) {
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedEsoList | null>(null);
  const [progress, setProgress] = useState(0);
  const [totals, setTotals] = useState<Totals>(emptyTotals());
  const [samples, setSamples] = useState<Record<string, Sample[]>>({});
  const [applied, setApplied] = useState<{ inserted: number; updated: number; unchanged: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Όσο εφαρμόζεται η ενημέρωση, προειδοποίηση πριν κλείσει η σελίδα
  useEffect(() => {
    if (stage !== "applying") return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [stage]);

  function reset() {
    setStage("idle");
    setError(null);
    setParsed(null);
    setFileName("");
    setProgress(0);
    setTotals(emptyTotals());
    setSamples({});
    setApplied(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function onFile(file: File) {
    setError(null);
    setParsed(null);
    setTotals(emptyTotals());
    setSamples({});
    setApplied(null);
    setFileName(file.name);
    setStage("reading");
    try {
      const XLSX = await import("xlsx"); // φορτώνεται μόνο σε αυτή τη σελίδα
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      let result: ParsedEsoList | null = null;
      let lastError = "";
      for (const name of workbook.SheetNames) {
        try {
          const grid = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, raw: true, defval: "" });
          result = parseEsoRows(grid, name);
          break;
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
        }
      }
      if (!result) throw new Error(lastError || "Το αρχείο δεν περιέχει λίστα βαθμολογιών της ΕΣΟ.");
      setParsed(result);
      setStage("parsed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Το αρχείο δεν μπόρεσε να διαβαστεί.");
      setStage("idle");
    }
  }

  async function analyze() {
    if (!parsed) return;
    setError(null);
    setStage("analyzing");
    setProgress(0);
    const acc = emptyTotals();
    const smp: Record<string, Sample[]> = {};
    for (let i = 0; i < parsed.rows.length; i += BATCH) {
      const res = await analyzeEsoBatch(parsed.rows.slice(i, i + BATCH));
      if (!res.ok) {
        setError(res.message);
        setStage("parsed");
        return;
      }
      acc.inserted += res.inserted;
      acc.updated += res.updated;
      acc.unchanged += res.unchanged;
      for (const [k, v] of Object.entries(res.changes)) acc.changes[k] = (acc.changes[k] ?? 0) + (v ?? 0);
      for (const [k, v] of Object.entries(res.flags)) acc.flags[k] = (acc.flags[k] ?? 0) + (v ?? 0);
      for (const s of res.samples) {
        const list = (smp[s.kind] ??= []);
        if (list.length < SAMPLE_CAP) list.push(s);
      }
      setProgress(Math.min(1, (i + BATCH) / parsed.rows.length));
    }
    setTotals(acc);
    setSamples(smp);
    setStage("analyzed");
  }

  async function apply() {
    if (!parsed) return;
    const older = !!(lastImport?.list_date && parsed.listDate && parsed.listDate < lastImport.list_date);
    const message = older
      ? `Προσοχή: η λίστα που ανεβάσατε (${formatDate(parsed.listDate)}) είναι ΠΑΛΑΙΟΤΕΡΗ από την τελευταία που εφαρμόστηκε (${formatDate(lastImport!.list_date)}). ` +
        `Η εφαρμογή της μπορεί να επαναφέρει παλιότερους βαθμούς. Θέλετε πραγματικά να συνεχίσετε;`
      : `Θα προστεθούν ${num(totals.inserted)} νέοι αθλητές και θα ενημερωθούν ${num(totals.updated)}. Η σελίδα πρέπει να μείνει ανοιχτή μέχρι να τελειώσει. Συνέχεια;`;
    if (!window.confirm(message)) return;

    setError(null);
    setStage("applying");
    setProgress(0);
    const done = { inserted: 0, updated: 0, unchanged: 0 };
    for (let i = 0; i < parsed.rows.length; i += BATCH) {
      const res = await applyEsoBatch(parsed.rows.slice(i, i + BATCH));
      if (!res.ok) {
        setApplied(done);
        setError(
          `${res.message} Η εφαρμογή σταμάτησε στη γραμμή ${i + 1} από ${parsed.rows.length}. Τα προηγούμενα πακέτα έχουν ήδη ` +
            `εφαρμοστεί. Η ενημέρωση είναι ασφαλές να επαναληφθεί: ανεβάστε ξανά το ίδιο αρχείο και δείτε τι απομένει.`
        );
        setStage("analyzed");
        return;
      }
      done.inserted += res.inserted;
      done.updated += res.updated;
      done.unchanged += res.unchanged;
      setProgress(Math.min(1, (i + BATCH) / parsed.rows.length));
    }
    setApplied(done);
    const log = await finishEsoImport({
      fileName,
      listName: parsed.listName,
      listDate: parsed.listDate,
      totalRows: parsed.rows.length,
      ...done,
    });
    if (!log.ok) setError(log.message);
    setStage("done");
  }

  const changeEntries = Object.entries(totals.changes).filter(([, v]) => v > 0);
  const flagEntries = Object.entries(totals.flags).filter(([, v]) => v > 0);
  const nothingToApply = totals.inserted + totals.updated === 0;
  const sameList = !!(lastImport?.list_date && parsed?.listDate && parsed.listDate === lastImport.list_date);
  const olderList = !!(lastImport?.list_date && parsed?.listDate && parsed.listDate < lastImport.list_date);
  const busy = stage === "reading" || stage === "analyzing" || stage === "applying";

  const btn = "rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-40";

  return (
    <div className="flex flex-col gap-4 bg-card border border-cardBorder rounded-xl p-5">
      <div>
        <div className="text-xs uppercase tracking-wide text-muted">Ενημέρωση από λίστα ΕΣΟ (Excel)</div>
        <p className="text-xs text-muted mt-1">
          Ανεβάστε το αρχείο βαθμολογιών της ΕΣΟ (.xls ή .xlsx). Το αρχείο διαβάζεται στον browser σας και πρώτα
          εμφανίζεται προεπισκόπηση. Δεν αλλάζει τίποτα μέχρι να πατήσετε «Εφαρμογή». Δεν διαγράφεται ποτέ αθλητής.
        </p>
        {lastImport ? (
          <p className="text-xs text-muted mt-1">
            Τελευταία ενημέρωση: λίστα {formatDate(lastImport.list_date)} (εφαρμόστηκε{" "}
            {new Date(lastImport.applied_at).toLocaleDateString("el-GR")}, {num(lastImport.inserted)} νέοι,{" "}
            {num(lastImport.updated)} ενημερώσεις).
          </p>
        ) : (
          <p className="text-xs text-muted mt-1">Δεν έχει γίνει ακόμα ενημέρωση από λίστα ΕΣΟ.</p>
        )}
      </div>

      {(stage === "idle" || stage === "reading") && (
        <input
          ref={fileInput}
          type="file"
          accept=".xls,.xlsx"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
          className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-panel file:px-3 file:py-2 file:text-sm"
        />
      )}
      {stage === "reading" && (
        <p className="text-sm text-muted">Ανάγνωση αρχείου… μπορεί να διαρκέσει λίγα δευτερόλεπτα για μεγάλα αρχεία.</p>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {parsed && stage !== "idle" && stage !== "reading" && (
        <div className="bg-panel border border-cardBorder rounded-lg px-4 py-3 text-sm">
          <div className="font-semibold">{fileName}</div>
          <div className="text-xs text-muted mt-1">
            Λίστα {formatDate(parsed.listDate)} · {num(parsed.rows.length)} αθλητές
            {parsed.rows.length !== parsed.totalRows ? ` (από ${num(parsed.totalRows)} γραμμές)` : ""}
            {parsed.issues.length > 0 ? ` · ${num(parsed.issues.length)} προβλήματα γραμμών` : ""}
          </div>
          {olderList && (
            <p className="text-xs text-red-400 mt-2">
              Προσοχή: αυτή η λίστα ({formatDate(parsed.listDate)}) είναι παλαιότερη από την τελευταία που εφαρμόστηκε (
              {formatDate(lastImport!.list_date)}).
            </p>
          )}
          {sameList && (
            <p className="text-xs text-muted mt-2">Η ίδια λίστα ({formatDate(parsed.listDate)}) έχει ήδη εφαρμοστεί. Δεν θα υπάρχουν αλλαγές.</p>
          )}
          {parsed.issues.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs cursor-pointer text-muted">Προβλήματα γραμμών (εμφανίζονται τα πρώτα 20)</summary>
              <ul className="text-xs text-muted mt-1 list-disc pl-5">
                {parsed.issues.slice(0, 20).map((i, idx) => (
                  <li key={idx}>
                    Γραμμή {i.row}
                    {i.eso_id ? ` (ΑΜ ${i.eso_id})` : ""}: {i.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {(stage === "analyzing" || stage === "applying") && (
        <div>
          <div className="text-xs text-muted mb-1">
            {stage === "analyzing" ? "Προεπισκόπηση…" : "Εφαρμογή… μην κλείσετε τη σελίδα."} {Math.round(progress * 100)}%
          </div>
          <div className="h-2 bg-panel rounded-full overflow-hidden">
            <div className="h-full bg-gold transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      )}

      {stage === "parsed" && (
        <div className="flex gap-2">
          <button type="button" onClick={analyze} className={`${btn} bg-gold text-bg`}>
            Προεπισκόπηση αλλαγών
          </button>
          <button type="button" onClick={reset} className={`${btn} bg-panel border border-cardBorder`}>
            Άλλο αρχείο
          </button>
        </div>
      )}

      {stage === "analyzed" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              ["Νέοι αθλητές", totals.inserted],
              ["Θα ενημερωθούν", totals.updated],
              ["Αμετάβλητοι", totals.unchanged],
            ].map(([label, value]) => (
              <div key={label as string} className="bg-panel border border-cardBorder rounded-lg py-3">
                <div className="font-serif font-bold text-xl">{num(value as number)}</div>
                <div className="text-xs text-muted">{label}</div>
              </div>
            ))}
          </div>

          {changeEntries.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted mb-1">Αλλαγές που θα εφαρμοστούν</div>
              <ul className="text-sm divide-y divide-cardBorder bg-panel border border-cardBorder rounded-lg">
                {changeEntries.map(([k, v]) => (
                  <li key={k} className="flex justify-between px-3 py-1.5">
                    <span>{CHANGE_LABELS[k] ?? k}</span>
                    <span className="font-semibold">{num(v)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {flagEntries.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted mb-1">Για έλεγχο (δεν εφαρμόζονται αυτόματα)</div>
              <ul className="text-sm divide-y divide-cardBorder bg-panel border border-cardBorder rounded-lg">
                {flagEntries.map(([k, v]) => (
                  <li key={k} className="flex justify-between px-3 py-1.5">
                    <span>{FLAG_LABELS[k] ?? k}</span>
                    <span className="font-semibold">{num(v)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Object.keys(samples).length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-xs uppercase tracking-wide text-muted">Δείγματα</div>
              {Object.entries(samples).map(([kind, list]) => (
                <details key={kind} className="bg-panel border border-cardBorder rounded-lg px-3 py-2">
                  <summary className="text-sm cursor-pointer">{SAMPLE_LABELS[kind] ?? kind}</summary>
                  <ul className="text-xs text-muted mt-2 flex flex-col gap-1">
                    {list.map((s, i) => (
                      <li key={i}>
                        <span>{s.name}</span> (ΑΜ {s.eso_id}): {s.detail}
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={apply} disabled={nothingToApply} className={`${btn} bg-gold text-bg`}>
              {nothingToApply ? "Δεν υπάρχουν αλλαγές" : "Εφαρμογή"}
            </button>
            <button type="button" onClick={reset} className={`${btn} bg-panel border border-cardBorder`}>
              Άκυρο
            </button>
          </div>
        </div>
      )}

      {stage === "done" && applied && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-good">
            Η ενημέρωση ολοκληρώθηκε: {num(applied.inserted)} νέοι αθλητές, {num(applied.updated)} ενημερώσεις,{" "}
            {num(applied.unchanged)} αμετάβλητοι.
          </p>
          <button type="button" onClick={reset} className={`${btn} bg-panel border border-cardBorder self-start`}>
            Νέα ενημέρωση
          </button>
        </div>
      )}
    </div>
  );
}
