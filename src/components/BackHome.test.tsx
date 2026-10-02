// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const back = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ back }) }));

import BackHome from "./BackHome";

afterEach(cleanup);

describe("BackHome", () => {
  it("δείχνει «← Πίσω» και «🏠 Αρχική» μαζί", () => {
    render(<BackHome />);
    expect(screen.getByText("← Πίσω")).toBeInTheDocument();
    expect(screen.getByText("🏠 Αρχική")).toBeInTheDocument();
  });

  it("κλικ στο Πίσω καλεί το πραγματικό ιστορικό browser (router.back)", async () => {
    const user = userEvent.setup();
    render(<BackHome />);
    await user.click(screen.getByText("← Πίσω"));
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("το Αρχική είναι πάντα link προς /, ανεξάρτητα από ιστορικό", () => {
    render(<BackHome />);
    const home = screen.getByText("🏠 Αρχική").closest("a");
    expect(home).toHaveAttribute("href", "/");
  });
});
