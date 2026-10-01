import { createClient } from "@/lib/supabase/server";
import { getCurrentAccess } from "@/lib/access.server";
import { createClubOrSchool } from "./actions";
import Link from "next/link";
import SavableForm from "@/components/SavableForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClubsPage() {
  const supabase = createClient();
  const access = await getCurrentAccess();
  const canEdit = access?.role === "super_admin";

  const { data: clubs } = await supabase
    .from("clubs_schools")
    .select("id, name, type, eso_code, contact_email, contact_phone")
    .order("name");

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <Link href="/admin" className="text-xs text-muted hover:text-gold">
          ← Διοργανώσεις
        </Link>
        <h1 className="font-serif font-bold text-2xl mt-2">Σύλλογοι &amp; Σχολεία</h1>
        {!canEdit && (
          <p className="text-xs text-muted mt-1">Προβολή μόνο — η προσθήκη επιτρέπεται μόνο στον διαχειριστή.</p>
        )}
      </div>

      <div className="bg-card border border-cardBorder rounded-xl divide-y divide-cardBorder">
        {(clubs ?? []).map((c, i) => (
          <div key={c.id} className="px-4 py-2 flex items-center gap-3">
            <span className="w-5 text-xs text-muted text-right flex-shrink-0">{i + 1}</span>
            <span className="text-sm font-semibold truncate">{c.name}</span>
            <span className="text-xs text-muted truncate">
              {c.type === "club" ? "Σύλλογος" : "Σχολείο"}
              {c.eso_code ? ` · ΕΣΟ ${c.eso_code}` : ""}
              {c.contact_email ? ` · ${c.contact_email}` : ""}
              {c.contact_phone ? ` · ${c.contact_phone}` : ""}
            </span>
          </div>
        ))}
        {(clubs ?? []).length === 0 && (
          <p className="text-sm text-muted px-4 py-3">Κανένας σύλλογος/σχολείο ακόμα.</p>
        )}
      </div>

      {canEdit && (
        <SavableForm action={createClubOrSchool} resetOnSuccess successMessage="Ο σύλλογος/σχολείο δημιουργήθηκε." className="flex flex-col gap-3 bg-card border border-cardBorder rounded-xl p-5">
          <div className="text-xs uppercase tracking-wide text-muted">Νέος Σύλλογος/Σχολείο</div>
          <input
            name="name"
            required
            placeholder="π.χ. Σ.Ο. ΠΟΛΙΧΝΗΣ (ΕΛΛΗΝΙΚΑ ΚΕΦΑΛΑΙΑ)"
            className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm uppercase"
          />
          <div className="flex gap-3">
            <select name="type" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1">
              <option value="club">Σύλλογος</option>
              <option value="school">Σχολείο</option>
            </select>
            <input
              name="eso_code"
              placeholder="Κωδικός ΕΣΟ (προαιρετικό)"
              className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1"
            />
          </div>
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
        </SavableForm>
      )}
    </div>
  );
}
