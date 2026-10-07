// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RosterRules } from "@/lib/rosterRules/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

// ΜΕΓΑΛΗ ΑΛΛΑΓΗ (επιβεβαιωμένο): η σειρά αποθηκεύεται πλέον ΜΟΝΟ με submitRosterOrder,
// μετά από Έλεγχο Σύνθεσης — όχι πια σε κάθε κλικ ↑/↓.
const { submitRosterOrder } = vi.hoisted(() => ({
  submitRosterOrder: vi.fn(async () => undefined),
}));
vi.mock("./actions", () => ({ submitRosterOrder }));

import RosterEditor from "./RosterEditor";

afterEach(cleanup);

const entries = [
  { id: "e1", declared_order: 1, player: { id: "p1", last_name: "Παπάς", first_name: "Γιώργος", rating_national: 1200, gender: "M", birth_date: "2010-01-01" } },
  { id: "e2", declared_order: 2, player: { id: "p2", last_name: "Νικολάου", first_name: "Μαρία", rating_national: 1100, gender: "F", birth_date: "2012-01-01" } },
];

const rules: RosterRules = {
  assignment_mode: "fixed_category",
  roster_size: 6,
  match_board_count: 1,
  board_rules: [
    { board: 1, constraints: [{ type: "gender", value: "F" }] },
    { board: 2, constraints: [] },
  ],
};

function baseProps(overrides: Partial<React.ComponentProps<typeof RosterEditor>> = {}) {
  return {
    entries,
    rosterSize: 6,
    rules,
    referenceYear: 2026,
    editableByDeadline: true,
    token: "tok1",
    teamId: "team1",
    remove: vi.fn(async () => undefined),
    addManual: vi.fn(async () => undefined),
    search: vi.fn(async () => []),
    searchByNumber: vi.fn(async () => null),
    addDirectory: vi.fn(async () => ({ ok: true as const })),
    directoryAvailable: true,
    ...overrides,
  };
}

describe("RosterEditor — καθαρή προβολή από προεπιλογή", () => {
  it("δείχνει τη λίστα ΧΩΡΙΣ κουμπιά μετακίνησης/αφαίρεσης, με τη σημειογραφία θέσης", () => {
    render(<RosterEditor {...baseProps()} />);
    expect(screen.getByText(/Παπάς/)).toBeInTheDocument();
    expect(screen.getByText("1η (F)")).toBeInTheDocument(); // η ετικέτα δείχνει τον όρο ΤΗΣ ΘΕΣΗΣ (board 1 = F), ανεξάρτητα από το ότι ο Παπάς (M) δεν ταιριάζει ακόμα
    expect(screen.queryByLabelText("Μετακίνηση πάνω")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Αφαίρεση")).not.toBeInTheDocument();
  });

  it("δείχνει τη διαχωριστική ετικέτα Βασικοί/Αναπληρωματικοί στο σωστό σημείο (match_board_count=1)", () => {
    render(<RosterEditor {...baseProps()} />);
    expect(screen.getByText("Βασικοί (1 σκακιέρες)")).toBeInTheDocument();
    expect(screen.getByText("Αναπληρωματικοί")).toBeInTheDocument();
  });
});

describe("RosterEditor — επεξεργασία, μετακίνηση ΤΟΠΙΚΑ χωρίς αποθήκευση", () => {
  it("κλικ στο ↑/↓ αλλάζει ΜΟΝΟ την τοπική σειρά — καμία κλήση submitRosterOrder", async () => {
    const user = userEvent.setup();
    render(<RosterEditor {...baseProps()} />);
    await user.click(screen.getByText("Επεξεργασία Βασικής Σύνθεσης"));
    await user.click(screen.getAllByLabelText("Μετακίνηση κάτω")[0]!);
    // Η θέση 1 είναι πλέον η Νικολάου, η θέση 2 ο Παπάς — οπτική αλλαγή σειράς.
    const rows = screen.getAllByText(/Παπάς|Νικολάου/);
    expect(rows[0]!.textContent).toContain("Νικολάου");
    expect(submitRosterOrder).not.toHaveBeenCalled();
  });

  it("κλικ στο ✕ καλεί remove αμέσως — η αφαίρεση παραμένει άμεση, ανεξάρτητη", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<RosterEditor {...props} />);
    await user.click(screen.getByText("Επεξεργασία Βασικής Σύνθεσης"));
    await user.click(screen.getAllByLabelText("Αφαίρεση")[0]!);
    await waitFor(() => expect(props.remove).toHaveBeenCalledWith("e1"));
  });
});

