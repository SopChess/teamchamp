import { createClient } from "@/lib/supabase/server";
import { createCompetition } from "./actions";
import { AUDIENCE_LABELS } from "@/lib/teams/teams";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminHome() {
  const supabase = createClient();
  const { data: competitions } = await supabase
    .from("competitions")
    .select("id, name, format, rounds_count, starts_on")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto flex flex-col gap-10">
      <div>
        <div className="font-serif font-bold text-gold tracking-wide text-sm mb-1">
          TEAM ALMA
        </div>
        <div className="flex items-center justify-between">
          <h1 className="font-serif font-bold text-2xl">Διοργανώσεις</h1>
          <div className="flex gap-4">
            <Link href="/admin/users" className="text-xs text-gold underline">
              Χρήστες &amp; Πρόσβαση →
            </Link>
            <Link href="/admin/clubs" className="text-xs text-gold underline">
              Σύλλογοι/Σχολεία →
            </Link>
            <Link href="/admin/directory" className="text-xs text-gold underline">
              Κατάλογος Αθλητών →
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {(competitions ?? []).map((c) => (
          <Link
            key={c.id}
            href={`/admin/${c.id}`}
            className="bg-card border border-cardBorder rounded-xl px-4 py-3 flex items-center justify-between hover:border-gold transition-colors"
          >
            <div>
              <div className="font-semibold">{c.name}</div>
              <div className="text-xs text-muted mt-0.5">
                {c.format} · {c.rounds_count ?? "?"} γύροι
              </div>
            </div>
            <span className="text-muted text-sm">→</span>
          </Link>
        ))}
        {(competitions ?? []).length === 0 && (
          <p className="text-sm text-muted">Καμία διοργάνωση ακόμα.</p>
        )}
      </div>

      <form action={createCompetition} className="flex flex-col gap-3 bg-card border border-cardBorder rounded-xl p-5">
        <div className="text-xs uppercase tracking-wide text-muted">Νέα Διοργάνωση</div>
        <input
          name="name"
          required
          placeholder="π.χ. 18ο Πανελλήνιο Ομαδικό Παίδων-Κορασίδων"
          className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
        />
        <div className="flex gap-3">
          <input
            name="format"
            defaultValue="swiss"
            placeholder="format"
            className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1"
          />
          <input
            name="rounds_count"
            type="number"
            placeholder="γύροι"
            className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm w-24"
          />
        </div>
        <input
          name="venue"
          placeholder="Χώρος αγώνων"
          className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
        />
        <div className="flex gap-3">
          <input name="starts_on" type="date" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1" />
          <input name="ends_on" type="date" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1" />
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Σε ποιους απευθύνεται
          <select name="audience_type" defaultValue="eso_club" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm">
            {(Object.entries(AUDIENCE_LABELS) as [string, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Μέγιστες ομάδες ανά σύλλογο (μόνο για «Ομάδες μέλη ΕΣΟ»)
          <input
            name="max_teams_per_club"
            type="number"
            min={1}
            defaultValue={1}
            className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Προκήρυξη (link, π.χ. Google Drive)
          <input
            name="announcement_url"
            type="url"
            placeholder="https://drive.google.com/..."
            className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Χώρος αγώνων — link Google Maps
          <input
            name="venue_maps_url"
            type="url"
            placeholder="https://maps.app.goo.gl/..."
            className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Προθεσμία εγγραφών
          <input
            name="registration_deadline"
            type="datetime-local"
            className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <button type="submit" className="bg-gold text-bg font-semibold rounded-lg py-2.5 text-sm mt-1">
          Δημιουργία
        </button>
      </form>
    </div>
  );
}
