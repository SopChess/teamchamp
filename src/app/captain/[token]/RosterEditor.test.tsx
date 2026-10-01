// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Το RosterEditor εμφανίζει PlayerSearch όταν είναι σε επεξεργασία, το οποίο καλεί useRouter()
// — χρειάζεται πραγματικό Next.js App Router context που δεν υπάρχει σε απλό jsdom render.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import RosterEditor from "./RosterEditor";

afterEach(cleanup);

const entries = [
  { id: "e1", declared_order: 1, player: { last_name: "Παπάς", first_name: "Γιώργος", rating_national: 1200, gender: "M" } },
  { id: "e2", declared_order: 2, player: { last_name: "Νικολάου", first_name: "Μαρία", rating_national: 1100, gender: "F" } },
];

function baseProps(overrides: Partial<React.ComponentProps<typeof RosterEditor>> = {}) {
  return {
    entries,
    rosterSize: 6,
    editableByDeadline: true,
    moveUp: vi.fn(async () => undefined),
    moveDown: vi.fn(async () => undefined),
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
  it("δείχνει τη λίστα ΧΩΡΙΣ κουμπιά μετακίνησης/αφαίρεσης", () => {
    render(<RosterEditor {...baseProps()} />);
    expect(screen.getByText(/Παπάς/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Μετακίνηση πάνω")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Αφαίρεση")).not.toBeInTheDocument();
  });

  it("δεν δείχνει αναζήτηση/χειροκίνητη φόρμα σε προβολή", () => {
    render(<RosterEditor {...baseProps()} />);
    expect(screen.queryByText("Χειροκίνητη προσθήκη (αν δεν βρίσκεται στο μητρώο ΕΣΟ) · λατινικά")).not.toBeInTheDocument();
  });

  it("το κουμπί λέει «Επεξεργασία Βασικής Σύνθεσης»", () => {
    render(<RosterEditor {...baseProps()} />);
    expect(screen.getByText("Επεξεργασία Βασικής Σύνθεσης")).toBeInTheDocument();
  });
});

describe("RosterEditor — εναλλαγή σε επεξεργασία", () => {
  it("κλικ στο Επεξεργασία εμφανίζει κουμπιά μετακίνησης/αφαίρεσης ΚΑΙ τη φόρμα χειροκίνητης προσθήκης", async () => {
    const user = userEvent.setup();
    render(<RosterEditor {...baseProps()} />);
    await user.click(screen.getByText("Επεξεργασία Βασικής Σύνθεσης"));
    expect(screen.getAllByLabelText("Μετακίνηση πάνω").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Αφαίρεση").length).toBeGreaterThan(0);
    expect(screen.getByText("Χειροκίνητη προσθήκη (αν δεν βρίσκεται στο μητρώο ΕΣΟ) · λατινικά")).toBeInTheDocument();
  });

  it("κλικ στο Αποθήκευση επιστρέφει στην καθαρή προβολή — ΚΑΜΙΑ ενέργεια βάσης (δεν καλείται τίποτα)", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<RosterEditor {...props} />);
    await user.click(screen.getByText("Επεξεργασία Βασικής Σύνθεσης"));
    await user.click(screen.getByText("Αποθήκευση"));
    expect(screen.queryByLabelText("Αφαίρεση")).not.toBeInTheDocument();
    expect(props.moveUp).not.toHaveBeenCalled();
    expect(props.remove).not.toHaveBeenCalled();
  });

  it("κλικ στο ✕ καλεί remove με το σωστό entryId — ΧΩΡΙΣ να χρειάζεται \"υποβολή\"", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<RosterEditor {...props} />);
    await user.click(screen.getByText("Επεξεργασία Βασικής Σύνθεσης"));
    const removeButtons = screen.getAllByLabelText("Αφαίρεση");
    await user.click(removeButtons[0]!);
    await waitFor(() => expect(props.remove).toHaveBeenCalledWith("e1"));
  });

  it("κλικ στο ↑/↓ καλεί moveUp/moveDown με το σωστό entryId", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<RosterEditor {...props} />);
    await user.click(screen.getByText("Επεξεργασία Βασικής Σύνθεσης"));
    await user.click(screen.getAllByLabelText("Μετακίνηση κάτω")[0]!);
    await waitFor(() => expect(props.moveDown).toHaveBeenCalledWith("e1"));
  });
});

describe("RosterEditor — ΚΑΜΙΑ μόνιμη κλειδαριά από «υποβολή», μόνο η προθεσμία", () => {
  it("ΔΕΝ υπάρχει πουθενά κουμπί «Υποβολή Σύνθεσης»", async () => {
    const user = userEvent.setup();
    render(<RosterEditor {...baseProps()} />);
    expect(screen.queryByText(/Υποβολή Σύνθεσης/)).not.toBeInTheDocument();
    await user.click(screen.getByText("Επεξεργασία Βασικής Σύνθεσης"));
    expect(screen.queryByText(/Υποβολή Σύνθεσης/)).not.toBeInTheDocument();
  });

  it("όταν η προθεσμία έχει λήξει, το κουμπί Επεξεργασία είναι ΟΡΑΤΟ αλλά ΑΝΕΝΕΡΓΟ, με εξήγηση", () => {
    render(<RosterEditor {...baseProps({ editableByDeadline: false, lockedReason: "Η προθεσμία εγγραφών έχει λήξει." })} />);
    const btn = screen.getByText("Επεξεργασία Βασικής Σύνθεσης") as HTMLButtonElement;
    expect(btn).toBeInTheDocument();
    expect(btn.disabled).toBe(true);
    expect(screen.getByText("Η προθεσμία εγγραφών έχει λήξει.")).toBeInTheDocument();
  });

  it("κλικ σε ανενεργό κουμπί ΔΕΝ ανοίγει επεξεργασία", async () => {
    const user = userEvent.setup();
    render(<RosterEditor {...baseProps({ editableByDeadline: false, lockedReason: "Κλειδωμένο." })} />);
    await user.click(screen.getByText("Επεξεργασία Βασικής Σύνθεσης"));
    expect(screen.queryByLabelText("Αφαίρεση")).not.toBeInTheDocument();
  });

  it("διαφορετικό μήνυμα όταν το κλείδωμα είναι από τη διοργάνωση, όχι την προθεσμία", () => {
    render(<RosterEditor {...baseProps({ editableByDeadline: false, lockedReason: "Η βασική σύνθεση έχει κλειδωθεί από τη διοργάνωση." })} />);
    expect(screen.getByText("Η βασική σύνθεση έχει κλειδωθεί από τη διοργάνωση.")).toBeInTheDocument();
  });
});

describe("RosterEditor — άδειος κατάλογος", () => {
  it("δείχνει μήνυμα όταν δεν υπάρχει κανένας αθλητής", () => {
    render(<RosterEditor {...baseProps({ entries: [] })} />);
    expect(screen.getByText("Κανένας αθλητής ακόμα.")).toBeInTheDocument();
  });
});
