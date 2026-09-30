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

/**
 * Το προσωπικό link πρόσβασης στο Portal Αρχηγού, μετά την εγγραφή ομάδας.
 * Αν ο υπεύθυνος έχει και άλλες ομάδες, το ίδιο link τις δείχνει όλες.
 */
export async function sendCaptainAccessEmail(
  email: string,
  captainFirstName: string,
  teamName: string,
  link: string
): Promise<boolean> {
  const html = emailWrapper(`
    <p>Αγαπητέ/ή <b>${escapeHtml(captainFirstName)}</b>,</p>
    <p>Η εγγραφή της ομάδας <b>${escapeHtml(teamName)}</b> καταχωρήθηκε με επιτυχία.</p>
    <p>Το προσωπικό σας link πρόσβασης στο Portal Αρχηγού:</p>
    <p><a href="${link}" style="color:#0f2540;font-weight:bold">${link}</a></p>
    <p style="font-size:0.9em;color:#666">
      Ανοίξτε το μία φορά σε κάθε συσκευή που θέλετε να χρησιμοποιήσετε. Είναι προσωπικό —
      παρακαλούμε μην το προωθήσετε σε τρίτους. Μέσα από αυτό μπορείτε να διαχειρίζεστε τη
      σύνθεση της ομάδας σας μέχρι την προθεσμία εγγραφών.
    </p>
  `);
  const text =
    `Η εγγραφή της ομάδας ${teamName} καταχωρήθηκε με επιτυχία.\n\n` +
    `Το προσωπικό σας link πρόσβασης: ${link}\n\n` +
    `Ανοίξτε το μία φορά σε κάθε συσκευή. Είναι προσωπικό — μην το προωθήσετε σε τρίτους.`;
  return sendEmail(email, `Επιβεβαίωση Εγγραφής — ${teamName}`, html, text);
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
