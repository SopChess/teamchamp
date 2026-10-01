import nodemailer from "nodemailer";

/**
 * Αποστολή email μέσω Gmail (ίδια δομή με το SopRegSB, για συνέπεια):
 *   sendEmail()    — χαμηλού επιπέδου, στέλνει πραγματικά το email
 *   emailWrapper() — κοινό HTML "περίβλημα" γύρω από κάθε μήνυμα
 *   send*Email()   — ένα template ανά περίσταση, χτισμένο πάνω στα δύο πιο πάνω
 *
 * Χρειάζεται GMAIL_USER και GMAIL_APP_PASSWORD (App Password, όχι ο κανονικός
 * κωδικός — myaccount.google.com/apppasswords, μετά από ενεργό 2-Step
 * Verification). Χωρίς αυτά, sendEmail() επιστρέφει false χωρίς να πετάξει —
 * το αντιμετωπίζει κανονικά η κάθε ενέργεια (π.χ. δείχνει το link στην οθόνη).
 */

const FROM_EMAIL = process.env.GMAIL_USER || "";
const FROM_NAME = "Team ALMA";

function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

/** true αν το email πράγματι στάλθηκε· false αν λείπουν τα credentials (δεν πετάει). */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  attachments?: EmailAttachment[]
): Promise<boolean> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return false;

  const transporter = getTransporter();
  await transporter.sendMail({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to,
    subject,
    html,
    text,
    attachments,
  });
  return true;
}

