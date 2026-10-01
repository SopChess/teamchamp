// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RosterRulesBuilder from "./RosterRulesBuilder";

afterEach(cleanup);

describe("RosterRulesBuilder — ο αριθμός σκακιέρας δεν είναι πια επεξεργάσιμος (επιβεβαιωμένο)", () => {
  it("δείχνει «Σκακιέρα 1», «Σκακιέρα 2» ως απλό κείμενο, όχι input", () => {
    render(<RosterRulesBuilder initial={[{ board: 1, constraints: [] }, { board: 2, constraints: [] }]} />);
    expect(screen.getByText("Σκακιέρα 1")).toBeInTheDocument();
    expect(screen.getByText("Σκακιέρα 2")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Αριθμός σκακιέρας/)).not.toBeInTheDocument();
  });

  it("η θέση αποφασίζει τον αριθμό, ΑΚΟΜΑ ΚΙ ΑΝ τα αποθηκευμένα δεδομένα έχουν κενά (π.χ. 1, 4)", () => {
    render(<RosterRulesBuilder initial={[{ board: 1, constraints: [] }, { board: 4, constraints: [] }]} />);
    expect(screen.getByText("Σκακιέρα 1")).toBeInTheDocument();
    expect(screen.getByText("Σκακιέρα 2")).toBeInTheDocument(); // ΟΧΙ "Σκακιέρα 4" — κανονικοποιείται στη θέση
    expect(screen.queryByText("Σκακιέρα 4")).not.toBeInTheDocument();
  });

  it("αφαίρεση μιας σκακιέρας από τη μέση μετονομάζει αυτόματα τις επόμενες", async () => {
    const user = userEvent.setup();
    render(<RosterRulesBuilder initial={[{ board: 1, constraints: [] }, { board: 2, constraints: [] }, { board: 3, constraints: [] }]} />);
    const removeButtons = screen.getAllByText("Αφαίρεση σκακιέρας");
    await user.click(removeButtons[0]!); // αφαιρεί την 1η
    expect(screen.queryByText("Σκακιέρα 3")).not.toBeInTheDocument();
    expect(screen.getByText("Σκακιέρα 1")).toBeInTheDocument(); // η πρώην "2" έγινε "1"
    expect(screen.getByText("Σκακιέρα 2")).toBeInTheDocument(); // η πρώην "3" έγινε "2"
  });

  it("προσθήκη νέας σκακιέρας παίρνει τον επόμενο διαθέσιμο αριθμό", async () => {
    const user = userEvent.setup();
    render(<RosterRulesBuilder initial={[{ board: 1, constraints: [] }]} />);
    await user.click(screen.getByText("+ Προσθήκη σκακιέρας"));
    expect(screen.getByText("Σκακιέρα 2")).toBeInTheDocument();
  });

  it("το κρυφό πεδίο JSON αποθηκεύει πάντα τον αριθμό θέσης, όχι τον παλιό", () => {
    const { container } = render(<RosterRulesBuilder initial={[{ board: 1, constraints: [] }, { board: 4, constraints: [] }]} />);
    const hidden = container.querySelector('input[name="board_rules_json"]') as HTMLInputElement;
    const saved = JSON.parse(hidden.value);
    expect(saved.map((r: { board: number }) => r.board)).toEqual([1, 2]);
  });
});
