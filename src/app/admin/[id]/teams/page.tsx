import { createClient } from "@/lib/supabase/server";
import { createTeam } from "./actions";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_LABELS: Record<string, string> = {
  declared: "Δηλωμένη",
  confirmation_form_open: "Φόρμα Επιβεβαίωσης Ανοιχτή",
  confirmed: "Επιβεβαιωμένη",
  invalid: "Άκυρη",
};

export default async function TeamsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name")
    .eq("id", params.id)
    .single();

  const { data: teams } = await supabase
    .from("teams")
    .select("id, status, roster_lock_deadline, captain_access_token, clubs_schools(name)")
    .eq("competition_id", params.id)
    .order("created_at", { ascending: false });

  const { data: clubs } = await supabase
    .from("clubs_schools")
    .select("id, name")
    .order("name");

  const boundCreate = createTeam.bind(null, params.id);

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <Link href={`/admin/${params.id}`} className="text-xs text-muted hover:text-gold">
          ← {competition?.name ?? "Διοργάνωση"}
        </Link>
        <h1 className="font-serif font-bold text-2xl mt-2">Ομάδες</h1>
      </div>

      <div className="flex flex-col gap-3">
        {(teams ?? []).map((t) => {
          const captainUrl = `/captain/${t.captain_access_token}`;
          return (
            <div key={t.id} className="bg-card border border-cardBorder rounded-xl px-4 py-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold">
                  {/* @ts-expect-error — Supabase join typing simplified */}
                  {t.clubs_schools?.name ?? "Ομάδα"}
                </div>
                <span className="text-xs text-muted">{STATUS_LABELS[t.status] ?? t.status}</span>
              </div>
              {t.roster_lock_deadline && (
                <div className="text-xs text-muted">
                  Κατάθεση Βασικής Σύνθεσης έως: {new Date(t.roster_lock_deadline).toLocaleString("el-GR")}
                </div>
              )}
              <div className="text-xs">
                Portal Αρχηγού:{" "}
                <span className="text-gold break-all">{captainUrl}</span>
              </div>
            </div>
          );
        })}
        {(teams ?? []).length === 0 && (
          <p className="text-sm text-muted">Καμία ομάδα ακόμα.</p>
        )}
      </div>

      <form action={boundCreate} className="flex flex-col gap-3 bg-card border border-cardBorder rounded-xl p-5">
        <div className="text-xs uppercase tracking-wide text-muted">Νέα Ομάδα</div>
        <select
          name="club_or_school_id"
          required
          className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
        >
          <option value="">— Επιλέξτε σύλλογο/σχολείο —</option>
          {(clubs ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex flex-col gap-1 text-sm">
          Κατάθεση Βασικής Σύνθεσης έως
          <input
            name="roster_lock_deadline"
            type="datetime-local"
            className="bg-panel border border-cardBorder rounded-lg px-3 py-2"
          />
        </label>
        <button type="submit" className="bg-gold text-bg font-semibold rounded-lg py-2.5 text-sm mt-1">
          Δημιουργία Ομάδας
        </button>
        {(clubs ?? []).length === 0 && (
          <p className="text-xs text-muted">
            Δεν υπάρχει κανένας σύλλογος/σχολείο ακόμα — πρόσθεσε πρώτα από{" "}
            <Link href="/admin/clubs" className="text-gold underline">
              εδώ
            </Link>
            .
          </p>
        )}
      </form>
    </div>
  );
}
