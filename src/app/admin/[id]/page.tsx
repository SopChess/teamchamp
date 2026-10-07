import { createClient } from "@/lib/supabase/server";
import { saveRosterRules, saveScoringRules, updateCompetition } from "../actions";
import { AUDIENCE_LABELS } from "@/lib/teams/teams";
import { TOURNAMENT_STATUS_LABEL } from "@/lib/competitions/tournamentStatus";
import { TOURNAMENT_CATEGORIES, CATEGORY_LABEL } from "@/lib/competitions/category";
import { TOURNAMENT_FORMATS, FORMAT_LABEL } from "@/lib/competitions/format";
import RosterRulesBuilder from "../RosterRulesBuilder";
import { TIEBREAK_LABELS, DEFAULT_TIEBREAKS } from "@/lib/standings/standings";
import type { RosterRules } from "@/lib/rosterRules/types";
import Link from "next/link";
import SavableForm from "@/components/SavableForm";
import TabsShell, { type CaptainTab } from "@/app/captain/[token]/TabsShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CompetitionPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name, format, rounds_count, starts_on, ends_on, venue, audience_type, max_teams_per_club, announcement_url, venue_maps_url, chess_results_url, time_control, registration_deadline, roster_submission_deadline, entry_fee_amount, entry_fee_note, entry_fee_deadline, status, requires_certificate, organizer, category, season, team_count")
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

  const detailsTabContent = (
    <SavableForm action={boundUpdateCompetition} successMessage="Τα στοιχεία αποθηκεύτηκαν." className="flex flex-col gap-4 bg-card border border-cardBorder rounded-xl p-5">
      <label className="flex flex-col gap-1 text-sm text-muted">
        Όνομα
        <input
          name="name"
          required
          defaultValue={competition?.name ?? ""}
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Διοργανώτρια αρχή
        <input
          name="organizer"
          defaultValue={competition?.organizer ?? ""}
          placeholder="π.χ. Σκακιστικός Όμιλος Πολίχνης"
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Αγωνιστική περίοδος
        <input
          name="season"
          defaultValue={competition?.season ?? ""}
          placeholder="π.χ. 2026-2027"
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Κατηγορία διοργάνωσης
        <select
          name="category"
          defaultValue={competition?.category ?? "other"}
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
        >
          {TOURNAMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
          ))}
        </select>
      </label>
      <div className="flex gap-3">
        <label className="flex flex-col gap-1 text-sm flex-1 text-muted">
          Σύστημα αγώνων
          <select
            name="format"
            defaultValue={competition?.format ?? "swiss"}
            className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
          >
            {TOURNAMENT_FORMATS.map((f) => (
              <option key={f} value={f}>{FORMAT_LABEL[f]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Γύροι
          <input
            name="rounds_count"
            type="number"
            defaultValue={competition?.rounds_count ?? ""}
            className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Αριθμός σκακιερών ανά συνάντηση
        <input
          name="match_board_count"
          type="number"
          min={1}
          defaultValue={rosterRules?.match_board_count ?? ""}
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
        />
        <span className="text-xs text-muted">Το ίδιο πεδίο με τους Κανόνες Σύνθεσης παρακάτω.</span>
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Κατάσταση
        <select
          name="status"
          defaultValue={competition?.status ?? "open"}
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
        >
          {(Object.entries(TOURNAMENT_STATUS_LABEL) as [string, string][]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <span className="text-xs text-muted">
          «Ανοιχτές Εγγραφές» κλείνει αυτόματα μόλις περάσει η προθεσμία εγγραφών. Τις υπόλοιπες
          καταστάσεις τις ορίζετε εσείς χειροκίνητα — για να ξανανοίξετε τις εγγραφές μετά τη λήξη
          της προθεσμίας, δώστε και νέα (μελλοντική) προθεσμία παρακάτω.
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Χώρος αγώνων
        <input
          name="venue"
          defaultValue={competition?.venue ?? ""}
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
        />
      </label>
      <div className="flex gap-3">
        <label className="flex flex-col gap-1 text-sm flex-1 text-muted">
          Έναρξη
          <input name="starts_on" type="date" defaultValue={competition?.starts_on ?? ""} className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 text-muted">
          Λήξη
          <input name="ends_on" type="date" defaultValue={competition?.ends_on ?? ""} className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2" />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Σε ποιους απευθύνεται
        <select
          name="audience_type"
          defaultValue={competition?.audience_type ?? "eso_club"}
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
        >
          {(Object.entries(AUDIENCE_LABELS) as [string, string][]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <span className="text-xs text-muted">
          Αλλαγή εδώ δεν επηρεάζει ομάδες που έχουν ήδη δηλωθεί.
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Αριθμός ομάδων (αναμενόμενος/μέγιστος για όλη τη διοργάνωση)
        <input
          name="team_count"
          type="number"
          min={1}
          defaultValue={competition?.team_count ?? ""}
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
        />
      </label>
      {/* Μόνο για "Ομάδες μέλη ΕΣΟ" — επιβεβαιωμένο: δεν έχει νόημα για ελεύθερη επωνυμία,
          οπότε δεν εμφανίζεται καν αντί να φαίνεται πάντα χωρίς να εφαρμόζεται. */}
      {(competition?.audience_type ?? "eso_club") === "eso_club" && (
        <label className="flex flex-col gap-1 text-sm text-muted">
          Μέγιστες ομάδες ανά σύλλογο
          <input
            name="max_teams_per_club"
            type="number"
            min={1}
            defaultValue={competition?.max_teams_per_club ?? 1}
            className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
          />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm text-muted">
        Προκήρυξη (link, π.χ. Google Drive)
        <input
          name="announcement_url"
          type="url"
          defaultValue={competition?.announcement_url ?? ""}
          placeholder="https://drive.google.com/..."
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Χώρος αγώνων — link Google Maps
        <input
          name="venue_maps_url"
          type="url"
          defaultValue={competition?.venue_maps_url ?? ""}
          placeholder="https://maps.app.goo.gl/..."
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Link αποτελεσμάτων (chess-results.com)
        <input
          name="chess_results_url"
          type="url"
          defaultValue={competition?.chess_results_url ?? ""}
          placeholder="https://chess-results.com/tnr..."
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
        />
        <span className="text-xs text-muted">Προαιρετικό — εμφανίζεται στη δημόσια σελίδα του τουρνουά, αν δοθεί.</span>
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Χρόνος σκέψης
        <input
          name="time_control"
          defaultValue={competition?.time_control ?? ""}
          placeholder="π.χ. 15΄+10΄΄/κίνηση"
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Προθεσμία εγγραφών
        <input
          name="registration_deadline"
          type="datetime-local"
          defaultValue={competition?.registration_deadline ? new Date(competition.registration_deadline).toISOString().slice(0, 16) : ""}
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Προθεσμία κατάθεσης βασικών συνθέσεων
        <input
          name="roster_submission_deadline"
          type="datetime-local"
          defaultValue={
            competition?.roster_submission_deadline
              ? new Date(competition.roster_submission_deadline).toISOString().slice(0, 16)
              : ""
          }
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
        />
        <span className="text-xs text-muted">
          Προαιρετική — αν μείνει κενή, η σύνθεση κλειδώνει με την προθεσμία εγγραφών, όπως πάντα.
        </span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="requires_certificate" defaultChecked={competition?.requires_certificate ?? true} />
        Απαιτείται βεβαίωση φοίτησης
      </label>
      <div className="flex gap-3">
        <label className="flex flex-col gap-1 text-sm flex-1 text-muted">
          Παράβολο συμμετοχής (€)
          <input
            name="entry_fee_amount"
            type="number"
            step="0.01"
            min={0}
            defaultValue={competition?.entry_fee_amount ?? ""}
            placeholder="κενό = χωρίς παράβολο"
            className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 text-muted">
          Σημείωση παραβόλου
          <input
            name="entry_fee_note"
            defaultValue={competition?.entry_fee_note ?? ""}
            placeholder="π.χ. ανά αθλητή"
            className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Προθεσμία πληρωμής παραβόλου
        <input
          name="entry_fee_deadline"
          type="datetime-local"
          defaultValue={competition?.entry_fee_deadline ? new Date(competition.entry_fee_deadline).toISOString().slice(0, 16) : ""}
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
        />
        <span className="text-xs text-muted">Προαιρετική, ξεχωριστή από την προθεσμία εγγραφών — κενή αν δεν χρειάζεται.</span>
      </label>
      <p className="text-xs text-muted -mt-1">
        Βεβαίωση και παράβολο ρυθμίζονται ανεξάρτητα — αν καμία από τις δύο δεν χρειάζεται, το
        αντίστοιχο tab δεν εμφανίζεται καθόλου στο Portal Αρχηγού.
      </p>
      <button type="submit" className="bg-panel border border-cardBorder rounded-lg py-2.5 text-sm">
        Αποθήκευση Στοιχείων
      </button>
    </SavableForm>
  );

  const rulesTabContent = (
    <SavableForm action={boundSave} successMessage="Οι κανόνες σύνθεσης αποθηκεύτηκαν." className="flex flex-col gap-4 bg-card border border-cardBorder rounded-xl p-5">
      <label className="flex flex-col gap-1 text-sm text-muted">
        Τρόπος ανάθεσης σκακιέρας
        <select
          name="assignment_mode"
          defaultValue={rosterRules?.assignment_mode ?? "strength_order"}
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
        >
          <option value="strength_order">strength_order — δηλωμένη σειρά με εξαιρέσεις</option>
          <option value="fixed_category">fixed_category — σταθερή κατηγορία ανά board</option>
        </select>
      </label>

      <div className="flex gap-3">
        <label className="flex flex-col gap-1 text-sm flex-1 text-muted">
          Αριθμός αθλητών Βασικής Σύνθεσης
          <input
            name="roster_size"
            type="number"
            defaultValue={rosterRules?.roster_size ?? ""}
            placeholder="π.χ. 6 (κενό = απεριόριστο)"
            className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 text-muted">
          Σκακιέρες ανά αγώνα
          <input
            name="match_board_count"
            type="number"
            defaultValue={rosterRules?.match_board_count ?? ""}
            placeholder="π.χ. 4"
            className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 text-muted">
          Αναπληρωματικοί
          <input
            name="reserve_count"
            type="number"
            defaultValue={rosterRules?.reserve_count ?? ""}
            className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2"
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
    </SavableForm>
  );

  const scoringTabContent = (
    <SavableForm action={boundScoring} successMessage="Η βαθμολογία αποθηκεύτηκε." className="flex flex-col gap-4 bg-card border border-cardBorder rounded-xl p-5">
      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-sm text-muted">
          Νίκη (βαθμοί)
          <input name="win_points" defaultValue={scoring?.win_points ?? 2} className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Ισοπαλία
          <input name="draw_points" defaultValue={scoring?.draw_points ?? 1} className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Ήττα
          <input name="loss_points" defaultValue={scoring?.loss_points ?? 0} className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm text-muted">
        Ποινή ήττας χωρίς αγώνα (βαθμοί που αφαιρούνται, 0 = καμία)
        <input name="forfeit_loss_penalty" defaultValue={scoring?.forfeit_loss_penalty ?? 0} className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-muted">
          BYE: βαθμοί συνάντησης
          <input name="bye_match_points" defaultValue={scoring?.bye_match_points ?? 2} className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          BYE: πόντοι σκακιερών (κενό = μισοί)
          <input name="bye_board_points" defaultValue={scoring?.bye_board_points ?? ""} className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2" />
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
    </SavableForm>
  );

  const tabs: CaptainTab[] = [
    { id: "details", label: "Στοιχεία", content: detailsTabContent },
    { id: "rules", label: "Κανόνες Σύνθεσης", content: rulesTabContent },
    { id: "scoring", label: "Βαθμολογία", content: scoringTabContent },
  ];

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="font-serif font-bold text-2xl">{competition?.name ?? "Διοργάνωση"}</h1>
        <div className="flex gap-4 mt-2 flex-wrap">
          <Link href={`/admin/${params.id}/teams`} className="text-xs text-gold underline">
            Ομάδες
          </Link>
          <Link href={`/admin/${params.id}/meetings`} className="text-xs text-gold underline">
            Συναντήσεις &amp; QR
          </Link>
          <Link href={`/admin/${params.id}/rounds`} className="text-xs text-gold underline">
            Γύροι &amp; Αντιστοίχιση
          </Link>
          <Link href="/admin/clubs" className="text-xs text-gold underline">
            Σύλλογοι/Σχολεία
          </Link>
        </div>
      </div>

      <TabsShell tabs={tabs} />
    </div>
  );
}
