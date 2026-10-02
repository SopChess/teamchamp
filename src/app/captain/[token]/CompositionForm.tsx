"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { satisfiesBoardRule, validateComposition } from "@/lib/rosterRules/engine";
import { describeConstraintsShort } from "@/lib/rosterRules/boardNotation";
import type { BoardAssignment, Player, RosterEntry, RosterRules } from "@/lib/rosterRules/types";
import type { SubmitCompositionResult } from "./actions";

interface Props {
  rules: RosterRules;
  roster: RosterEntry[];
  players: Record<string, Player>;
  initial: BoardAssignment[];
  submit: (assignmentsJson: string) => Promise<SubmitCompositionResult>;
  /** Έτος αναφοράς για τη σημειογραφία U16/F κ.λπ. (επιβεβαιωμένο: έτος έναρξης τουρνουά). */
  referenceYear: number;
}

const nameOf = (p?: Player) => (p ? `${p.last_name} ${p.first_name}` : "—");
const ratingOf = (p?: Player) => p?.rating_fide ?? p?.rating_national ?? null;
const charsOf = (p?: Player) => {
  if (!p) return "";
  const parts: string[] = [];
  if (p.gender) parts.push(p.gender);
  if (p.birth_date) parts.push(`γεν. ${p.birth_date.slice(0, 4)}`);
  return parts.join(" · ");
};

/**
 * Προετοιμασία σύνθεσης γύρου.
 *  - strength_order: επιλέγετε ποιοι παίζουν· οι γενικές σκακιέρες γεμίζουν αυτόματα
 *    με τη δηλωμένη σειρά, και για τις σκακιέρες με ειδικό όρο (π.χ. γυναικεία)
 *    επιλέγετε ρητά αθλήτρια.
 *  - fixed_category: επιλέγετε αθλητή για κάθε σκακιέρα (μόνο επιλέξιμοι).
 * Ο έλεγχος τρέχει ζωντανά με τον ΙΔΙΟ κώδικα που ξανατρέχει ο server στην υποβολή.
 */
