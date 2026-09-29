import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import {
  addPlayerToRoster,
  removeRosterEntry,
  moveRosterEntry,
  saveCaptainInfo,
  confirmRoster,
  submitRoundComposition,
  searchDirectory,
  searchDirectoryByNumber,
  addDirectoryPlayerToRoster,
  uploadAttendanceCertificate,
  setEntryFeeMethod,
  getCertificateUrl,
} from "./actions";
import { ENTRY_FEE_STATUS_LABEL, isEntryFeeStatus } from "@/lib/attendance/attendance";
import type { RosterRules } from "@/lib/rosterRules/types";
import { computeDefaultAssignment } from "@/lib/rosterRules/engine";
import { loadCaptainRound, loadRoster, loadRules } from "@/lib/rounds/server";
import CompositionForm from "./CompositionForm";
import PlayerSearch from "./PlayerSearch";
import Countdown from "./Countdown";
import SavableForm from "@/components/SavableForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_LABELS: Record<string, string> = {
  declared: "Δηλωμένη",
  confirmation_form_open: "Φόρμα Επιβεβαίωσης Ανοιχτή",
  confirmed: "Επιβεβαιωμένη",
  invalid: "Άκυρη",
};

/**
 * Portal Αρχηγού — Στάδιο 1 (Κατάθεση Βασικής Σύνθεσης). Αυθεντικοποίηση
 * μέσω URL token (§2), όχι Supabase Auth session. Η πλήρης οθόνη Portal
 * (countdown ανά γύρο, αντίπαλος, ειδοποιήσεις — βλ. mockups) και το Στάδιο 2
 * (κατάθεση σύνθεσης ανά γύρο) έρχονται σε επόμενο πέρασμα.
 */
