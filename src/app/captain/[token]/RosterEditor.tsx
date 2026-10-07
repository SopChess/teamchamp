"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import SavableForm from "@/components/SavableForm";
import PlayerSearch from "./PlayerSearch";
import type { DirectoryHit } from "@/lib/players/directory";
import type { AddAthleteResult } from "./actions";
import { submitRosterOrder } from "./actions";
import { satisfiesBoardRule } from "@/lib/rosterRules/engine";
import { positionLabel } from "@/lib/rosterRules/boardNotation";
import type { RosterRules, Player, BoardConstraint } from "@/lib/rosterRules/types";

interface EntryPlayer {
  id?: string;
  last_name?: string;
  first_name?: string;
  rating_national?: number;
  rating_fide?: number;
  gender?: string;
  birth_date?: string | null;
}

export interface RosterEditorEntry {
  id: string;
  declared_order: number;
  player: EntryPlayer | undefined;
}

interface Props {
  entries: RosterEditorEntry[];
  rosterSize: number | null;
  /** Κανόνες σύνθεσης (επιβεβαιωμένο, νέο): η σημειογραφία ανά θέση, η διαχωριστική
   * γραμμή Βασικών/Αναπληρωματικών (στο match_board_count), και ο Έλεγχος Σύνθεσης
   * βασίζονται όλα σε αυτό. Μπορεί να είναι null αν δεν έχουν οριστεί ακόμα κανόνες. */
  rules: RosterRules | null;
  referenceYear: number;
  editableByDeadline: boolean;
  lockedReason?: string;
  token: string;
  teamId: string | undefined;
  remove: (entryId: string) => Promise<void>;
  addManual: (formData: FormData) => Promise<void>;
  search: (epitheto: string, onoma: string) => Promise<DirectoryHit[]>;
  searchByNumber: (number: string) => Promise<DirectoryHit | null>;
  addDirectory: (directoryId: string, gender: string) => Promise<AddAthleteResult>;
  directoryAvailable: boolean;
}

type CheckStatus = "ok" | "bad" | "neutral";

function toPlayer(p: EntryPlayer | undefined): Player {
  return {
    id: p?.id ?? "",
    first_name: p?.first_name ?? "",
    last_name: p?.last_name ?? "",
    birth_date: p?.birth_date ?? undefined,
    gender: p?.gender as "M" | "F" | undefined,
    rating_national: p?.rating_national,
    rating_fide: p?.rating_fide,
  };
}

/**
 * Η Βασική Σύνθεση ξεκινά σε ΚΑΘΑΡΗ προβολή. Το κουμπί "Επεξεργασία Βασικής Σύνθεσης"
 * ανοίγει πλήρη επεξεργασία. ΜΕΓΑΛΗ ΑΛΛΑΓΗ (επιβεβαιωμένο, αντιστρέφει το προηγούμενο
 * "αποθήκευση άμεσα"): η μετακίνηση ↑/↓ αλλάζει πλέον ΜΟΝΟ τοπική κατάσταση (καμία κλήση
 * server σε κάθε κλικ) — η σειρά αποθηκεύεται ΜΟΝΟ με "Υποβολή Σύνθεσης", και ΜΟΝΟ αφού
 * ο "Έλεγχος Σύνθεσης" βρει όλες τις Βασικές θέσεις έγκυρες (πράσινο). Η προσθήκη/αφαίρεση
 * αθλητή παραμένει άμεση (ξεχωριστό ζήτημα από τη σειρά) — αμετάβλητη.
 */
