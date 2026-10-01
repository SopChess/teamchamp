import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { registerTeam } from "./actions";
import { searchDirectoryForRegistration, searchDirectoryByNumberForRegistration } from "./directorySearch";
import { registrationStatus } from "@/lib/competitions/registration";
import { AUDIENCE_FIELD_LABEL, AUDIENCE_FIELD_EXAMPLE, requiresEsoCode, type AudienceType } from "@/lib/teams/teams";
import SavableForm from "@/components/SavableForm";
import AthletePicker from "./AthletePicker";
import type { RosterRules } from "@/lib/rosterRules/types";

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
  const needsEsoCode = requiresEsoCode(audienceType);

  const { data: rules } = await supabase
    .from("roster_rules")
    .select("assignment_mode, roster_size, match_board_count, board_rules, reserve_count, one_player_per_category")
    .eq("competition_id", params.id)
    .maybeSingle<RosterRules>();

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
          successMessage="Η εγγραφή καταχωρήθηκε — μεταφορά στο Team Portal σας..."
          className="flex flex-col gap-4"
        >
          <div className="bg-card border border-cardBorder rounded-xl p-4 flex flex-col gap-3 transition-colors hover:border-gold/40">
            <div className="text-xs uppercase tracking-wide text-muted">{fieldLabel}</div>
            <input
              name="new_team_name"
              required
              placeholder={fieldExample}
              className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm uppercase"
            />
            {needsEsoCode && (
              <input
                name="eso_code"
                required
                placeholder="Κωδικός ΕΣΟ του συλλόγου"
                className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
              />
            )}
            <p className="text-xs text-muted">
              Αν ο σύλλογος/σχολείο έχει ήδη καταχωρηθεί με το ίδιο ακριβώς όνομα, θα αναγνωριστεί
              αυτόματα — δεν χρειάζεται να ελέγξετε εσείς αν υπάρχει ήδη.
            </p>
          </div>

          <div className="bg-card border border-cardBorder rounded-xl p-4 flex flex-col gap-3 transition-colors hover:border-gold/40">
            <div className="text-xs uppercase tracking-wide text-muted">Στοιχεία Υπευθύνου</div>
            <div className="flex gap-2">
              <input name="first_name" required placeholder="Όνομα" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1 min-w-0 uppercase" />
              <input name="last_name" required placeholder="Επώνυμο" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1 min-w-0 uppercase" />
            </div>
            <input name="phone" required placeholder="Τηλέφωνο" type="tel" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm" />
            <input name="email" required placeholder="Email" type="email" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm" />
            <p className="text-xs text-muted">
              Αν είστε ήδη υπεύθυνος άλλης ομάδας με το ίδιο email και τηλέφωνο, θα βλέπετε όλες τις
              ομάδες σας από το ίδιο Team Portal.
            </p>
          </div>

          <div className="bg-card border border-cardBorder rounded-xl p-4 flex flex-col gap-3 transition-colors hover:border-gold/40">
            <div className="text-xs uppercase tracking-wide text-muted">Αθλητές</div>
            <AthletePicker
              search={searchDirectoryForRegistration}
              searchByNumber={searchDirectoryByNumberForRegistration}
              rules={rules ?? null}
            />
          </div>

          <button type="submit" className="bg-gold text-bg font-semibold rounded-xl py-3 text-sm">
            Ολοκλήρωση Εγγραφής
          </button>

          <p className="text-xs text-muted">
            Θα λάβετε email με τα στοιχεία της διοργάνωσης και σύνδεσμο προς το Team Portal σας.
            Μπορείτε να επεξεργάζεστε την ομάδα σας μέχρι την προθεσμία εγγραφών.
          </p>
        </SavableForm>
      )}

      <p className="text-xs text-muted text-center">
        Έχετε ήδη εγγράψει ομάδα και χάσατε το link;{" "}
        <Link href="/captain/recover" className="text-gold underline">
          Ανάκτηση link
        </Link>
      </p>
    </div>
  );
}
