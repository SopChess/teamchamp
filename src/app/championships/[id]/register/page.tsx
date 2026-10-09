import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { registerTeam } from "./actions";
import { searchDirectoryForRegistration, searchDirectoryByNumberForRegistration } from "./directorySearch";
import { isRegistrationOpen, type TournamentStatus } from "@/lib/competitions/tournamentStatus";
import { AUDIENCE_FIELD_LABEL, AUDIENCE_FIELD_EXAMPLE, requiresEsoCode, type AudienceType } from "@/lib/teams/teams";
import BackHome from "@/components/BackHome";
import RegisterWizard from "./RegisterWizard";
import { referenceYearOf } from "@/lib/rosterRules/boardNotation";
import type { RosterRules } from "@/lib/rosterRules/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RegisterPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name, audience_type, registration_deadline, status, starts_on")
    .eq("id", params.id)
    .maybeSingle();
  if (!competition) notFound();

  const open = isRegistrationOpen((competition.status ?? "open") as TournamentStatus, competition.registration_deadline);
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
        <BackHome className="mb-1.5" />
        <Link href={`/championships/${params.id}`} className="text-xs text-muted hover:text-gold">
          {competition.name}
        </Link>
        <h1 className="font-serif font-bold text-2xl mt-2">Εγγραφή Ομάδας</h1>
      </div>

      {!open ? (
        <div className="bg-card border border-red-400/40 rounded-xl p-4 text-sm">
          Οι εγγραφές για αυτή τη διοργάνωση έχουν κλείσει.
        </div>
      ) : (
        <RegisterWizard
          action={boundRegister}
          fieldLabel={fieldLabel}
          fieldExample={fieldExample}
          needsEsoCode={needsEsoCode}
          search={searchDirectoryForRegistration}
          searchByNumber={searchDirectoryByNumberForRegistration}
          rules={rules ?? null}
          referenceYear={referenceYearOf(competition.starts_on)}
        />
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