export default function CompositionForm({ rules, roster, players, initial, submit, referenceYear }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedRoster = [...roster].sort((a, b) => a.declared_order - b.declared_order);
  const ruleFor = (board: number) => rules.board_rules.find((b) => b.board === board);

  const isFixed = rules.assignment_mode === "fixed_category";
  const boards = isFixed
    ? rules.board_rules.map((b) => b.board).sort((x, y) => x - y)
    : Array.from({ length: rules.match_board_count ?? rules.board_rules.length }, (_, i) => i + 1);
  const exemptBoards = isFixed ? [] : boards.filter((b) => ruleFor(b)?.exempt_from_order);
  const generalBoards = isFixed ? [] : boards.filter((b) => !ruleFor(b)?.exempt_from_order);

  const [active, setActive] = useState<Set<string>>(() => new Set(initial.map((a) => a.player_id)));
  const [choice, setChoice] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    for (const a of initial) {
      if (isFixed || ruleFor(a.board)?.exempt_from_order) init[a.board] = a.player_id;
    }
    return init;
  });

  const eligibleFor = (board: number) =>
    sortedRoster.filter((r) => {
      const rule = ruleFor(board);
      const p = players[r.player_id];
      return !rule || !p || satisfiesBoardRule(p, rule);
    });

  // Συνάθροιση σύνθεσης από την τρέχουσα κατάσταση της φόρμας
  const assignments: BoardAssignment[] = [];
  let generalPlayerCount = 0;
  if (isFixed) {
    for (const b of boards) if (choice[b]) assignments.push({ board: b, player_id: choice[b] });
  } else {
    const exemptIds = new Set(exemptBoards.map((b) => choice[b]).filter(Boolean));
    for (const b of exemptBoards) if (choice[b]) assignments.push({ board: b, player_id: choice[b] });
    const general = sortedRoster.filter((r) => active.has(r.player_id) && !exemptIds.has(r.player_id));
    generalPlayerCount = general.length;
    generalBoards.forEach((b, i) => {
      if (general[i]) assignments.push({ board: b, player_id: general[i].player_id });
    });
  }
  assignments.sort((x, y) => x.board - y.board);

  const check = validateComposition(rules, roster, players, assignments);
  const countOk = isFixed || generalPlayerCount === generalBoards.length;
  const canSubmit = check.valid && countOk && !pending;

  function toggle(playerId: string, on: boolean) {
    setActive((prev) => {
      const next = new Set(prev);
      if (on) next.add(playerId);
      else next.delete(playerId);
      return next;
    });
    if (!on) {
      setChoice((prev) => {
        const next = { ...prev };
        for (const b of Object.keys(next)) if (next[Number(b)] === playerId) delete next[Number(b)];
        return next;
      });
    }
  }

  function pick(board: number, playerId: string) {
    setChoice((prev) => {
      const next = { ...prev };
      if (playerId) next[board] = playerId;
      else delete next[board];
      return next;
    });
    if (playerId && !isFixed) setActive((prev) => new Set(prev).add(playerId));
  }

  async function onSubmit() {
    setPending(true);
    setError(null);
    const result = await submit(JSON.stringify(assignments));
    setPending(false);
    if (result.ok) router.refresh();
    else setError(result.message);
  }

  return (
    <div className="flex flex-col gap-5">
      {!isFixed && (
        <div>
          <div className="text-xs uppercase tracking-wide text-muted mb-2">
            Ποιοι παίζουν · από τη βασική σύνθεση
          </div>
          <div className="flex flex-col gap-2">
            {sortedRoster.map((r) => {
              const p = players[r.player_id];
              const on = active.has(r.player_id);
              return (
                <label
                  key={r.player_id}
                  className={`flex items-center gap-3 border rounded-lg px-3 py-2 cursor-pointer ${
                    on ? "bg-card border-cardBorder" : "bg-panel border-cardBorder opacity-60"
                  }`}
                >
                  <span className="w-6 h-6 rounded-md bg-panel flex items-center justify-center text-xs font-bold text-gold flex-shrink-0">
                    {r.declared_order}
                  </span>
                  <span className="flex-1 min-w-0 text-sm font-semibold truncate">{nameOf(p)}</span>
                  <span className="text-xs text-muted">{ratingOf(p) ?? ""}</span>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => toggle(r.player_id, e.target.checked)}
                    aria-label={`Παίζει: ${nameOf(p)}`}
                    className="h-5 w-5 accent-[#C9A15A]"
                  />
                </label>
              );
            })}
          </div>
        </div>
      )}

      {(isFixed ? boards : exemptBoards).map((b) => (
        <div key={b}>
          <div className="text-xs uppercase tracking-wide text-muted mb-2">
            Σκακιέρα {b}
            {(() => {
              const short = describeConstraintsShort(ruleFor(b)?.constraints ?? [], referenceYear);
              return short ? ` · ${short}` : !isFixed ? " · ειδικός όρος" : "";
            })()}
          </div>
          <select
            value={choice[b] ?? ""}
            onChange={(e) => pick(b, e.target.value)}
            aria-label={`Επιλογή αθλητή για τη σκακιέρα ${b}`}
            className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
          >
            <option value="">— Επιλέξτε αθλητή —</option>
            {eligibleFor(b).map((r) => (
              <option key={r.player_id} value={r.player_id}>
                {nameOf(players[r.player_id])}
                {ratingOf(players[r.player_id]) ? ` · ${ratingOf(players[r.player_id])}` : ""}
                {charsOf(players[r.player_id]) ? ` · ${charsOf(players[r.player_id])}` : ""}
              </option>
            ))}
          </select>
        </div>
      ))}

      <div>
        <div className="text-xs uppercase tracking-wide text-muted mb-2">Προεπισκόπηση σύνθεσης</div>
        <div className="bg-card border border-cardBorder rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cardBorder">
                <th className="text-left font-semibold text-xs uppercase tracking-wide text-muted px-3 py-2">Σκακιέρα</th>
                <th className="text-left font-semibold text-xs uppercase tracking-wide text-muted px-3 py-2">Αθλητής</th>
                <th className="text-left font-semibold text-xs uppercase tracking-wide text-muted px-3 py-2">Κατηγορία</th>
                <th className="text-left font-semibold text-xs uppercase tracking-wide text-muted px-3 py-2">Έλεγχος</th>
              </tr>
            </thead>
            <tbody>
              {boards.map((b) => {
                const a = assignments.find((x) => x.board === b);
                const short = describeConstraintsShort(ruleFor(b)?.constraints ?? [], referenceYear);
                return (
                  <tr key={b} className="border-b border-cardBorder last:border-b-0">
                    <td className="px-3 py-2.5 font-semibold">{b}</td>
                    <td className="px-3 py-2.5">
                      {a ? nameOf(players[a.player_id]) : <span className="text-muted">Επιλογή αθλητή</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {short ? (
                        <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded bg-infoBg text-infoText">{short}</span>
                      ) : (
                        <span className="text-xs text-muted">Χωρίς όρο</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                          a ? "bg-okBg text-okText" : "bg-pendingBg text-pendingText"
                        }`}
                      >
                        {a ? "Έγκυρη" : "Εκκρεμεί"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {!countOk && (
        <p className="text-sm text-muted">
          Επιλέξτε ακριβώς {generalBoards.length} αθλητές για τις γενικές σκακιέρες (τώρα:{" "}
          {generalPlayerCount}).
        </p>
      )}
      {countOk && !check.valid && (
        <ul className="text-sm text-muted list-disc pl-5">
          {check.issues.map((i, idx) => (
            <li key={idx}>{i.message}</li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="w-full bg-gold text-bg font-semibold rounded-xl py-3 text-sm disabled:opacity-40"
      >
        {pending ? "Υποβολή..." : "Υποβολή Σύνθεσης"}
      </button>
      <p className="text-xs text-muted">
        Μόλις υποβληθεί, η σύνθεση δεν αλλάζει για τον συγκεκριμένο γύρο.
      </p>
    </div>
  );
}
