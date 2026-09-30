// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SavableForm from "./SavableForm";

afterEach(cleanup);

function Form({ action, successMessage, resetOnSuccess }: {
  action: (fd: FormData) => Promise<void>;
  successMessage?: string;
  resetOnSuccess?: boolean;
}) {
  return (
    <SavableForm action={action} successMessage={successMessage} resetOnSuccess={resetOnSuccess}>
      <input name="name" defaultValue="Αρχικό" />
      <button type="submit">Αποθήκευση</button>
    </SavableForm>
  );
}

describe("SavableForm — επιτυχία", () => {
  it("δείχνει «Αποθήκευση...» όσο εκτελείται και μετά ✓ Αποθηκεύτηκε", async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    const action = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
    render(<Form action={action} />);

    await user.click(screen.getByText("Αποθήκευση"));
    expect(await screen.findByText("Αποθήκευση...")).toBeInTheDocument();

    resolve();
    await waitFor(() => expect(screen.getByText("✓ Αποθηκεύτηκε.")).toBeInTheDocument());
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("απενεργοποιεί τα πεδία της φόρμας όσο εκτελείται (προστασία από διπλό κλικ)", async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    const action = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
    render(<Form action={action} />);

    // Το πραγματικό ενδιαφέρον είναι το <fieldset disabled> γύρω από τα πεδία — αυτό είναι στάνταρ HTML
    // συμπεριφορά (απενεργοποιεί ΟΛΑ τα εσωτερικά πεδία/κουμπιά σε κάθε πραγματικό browser)· το jsdom
    // δεν προσομοιώνει πλήρως την κληρονομικότητα προς τα παιδιά, οπότε ελέγχουμε το ίδιο το fieldset.
    const button = screen.getByText("Αποθήκευση") as HTMLButtonElement;
    const input = screen.getByDisplayValue("Αρχικό") as HTMLInputElement;
    await user.click(button);
    const fieldset = await screen.findByText("Αποθήκευση...").then(() => input.closest("fieldset")!);
    expect(fieldset.disabled).toBe(true);

    resolve();
    await waitFor(() => expect(fieldset.disabled).toBe(false));
    expect(action).toHaveBeenCalledTimes(1); // δεν διπλοκλήθηκε ενώ ήταν κλειδωμένο
  });

  it("χρησιμοποιεί το προσαρμοσμένο μήνυμα επιτυχίας", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => undefined);
    render(<Form action={action} successMessage="Ο αθλητής προστέθηκε." />);
    await user.click(screen.getByText("Αποθήκευση"));
    await waitFor(() => expect(screen.getByText("✓ Ο αθλητής προστέθηκε.")).toBeInTheDocument());
  });

  it("το FormData που φτάνει στο action περιέχει τα πεδία της φόρμας", async () => {
    const user = userEvent.setup();
    let captured: FormData | null = null;
    const action = vi.fn(async (fd: FormData) => { captured = fd; });
    render(<Form action={action} />);
    await user.click(screen.getByText("Αποθήκευση"));
    await waitFor(() => expect(action).toHaveBeenCalled());
    expect(captured!.get("name")).toBe("Αρχικό");
  });

  it("resetOnSuccess αδειάζει τη φόρμα μετά από επιτυχία", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => undefined);
    render(<Form action={action} resetOnSuccess />);
    const input = screen.getByDisplayValue("Αρχικό") as HTMLInputElement;
    await user.clear(input);
    await user.type(input, "Αλλαγμένο");
    await user.click(screen.getByText("Αποθήκευση"));
    await waitFor(() => expect(screen.getByText(/Αποθηκεύτηκε/)).toBeInTheDocument());
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("Αρχικό");
  });

  it("χωρίς resetOnSuccess, η φόρμα ΔΕΝ αδειάζει", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => undefined);
    render(<Form action={action} />);
    const input = screen.getByDisplayValue("Αρχικό") as HTMLInputElement;
    await user.clear(input);
    await user.type(input, "Αλλαγμένο");
    await user.click(screen.getByText("Αποθήκευση"));
    await waitFor(() => expect(screen.getByText(/Αποθηκεύτηκε/)).toBeInTheDocument());
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("Αλλαγμένο");
  });
});

