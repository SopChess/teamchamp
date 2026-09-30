import { randomBytes } from "crypto";
import { emailKey, phoneKey } from "./identity";

/**
 * Βρίσκει τον λογαριασμό υπευθύνου με το ίδιο email+τηλέφωνο, ή δημιουργεί
 * νέο. Ασφαλές σε ταυτόχρονες κλήσεις (π.χ. δύο εγγραφές την ίδια στιγμή από
 * το ίδιο πρόσωπο): αν η εισαγωγή συγκρουστεί με τον μοναδικό περιορισμό
 * (email_key, phone_key), ξαναδιαβάζει την ήδη υπάρχουσα γραμμή αντί να
 * αποτύχει — το ίδιο μοτίβο με τα team_name_aliases.
 */
export async function findOrCreateCaptainAccount(
  db: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  email: string,
  phone: string
): Promise<{ id: string; access_token: string }> {
  const ek = emailKey(email);
  const pk = phoneKey(phone);

  const { data: existing } = await db
    .from("captain_accounts")
    .select("id, access_token")
    .eq("email_key", ek)
    .eq("phone_key", pk)
    .maybeSingle();
  if (existing) return existing;

  const token = randomBytes(16).toString("hex");
  const { data: created, error } = await db
    .from("captain_accounts")
    .insert({ email: email.trim(), phone: phone.trim(), email_key: ek, phone_key: pk, access_token: token })
    .select("id, access_token")
    .single();

  if (!error) return created;
  if (error.code !== "23505") throw new Error(`Αποτυχία δημιουργίας λογαριασμού: ${error.message}`);

  // Κάποιος άλλος το δημιούργησε ανάμεσα στον έλεγχο και την εισαγωγή — το διαβάζουμε.
  const { data: retry } = await db
    .from("captain_accounts")
    .select("id, access_token")
    .eq("email_key", ek)
    .eq("phone_key", pk)
    .single();
  if (!retry) throw new Error("Αποτυχία δημιουργίας λογαριασμού.");
  return retry;
}
