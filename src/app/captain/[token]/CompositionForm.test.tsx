// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import CompositionForm from "./CompositionForm";
import type { Player, RosterEntry, RosterRules } from "@/lib/rosterRules/types";

afterEach(cleanup);

const players: Record<string, Player> = {
  p1: { id: "p1", first_name: "Γιώργος", last_name: "Παπαδόπουλος", gender: "M", birth_date: "2010-01-01" },
  p2: { id: "p2", first_name: "Μαρία", last_name: "Κωνσταντίνου", gender: "F", birth_date: "2012-01-01" },
};
const roster: RosterEntry[] = [
  { player_id: "p1", declared_order: 1 },
  { player_id: "p2", declared_order: 2 },
];
const rules: RosterRules = {
  assignment_mode: "fixed_category",
  roster_size: 2,
  match_board_count: 2,
  board_rules: [
    { board: 1, constraints: [{ type: "birth_year_from", value: 2010 }] },
    { board: 2, constraints: [{ type: "gender", value: "F" }] },
  ],
};

describe("CompositionForm — πίνακας προεπισκόπησης (επιβεβαιωμένο, νέα παρουσίαση)", () => {
  it("η προεπισκόπηση δείχνει στήλες Σκακιέρα/Αθλητής/Κατηγορία/Έλεγχος, με U16/F ως κατηγορία", () => {
    const { getByText } = render(
      <CompositionForm rules={rules} roster={roster} players={players} initial={[]} submit={vi.fn()} referenceYear={2026} />
    );
    expect(getByText("Σκακιέρα")).toBeInTheDocument();
    expect(getByText("Αθλητής")).toBeInTheDocument();
    expect(getByText("Κατηγορία")).toBeInTheDocument();
    expect(getByText("Έλεγχος")).toBeInTheDocument();
    expect(getByText("U16")).toBeInTheDocument();
    expect(getByText("F")).toBeInTheDocument();
  });

  it('χωρίς κανέναν επιλεγμένο αθλητή ακόμα, όλες οι σκακιέρες δείχνουν "Εκκρεμεί"', () => {
    const { getAllByText } = render(
      <CompositionForm rules={rules} roster={roster} players={players} initial={[]} submit={vi.fn()} referenceYear={2026} />
    );
    expect(getAllByText("Εκκρεμεί")).toHaveLength(2);
  });

  it('επιλογή αθλητή για σκακιέρα ενημερώνει την προεπισκόπηση σε "Έγκυρη" με το όνομά του', async () => {
    const user = userEvent.setup();
    const { getAllByLabelText, getAllByText } = render(
      <CompositionForm rules={rules} roster={roster} players={players} initial={[]} submit={vi.fn()} referenceYear={2026} />
    );
    const select = getAllByLabelText("Επιλογή αθλητή για τη σκακιέρα 1")[0]!;
    await user.selectOptions(select, "p1");
    expect(getAllByText("Έγκυρη")).toHaveLength(1);
    expect(getAllByText("Παπαδόπουλος Γιώργος").length).toBeGreaterThan(0);
  });
});