export default async function CaptainPortal({ params }: { params: { token: string } }) {
  const supabase = createClient();

  const { data: team } = await supabase
    .from("teams")
    .select(
      "id, competition_id, status, roster_lock_deadline, roster_locked, clubs_schools(name), attendance_certificate_original_name, attendance_certificate_uploaded_at, entry_fee_status, entry_fee_method"
    )
    .eq("captain_access_token", params.token)
    .maybeSingle();

  if (!team) {
    notFound();
  }

  const { data: rules } = await supabase
    .from("roster_rules")
    .select("roster_size")
    .eq("competition_id", team.competition_id)
    .maybeSingle<Pick<RosterRules, "roster_size">>();

  const { data: entries } = await supabase
    .from("roster_entries")
    .select("id, declared_order, players(id, first_name, last_name, rating_national, rating_fide, gender)")
    .eq("team_id", team.id)
    .order("declared_order", { ascending: true });

  const { data: captain } = await supabase
    .from("captains")
    .select("first_name, last_name, phone")
    .eq("team_id", team.id)
    .maybeSingle();

  const round = await loadCaptainRound(team.id, team.competition_id);
  const certificateUrl = team.attendance_certificate_original_name ? await getCertificateUrl(params.token) : null;
  const feeStatus = isEntryFeeStatus(team.entry_fee_status) ? team.entry_fee_status : "pending";
  const boundUploadCertificate = uploadAttendanceCertificate.bind(null, params.token);
  const boundEntryFeeMethod = setEntryFeeMethod.bind(null, params.token);
  const roundRules = round.kind === "play" && !round.composition ? await loadRules(supabase, team.competition_id) : null;
  const roundRoster = roundRules ? await loadRoster(supabase, team.id) : null;
  const initialAssignments =
    roundRules && roundRoster ? computeDefaultAssignment(roundRules, roundRoster.roster, roundRoster.players) : [];

  const deadlinePassed =
    !!team.roster_lock_deadline && new Date(team.roster_lock_deadline) < new Date();
  const editable = !team.roster_locked && !deadlinePassed;

  const boundAddPlayer = addPlayerToRoster.bind(null, params.token);
  const boundRemove = removeRosterEntry.bind(null, params.token);
  const boundMove = moveRosterEntry.bind(null, params.token);
  const boundCaptainInfo = saveCaptainInfo.bind(null, params.token);
  const boundConfirm = confirmRoster.bind(null, params.token);

  return (
    <div className="min-h-screen px-6 py-10 max-w-sm mx-auto flex flex-col gap-8">
      <div>
        <div className="font-serif font-bold text-gold tracking-wide text-sm mb-1">TEAM ALMA</div>
        <div className="text-xs text-muted mb-1">Κατάθεση Βασικής Σύνθεσης</div>
        <h1 className="font-serif font-bold text-xl">
          {/* @ts-expect-error — Supabase join typing simplified */}
          {team.clubs_schools?.name ?? "Ομάδα"}
        </h1>
      </div>


      {round.kind === "bye" && (
        <div className="bg-card border border-cardBorder rounded-xl px-4 py-3 text-sm">
          <div className="font-semibold">Γύρος {round.roundNumber}</div>
          <p className="text-muted mt-1">Η ομάδα σας έχει ελεύθερο γύρο (bye). Δεν απαιτείται σύνθεση.</p>
        </div>
      )}

      {round.kind === "play" && (
        <section className="flex flex-col gap-5">
          <div className="bg-card border border-cardBorder rounded-xl px-4 py-4">
            <div className="text-xs uppercase tracking-wide text-muted">
              Γύρος {round.roundNumber} · Προετοιμασία Σύνθεσης
            </div>
            {round.window.open && round.window.endsAt && !round.composition ? (
              <div className="mt-2">
                <Countdown endsAt={round.window.endsAt} />
                <div className="text-xs text-muted mt-1">λεπτά που απομένουν για την υποβολή</div>
              </div>
            ) : (
              <div className="text-sm mt-2 text-muted">
                {round.composition ? "Η σύνθεση του γύρου έχει οριστικοποιηθεί." : "Το χρονικό παράθυρο υποβολής έχει λήξει."}
              </div>
            )}
          </div>

          <div className="rounded-xl px-4 py-3 border" style={{ background: "#1B1826", borderColor: "#3A2E52" }}>
            <div className="text-xs uppercase tracking-wide text-muted mb-1">Αντίπαλος · Βασική Σύνθεση</div>
            <div className="font-bold mb-2" style={{ color: "#C9A8E8" }}>{round.opponentName}</div>
            <div className="flex flex-col gap-1">
              {round.opponentRoster.map((o) => (
                <div key={o.order} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-xs font-bold text-muted2">{o.order}</span>
                  <span className="flex-1 truncate" style={{ color: "#C7CEDD" }}>{o.name}</span>
                  <span className="text-xs text-muted2">{o.rating ?? ""}</span>
                </div>
              ))}
              {round.opponentRoster.length === 0 && (
                <span className="text-xs text-muted">Δεν έχει δηλωθεί ακόμα βασική σύνθεση.</span>
              )}
            </div>
          </div>

          {round.composition && (
            <div className="bg-card border border-cardBorder rounded-xl px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-muted mb-2">Η σύνθεσή σας για τον γύρο</div>
              {round.composition.assignments.map((a) => (
                <div key={a.board} className="flex justify-between py-1.5 text-sm border-b border-cardBorder last:border-b-0">
                  <span className="text-muted">Σκακιέρα {a.board}</span>
                  <span className="font-semibold">{a.playerName}</span>
                </div>
              ))}
              {round.composition.status === "used_default" && (
                <p className="text-xs text-muted mt-2">
                  Δεν υποβλήθηκε σύνθεση εγκαίρως, οπότε εφαρμόστηκε η βασική σύνθεση όπως δηλώθηκε.
                </p>
              )}
            </div>
          )}

          {!round.composition && round.window.open && roundRules && roundRoster && (
            <CompositionForm
              rules={roundRules}
              roster={roundRoster.roster}
              players={roundRoster.players}
              initial={initialAssignments}
              submit={submitRoundComposition.bind(null, params.token, round.roundId)}
            />
          )}
          {!round.composition && round.window.open && !roundRules && (
            <p className="text-sm text-muted">Δεν έχουν οριστεί ακόμα κανόνες σύνθεσης για τη διοργάνωση.</p>
          )}
        </section>
      )}

      <div className="bg-card border border-cardBorder rounded-xl px-4 py-3 flex items-center justify-between">
        <div>
          {team.roster_lock_deadline && (
            <>
              <div className="text-xs text-muted">Κατάθεση Βασικής Σύνθεσης έως</div>
              <div className="text-sm font-semibold mt-0.5">
                {new Date(team.roster_lock_deadline).toLocaleString("el-GR")}
              </div>
            </>
          )}
        </div>
        <span className="text-xs bg-panel border border-cardBorder rounded-full px-3 py-1">
          {STATUS_LABELS[team.status] ?? team.status}
        </span>
      </div>

      {!editable && (
        <p className="text-sm text-good">
          {team.roster_locked
            ? "Η βασική σύνθεση είναι κλειδωμένη."
            : "Η προθεσμία έχει λήξει — η σύνθεση δεν αλλάζει πια."}
        </p>
      )}

      <div>
        <div className="text-xs uppercase tracking-wide text-muted mb-2">
          Βασική Σύνθεση{rules?.roster_size ? ` · έως ${rules.roster_size}` : ""}
        </div>
        <div className="flex flex-col gap-2">
          {(entries ?? []).map((entry, i) => {
            const rawPlayer = (entry as unknown as { players: unknown }).players;
            const player = (Array.isArray(rawPlayer) ? rawPlayer[0] : rawPlayer) as
              | { first_name: string; last_name: string; rating_national?: number; rating_fide?: number; gender?: string }
              | undefined;
            return (
              <div
                key={entry.id}
                className="flex items-center gap-3 bg-card border border-cardBorder rounded-lg px-3 py-2"
              >
                <div className="w-6 h-6 rounded-md bg-panel flex items-center justify-center text-xs font-bold text-gold flex-shrink-0">
                  {entry.declared_order}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {player?.last_name} {player?.first_name}
                  </div>
                  <div className="text-xs text-muted">
                    {player?.rating_fide ?? player?.rating_national ?? "—"}
                    {player?.gender ? ` · ${player.gender === "F" ? "Γ" : "Α"}` : ""}
                  </div>
                </div>
                {editable && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <SavableForm action={boundMove.bind(null, entry.id, "up")}>
                      <button
                        type="submit"
                        disabled={i === 0}
                        aria-label="Μετακίνηση πάνω"
                        className="w-8 h-8 flex items-center justify-center text-muted disabled:opacity-30"
                      >
                        ↑
                      </button>
                    </SavableForm>
                    <SavableForm action={boundMove.bind(null, entry.id, "down")}>
                      <button
                        type="submit"
                        disabled={i === (entries?.length ?? 0) - 1}
                        aria-label="Μετακίνηση κάτω"
                        className="w-8 h-8 flex items-center justify-center text-muted disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </SavableForm>
                    <SavableForm action={boundRemove.bind(null, entry.id)} successMessage="Ο αθλητής αφαιρέθηκε.">
                      <button
                        type="submit"
                        aria-label="Αφαίρεση"
                        className="w-8 h-8 flex items-center justify-center text-red-400"
                      >
                        ✕
                      </button>
                    </SavableForm>
                  </div>
                )}
              </div>
            );
          })}
          {(entries ?? []).length === 0 && (
            <p className="text-sm text-muted">Κανένας αθλητής ακόμα.</p>
          )}
        </div>
      </div>

      {editable && (
        <PlayerSearch
          search={searchDirectory.bind(null, params.token)}
          searchByNumber={searchDirectoryByNumber.bind(null, params.token)}
          add={addDirectoryPlayerToRoster.bind(null, params.token)}
          available={!!process.env.SUPABASE_SERVICE_ROLE_KEY}
        />
      )}

      {editable && (
        <SavableForm action={boundAddPlayer} resetOnSuccess successMessage="Ο αθλητής προστέθηκε." className="flex flex-col gap-2 bg-card border border-cardBorder rounded-xl p-4">
          <div className="text-xs uppercase tracking-wide text-muted">Χειροκίνητη προσθήκη (αν δεν βρίσκεται στον κατάλογο) · λατινικά</div>
          <div className="flex gap-2">
            <input name="first_name" required placeholder="Όνομα" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1" />
            <input name="last_name" required placeholder="Επώνυμο" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1" />
          </div>
          <div className="flex gap-2">
            <input name="birth_date" type="date" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1" />
            <select name="gender" required defaultValue="" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1">
              <option value="" disabled>Φύλο *</option>
              <option value="M">Άνδρας</option>
              <option value="F">Γυναίκα</option>
            </select>
          </div>
          <div className="flex gap-2">
            <input name="national_id" placeholder="ΑΜ ΕΣΟ" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1" />
            <input name="fide_id" placeholder="FIDE ID" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1" />
          </div>
          <div className="flex gap-2">
            <input name="rating_national" type="number" placeholder="Εθνικό ΕΛΟ" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1" />
            <input name="rating_fide" type="number" placeholder="FIDE ΕΛΟ" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1" />
          </div>
          <button type="submit" className="bg-gold text-bg font-semibold rounded-lg py-2.5 text-sm mt-1">
            Προσθήκη
          </button>
        </SavableForm>
      )}

      <div>
        <div className="text-xs uppercase tracking-wide text-muted mb-2">Αρχηγός Ομάδας</div>
        <SavableForm action={boundCaptainInfo} successMessage="Τα στοιχεία του αρχηγού αποθηκεύτηκαν." className="flex flex-col gap-2 bg-card border border-cardBorder rounded-xl p-4">
          <div className="flex gap-2">
            <input
              name="first_name"
              required
              defaultValue={captain?.first_name ?? ""}
              placeholder="Όνομα (λατινικά)"
              className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1"
            />
            <input
              name="last_name"
              required
              defaultValue={captain?.last_name ?? ""}
              placeholder="Επώνυμο (λατινικά)"
              className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1"
            />
          </div>
          <input
            name="phone"
            defaultValue={captain?.phone ?? ""}
            placeholder="Τηλέφωνο"
            className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
          />
          <button type="submit" className="bg-panel border border-cardBorder rounded-lg py-2.5 text-sm">
            Αποθήκευση Στοιχείων Αρχηγού
          </button>
        </SavableForm>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-muted mb-2">Βεβαίωση Φοίτησης</div>
        <div className="flex flex-col gap-2 bg-card border border-cardBorder rounded-xl p-4">
          {team.attendance_certificate_original_name ? (
            <p className="text-sm">
              Έχει ανέβει: <span className="text-muted">{team.attendance_certificate_original_name}</span>
              {team.attendance_certificate_uploaded_at && (
                <span className="text-muted">
                  {" "}
                  ({new Date(team.attendance_certificate_uploaded_at).toLocaleDateString("el-GR")})
                </span>
              )}
              {certificateUrl && (
                <>
                  {" — "}
                  <a href={certificateUrl} className="text-gold underline" target="_blank" rel="noreferrer">
                    Προβολή
                  </a>
                </>
              )}
            </p>
          ) : (
            <p className="text-sm text-muted">Δεν έχει ανέβει ακόμα βεβαίωση.</p>
          )}
          <SavableForm action={boundUploadCertificate} resetOnSuccess successMessage="Η βεβαίωση ανέβηκε." className="flex gap-2">
            <input
              name="file"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              required
              className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1"
            />
            <button type="submit" className="bg-panel border border-cardBorder rounded-lg px-4 py-2 text-sm whitespace-nowrap">
              {team.attendance_certificate_original_name ? "Αντικατάσταση" : "Ανέβασμα"}
            </button>
          </SavableForm>
          <p className="text-xs text-muted">PDF ή εικόνα (JPG/PNG), έως 8 MB.</p>
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-muted mb-2">Παράβολο Συμμετοχής</div>
        <div className="flex flex-col gap-2 bg-card border border-cardBorder rounded-xl p-4">
          <p className="text-sm">
            Κατάσταση: <span className="text-gold">{ENTRY_FEE_STATUS_LABEL[feeStatus]}</span>
          </p>
          <SavableForm action={boundEntryFeeMethod} successMessage="Ο τρόπος πληρωμής αποθηκεύτηκε." className="flex gap-2">
            <input
              name="entry_fee_method"
              defaultValue={team.entry_fee_method ?? ""}
              placeholder="Τρόπος πληρωμής (π.χ. κατάθεση, μετρητά)"
              className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1"
            />
            <button type="submit" className="bg-panel border border-cardBorder rounded-lg px-4 py-2 text-sm whitespace-nowrap">
              Αποθήκευση
            </button>
          </SavableForm>
          <p className="text-xs text-muted">
            Η κατάσταση ενημερώνεται από τη διοργάνωση αφού επιβεβαιωθεί η πληρωμή.
          </p>
        </div>
      </div>

      {editable && (
        <SavableForm action={boundConfirm} successMessage="Η σύνθεση υποβλήθηκε.">
          <button type="submit" className="w-full bg-gold text-bg font-semibold rounded-xl py-3 text-sm">
            Υποβολή Σύνθεσης
          </button>
        </SavableForm>
      )}
    </div>
  );
}