export default function RosterEditor({
  entries, rosterSize, rules, referenceYear, editableByDeadline, lockedReason, token, teamId, remove, addManual,
  search, searchByNumber, addDirectory, directoryAvailable,
}: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const editing = isEditing && editableByDeadline;

  const [draft, setDraft] = useState<RosterEditorEntry[]>(entries);
  const [checkResults, setCheckResults] = useState<Record<string, CheckStatus> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Συγχρονισμός όταν αλλάζει ο ΠΡΑΓΜΑΤΙΚΟΣ κατάλογος (προσθήκη/αφαίρεση αθλητή —
  // αυτά παραμένουν άμεσα, αναγκάζουν τη σελίδα να φέρει νέα entries από τον server).
  const prevIds = useRef<string>("");
  useEffect(() => {
    const ids = entries.map((e) => e.id).sort().join(",");
    if (ids !== prevIds.current) {
      prevIds.current = ids;
      setDraft(entries);
      setCheckResults(null);
    }
  }, [entries]);

  const matchBoardCount = rules?.match_board_count ?? rules?.board_rules.length ?? null;
  const constraintsFor = (position: number): BoardConstraint[] =>
    rules?.board_rules.find((b) => b.board === position)?.constraints ?? [];

  const move = (index: number, dir: "up" | "down") => {
    const swapWith = dir === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= draft.length) return;
    const next = [...draft];
    [next[index], next[swapWith]] = [next[swapWith]!, next[index]!];
    setDraft(next);
    setCheckResults(null); // προηγούμενος έλεγχος δεν ισχύει πια για τη νέα σειρά
  };

  const runCheck = () => {
    const results: Record<string, CheckStatus> = {};
    draft.forEach((entry, i) => {
      const position = i + 1;
      if (matchBoardCount != null && position > matchBoardCount) {
        results[entry.id] = "neutral"; // αναπληρωματικός — καμία συγκεκριμένη σκακιέρα να ελεγχθεί
        return;
      }
      const rule = rules?.board_rules.find((b) => b.board === position);
      if (!rule || rule.constraints.length === 0) {
        results[entry.id] = "ok";
        return;
      }
      results[entry.id] = satisfiesBoardRule(toPlayer(entry.player), rule) ? "ok" : "bad";
    });
    setCheckResults(results);
  };

  const allOk = checkResults != null && draft.every((e) => checkResults[e.id] !== "bad");

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitRosterOrder(token, teamId, draft.map((e) => e.id));
      router.refresh();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Άγνωστο σφάλμα.");
    } finally {
      setSubmitting(false);
    }
  };

  const rowBg = (status: CheckStatus | undefined) => {
    if (status === "ok") return "bg-okBg border-okText/30";
    if (status === "bad") return "bg-pendingBg border-pendingText/30";
    return "bg-card border-cardBorder";
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-wide text-muted">
          Βασική Σύνθεση{rosterSize ? ` · έως ${rosterSize}` : ""}
        </div>
        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            disabled={!editableByDeadline}
            title={!editableByDeadline ? lockedReason : undefined}
            className="text-xs text-gold underline disabled:text-muted disabled:no-underline disabled:cursor-not-allowed"
          >
            Επεξεργασία Βασικής Σύνθεσης
          </button>
        ) : (
          <button type="button" onClick={() => setIsEditing(false)} className="text-xs text-gold underline">
            Κλείσιμο
          </button>
        )}
      </div>

      {!editableByDeadline && (
        <p className="text-xs text-muted">
          {lockedReason ?? "Η προθεσμία έχει λήξει — δεν επιτρέπονται πλέον αλλαγές στη σύνθεση."}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {matchBoardCount != null && (
          <div className="text-[10px] uppercase tracking-wide text-muted font-semibold px-1">
            Βασικοί ({matchBoardCount} σκακιέρες)
          </div>
        )}
        {draft.map((entry, i) => {
          const position = i + 1;
          const isReserve = matchBoardCount != null && position > matchBoardCount;
          const showDividerBefore = matchBoardCount != null && position === matchBoardCount + 1;
          return (
            <div key={entry.id}>
              {showDividerBefore && (
                <div className="flex flex-col gap-1 mt-1 mb-1">
                  <div className="h-px bg-cardBorder" />
                  <div className="text-[10px] uppercase tracking-wide text-muted font-semibold px-1">Αναπληρωματικοί</div>
                </div>
              )}
              <div
                className={`flex items-center gap-3 border rounded-lg px-3 py-2 transition-colors ${
                  editing ? rowBg(checkResults?.[entry.id]) : isReserve ? "bg-panel border-cardBorder" : "bg-card border-cardBorder"
                }`}
              >
                <div className="text-xs font-bold text-gold flex-shrink-0 w-20">
                  {positionLabel(position, constraintsFor(position), referenceYear)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {entry.player?.last_name} {entry.player?.first_name}
                  </div>
                  <div className="text-xs text-muted">
                    {entry.player?.rating_fide ?? entry.player?.rating_national ?? "—"}
                    {entry.player?.gender ? ` · ${entry.player.gender === "F" ? "Γ" : "Α"}` : ""}
                    {entry.player?.birth_date ? ` · γεν. ${entry.player.birth_date.slice(0, 4)}` : ""}
                  </div>
                </div>
                {editing && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => move(i, "up")}
                      disabled={i === 0}
                      aria-label="Μετακίνηση πάνω"
                      className="w-8 h-8 flex items-center justify-center text-muted disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, "down")}
                      disabled={i === draft.length - 1}
                      aria-label="Μετακίνηση κάτω"
                      className="w-8 h-8 flex items-center justify-center text-muted disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <SavableForm action={() => remove(entry.id)} successMessage="Ο αθλητής αφαιρέθηκε.">
                      <button type="submit" aria-label="Αφαίρεση" className="w-8 h-8 flex items-center justify-center text-red-400">✕</button>
                    </SavableForm>
                  </div>
                )}
              </div>
              {editing && checkResults?.[entry.id] === "bad" && (
                <p className="text-xs text-pendingText mt-1 ml-1">
                  ⚠ {positionLabel(position, constraintsFor(position), referenceYear)}: ο αθλητής δεν πληροί τον όρο αυτής της σκακιέρας.
                </p>
              )}
            </div>
          );
        })}
        {draft.length === 0 && <p className="text-sm text-muted">Κανένας αθλητής ακόμα.</p>}
      </div>

      {editing && draft.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={runCheck}
              className="flex-1 border border-gold text-gold font-semibold rounded-lg py-2.5 text-sm"
            >
              Έλεγχος Σύνθεσης
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!allOk || submitting}
              className="flex-1 bg-gold text-bg font-semibold rounded-lg py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Υποβολή..." : "Υποβολή Σύνθεσης"}
            </button>
          </div>
          <p className="text-[11px] text-muted text-center">
            Η Υποβολή ενεργοποιείται μόνο αφού ο Έλεγχος βρει όλες τις Βασικές θέσεις έγκυρες.
          </p>
          {submitError && <p className="text-xs text-pendingText">{submitError}</p>}
        </div>
      )}

      {editing && (
        <PlayerSearch search={search} searchByNumber={searchByNumber} add={addDirectory} available={directoryAvailable} />
      )}

      {editing && (
        <SavableForm action={addManual} resetOnSuccess successMessage="Ο αθλητής προστέθηκε." className="flex flex-col gap-2 bg-card border border-cardBorder rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-muted">Χειροκίνητη προσθήκη (αν δεν βρίσκεται στο μητρώο ΕΣΟ) · λατινικά</div>
          <div className="flex gap-2">
            <input name="last_name" required placeholder="Επώνυμο" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1 min-w-0" />
            <input name="first_name" required placeholder="Όνομα" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1 min-w-0" />
          </div>
          <div className="flex gap-2">
            <input name="birth_date" type="date" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1 min-w-0" />
            <select name="gender" required defaultValue="" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1 min-w-0">
              <option value="" disabled>Φύλο *</option>
              <option value="M">Άνδρας</option>
              <option value="F">Γυναίκα</option>
            </select>
          </div>
          <div className="flex gap-2">
            <input name="national_id" placeholder="ΑΜ ΕΣΟ" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1 min-w-0" />
            <input name="fide_id" placeholder="FIDE ID" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1 min-w-0" />
          </div>
          <div className="flex gap-2">
            <input name="rating_national" type="number" placeholder="Εθνικό ΕΛΟ" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1 min-w-0" />
            <input name="rating_fide" type="number" placeholder="FIDE ΕΛΟ" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1 min-w-0" />
          </div>
          <button type="submit" className="bg-gold text-bg font-semibold rounded-lg py-2.5 text-sm mt-1">
            Προσθήκη
          </button>
        </SavableForm>
      )}
    </div>
  );
}
