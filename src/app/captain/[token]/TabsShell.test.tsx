// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TabsShell from "./TabsShell";

afterEach(cleanup);

// jsdom δεν εφαρμόζει το πραγματικό CSS του Tailwind (η κλάση "hidden" δεν
// γίνεται πραγματικό display:none χωρίς φορτωμένο stylesheet) — ελέγχουμε την
// ίδια την κλάση στον γονέα, που είναι αυτό που πραγματικά αποφασίζει το component.
function isHidden(text: string): boolean {
  return screen.getByText(text).parentElement!.className.includes("hidden");
}

function Demo() {
  return (
    <TabsShell
      tabs={[
        { id: "a", label: "Ομάδα", content: <div>Περιεχόμενο Α</div> },
        { id: "b", label: "Αθλητές", content: <div>Περιεχόμενο Β</div>, attention: true },
        { id: "c", label: "Πληρωμή", content: <div>Περιεχόμενο Γ</div> },
      ]}
    />
  );
}

describe("TabsShell", () => {
  it("δείχνει την πρώτη καρτέλα εξ ορισμού", () => {
    render(<Demo />);
    expect(isHidden("Περιεχόμενο Α")).toBe(false);
    expect(isHidden("Περιεχόμενο Β")).toBe(true);
  });

  it("αλλάζει καρτέλα με κλικ, ίδιο URL/σελίδα (καμία πλοήγηση)", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.click(screen.getByRole("tab", { name: /Αθλητές/ }));
    expect(isHidden("Περιεχόμενο Β")).toBe(false);
    expect(isHidden("Περιεχόμενο Α")).toBe(true);
  });

  it("το περιεχόμενο ΔΕΝ αποσυνδέεται (unmount) όταν κρύβεται — μένει στο DOM", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    // Και οι τρεις καρτέλες υπάρχουν ήδη στο DOM από την αρχή, απλώς οι δύο είναι κρυφές.
    expect(screen.getByText("Περιεχόμενο Β")).toBeInTheDocument();
    expect(screen.getByText("Περιεχόμενο Γ")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Αθλητές/ }));
    await user.click(screen.getByRole("tab", { name: "Ομάδα" }));
    expect(screen.getByText("Περιεχόμενο Β")).toBeInTheDocument(); // ακόμα εκεί, όχι ξαναφτιαγμένο
  });

  it("δείχνει κόκκινη κουκίδα προσοχής στην καρτέλα που τη ζήτησε", () => {
    const { container } = render(<Demo />);
    const athletesTab = screen.getByRole("tab", { name: /Αθλητές/ });
    expect(athletesTab.querySelector(".bg-red-400")).toBeInTheDocument();
    const teamTab = screen.getByRole("tab", { name: "Ομάδα" });
    expect(teamTab.querySelector(".bg-red-400")).not.toBeInTheDocument();
    void container;
  });

  it("σέβεται το defaultTab", () => {
    render(
      <TabsShell
        defaultTab="c"
        tabs={[
          { id: "a", label: "Ομάδα", content: <div>Α</div> },
          { id: "c", label: "Πληρωμή", content: <div>Γ</div> },
        ]}
      />
    );
    expect(isHidden("Γ")).toBe(false);
  });
});