function emailWrapper(content: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#2b2b2b">
    <div style="background:#0f2540;padding:24px;border-radius:12px 12px 0 0;text-align:center">
      <h2 style="color:#d4af37;margin:0;font-family:Georgia,serif">${FROM_NAME}</h2>
    </div>
    <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
      ${content}
    </div>
  </div>`;
}

export interface CaptainAccessEmailInfo {
  teamName: string;
  competitionName: string;
  startsOn: string | null;
  endsOn: string | null;
  venue: string | null;
  portalUrl: string;
}

function formatDateRange(startsOn: string | null, endsOn: string | null): string | null {
  const fmt = (d: string) => new Date(d).toLocaleDateString("el-GR");
  if (startsOn && endsOn && startsOn !== endsOn) return `${fmt(startsOn)} – ${fmt(endsOn)}`;
  if (startsOn) return fmt(startsOn);
  if (endsOn) return fmt(endsOn);
  return null;
}

/**
 * Επιβεβαίωση εγγραφής ομάδας: στοιχεία του τουρνουά (όχι γυμνό link) και ένα
 * ξεχωριστό κουμπί "Team Portal" προς τη διαχείριση — κληρώσεις, αποτελέσματα,
 * υποβολή σύνθεσης ανά γύρο, ό,τι άλλο προβλέπει η εφαρμογή (επιβεβαιωμένο).
 * Αν ο υπεύθυνος έχει και άλλες ομάδες, το ίδιο κουμπί τις δείχνει όλες.
 */
export async function sendCaptainAccessEmail(
  email: string,
  captainFirstName: string,
  info: CaptainAccessEmailInfo
): Promise<boolean> {
  const dates = formatDateRange(info.startsOn, info.endsOn);
  const detailsHtml = [
    `<tr><td style="padding:4px 0;color:#666">Διοργάνωση</td><td style="padding:4px 0;font-weight:bold">${escapeHtml(info.competitionName)}</td></tr>`,
    `<tr><td style="padding:4px 0;color:#666">Ομάδα</td><td style="padding:4px 0;font-weight:bold">${escapeHtml(info.teamName)}</td></tr>`,
    dates ? `<tr><td style="padding:4px 0;color:#666">Ημερομηνίες</td><td style="padding:4px 0">${escapeHtml(dates)}</td></tr>` : "",
    info.venue ? `<tr><td style="padding:4px 0;color:#666">Χώρος αγώνων</td><td style="padding:4px 0">${escapeHtml(info.venue)}</td></tr>` : "",
  ].join("");

  const html = emailWrapper(`
    <p>Αγαπητέ/ή <b>${escapeHtml(captainFirstName)}</b>,</p>
    <p>Η εγγραφή της ομάδας σας καταχωρήθηκε με επιτυχία.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">${detailsHtml}</table>
    <div style="text-align:center;margin:28px 0">
      <a href="${info.portalUrl}" style="background:#c9a15a;color:#0f2540;font-weight:bold;text-decoration:none;
        padding:12px 28px;border-radius:10px;display:inline-block">Team Portal</a>
    </div>
    <p style="font-size:0.9em;color:#666">
      Από το Team Portal διαχειρίζεστε τη σύνθεση της ομάδας σας, βλέπετε κληρώσεις και αποτελέσματα,
      και υποβάλλετε τη σύνθεση κάθε γύρου. Ανοίξτε το κουμπί μία φορά σε κάθε συσκευή που θέλετε να
      χρησιμοποιήσετε — είναι προσωπικό, παρακαλούμε μην το προωθήσετε σε τρίτους. Μπορείτε να
      επεξεργάζεστε τη βασική σύνθεση της ομάδας μέχρι την προθεσμία εγγραφών.
    </p>
  `);
  const text =
    `Η εγγραφή της ομάδας σας καταχωρήθηκε με επιτυχία.\n\n` +
    `Διοργάνωση: ${info.competitionName}\n` +
    `Ομάδα: ${info.teamName}\n` +
    (dates ? `Ημερομηνίες: ${dates}\n` : "") +
    (info.venue ? `Χώρος αγώνων: ${info.venue}\n` : "") +
    `\nTeam Portal: ${info.portalUrl}\n\n` +
    `Ανοίξτε το μία φορά σε κάθε συσκευή. Είναι προσωπικό — μην το προωθήσετε σε τρίτους.`;
  return sendEmail(email, `Επιβεβαίωση Εγγραφής — ${info.teamName}`, html, text);
}

/** Το προσωπικό link πρόσβασης για το επιτελείο διοργάνωσης (admin/υπεύθυνος/διαιτητής). */
export async function sendStaffAccessEmail(email: string, link: string): Promise<boolean> {
  const html = emailWrapper(`
    <p>Ακολουθεί το προσωπικό σας link πρόσβασης στο <b>${FROM_NAME}</b>:</p>
    <p><a href="${link}" style="color:#0f2540;font-weight:bold">${link}</a></p>
    <p style="font-size:0.9em;color:#666">
      Ανοίξτε το μία φορά σε κάθε συσκευή που θέλετε να χρησιμοποιήσετε. Είναι προσωπικό —
      παρακαλούμε μην το προωθήσετε σε τρίτους.
    </p>
  `);
  const text =
    `Ακολουθεί το προσωπικό σας link πρόσβασης στο Team ALMA:\n\n${link}\n\n` +
    `Ανοίξτε το μία φορά σε κάθε συσκευή που θέλετε να χρησιμοποιήσετε. ` +
    `Είναι προσωπικό — παρακαλούμε μην το προωθήσετε σε τρίτους.`;
  return sendEmail(email, "Το προσωπικό σας link πρόσβασης — Team ALMA", html, text);
}

export type StaffRole = "super_admin" | "tournament_admin" | "referee";

const ROLE_INTRO: Record<StaffRole, string> = {
  super_admin:
    "Σας δόθηκε πρόσβαση διαχειριστή στο Team ALMA — πλήρης πρόσβαση σε όλες τις διοργανώσεις, " +
    "συλλόγους/σχολεία, ομάδες και χρήστες.",
  tournament_admin:
    "Σας δόθηκε πρόσβαση υπευθύνου πρωταθλήματος στο Team ALMA — μπορείτε να διαχειρίζεστε τις " +
    "κληρώσεις, να καταχωρείτε αποτελέσματα και να επεξεργάζεστε τις ομάδες της διοργάνωσης/ων που " +
    "σας έχουν ανατεθεί.",
  referee:
    "Σας δόθηκε πρόσβαση διαιτητή στο Team ALMA. Στην αίθουσα αγώνων, σαρώστε το QR της κάθε " +
    "σκακιέρας (Συνάντηση/Σκακιέρα) με το κινητό σας — θα ανοίξει απευθείας τη σελίδα καταχώρησης " +
    "του αποτελέσματος. Δεν χρειάζεται να ανοίξετε το link παρακάτω για να σαρώσετε — είναι μόνο για " +
    "αναφορά, σε περίπτωση που χρειαστεί.",
};

const ROLE_SUBJECT: Record<StaffRole, string> = {
  super_admin: "Πρόσβαση Διαχειριστή — Team ALMA",
  tournament_admin: "Πρόσβαση Υπευθύνου Πρωταθλήματος — Team ALMA",
  referee: "Πρόσβαση Διαιτητή — Team ALMA",
};

/**
 * Προσωπικό link πρόσβασης του επιτελείου, με περιεχόμενο προσαρμοσμένο στον
 * ρόλο (επιβεβαιωμένο) — ο admin το δημιουργεί και το στέλνει, καμία δημόσια
 * φόρμα αιτήματος δεν χρειάζεται πια στην αρχική σελίδα.
 */
export async function sendRoleAccessEmail(role: StaffRole, email: string, link: string): Promise<boolean> {
  const intro = ROLE_INTRO[role];
  const html = emailWrapper(`
    <p>${intro}</p>
    <p>Το προσωπικό σας link:</p>
    <p><a href="${link}" style="color:#0f2540;font-weight:bold">${link}</a></p>
    <p style="font-size:0.9em;color:#666">
      Ανοίξτε το μία φορά σε κάθε συσκευή που θέλετε να χρησιμοποιήσετε. Είναι προσωπικό —
      παρακαλούμε μην το προωθήσετε σε τρίτους.
    </p>
  `);
  const text =
    `${intro}\n\nΤο προσωπικό σας link: ${link}\n\n` +
    `Ανοίξτε το μία φορά σε κάθε συσκευή που θέλετε να χρησιμοποιήσετε. ` +
    `Είναι προσωπικό — παρακαλούμε μην το προωθήσετε σε τρίτους.`;
  return sendEmail(email, ROLE_SUBJECT[role], html, text);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
