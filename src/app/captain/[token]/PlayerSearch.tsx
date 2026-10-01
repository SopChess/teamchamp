"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DirectoryHit } from "@/lib/players/directory";
import type { AddAthleteResult } from "./actions";

interface Props {
  search: (epitheto: string, onoma: string) => Promise<DirectoryHit[]>;
  searchByNumber: (number: string) => Promise<DirectoryHit | null>;
  add: (directoryId: string, gender: string) => Promise<AddAthleteResult>;
  /** false όταν ο κατάλογος δεν μπορεί να διαβαστεί (π.χ. λείπει το service key στο Vercel) */
  available?: boolean;
}

/**
 * Προσθήκη αθλητή από τον κατάλογο, όπως στις εγγραφές του SopRegSB: πληκτρολογείτε
 * επώνυμο (και όνομα), ή ΑΜ ΕΣΟ / FIDE ID, επιλέγετε από τις προτάσεις, και
 * επιλέγετε ΥΠΟΧΡΕΩΤΙΚΑ το φύλο. Τα στοιχεία διαβάζονται ξανά στον server.
 */
export default function PlayerSearch({ search, searchByNumber, add, available = true }: Props) {
  const router = useRouter();
  const [epitheto, setEpitheto] = useState("");
  const [onoma, setOnoma] = useState("");
  const [number, setNumber] = useState("");
  const [hits, setHits] = useState<DirectoryHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<DirectoryHit | null>(null);
  const [gender, setGender] = useState<"" | "M" | "F">("");
  const [message, setMessage] = useState<{ tone: "ok" | "error" | "info"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const requestId = useRef(0);

  // Αναζήτηση 300 ms μετά την τελευταία πληκτρολόγηση· αγνοούνται απαντήσεις που έφτασαν εκτός σειράς.
  useEffect(() => {
    if (selected) return;
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
  }, [epitheto, onoma, selected, search]);

  async function lookupNumber() {
    if (!number.trim()) return;
    setMessage({ tone: "info", text: "Αναζήτηση..." });
    const hit = await searchByNumber(number);
    if (hit) {
      pick(hit);
      setMessage(null);
    } else {
      setMessage({
        tone: "info",
        text: "Δεν βρέθηκε. Συμπληρώστε τα στοιχεία χειροκίνητα στη φόρμα παρακάτω.",
      });
    }
  }

  function pick(hit: DirectoryHit) {
    setSelected(hit);
    setGender("");
    setHits([]);
    setMessage(null);
  }

  function reset() {
    setSelected(null);
    setGender("");
    setEpitheto("");
    setOnoma("");
    setNumber("");
    setHits([]);
    setSearched(false);
  }

  async function submit() {
    if (!selected || !gender) return;
    setPending(true);
    setMessage(null);
    const result = await add(selected.id, gender);
    setPending(false);
    if (result.ok) {
      reset();
      setMessage({ tone: "ok", text: "Ο αθλητής προστέθηκε στη βασική σύνθεση." });
      router.refresh();
    } else {
      setMessage({ tone: "error", text: result.message });
    }
  }

  const input = "bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm w-full";

  return (
    <div className="flex flex-col gap-3 bg-card border border-cardBorder rounded-xl p-4">
      <div className="text-xs uppercase tracking-wide text-muted">Προσθήκη αθλητή από το Μητρώο ΕΣΟ</div>

      {!available && (
        <p className="text-sm text-muted">
          Η αναζήτηση στο μητρώο ΕΣΟ δεν είναι ακόμα ενεργή. Προσθέστε τον αθλητή με τη
          χειροκίνητη φόρμα παρακάτω ή ενημερώστε τον διαχειριστή.
        </p>
      )}

      {available && !selected && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <input
              className={input}
              placeholder="Επώνυμο"
              value={epitheto}
              onChange={(e) => setEpitheto(e.target.value)}
              autoComplete="off"
              aria-label="Επώνυμο αθλητή"
            />
            <input
              className={input}
              placeholder="Όνομα"
              value={onoma}
              onChange={(e) => setOnoma(e.target.value)}
              autoComplete="off"
              aria-label="Όνομα αθλητή"
            />
          </div>

          <div className="flex gap-2">
            <input
              className={input}
              placeholder="ή ΑΜ ΕΣΟ / FIDE ID"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              aria-label="ΑΜ ΕΣΟ ή FIDE ID"
            />
            <button
              type="button"
              onClick={lookupNumber}
              className="bg-panel border border-cardBorder rounded-lg px-4 text-sm whitespace-nowrap"
            >
              Αναζήτηση
            </button>
          </div>

          {hits.length > 0 && (
            <ul className="flex flex-col divide-y divide-cardBorder border border-cardBorder rounded-lg overflow-hidden">
              {hits.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => pick(h)}
                    className="w-full text-left px-3 py-2.5 hover:bg-panel flex flex-col gap-0.5"
                  >
                    <span className="text-sm font-semibold">
                      {h.epitheto} {h.onoma}
                    </span>
                    <span className="text-xs text-muted">
                      {[h.club, h.birthYear ? `γεν. ${h.birthYear}` : null, h.rating ? `ΕΛΟ ${h.rating}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {hits.length >= 15 && (
            <p className="text-xs text-muted">Πληκτρολογήστε και το όνομα για πιο στοχευμένα αποτελέσματα.</p>
          )}
          {searched && hits.length === 0 && (
            <p className="text-xs text-muted">
              Δεν βρέθηκε αθλητής. Δοκιμάστε άλλη γραφή ή συμπληρώστε τα στοιχεία χειροκίνητα στη φόρμα παρακάτω.
            </p>
          )}
        </>
      )}

      {selected && (
        <div className="flex flex-col gap-3">
          <div className="bg-panel border border-cardBorder rounded-lg px-3 py-3">
            <div className="text-sm font-semibold">
              {selected.epitheto} {selected.onoma}
            </div>
            <div className="text-xs text-muted mt-0.5">
              {[selected.club, selected.birthYear ? `γεν. ${selected.birthYear}` : null, selected.rating ? `ΕΛΟ ${selected.rating}` : null]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm mb-1">
              Φύλο <span className="text-gold">*</span>
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["M", "Άνδρας"],
                  ["F", "Γυναίκα"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`flex items-center justify-center gap-2 border rounded-lg py-2.5 text-sm cursor-pointer ${
                    gender === value ? "bg-gold text-bg border-gold font-semibold" : "bg-panel border-cardBorder"
                  }`}
                >
                  <input
                    type="radio"
                    name="gender"
                    value={value}
                    checked={gender === value}
                    onChange={() => setGender(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted">Το φύλο καθορίζει σε ποιες σκακιέρες μπορεί να αγωνιστεί ο αθλητής.</p>
            {selected.sexEso === "F" && (
              <p className="text-xs text-gold">Στη λίστα ΕΣΟ ο αθλητής σημειώνεται ως Γυναίκα. Η επιλογή είναι δική σας.</p>
            )}
          </fieldset>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={reset} className="bg-panel border border-cardBorder rounded-lg py-2.5 text-sm">
              Αλλαγή αθλητή
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!gender || pending}
              className="bg-gold text-bg font-semibold rounded-lg py-2.5 text-sm disabled:opacity-40"
            >
              {pending ? "Προσθήκη..." : "Προσθήκη"}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p
          className={`text-sm ${
            message.tone === "ok" ? "text-good" : message.tone === "error" ? "text-red-400" : "text-muted"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
