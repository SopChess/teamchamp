// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import RegisterWizard from "./RegisterWizard";

afterEach(cleanup);

function setup() {
  return render(
    <RegisterWizard
      action={vi.fn()}
      fieldLabel="Όνομα Συλλόγου"
      fieldExample="π.χ. Σ.Ο. Πολίχνης"
      needsEsoCode={false}
      search={vi.fn().mockResolvedValue([])}
      searchByNumber={vi.fn().mockResolvedValue(null)}
      rules={null}
      referenceYear={2026}
    />
  );
}

describe("RegisterWizard", () => {
  it("ξεκινά στο Βήμα 1 και δεν προχωρά αν λείπουν υποχρεωτικά πεδία", () => {
    const { container } = setup();
    fireEvent.click(screen.getByText(/Συνέχεια στη Βασική Σύνθεση/));
    // το Βήμα 2 παραμένει κρυμμένο
    const step2 = screen.getByText("Ολοκλήρωση Εγγραφής").closest("div.hidden");
    expect(step2).not.toBeNull();
    expect(container.querySelector('input[name="new_team_name"]')).not.toBeNull();
  });

  it("προχωρά στο Βήμα 2 όταν τα πεδία είναι συμπληρωμένα, και το «Πίσω» επιστρέφει", () => {
    const { container } = setup();
    const set = (name: string, value: string) =>
      fireEvent.change(container.querySelector(`input[name="${name}"]`)!, { target: { value } });
    set("new_team_name", "ΟΜΑΔΑ");
    set("last_name", "ΠΑΠΑΔΟΠΟΥΛΟΣ");
    set("first_name", "ΓΙΩΡΓΟΣ");
    set("phone", "6900000000");
    set("email", "a@b.gr");
    fireEvent.click(screen.getByText(/Συνέχεια στη Βασική Σύνθεση/));
    expect(screen.getByText("Ολοκλήρωση Εγγραφής").closest("div.hidden")).toBeNull();
    fireEvent.click(screen.getByText("← Πίσω"));
    expect(screen.getByText("Ολοκλήρωση Εγγραφής").closest("div.hidden")).not.toBeNull();
    // τα πεδία του Βήματος 1 μένουν στο DOM με τις τιμές τους
    expect((container.querySelector('input[name="email"]') as HTMLInputElement).value).toBe("a@b.gr");
  });
});