describe("SavableForm — αποτυχία", () => {
  it("δείχνει το ΑΚΡΙΒΕΣ μήνυμα σφάλματος που πέταξε το action", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => { throw new Error("Υπάρχει ήδη σύλλογος με αυτό το όνομα."); });
    render(<Form action={action} />);
    await user.click(screen.getByText("Αποθήκευση"));
    await waitFor(() => expect(screen.getByText("✗ Υπάρχει ήδη σύλλογος με αυτό το όνομα.")).toBeInTheDocument());
  });

  it("σφάλμα χωρίς μήνυμα δείχνει γενικό κείμενο, όχι κενό", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => { throw "κάτι πήγε στραβά"; }); // eslint-disable-line @typescript-eslint/no-throw-literal
    render(<Form action={action} />);
    await user.click(screen.getByText("Αποθήκευση"));
    await waitFor(() => expect(screen.getByText("✗ Παρουσιάστηκε σφάλμα.")).toBeInTheDocument());
  });

  it("δεύτερη προσπάθεια μετά από σφάλμα καθαρίζει το προηγούμενο μήνυμα όσο εκτελείται", async () => {
    const user = userEvent.setup();
    const action = vi.fn()
      .mockRejectedValueOnce(new Error("Πρώτο σφάλμα"))
      .mockResolvedValueOnce(undefined);
    render(<Form action={action} />);
    await user.click(screen.getByText("Αποθήκευση"));
    await waitFor(() => expect(screen.getByText("✗ Πρώτο σφάλμα")).toBeInTheDocument());

    await user.click(screen.getByText("Αποθήκευση"));
    expect(screen.queryByText("✗ Πρώτο σφάλμα")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Αποθηκεύτηκε/)).toBeInTheDocument());
  });

  it("δεν αδειάζει τη φόρμα όταν αποτυγχάνει, ακόμα και με resetOnSuccess", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => { throw new Error("Σφάλμα"); });
    render(<Form action={action} resetOnSuccess />);
    const input = screen.getByDisplayValue("Αρχικό") as HTMLInputElement;
    await user.clear(input);
    await user.type(input, "Κρατημένη τιμή");
    await user.click(screen.getByText("Αποθήκευση"));
    await waitFor(() => expect(screen.getByText("✗ Σφάλμα")).toBeInTheDocument());
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("Κρατημένη τιμή");
  });
});

describe("SavableForm — redirect του Next.js", () => {
  // Το component ΞΑΝΑΠΕΤΑΕΙ σκόπιμα τα redirect/notFound (το πραγματικό Next.js τα πιάνει
  // στον router) — σε αυτό το test-harness δεν υπάρχει router, οπότε το πιάνουμε εμείς
  // προσωρινά ως unhandled rejection, ώστε να επιβεβαιώσουμε ΤΙ ξαναπετάχτηκε χωρίς να
  // αποτύχει η δοκιμή.
  async function expectRethrown(matchDigest: string, trigger: () => Promise<void>): Promise<void> {
    let caught: any = null;
    const onRejection = (reason: unknown) => { caught = reason; };
    process.on("unhandledRejection", onRejection);
    try {
      await trigger();
      await waitFor(() => expect(caught).not.toBeNull());
      expect((caught as { digest?: string })?.digest).toBe(matchDigest);
    } finally {
      process.off("unhandledRejection", onRejection);
    }
  }

  it("ΞΑΝΑΠΕΤΑΕΙ το redirect (digest NEXT_REDIRECT) αντί να το δείξει ως σφάλμα", async () => {
    const user = userEvent.setup();
    const digest = "NEXT_REDIRECT;push;/admin/123;307;";
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), { digest });
    const action = vi.fn(async () => { throw redirectError; });
    render(<Form action={action} />);
    await expectRethrown(digest, async () => { await user.click(screen.getByText("Αποθήκευση")); });
    expect(screen.queryByText(/✗/)).not.toBeInTheDocument();
    expect(screen.queryByText(/✓/)).not.toBeInTheDocument();
  });

  it("ΞΑΝΑΠΕΤΑΕΙ το NEXT_NOT_FOUND αντί να το δείξει ως σφάλμα", async () => {
    const user = userEvent.setup();
    const err = Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_NOT_FOUND" });
    const action = vi.fn(async () => { throw err; });
    render(<Form action={action} />);
    await expectRethrown("NEXT_NOT_FOUND", async () => { await user.click(screen.getByText("Αποθήκευση")); });
    expect(screen.queryByText(/✗/)).not.toBeInTheDocument();
  });
});
