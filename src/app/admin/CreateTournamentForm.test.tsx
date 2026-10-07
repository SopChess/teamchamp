// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateTournamentForm from "./CreateTournamentForm";

afterEach(cleanup);

describe("CreateTournamentForm — πίσω από κουμπί (επιβεβαιωμένο)", () => {
  it("δείχνει μόνο το κουμπί «+ Νέο Τουρνουά» αρχικά — καμία φόρμα ορατή", () => {
    render(<CreateTournamentForm action={vi.fn(async () => undefined)} />);
    expect(screen.getByText("+ Νέο Τουρνουά")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Πανελλήνιο/)).not.toBeInTheDocument();
  });

  it("κλικ στο κουμπί ανοίγει την πλήρη φόρμα, με ΟΛΑ τα πεδία που έχει και η επεξεργασία", async () => {
    const user = userEvent.setup();
    render(<CreateTournamentForm action={vi.fn(async () => undefined)} />);
    await user.click(screen.getByText("+ Νέο Τουρνουά"));
    expect(screen.getByPlaceholderText(/Πανελλήνιο/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("https://chess-results.com/tnr...")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("π.χ. 15΄+10΄΄/κίνηση")).toBeInTheDocument();
    expect(screen.getByText("Προθεσμία πληρωμής παραβόλου")).toBeInTheDocument();
    expect(screen.getByText("Απαιτείται βεβαίωση φοίτησης")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("π.χ. 2026-2027")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("π.χ. 12")).toBeInTheDocument();
  });

  it("κλικ στην Ακύρωση κλείνει ξανά τη φόρμα", async () => {
    const user = userEvent.setup();
    render(<CreateTournamentForm action={vi.fn(async () => undefined)} />);
    await user.click(screen.getByText("+ Νέο Τουρνουά"));
    await user.click(screen.getByText("Ακύρωση"));
    expect(screen.getByText("+ Νέο Τουρνουά")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Πανελλήνιο/)).not.toBeInTheDocument();
  });
});
