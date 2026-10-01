"use client";

import { useEffect, useRef, useState } from "react";
import type { DirectoryHit } from "@/lib/players/directory";
import { validateBasicRoster } from "@/lib/rosterRules/basicRosterCheck";
import type { RosterRules, Player, RosterEntry } from "@/lib/rosterRules/types";

type Gender = "M" | "F";

interface PendingAthlete {
  key: string;
  source: "directory" | "manual";
  directoryId?: string;
  gender: Gender;
  first_name?: string;
  last_name?: string;
  birth_date?: string;
  rating_national?: string;
  rating_fide?: string;
  label: string;
  sub: string;
}

interface Props {
  search: (epitheto: string, onoma: string) => Promise<DirectoryHit[]>;
  searchByNumber: (number: string) => Promise<DirectoryHit | null>;
  rules: Pick<RosterRules, "assignment_mode" | "roster_size" | "match_board_count" | "board_rules" | "reserve_count" | "one_player_per_category"> | null;
}

/**
 * Προσθήκη αθλητών ΠΡΙΝ υπάρξει καν ομάδα (δεν έχουμε ακόμα token/teamId) —
 * η λίστα μένει σε τοπικό state μέχρι το ΤΕΛΙΚΟ submit της φόρμας εγγραφής,
 * που τη στέλνει μαζί με τα στοιχεία ομάδας/υπευθύνου σε ΜΙΑ αποθήκευση. Η
 * ίδια εμπειρία αναζήτησης με το Portal Αρχηγού (επώνυμο/όνομα ή ΑΜ, φύλο
 * υποχρεωτικό), αλλά χωρίς να γράφει τίποτα στη βάση μέχρι το τέλος.
 */
