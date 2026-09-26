import { createClient } from "@/lib/supabase/server";
import { saveRosterRules } from "../actions";
import type { RosterRules } from "@/lib/rosterRules/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CompetitionPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name, format, rounds_count")
    .eq("id", params.id)
    .single();

  const { data: rosterRules } = await supabase
    .from("roster_rules")
    .select("*")
    .eq("competition_id", params.id)
    .maybeSingle<RosterRules & { competition_id: string }>();

  const boundSave = saveRosterRules.bind(null, params.id);

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <div className="font-serif font-bold text-gold tracking-wide text-sm mb-1">TEAM ALMA</div>
        <h1 className="font-serif font-bold text-2xl">{competition?.name ?? "Διοργάνωση"}</h1>
      </div>

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
            Μέγεθος ρόστερ
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

        <label className="flex flex-col gap-1 text-sm">
          board_rules (JSON — προσωρινή επεξεργασία· dynamic builder έρχεται σε επόμενο πέρασμα)
          <textarea
            name="board_rules_json"
            rows={10}
            defaultValue={JSON.stringify(rosterRules?.board_rules ?? [], null, 2)}
            className="bg-panel border border-cardBorder rounded-lg px-3 py-2 font-mono text-xs"
          />
        </label>

        <button type="submit" className="bg-gold text-bg font-semibold rounded-lg py-2.5 text-sm">
          Αποθήκευση Κανόνων Σύνθεσης
        </button>
      </form>
    </div>
  );
}