describe("RosterEditor — Έλεγχος Σύνθεσης / Υποβολή Σύνθεσης (επιβεβαιωμένο, νέα λογική)", () => {
  it('"Υποβολή Σύνθεσης" είναι ΑΝΕΝΕΡΓΗ πριν από οποιονδήποτε Έλεγχο', async () => {
    const user = userEvent.setup();
    render(<RosterEditor {...baseProps()} />);
    await user.click(screen.getByText("Επεξεργασία Βασικής Σύνθεσης"));
    const submitBtn = screen.getByText("Υποβολή Σύνθεσης") as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it("Έλεγχος με λάθος τοποθέτηση (board 1 θέλει F, έχει M) → κόκκινο, Υποβολή παραμένει ανενεργή", async () => {
    const user = userEvent.setup();
    render(<RosterEditor {...baseProps()} />);
    await user.click(screen.getByText("Επεξεργασία Βασικής Σύνθεσης"));
    await user.click(screen.getByText("Έλεγχος Σύνθεσης"));
    expect(screen.getByText(/δεν πληροί τον όρο αυτής της σκακιέρας/)).toBeInTheDocument();
    const submitBtn = screen.getByText("Υποβολή Σύνθεσης") as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it("μετά από μετακίνηση ώστε η F να πάει στη θέση 1, ο Έλεγχος βγάζει όλα πράσινα και η Υποβολή ενεργοποιείται, καλώντας submitRosterOrder με τη σωστή σειρά", async () => {
    const user = userEvent.setup();
    render(<RosterEditor {...baseProps()} />);
    await user.click(screen.getByText("Επεξεργασία Βασικής Σύνθεσης"));
    await user.click(screen.getAllByLabelText("Μετακίνηση κάτω")[0]!); // Νικολάου (F) πάει στη θέση 1
    await user.click(screen.getByText("Έλεγχος Σύνθεσης"));
    expect(screen.queryByText(/δεν πληροί τον όρο/)).not.toBeInTheDocument();
    const submitBtn = screen.getByText("Υποβολή Σύνθεσης") as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);
    await user.click(submitBtn);
    await waitFor(() => expect(submitRosterOrder).toHaveBeenCalledWith("tok1", "team1", ["e2", "e1"]));
  });

  it("μετακίνηση ΜΕΤΑ από επιτυχή Έλεγχο ακυρώνει το αποτέλεσμα — η Υποβολή ξαναγίνεται ανενεργή", async () => {
    const user = userEvent.setup();
    render(<RosterEditor {...baseProps()} />);
    await user.click(screen.getByText("Επεξεργασία Βασικής Σύνθεσης"));
    await user.click(screen.getAllByLabelText("Μετακίνηση κάτω")[0]!);
    await user.click(screen.getByText("Έλεγχος Σύνθεσης"));
    expect((screen.getByText("Υποβολή Σύνθεσης") as HTMLButtonElement).disabled).toBe(false);
    await user.click(screen.getAllByLabelText("Μετακίνηση πάνω")[1]!); // ξαναγυρίζει πίσω
    expect((screen.getByText("Υποβολή Σύνθεσης") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("RosterEditor — κλείδωμα από προθεσμία", () => {
  it("όταν η προθεσμία έχει λήξει, το κουμπί Επεξεργασία είναι ΟΡΑΤΟ αλλά ΑΝΕΝΕΡΓΟ, με εξήγηση", () => {
    render(<RosterEditor {...baseProps({ editableByDeadline: false, lockedReason: "Η προθεσμία έχει λήξει." })} />);
    const btn = screen.getByText("Επεξεργασία Βασικής Σύνθεσης") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByText("Η προθεσμία έχει λήξει.")).toBeInTheDocument();
  });
});

describe("RosterEditor — άδειος κατάλογος", () => {
  it("δείχνει μήνυμα όταν δεν υπάρχει κανένας αθλητής", () => {
    render(<RosterEditor {...baseProps({ entries: [] })} />);
    expect(screen.getByText("Κανένας αθλητής ακόμα.")).toBeInTheDocument();
  });
});