export default function AthletePicker({ search, searchByNumber, rules }: Props) {
  const [epitheto, setEpitheto] = useState("");
  const [onoma, setOnoma] = useState("");
  const [number, setNumber] = useState("");
  const [hits, setHits] = useState<DirectoryHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<DirectoryHit | null>(null);
  const [gender, setGender] = useState<"" | Gender>("");
  const [manual, setManual] = useState(false);
  const [manualFirst, setManualFirst] = useState("");
  const [manualLast, setManualLast] = useState("");
  const [manualBirth, setManualBirth] = useState("");
  const [athletes, setAthletes] = useState<PendingAthlete[]>([]);
  const requestId = useRef(0);

  useEffect(() => {
    if (selected || manual) return;
    const e = epitheto.trim();
    if (e.length < 2) {
      setHits([]);
      setSearched(false);
      return;
    }
    const timer = setTimeout(async () => {
      const mine = ++requestId.current;
      const result = await search(e, onoma.trim());
      if (mine !== requestId.current) return;
      setHits(result);
      setSearched(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [epitheto, onoma, selected, manual, search]);

  async function lookupNumber() {
    if (!number.trim()) return;
    const hit = await searchByNumber(number);
    if (hit) pick(hit);
  }

  function pick(hit: DirectoryHit) {
    setSelected(hit);
    setManual(false);
    setGender("");
    setHits([]);
  }

  function resetPicker() {
    setSelected(null);
    setManual(false);
    setGender("");
    setEpitheto("");
    setOnoma("");
    setNumber("");
    setManualFirst("");
    setManualLast("");
    setManualBirth("");
    setHits([]);
    setSearched(false);
  }

  function confirmAdd() {
    if (!gender) return;
    if (selected) {
      setAthletes((prev) => [
        ...prev,
        {
          key: `d-${selected.id}-${Date.now()}`,
          source: "directory",
          directoryId: selected.id,
          gender,
          label: `${selected.epitheto} ${selected.onoma}`,
          sub: [selected.club, selected.birthYear ? `γεν. ${selected.birthYear}` : null, selected.rating ? `ΕΛΟ ${selected.rating}` : null]
            .filter(Boolean)
            .join(" · "),
        },
      ]);
    } else if (manual && manualFirst.trim() && manualLast.trim()) {
      setAthletes((prev) => [
        ...prev,
        {
          key: `m-${Date.now()}`,
          source: "manual",
          gender,
          first_name: manualFirst.trim(),
          last_name: manualLast.trim(),
          birth_date: manualBirth || undefined,
          label: `${manualLast.trim()} ${manualFirst.trim()}`,
          sub: manualBirth ? `γεν. ${manualBirth}` : "χειροκίνητη καταχώρηση",
        },
      ]);
    }
    resetPicker();
  }

  function remove(key: string) {
    setAthletes((prev) => prev.filter((a) => a.key !== key));
  }

  // Ζωντανός έλεγχος (εκτίμηση): για αθλητές από τον κατάλογο δεν έχουμε ακριβή
  // ημερομηνία γέννησης εδώ (μόνο έτος) — ελέγχονται με το 15/6 του έτους ως
  // προσέγγιση. Ο πραγματικός έλεγχος με ακριβή στοιχεία γίνεται στον server.
  const issues = rules
    ? (() => {
        const roster: RosterEntry[] = athletes.map((a, i) => ({ player_id: a.key, declared_order: i + 1 }) as RosterEntry);
        const players: Record<string, Player> = {};
        for (const a of athletes) {
          players[a.key] = {
            id: a.key,
            first_name: a.first_name ?? "",
            last_name: a.last_name ?? "",
            gender: a.gender,
            birth_date: a.birth_date ?? (a.sub.match(/γεν\. (\d{4})/) ? `${a.sub.match(/γεν\. (\d{4})/)![1]}-06-15` : null),
          } as Player;
        }
        return validateBasicRoster(rules, roster, players);
      })()
    : [];

  const inputCls = "bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm w-full";

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="athletes_json" value={JSON.stringify(athletes.map(({ key: _key, sub: _sub, label, ...rest }) => ({ ...rest, label })))} />

      {athletes.length > 0 && (
        <ul className="flex flex-col divide-y divide-cardBorder border border-cardBorder rounded-lg overflow-hidden">
          {athletes.map((a) => (
            <li key={a.key} className="flex items-center justify-between px-3 py-2.5">
              <div>
                <div className="text-sm font-semibold">{a.label}</div>
                <div className="text-xs text-muted">
                  {a.gender === "F" ? "Γυναίκα" : "Άνδρας"} · {a.sub}
                </div>
              </div>
              <button type="button" onClick={() => remove(a.key)} className="text-xs text-red-400 hover:underline">
                Αφαίρεση
              </button>
            </li>
          ))}
        </ul>
      )}

      {rules && (
        <div className="text-xs text-muted">
          {athletes.length} αθλητές
          {rules.roster_size ? ` (μέγιστο ${rules.roster_size})` : ""}
          {issues.length === 0 && athletes.length > 0 && <span className="text-good"> — καλύπτονται όλες οι σκακιέρες ✓</span>}
        </div>
      )}
      {issues.length > 0 && (
        <ul className="text-xs text-gold list-disc pl-5">
          {issues.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      {!selected && !manual && (
        <div className="flex flex-col gap-2 bg-card border border-cardBorder rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-muted">Αναζήτηση στο Μητρώο ΕΣΟ</div>
          <div className="grid grid-cols-2 gap-2">
            <input className={`${inputCls} min-w-0`} placeholder="Επώνυμο" value={epitheto} onChange={(e) => setEpitheto(e.target.value)} autoComplete="off" />
            <input className={`${inputCls} min-w-0`} placeholder="Όνομα" value={onoma} onChange={(e) => setOnoma(e.target.value)} autoComplete="off" />
          </div>
          <div className="flex gap-2">
            <input className={`${inputCls} min-w-0`} placeholder="ή ΑΜ ΕΣΟ / FIDE ID" value={number} onChange={(e) => setNumber(e.target.value)} inputMode="numeric" autoComplete="off" />
            <button type="button" onClick={lookupNumber} className="bg-panel border border-cardBorder rounded-lg px-4 text-sm whitespace-nowrap flex-shrink-0">
              Αναζήτηση
            </button>
          </div>

          {/* Μόνιμο κουμπί, ΠΑΝΤΑ ορατό πάνω από τα αποτελέσματα — όχι μόνο όταν η αναζήτηση
              δεν βρίσκει τίποτα (επιβεβαιωμένο bug fix: πριν κρυβόταν πίσω από τα αποτελέσματα
              όταν το επώνυμο έφερνε άλλους αθλητές, και δεν άφηνε να γίνει χειροκίνητη προσθήκη). */}
          <button
            type="button"
            onClick={() => setManual(true)}
            className="self-start text-xs text-gold underline"
          >
            Δεν βρίσκετε τον αθλητή; Χειροκίνητη καταχώρηση
          </button>

          {hits.length > 0 && (
            <ul className="flex flex-col divide-y divide-cardBorder border border-cardBorder rounded-lg overflow-y-auto max-h-56">
              {hits.map((h) => (
                <li key={h.id}>
                  <button type="button" onClick={() => pick(h)} className="w-full text-left px-3 py-2.5 hover:bg-panel flex flex-col gap-0.5">
                    <span className="text-sm font-semibold">{h.epitheto} {h.onoma}</span>
                    <span className="text-xs text-muted">
                      {[h.club, h.birthYear ? `γεν. ${h.birthYear}` : null, h.rating ? `ΕΛΟ ${h.rating}` : null].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {searched && hits.length === 0 && (
            <p className="text-xs text-muted">Δεν βρέθηκε κανείς στο μητρώο ΕΣΟ με αυτά τα στοιχεία.</p>
          )}
        </div>
      )}

      {(selected || manual) && (
        <div className="flex flex-col gap-3 bg-card border border-cardBorder rounded-xl p-4">
          {selected ? (
            <div className="bg-panel border border-cardBorder rounded-lg px-3 py-3">
              <div className="text-sm font-semibold">{selected.epitheto} {selected.onoma}</div>
              <div className="text-xs text-muted mt-0.5">
                {[selected.club, selected.birthYear ? `γεν. ${selected.birthYear}` : null, selected.rating ? `ΕΛΟ ${selected.rating}` : null]
                  .filter(Boolean).join(" · ")}
              </div>
              {selected.sexEso === "F" && <p className="text-xs text-gold mt-1">Στη λίστα ΕΣΟ σημειώνεται ως Γυναίκα.</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <input className={`${inputCls} min-w-0`} placeholder="Όνομα (λατινικά)" value={manualFirst} onChange={(e) => setManualFirst(e.target.value)} />
                <input className={`${inputCls} min-w-0`} placeholder="Επώνυμο (λατινικά)" value={manualLast} onChange={(e) => setManualLast(e.target.value)} />
              </div>
              <input className={`${inputCls} min-w-0`} type="date" placeholder="Ημερομηνία γέννησης" value={manualBirth} onChange={(e) => setManualBirth(e.target.value)} />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="text-sm">Φύλο <span className="text-gold">*</span></div>
            <div className="grid grid-cols-2 gap-2">
              {([["M", "Άνδρας"], ["F", "Γυναίκα"]] as const).map(([value, lbl]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setGender(value)}
                  className={`min-w-0 border rounded-lg py-2.5 text-sm ${gender === value ? "bg-gold text-bg border-gold font-semibold" : "bg-panel border-cardBorder"}`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={resetPicker} className="min-w-0 bg-panel border border-cardBorder rounded-lg py-2.5 text-sm">
              Άκυρο
            </button>
            <button
              type="button"
              onClick={confirmAdd}
              disabled={!gender || (manual && (!manualFirst.trim() || !manualLast.trim()))}
              className="min-w-0 bg-gold text-bg font-semibold rounded-lg py-2.5 text-sm disabled:opacity-40"
            >
              Προσθήκη στη λίστα
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
