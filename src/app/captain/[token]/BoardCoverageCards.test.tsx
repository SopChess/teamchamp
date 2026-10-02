// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import BoardCoverageCards from "./BoardCoverageCards";
import type { BoardCoverage } from "@/lib/rosterRules/basicRosterCheck";

afterEach(cleanup);

describe("BoardCoverageCards — πίνακας σύνθεσης (επιβεβαιωμένο, νέα παρουσίαση)", () => {
  it("δείχνει τις 4 στήλες: Σκακιέρα, Αθλητής, Κατηγορία, Έλεγχος", () => {
    render(<BoardCoverageCards boards={[{ board: 1, label: "", shortLabel: "", covered: true, athleteName: "Παπαδόπουλος Γιώργος" }]} />);
    expect(screen.getByText("Σκακιέρα")).toBeInTheDocument();
    expect(screen.getByText("Αθλητής")).toBeInTheDocument();
    expect(screen.getByText("Κατηγορία")).toBeInTheDocument();
    expect(screen.getByText("Έλεγχος")).toBeInTheDocument();
  });

  it('καλυμμένη σκακιέρα: δείχνει το όνομα αθλητή και "Έγκυρη"', () => {
    const boards: BoardCoverage[] = [{ board: 1, label: "", shortLabel: "U16", covered: true, athleteName: "Παπαδόπουλος Γιώργος" }];
    render(<BoardCoverageCards boards={boards} />);
    expect(screen.getByText("Παπαδόπουλος Γιώργος")).toBeInTheDocument();
    expect(screen.getByText("U16")).toBeInTheDocument();
    expect(screen.getByText("Έγκυρη")).toBeInTheDocument();
  });

  it('ακάλυπτη σκακιέρα: δείχνει "Επιλογή αθλητή" και "Εκκρεμεί"', () => {
    const boards: BoardCoverage[] = [{ board: 2, label: "", shortLabel: "F", covered: false, athleteName: null }];
    render(<BoardCoverageCards boards={boards} />);
    expect(screen.getByText("Επιλογή αθλητή")).toBeInTheDocument();
    expect(screen.getByText("Εκκρεμεί")).toBeInTheDocument();
  });

  it('σκακιέρα χωρίς όρο δείχνει "Χωρίς όρο" αντί για ετικέτα κατηγορίας', () => {
    const boards: BoardCoverage[] = [{ board: 3, label: "", shortLabel: "", covered: false, athleteName: null }];
    render(<BoardCoverageCards boards={boards} />);
    expect(screen.getByText("Χωρίς όρο")).toBeInTheDocument();
  });

  it("καμία σκακιέρα → δεν αποδίδει τίποτα", () => {
    const { container } = render(<BoardCoverageCards boards={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
