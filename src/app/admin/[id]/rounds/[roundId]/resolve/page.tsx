import { createClient } from "@/lib/supabase/server";
import { resolveTeamMapping } from "../../actions";
import { normalizeTeamName, type ParsedPairing } from "@/lib/swissImport/parsePairings";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ClubRef = { name: string } | { name: string }[] | null;
function clubName(raw: ClubRef): string {
  const club = Array.isArray(raw) ? raw[0] : raw;
  return club?.name ?? "Ομάδα";
}

export default async function ResolveMappingPage({
  params,
}: {
  params: { id: string; roundId: string };
}) {
  const supabase = createClient();

  const { data: staging } = await supabase
    .from("round_import_staging")
    .select("raw_pairings")
    .eq("round_id", params.roundId)
    .maybeSingle<{ raw_pairings: ParsedPairing[] }>();

  if (!staging) {
    notFound();
  }

  const { data: teams } = await supabase
    .from("teams")
    .select("id, clubs_schools(name)")
    .eq("competition_id", params.id);

  const { data: aliases } = await supabase
    .from("team_name_aliases")
    .select("excel_name")
    .eq("competition_id", params.id);

  const knownNames = new Set<string>();
  for (const t of teams ?? []) knownNames.add(normalizeTeamName(clubName(t.clubs_schools as ClubRef)));
  for (const a of aliases ?? []) knownNames.add(a.excel_name);

  const unresolved: string[] = [];
  const seen = new Set<string>();
  for (const p of staging.raw_pairings) {
    for (const name of [p.teamAName, p.teamBName]) {
      if (!name) continue;
      const normalized = normalizeTeamName(name);
      if (!knownNames.has(normalized) && !seen.has(normalized)) {
        seen.add(normalized);
        unresolved.push(name);
      }
    }
  }

  const boundResolve = resolveTeamMapping.bind(null, params.id, params.roundId);

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <Link href={`/admin/${params.id}/rounds`} className="text-xs text-muted hover:text-gold">
          ← Γύροι &amp; Κλήρωση
        </Link>
        <h1 className="font-serif font-bold text-2xl mt-2">Επίλυση Αντιστοιχίας</h1>
        <p className="text-xs text-muted mt-1">
          Αυτά τα ονόματα από το αρχείο Excel δεν ταιριάζουν αυτόματα με καμία δηλωμένη ομάδα.
          Διάλεξε τη σωστή ομάδα για το καθένα — η αντιστοίχιση αποθηκεύεται μόνιμα και δεν θα
          ξαναρωτηθεί σε επόμενο γύρο αυτής της διοργάνωσης.
        </p>
      </div>

      {unresolved.length === 0 ? (
        <p className="text-sm text-good">Όλα τα ονόματα έχουν πλέον αντιστοιχία — δεν μένει τίποτα εδώ.</p>
      ) : (
        <form action={boundResolve} className="flex flex-col gap-4">
          {unresolved.map((name, i) => (
            <div key={name} className="bg-card border border-cardBorder rounded-xl p-4 flex flex-col gap-2">
              <input type="hidden" name={`names[${i}]`} value={name} />
              <div className="text-sm font-semibold">{name}</div>
              <select
                name={`teams[${i}]`}
                required
                className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— Επίλεξε ομάδα —</option>
                {(teams ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {clubName(t.clubs_schools as ClubRef)}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <button type="submit" className="bg-gold text-bg font-semibold rounded-lg py-2.5 text-sm">
            Αποθήκευση Αντιστοιχίας &amp; Ολοκλήρωση Εισαγωγής
          </button>
        </form>
      )}
    </div>
  );
}
