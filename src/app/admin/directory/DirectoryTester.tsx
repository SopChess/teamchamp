"use client";

import { useEffect, useRef, useState } from "react";
import type { DirectoryHit } from "@/lib/players/directory";
import { adminSearchDirectory } from "./actions";

/** Δοκιμαστική αναζήτηση: επιβεβαιώνει ότι ο κατάλογος φορτώθηκε σωστά. */
export default function DirectoryTester() {
  const [epitheto, setEpitheto] = useState("");
  const [onoma, setOnoma] = useState("");
  const [hits, setHits] = useState<DirectoryHit[]>([]);
  const [searched, setSearched] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (epitheto.trim().length < 2) {
      setHits([]);
      setSearched(false);
      return;
    }
    const timer = setTimeout(async () => {
      const mine = ++requestId.current;
      const result = await adminSearchDirectory(epitheto, onoma);
      if (mine !== requestId.current) return; // παλιότερη απάντηση εκτός σειράς
      setHits(result);
      setSearched(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [epitheto, onoma]);

  const input = "bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm w-full";
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <input className={input} placeholder="Επώνυμο" value={epitheto} onChange={(e) => setEpitheto(e.target.value)} autoComplete="off" aria-label="Επώνυμο" />
        <input className={input} placeholder="Όνομα" value={onoma} onChange={(e) => setOnoma(e.target.value)} autoComplete="off" aria-label="Όνομα" />
      </div>
      {hits.length > 0 && (
        <ul className="bg-card border border-cardBorder rounded-xl divide-y divide-cardBorder overflow-hidden">
          {hits.map((h) => (
            <li key={h.id} className="px-3 py-2.5">
              <div className="text-sm font-semibold">
                {h.epitheto} {h.onoma}
              </div>
              <div className="text-xs text-muted">
                {[h.club, h.birthYear && `γεν. ${h.birthYear}`, h.rating && `ΕΛΟ ${h.rating}`].filter(Boolean).join(" · ")}
              </div>
            </li>
          ))}
        </ul>
      )}
      {searched && hits.length === 0 && <p className="text-xs text-muted">Δεν βρέθηκε αθλητής.</p>}
      {hits.length >= 15 && (
        <p className="text-xs text-muted">Εμφανίζονται τα πρώτα 15. Πληκτρολογήστε περισσότερα γράμματα ή και το όνομα.</p>
      )}
    </div>
  );
}
