import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendMail = vi.fn(async (_opts: Record<string, unknown>) => ({ messageId: "1" }));
vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn(() => ({ sendMail })) },
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  sendMail.mockClear();
  delete process.env.GMAIL_USER;
  delete process.env.GMAIL_APP_PASSWORD;
  vi.resetModules(); // το FROM_EMAIL υπολογίζεται στη φόρτωση του module — χρειάζεται φρέσκια εισαγωγή ανά test
});
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("sendEmail — χωρίς credentials", () => {
  it("επιστρέφει false χωρίς να προσπαθήσει αποστολή", async () => {
    const { sendEmail } = await import("./email");
    const ok = await sendEmail("x@example.gr", "Θέμα", "<p>Γεια</p>", "Γεια");
    expect(ok).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });
  it("το ίδιο όταν λείπει μόνο το ένα από τα δύο", async () => {
    process.env.GMAIL_USER = "x@gmail.com";
    const { sendEmail } = await import("./email");
    expect(await sendEmail("x@example.gr", "Θ", "h", "t")).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe("sendEmail — με credentials", () => {
  beforeEach(() => {
    process.env.GMAIL_USER = "sender@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "abcd1234abcd1234";
  });

  it("στέλνει με τα σωστά στοιχεία και επιστρέφει true", async () => {
    const { sendEmail } = await import("./email");
    const ok = await sendEmail("to@example.gr", "Θέμα", "<p>html</p>", "text");
    expect(ok).toBe(true);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Team ALMA <sender@gmail.com>",
        to: "to@example.gr",
        subject: "Θέμα",
        html: "<p>html</p>",
        text: "text",
      })
    );
  });

  it("sendCaptainAccessEmail: θέμα με το όνομα ομάδας, στοιχεία τουρνουά, κουμπί Team Portal, ονόματα ξεφεύγουν σωστά", async () => {
    const { sendCaptainAccessEmail } = await import("./email");
    await sendCaptainAccessEmail("cap@example.gr", "Γιώργος <script>", {
      teamName: "Σ.Ο. Πολίχνης",
      competitionName: "18ο Πανελλήνιο",
      startsOn: "2026-11-01",
      endsOn: "2026-11-03",
      venue: "Εκπαιδευτήρια Μαντουλίδη",
      portalUrl: "https://teamchamp.vercel.app/captain/abc123",
    });
    const [call] = sendMail.mock.calls[0]!;
    expect(call.to).toBe("cap@example.gr");
    expect(call.subject).toContain("Σ.Ο. Πολίχνης");
    expect(call.html).toContain("Team Portal");
    expect(call.html).toContain("18ο Πανελλήνιο");
    expect(call.html).toContain("Εκπαιδευτήρια Μαντουλίδη");
    expect(call.html).toContain("https://teamchamp.vercel.app/captain/abc123");
    expect(call.html).not.toContain("<script>");
    expect(call.html).toContain("&lt;script&gt;");
    expect(call.text).toContain("https://teamchamp.vercel.app/captain/abc123");
    expect(call.text).toContain("18ο Πανελλήνιο");
  });

  it("sendCaptainAccessEmail: χωρίς ημερομηνίες/χώρο, δεν εμφανίζει κενές γραμμές", async () => {
    const { sendCaptainAccessEmail } = await import("./email");
    await sendCaptainAccessEmail("cap@example.gr", "Μαρία", {
      teamName: "Κασκαντέρ", competitionName: "Δοκιμή", startsOn: null, endsOn: null, venue: null,
      portalUrl: "https://teamchamp.vercel.app/captain/xyz",
    });
    const [call] = sendMail.mock.calls[0]!;
    expect(call.html).not.toContain("Ημερομηνίες");
    expect(call.html).not.toContain("Χώρος αγώνων");
  });

  it("sendCaptainAccessEmail: ίδια ημερομηνία έναρξης/λήξης εμφανίζεται μία φορά", async () => {
    const { sendCaptainAccessEmail } = await import("./email");
    await sendCaptainAccessEmail("cap@example.gr", "Μαρία", {
      teamName: "Χ", competitionName: "Δ", startsOn: "2026-11-01", endsOn: "2026-11-01", venue: null,
      portalUrl: "https://teamchamp.vercel.app/captain/xyz",
    });
    const [call] = sendMail.mock.calls[0]!;
    const count = (String(call.html).match(/1\/11\/2026/g) || []).length;
    expect(count).toBe(1);
  });

  it("sendStaffAccessEmail: το link εμφανίζεται σε html και text", async () => {
    const { sendStaffAccessEmail } = await import("./email");
    await sendStaffAccessEmail("staff@example.gr", "https://teamchamp.vercel.app/access/xyz");
    const [call] = sendMail.mock.calls[0]!;
    expect(call.html).toContain("https://teamchamp.vercel.app/access/xyz");
    expect(call.text).toContain("https://teamchamp.vercel.app/access/xyz");
  });

  it("sendRoleAccessEmail: διαφορετικό θέμα και περιεχόμενο ανά ρόλο", async () => {
    const { sendRoleAccessEmail } = await import("./email");
    await sendRoleAccessEmail("referee", "ref@example.gr", "https://teamchamp.vercel.app/access/r1");
    const [refCall] = sendMail.mock.calls[0]!;
    expect(refCall.subject).toContain("Διαιτητή");
    expect(refCall.html).toContain("σαρώστε το QR");

    sendMail.mockClear();
    await sendRoleAccessEmail("tournament_admin", "ta@example.gr", "https://teamchamp.vercel.app/access/t1");
    const [taCall] = sendMail.mock.calls[0]!;
    expect(taCall.subject).toContain("Υπευθύνου Πρωταθλήματος");
    expect(taCall.html).toContain("κληρώσεις");
    expect(taCall.html).not.toContain("σαρώστε το QR");

    sendMail.mockClear();
    await sendRoleAccessEmail("super_admin", "sa@example.gr", "https://teamchamp.vercel.app/access/s1");
    const [saCall] = sendMail.mock.calls[0]!;
    expect(saCall.subject).toContain("Διαχειριστή");
    expect(saCall.html).toContain("πλήρης πρόσβαση");
  });

  it("sendRoleAccessEmail: το link εμφανίζεται σε html και text, για κάθε ρόλο", async () => {
    const { sendRoleAccessEmail } = await import("./email");
    await sendRoleAccessEmail("super_admin", "sa@example.gr", "https://teamchamp.vercel.app/access/abc");
    const [call] = sendMail.mock.calls[0]!;
    expect(call.html).toContain("https://teamchamp.vercel.app/access/abc");
    expect(call.text).toContain("https://teamchamp.vercel.app/access/abc");
  });
});
