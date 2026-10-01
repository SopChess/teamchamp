// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HiddenTournamentRow from "./HiddenTournamentRow";

afterEach(cleanup);

describe("HiddenTournamentRow", () => {
  it("δείχνει τον τίτλο", () => {
    render(<HiddenTournamentRow title="18ο Πανελλήνιο — Σ.Ο. Πολίχνης" show={vi.fn(async () => undefined)} />);
    expect(screen.getByText("18ο Πανελλήνιο — Σ.Ο. Πολίχνης")).toBeInTheDocument();
  });

  it("κλικ στην Επανεμφάνιση καλεί τη συνάρτηση show", async () => {
    const user = userEvent.setup();
    const show = vi.fn(async () => undefined);
    render(<HiddenTournamentRow title="Χ" show={show} />);
    await user.click(screen.getByText("Επανεμφάνιση"));
    await waitFor(() => expect(show).toHaveBeenCalledTimes(1));
  });
});
