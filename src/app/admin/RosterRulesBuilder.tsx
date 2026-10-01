"use client";

import { useState } from "react";
import type { BoardConstraint, BoardRule, ConstraintType } from "@/lib/rosterRules/types";
import {
  CONSTRAINT_LABELS,
  CONSTRAINT_TYPES,
  emptyBoardRule,
  emptyConstraint,
  validateBoardRules,
} from "@/lib/rosterRules/builder";

/**
 * Οπτικός επεξεργαστής των board_rules, αντί για ακατέργαστο JSON. Γράφει το
 * αποτέλεσμα σε κρυφό πεδίο "board_rules_json" — το server action
 * (saveRosterRules) δεν άλλαξε καθόλου, συνεχίζει να διαβάζει ακριβώς αυτό.
 */
export default function RosterRulesBuilder({ initial }: { initial: BoardRule[] }) {
  const [rules, setRules] = useState<BoardRule[]>(initial.length > 0 ? initial : [emptyBoardRule(1)]);
  // Ο αριθμός σκακιέρας δεν είναι πλέον επεξεργάσιμο πεδίο (επιβεβαιωμένο) — είναι πάντα η
  // θέση στη λίστα (1η γραμμή = Σκακιέρα 1, 2η = Σκακιέρα 2 κ.ο.κ.), ώστε να μην μπορεί ποτέ
  // να αποκλίνει. Κανονικοποιούμε εδώ ώστε ΚΑΙ η αποθήκευση να ακολουθεί πάντα τη θέση,
  // ανεξάρτητα από τι είχε αποθηκευτεί παλιότερα.
  const numberedRules = rules.map((r, i) => ({ ...r, board: i + 1 }));
  const errors = validateBoardRules(numberedRules);
  const json = JSON.stringify(numberedRules);

  const update = (i: number, patch: Partial<BoardRule>) =>
    setRules((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  // Ο αριθμός που περνάμε εδώ δεν έχει πια σημασία — πάντα αντικαθίσταται από τη θέση στο numberedRules.
  const addBoard = () => setRules((prev) => [...prev, emptyBoardRule(prev.length + 1)]);
  const removeBoard = (i: number) => setRules((prev) => prev.filter((_, idx) => idx !== i));

  const addConstraint = (i: number) =>
    update(i, { constraints: [...rules[i].constraints, emptyConstraint()] });
  const removeConstraint = (i: number, ci: number) =>
    update(i, { constraints: rules[i].constraints.filter((_, idx) => idx !== ci) });
  const updateConstraint = (i: number, ci: number, patch: Partial<BoardConstraint>) =>
    update(i, {
      constraints: rules[i].constraints.map((c, idx) => (idx === ci ? { ...c, ...patch } : c)),
    });

  const inputCls = "bg-panel border border-cardBorder rounded-lg px-2 py-1.5 text-xs";

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="board_rules_json" value={json} />
      <div className="text-xs uppercase tracking-wide text-muted">Κανόνες ανά σκακιέρα</div>

      {numberedRules.map((rule, i) => (
        <div key={i} className="bg-panel border border-cardBorder rounded-lg p-3 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-serif font-bold text-gold">Σκακιέρα {rule.board}</span>
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={!!rule.exempt_from_order}
                onChange={(e) => update(i, { exempt_from_order: e.target.checked })}
              />
              Εξαίρεση από τη σειρά (strength_order)
            </label>
            <button
              type="button"
              onClick={() => removeBoard(i)}
              className="ml-auto text-xs text-red-400 hover:underline"
            >
              Αφαίρεση σκακιέρας
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            {rule.constraints.map((c, ci) => (
              <div key={ci} className="flex items-center gap-2">
                <select
                  value={c.type}
                  onChange={(e) => updateConstraint(i, ci, emptyConstraint(e.target.value as ConstraintType))}
                  className={inputCls}
                  aria-label={`Τύπος όρου ${ci + 1} για τη σκακιέρα ${rule.board}`}
                >
                  {CONSTRAINT_TYPES.map((t) => (
                    <option key={t} value={t}>{CONSTRAINT_LABELS[t]}</option>
                  ))}
                </select>

                {c.type === "gender" && (
                  <select
                    value={String(c.value)}
                    onChange={(e) => updateConstraint(i, ci, { value: e.target.value })}
                    className={inputCls}
                    aria-label="Τιμή φύλου"
                  >
                    <option value="any">Οποιοδήποτε</option>
                    <option value="F">Γυναίκα</option>
                    <option value="M">Άνδρας</option>
                  </select>
                )}
                {(c.type === "birth_after" || c.type === "birth_before") && (
                  <input
                    type="date"
                    value={String(c.value)}
                    onChange={(e) => updateConstraint(i, ci, { value: e.target.value })}
                    className={inputCls}
                    aria-label="Ημερομηνία γέννησης"
                  />
                )}
                {(c.type === "birth_year_from" || c.type === "birth_year_until") && (
                  <input
                    type="number"
                    value={String(c.value)}
                    onChange={(e) => updateConstraint(i, ci, { value: e.target.value })}
                    placeholder="π.χ. 2014"
                    className={inputCls}
                    aria-label="Έτος γέννησης"
                  />
                )}
                {(c.type === "rating_min" || c.type === "rating_max") && (
                  <input
                    type="number"
                    value={String(c.value)}
                    onChange={(e) => updateConstraint(i, ci, { value: e.target.value })}
                    placeholder="π.χ. 1200"
                    className={inputCls}
                    aria-label="Τιμή βαθμού"
                  />
                )}
                {c.type === "alternates_allowed" && (
                  <span className="text-xs text-muted">επιτρέπονται</span>
                )}

                <button
                  type="button"
                  onClick={() => removeConstraint(i, ci)}
                  className="text-xs text-red-400 hover:underline"
                >
                  Αφαίρεση όρου
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addConstraint(i)}
              className="self-start text-xs text-gold hover:underline"
            >
              + Προσθήκη όρου
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addBoard}
        className="self-start bg-panel border border-cardBorder rounded-lg px-3 py-1.5 text-xs"
      >
        + Προσθήκη σκακιέρας
      </button>

      {errors.length > 0 && (
        <ul className="text-xs text-red-400 list-disc pl-5">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
