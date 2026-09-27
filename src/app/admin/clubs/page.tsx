import { createClient } from "@/lib/supabase/server";
import { createClubOrSchool } from "./actions";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClubsPage() {
  const supabase = createClient();
  const { data: clubs } = await supabase
    .from("clubs_schools")
    .select("id, name, type, contact_email, contact_phone")
    .order("name");

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <Link href="/admin" className="text-xs text-muted hover:text-gold">
          ← Διοργανώσεις
        </Link>
        <h1 className="font-serif font-bold text-2xl mt-2">Σύλλογοι &amp; Σχολεία</h1>
      </div>

      <div className="flex flex-col gap-3">
        {(clubs ?? []).map((c) => (
          <div
            key={c.id}
            className="bg-card border border-cardBorder rounded-xl px-4 py-3 flex items-center justify-between"
          >
            <div>
              <div className="font-semibold">{c.name}</div>
              <div className="text-xs text-muted mt-0.5">
                {c.type === "club" ? "Σύλλογος" : "Σχολείο"}
                {c.contact_email ? ` · ${c.contact_email}` : ""}
                {c.contact_phone ? ` · ${c.contact_phone}` : ""}
              </div>
            </div>
          </div>
        ))}
        {(clubs ?? []).length === 0 && (
          <p className="text-sm text-muted">Κανένας σύλλογος/σχολείο ακόμα.</p>
        )}
      </div>

      <form action={createClubOrSchool} className="flex flex-col gap-3 bg-card border border-cardBorder rounded-xl p-5">
        <div className="text-xs uppercase tracking-wide text-muted">Νέος Σύλλογος/Σχολείο</div>
        <input
          name="name"
          required
          placeholder="π.χ. Σ.Ο. ΠΟΛΙΧΝΗΣ (ΕΛΛΗΝΙΚΑ ΚΕΦΑΛΑΙΑ)"
          className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm uppercase"
        />
        <select name="type" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm">
          <option value="club">Σύλλογος</option>
          <option value="school">Σχολείο</option>
        </select>
        <div className="flex gap-3">
          <input
            name="contact_email"
            type="email"
            placeholder="email επικοινωνίας"
            className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1"
          />
          <input
            name="contact_phone"
            placeholder="τηλέφωνο"
            className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1"
          />
        </div>
        <button type="submit" className="bg-gold text-bg font-semibold rounded-lg py-2.5 text-sm mt-1">
          Δημιουργία
        </button>
      </form>
    </div>
  );
}
