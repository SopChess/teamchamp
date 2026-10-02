"use client";

import { useState } from "react";
import SavableForm from "@/components/SavableForm";
import PlayerSearch from "./PlayerSearch";
import type { DirectoryHit } from "@/lib/players/directory";
import type { AddAthleteResult } from "./actions";
import { moveRosterEntryUp, moveRosterEntryDown } from "./actions";

interface EntryPlayer {
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
  /** Αν η προθεσμία εγγραφών έχει περάσει — ΜΟΝΟ αυτή κλειδώνει πλέον την επεξεργασία
   * (επιβεβαιωμένο: καμία μόνιμη κλειδαριά από "υποβολή" σύνθεσης πια). */
  editableByDeadline: boolean;
  /** Μήνυμα που εξηγεί ΓΙΑΤΙ είναι κλειδωμένο (προθεσμία ή ρητό κλείδωμα από τη διοργάνωση). */
  lockedReason?: string;
  /** token/teamId της ομάδας — το RosterEditor καλεί ΑΠΕΥΘΕΙΑΣ τα server actions
   * μετακίνησης (επιβεβαιωμένο: πιο αξιόπιστο μοτίβο από bound function περασμένη
   * ως prop από parent — δεν έμεινε καμία αμφιβολία σειριοποίησης). */
  token: string;
  teamId: string | undefined;
  remove: (entryId: string) => Promise<void>;
  addManual: (formData: FormData) => Promise<void>;
  search: (epitheto: string, onoma: string) => Promise<DirectoryHit[]>;
  searchByNumber: (number: string) => Promise<DirectoryHit | null>;
  addDirectory: (directoryId: string, gender: string) => Promise<AddAthleteResult>;
  directoryAvailable: boolean;
}

/**
 * Η Βασική Σύνθεση ξεκινά σε ΚΑΘΑΡΗ προβολή (χωρίς κουμπιά μετακίνησης/αφαίρεσης) —
 * πιο τακτοποιημένη όψη. Το κουμπί "Επεξεργασία Βασικής Σύνθεσης" ανοίγει πλήρη
 * επεξεργασία (προσθήκη/αφαίρεση/αναδιάταξη, αναζήτηση μητρώου ΕΣΟ)· "Αποθήκευση"
 * κλείνει ξανά την προβολή — καμία ξεχωριστή ενέργεια βάσης, κάθε αλλαγή έχει ήδη
 * αποθηκευτεί μόνη της τη στιγμή που έγινε. Το ΜΟΝΟ πράγμα που μπλοκάρει πραγματικά
 * την επεξεργασία είναι η προθεσμία εγγραφών (επιβεβαιωμένο, αντικαθιστά το παλιό
 * μόνιμο κλείδωμα "Υποβολή Σύνθεσης").
 */
export default function RosterEditor({
  entries, rosterSize, editableByDeadline, lockedReason, token, teamId, remove, addManual,
  search, searchByNumber, addDirectory, directoryAvailable,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const editing = isEditing && editableByDeadline;

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
            Αποθήκευση
          </button>
        )}
      </div>

      {!editableByDeadline && (
        <p className="text-xs text-muted">
          {lockedReason ?? "Η προθεσμία εγγραφών έχει λήξει — δεν επιτρέπονται πλέον αλλαγές στη σύνθεση."}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {entries.map((entry, i) => (
          <div key={entry.id} className="flex items-center gap-3 bg-card border border-cardBorder rounded-lg px-3 py-2">
            <div className="w-6 h-6 rounded-md bg-panel flex items-center justify-center text-xs font-bold text-gold flex-shrink-0">
              {entry.declared_order}
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
                <SavableForm action={() => moveRosterEntryUp(token, teamId, entry.id)}>
                  <button type="submit" disabled={i === 0} aria-label="Μετακίνηση πάνω" className="w-8 h-8 flex items-center justify-center text-muted disabled:opacity-30">↑</button>
                </SavableForm>
                <SavableForm action={() => moveRosterEntryDown(token, teamId, entry.id)}>
                  <button type="submit" disabled={i === entries.length - 1} aria-label="Μετακίνηση κάτω" className="w-8 h-8 flex items-center justify-center text-muted disabled:opacity-30">↓</button>
                </SavableForm>
                <SavableForm action={() => remove(entry.id)} successMessage="Ο αθλητής αφαιρέθηκε.">
                  <button type="submit" aria-label="Αφαίρεση" className="w-8 h-8 flex items-center justify-center text-red-400">✕</button>
                </SavableForm>
              </div>
            )}
          </div>
        ))}
        {entries.length === 0 && <p className="text-sm text-muted">Κανένας αθλητής ακόμα.</p>}
      </div>

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
