// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TournamentPanel from "./TournamentPanel";

afterEach(cleanup);

function isHidden(text: string): boolean {
  return screen.getByText(text).closest("div")!.parentElement!.className.includes("hidden");
}

describe("TournamentPanel", () => {
  it("κλειστό από προεπιλογή — το περιεχόμενο δεν φαίνεται", () => {
    render(
      <TournamentPanel title="18ο Πανελλήνιο Ομαδικό">
        <div>Περιεχόμενο ομάδας</div>
      </TournamentPanel>
    );
    expect(isHidden("Περιεχόμενο ομάδας")).toBe(true);
  });

  it("defaultOpen=true — ανοιχτό εξ αρχής", () => {
    render(
      <TournamentPanel title="18ο Πανελλήνιο Ομαδικό" defaultOpen>
        <div>Περιεχόμενο ομάδας</div>
      </TournamentPanel>
    );
    expect(isHidden("Περιεχόμενο ομάδας")).toBe(false);
  });

  it("κλικ στον τίτλο ανοίγει/κλείνει", async () => {
    const user = userEvent.setup();
    render(
      <TournamentPanel title="18ο Πανελλήνιο Ομαδικό">
        <div>Περιεχόμενο ομάδας</div>
      </TournamentPanel>
    );
    await user.click(screen.getByText("18ο Πανελλήνιο Ομαδικό"));
    expect(isHidden("Περιεχόμενο ομάδας")).toBe(false);
    await user.click(screen.getByText("18ο Πανελλήνιο Ομαδικό"));
    expect(isHidden("Περιεχόμενο ομάδας")).toBe(true);
  });

  it("δείχνει υπότιτλο όταν δοθεί", () => {
    render(
      <TournamentPanel title="18ο Πανελλήνιο Ομαδικό" subtitle="Σ.Ο. Πολίχνης">
        <div>Χ</div>
      </TournamentPanel>
    );
    expect(screen.getByText("Σ.Ο. Πολίχνης")).toBeInTheDocument();
  });

  it("χωρίς onHide, ΔΕΝ εμφανίζεται κουμπί απόκρυψης (π.χ. παλιό link μίας ομάδας)", () => {
    render(
      <TournamentPanel title="Χ">
        <div>Χ</div>
      </TournamentPanel>
    );
    expect(screen.queryByText("Απόκρυψη")).not.toBeInTheDocument();
  });

  it("με onHide, κλικ στο Απόκρυψη καλεί τη συνάρτηση", async () => {
    const user = userEvent.setup();
    const onHide = vi.fn();
    render(
      <TournamentPanel title="Χ" onHide={onHide}>
        <div>Χ</div>
      </TournamentPanel>
    );
    await user.click(screen.getByText("Απόκρυψη"));
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it("το κλικ στο Απόκρυψη ΔΕΝ ανοίγει/κλείνει το πλαίσιο (ξεχωριστό κουμπί)", async () => {
    const user = userEvent.setup();
    render(
      <TournamentPanel title="Χ" onHide={vi.fn()}>
        <div>Περιεχόμενο</div>
      </TournamentPanel>
    );
    await user.click(screen.getByText("Απόκρυψη"));
    expect(isHidden("Περιεχόμενο")).toBe(true); // παρέμεινε κλειστό, δεν άνοιξε κατά λάθος
  });
});
