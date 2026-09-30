import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { registerTeam } from "./actions";
import { registrationStatus } from "@/lib/competitions/registration";
import {
  allowsFreeEntry, clubTypeFor, AUDIENCE_FIELD_LABEL, AUDIENCE_FIELD_EXAMPLE, type AudienceType,
} from "@/lib/teams/teams";
import SavableForm from "@/components/SavableForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RegisterPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name, audience_type, registration_deadline")
    .eq("id", params.id)
    .maybeSingle();
  if (!competition) notFound();

  const status = registrationStatus(competition.registration_deadline);
  const audienceType = (competition.audience_type as AudienceType) ?? "eso_club";
  const fieldLabel = AUDIENCE_FIELD_LABEL[audienceType];
  const fieldExample = AUDIENCE_FIELD_EXAMPLE[audienceType];
  const freeEntry = allowsFreeEntry(audienceType);

  const { data: clubs } = await supabase
    .from("clubs_schools")
    .select("id, name")
    .eq("type", clubTypeFor(audienceType))
    .order("name");

  const boundRegister = registerTeam.bind(null, params.id);

  return (
    <div className="min-h-screen px-6 py-12 max-w-md mx-auto flex flex-col gap-8">
      <div>
        <Link href={`/championships/${params.id}`} className="text-xs text-muted hover:text-gold">
          ← {competition.name}
        </Link>
        <h1 className="font-serif font-bold text-2xl mt-2">Εγγραφή Ομάδας</h1>
      </div>

      {status === "closed" ? (
        <div className="bg-card border border-red-400/40 rounded-xl p-4 text-sm">
          Οι εγγραφές για αυτή τη διοργάνωση έχουν κλείσει.
        </div>
      ) : (
        <SavableForm
          action={boundRegister}
          successMessage="Η εγγραφή καταχωρήθηκε — μεταφορά στο Portal σας..."
          className="flex flex-col gap-4"
        >
          <div className="bg-card border border-cardBorder rounded-xl p-4 flex flex-col gap-3">
            <div className="text-xs uppercase tracking-wide text-muted">{fieldLabel}</div>
            <select
              name="club_or_school_id"
              required={!freeEntry}
              className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
            >
              <option value="">— Επιλέξτε {fieldLabel.toLowerCase()} —</option>
              {(clubs ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {freeEntry && (
              <label className="flex flex-col gap-1 text-sm">
                ή νέα {fieldLabel.toLowerCase()}
                <input
                  name="new_team_name"
                  placeholder={fieldExample}
                  className="bg-panel border border-cardBorder rounded-lg px-3 py-2 uppercase"
                />
              </label>
            )}
          </div>

          <div className="bg-card border border-cardBorder rounded-xl p-4 flex flex-col gap-3">
            <div className="text-xs uppercase tracking-wide text-muted">Στοιχεία Υπευθύνου</div>
            <div className="flex gap-2">
              <input
                name="first_name" required placeholder="Όνομα (λατινικά)"
                className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1"
              />
              <input
                name="last_name" required placeholder="Επώνυμο (λατινικά)"
                className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1"
              />
            </div>
            <input
              name="phone" required placeholder="Τηλέφωνο" type="tel"
              className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
            />
            <input
              name="email" required placeholder="Email" type="email"
              className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted">
              Αν είστε ήδη υπεύθυνος άλλης ομάδας με το ίδιο email και τηλέφωνο, θα βλέπετε όλες τις
              ομάδες σας από το ίδιο link.
            </p>
          </div>

          <button type="submit" className="bg-gold text-bg font-semibold rounded-xl py-3 text-sm">
            Εγγραφή
          </button>

          <p className="text-xs text-muted">
            Μετά την εγγραφή θα μεταφερθείτε αμέσως στο προσωπικό σας Portal για να προσθέσετε τους
            αθλητές της ομάδας. Θα λάβετε και email με το link, για μελλοντική πρόσβαση. Μπορείτε να
            επεξεργάζεστε την ομάδα σας μέχρι την προθεσμία εγγραφών.
          </p>
        </SavableForm>
      )}
    </div>
  );
}
