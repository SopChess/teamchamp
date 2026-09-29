import { createClient } from "@/lib/supabase/server";
import { saveRosterRules, saveScoringRules, updateCompetition } from "../actions";
import { AUDIENCE_LABELS } from "@/lib/teams/teams";
import RosterRulesBuilder from "../RosterRulesBuilder";
import { TIEBREAK_LABELS, DEFAULT_TIEBREAKS } from "@/lib/standings/standings";
import type { RosterRules } from "@/lib/rosterRules/types";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CompetitionPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name, format, rounds_count, starts_on, ends_on, venue, audience_type, max_teams_per_club")
    .eq("id", params.id)
    .single();

  const { data: rosterRules } = await supabase
    .from("roster_rules")
    .select("*")
    .eq("competition_id", params.id)
    .maybeSingle<RosterRules & { competition_id: string }>();

  const { data: scoring } = await supabase
    .from("scoring_rules")
    .select("*")
    .eq("competition_id", params.id)
    .maybeSingle();

  const boundSave = saveRosterRules.bind(null, params.id);
  const boundScoring = saveScoringRules.bind(null, params.id);
  const boundUpdateCompetition = updateCompetition.bind(null, params.id);
  const savedTiebreaks: string[] =
    scoring?.tiebreak_criteria && scoring.tiebreak_criteria.length > 0
      ? scoring.tiebreak_criteria
      : DEFAULT_TIEBREAKS;

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <div className="font-serif font-bold text-gold tracking-wide text-sm mb-1">TEAM ALMA</div>
        <h1 className="font-serif font-bold text-2xl">{competition?.name ?? "Διοργάνωση"}</h1>
        <div className="flex gap-4 mt-2 flex-wrap">
          <Link href={`/admin/${params.id}/teams`} className="text-xs text-gold underline">
            Ομάδες →
          </Link>
          <Link href={`/admin/${params.id}/meetings`} className="text-xs text-gold underline">
            Συναντήσεις &amp; QR →
          </Link>
          <Link href={`/admin/${params.id}/rounds`} className="text-xs text-gold underline">
            Γύροι &amp; Αντιστοίχιση →
          </Link>
          <Link href="/admin/clubs" className="text-xs text-gold underline">
            Σύλλογοι/Σχολεία →
          </Link>
        </div>
      </div>

      <form action={boundUpdateCompetition} className="flex flex-col gap-4 bg-card border border-cardBorder rounded-xl p-5">
        <div className="text-xs uppercase tracking-wide text-muted">Στοιχεία Διοργάνωσης</div>
        <label className="flex flex-col gap-1 text-sm">
          Όνομα
          <input
            name="name"
            required
            defaultValue={competition?.name ?? ""}
            className="bg-panel border border-cardBorder rounded-lg px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Χώρος αγώνων
          <input
            name="venue"
            defaultValue={competition?.venue ?? ""}
            className="bg-panel border border-cardBorder rounded-lg px-3 py-2"
          />
        </label>
        <div className="flex gap-3">
          <label className="flex flex-col gap-1 text-sm flex-1">
            Έναρξη
            <input name="starts_on" type="date" defaultValue={competition?.starts_on ?? ""} className="bg-panel border border-cardBorder rounded-lg px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm flex-1">
            Λήξη
            <input name="ends_on" type="date" defaultValue={competition?.ends_on ?? ""} className="bg-panel border border-cardBorder rounded-lg px-3 py-2" />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Σε ποιους απευθύνεται
          <select
            name="audience_type"
            defaultValue={competition?.audience_type ?? "eso_club"}
            className="bg-panel border border-cardBorder rounded-lg px-3 py-2"
          >
            {(Object.entries(AUDIENCE_LABELS) as [string, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <span className="text-xs text-muted">
            Αλλαγή εδώ δεν επηρεάζει ομάδες που έχουν ήδη δηλωθεί.
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Μέγιστες ομάδες ανά σύλλογο (μόνο για «Ομάδες μέλη ΕΣΟ»)
          <input
            name="max_teams_per_club"
            type="number"
            min={1}
            defaultValue={competition?.max_teams_per_club ?? 1}
            className="bg-panel border border-cardBorder rounded-lg px-3 py-2"
          />
        </label>
        <button type="submit" className="bg-panel border border-cardBorder rounded-lg py-2.5 text-sm">
          Αποθήκευση Στοιχείων
        </button>
      </form>

      <form action={boundSave} className="flex flex-col gap-4 bg-card border border-cardBorder rounded-xl p-5">
        <div className="text-xs uppercase tracking-wide text-muted">Κανόνες Σύνθεσης</div>

        <label className="flex flex-col gap-1 text-sm">
          Τρόπος ανάθεσης σκακιέρας
          <select
            name="assignment_mode"
            defaultValue={rosterRules?.assignment_mode ?? "strength_order"}
            className="bg-panel border border-cardBorder rounded-lg px-3 py-2"
          >
            <option value="strength_order">strength_order — δηλωμένη σειρά με εξαιρέσεις</option>
            <option value="fixed_category">fixed_category — σταθερή κατηγορία ανά board</option>
          </select>
        </label>

        <div className="flex gap-3">
          <label className="flex flex-col gap-1 text-sm flex-1">
            Αριθμός αθλητών Βασικής Σύνθεσης
            <input
              name="roster_size"
              type="number"
              defaultValue={rosterRules?.roster_size ?? ""}
              placeholder="π.χ. 6 (κενό = απεριόριστο)"
              className="bg-panel border border-cardBorder rounded-lg px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm flex-1">
            Σκακιέρες ανά αγώνα
            <input
              name="match_board_count"
              type="number"
              defaultValue={rosterRules?.match_board_count ?? ""}
              placeholder="π.χ. 4"
              className="bg-panel border border-cardBorder rounded-lg px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm flex-1">
            Αναπληρωματικοί
            <input
              name="reserve_count"
              type="number"
              defaultValue={rosterRules?.reserve_count ?? ""}
              className="bg-panel border border-cardBorder rounded-lg px-3 py-2"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="one_player_per_category"
            defaultChecked={rosterRules?.one_player_per_category}
          />
          Ένας παίκτης ανά κατηγορία (fixed_category)
        </label>

        <RosterRulesBuilder initial={rosterRules?.board_rules ?? []} />

        <button type="submit" className="bg-gold text-bg font-semibold rounded-lg py-2.5 text-sm">
          Αποθήκευση Κανόνων Σύνθεσης
        </button>
      </form>

      <form action={boundScoring} className="flex flex-col gap-4 bg-card border border-cardBorder rounded-xl p-5">
        <div className="text-xs uppercase tracking-wide text-muted">Βαθμολογία &amp; Ισοβαθμία</div>

        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Νίκη (βαθμοί)
            <input name="win_points" defaultValue={scoring?.win_points ?? 2} className="bg-panel border border-cardBorder rounded-lg px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Ισοπαλία
            <input name="draw_points" defaultValue={scoring?.draw_points ?? 1} className="bg-panel border border-cardBorder rounded-lg px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Ήττα
            <input name="loss_points" defaultValue={scoring?.loss_points ?? 0} className="bg-panel border border-cardBorder rounded-lg px-3 py-2" />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Ποινή ήττας χωρίς αγώνα (βαθμοί που αφαιρούνται, 0 = καμία)
          <input name="forfeit_loss_penalty" defaultValue={scoring?.forfeit_loss_penalty ?? 0} className="bg-panel border border-cardBorder rounded-lg px-3 py-2" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            BYE: βαθμοί συνάντησης
            <input name="bye_match_points" defaultValue={scoring?.bye_match_points ?? 2} className="bg-panel border border-cardBorder rounded-lg px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            BYE: πόντοι σκακιερών (κενό = μισοί)
            <input name="bye_board_points" defaultValue={scoring?.bye_board_points ?? ""} className="bg-panel border border-cardBorder rounded-lg px-3 py-2" />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-sm">Κριτήρια ισοβαθμίας (με σειρά προτεραιότητας)</div>
          {[0, 1, 2].map((i) => (
            <select
              key={i}
              name={`tiebreak_${i + 1}`}
              defaultValue={savedTiebreaks[i] ?? ""}
              className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
            >
              <option value="">— {i + 1}ο κριτήριο: κανένα —</option>
              {Object.entries(TIEBREAK_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          ))}
          <p className="text-xs text-muted">
            Η ζωντανή κατάταξη που βλέπουν οι θεατές χρησιμοποιεί αυτές τις ρυθμίσεις. Η επίσημη
            κατάταξη βγαίνει από το Swiss-Manager.
          </p>
        </div>

        <button type="submit" className="bg-gold text-bg font-semibold rounded-lg py-2.5 text-sm">
          Αποθήκευση Βαθμολογίας
        </button>
      </form>
    </div>
  );
}
