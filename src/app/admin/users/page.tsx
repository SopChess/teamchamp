import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ACCESS_COOKIE } from "@/lib/access";
import { createAccessUser, setAccessActive } from "./actions";
import CopyLinkButton from "./CopyLinkButton";
import SavableForm from "@/components/SavableForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Διαχειριστής (πλήρης πρόσβαση)",
  tournament_admin: "Υπεύθυνος πρωταθλήματος",
  referee: "Διαιτητής",
};

type AccessRow = {
  id: string;
  email: string | null;
  label: string;
  role: string;
  competition_ids: string[];
  active: boolean;
  token: string;
  last_used_at: string | null;
};

export default async function UsersPage() {
  const supabase = createClient();
  const token = cookies().get(ACCESS_COOKIE)?.value ?? "";

  const { data: users, error } = await supabase.rpc("admin_list_access", { p_admin_token: token });
  const { data: competitions } = await supabase.from("competitions").select("id, name").order("name");

  const rows = (users ?? []) as AccessRow[];
  const compName = (id: string) => (competitions ?? []).find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <Link href="/admin" className="text-xs text-muted hover:text-gold">
          ← Διοργανώσεις
        </Link>
        <h1 className="font-serif font-bold text-2xl mt-2">Χρήστες &amp; Πρόσβαση</h1>
        <p className="text-xs text-muted mt-1">
          Κάθε χρήστης έχει ένα προσωπικό link. Το link λειτουργεί σαν κωδικός — παρακαλούμε μην το
          κοινοποιείτε σε τρίτους.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-400">
          Δεν ήταν δυνατή η φόρτωση των χρηστών. Βεβαιωθείτε ότι έχει τρέξει το migration 0005 και
          ότι είστε συνδεδεμένοι ως διαχειριστής.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {rows.map((u) => (
          <div
            key={u.id}
            className={`bg-card border border-cardBorder rounded-xl p-4 flex flex-col gap-2 ${
              u.active ? "" : "opacity-60"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{u.label}</div>
                <div className="text-xs text-muted">{u.email ?? "χωρίς email"}</div>
              </div>
              <span className="text-xs bg-panel border border-cardBorder rounded-full px-3 py-1">
                {u.active ? "Ενεργός" : "Ανακλήθηκε"}
              </span>
            </div>
            <div className="text-xs text-muted">
              {ROLE_LABELS[u.role] ?? u.role}
              {u.role !== "super_admin" && u.competition_ids.length > 0
                ? ` · ${u.competition_ids.map(compName).join(", ")}`
                : ""}
            </div>
            <div className="flex items-center gap-2 pt-1">
              {u.active && <CopyLinkButton token={u.token} />}
              <SavableForm action={setAccessActive.bind(null, u.id, !u.active)}>
                <button
                  type="submit"
                  className="text-xs bg-panel border border-cardBorder rounded-lg px-3 py-1.5"
                >
                  {u.active ? "Ανάκληση" : "Επανενεργοποίηση"}
                </button>
              </SavableForm>
            </div>
          </div>
        ))}
        {rows.length === 0 && !error && (
          <p className="text-sm text-muted">Δεν υπάρχουν ακόμα χρήστες.</p>
        )}
      </div>

      <SavableForm action={createAccessUser} resetOnSuccess successMessage="Ο χρήστης δημιουργήθηκε." className="flex flex-col gap-3 bg-card border border-cardBorder rounded-xl p-5">
        <div className="text-xs uppercase tracking-wide text-muted">Νέος χρήστης</div>
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
        />
        <input
          name="label"
          required
          placeholder="Ονοματεπώνυμο ή ετικέτα"
          className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
        />
        <select
          name="role"
          defaultValue="referee"
          className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
        >
          <option value="referee">Διαιτητής</option>
          <option value="tournament_admin">Υπεύθυνος πρωταθλήματος</option>
          <option value="super_admin">Διαχειριστής (πλήρης πρόσβαση)</option>
        </select>
        <fieldset className="flex flex-col gap-1">
          <legend className="text-xs text-muted mb-1">
            Πρωταθλήματα (για διαιτητή και υπεύθυνο πρωταθλήματος)
          </legend>
          {(competitions ?? []).map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="competition_ids" value={c.id} />
              {c.name}
            </label>
          ))}
          {(competitions ?? []).length === 0 && (
            <span className="text-xs text-muted">Δεν υπάρχουν ακόμα πρωταθλήματα.</span>
          )}
        </fieldset>
        <button type="submit" className="bg-gold text-bg font-semibold rounded-lg py-2.5 text-sm mt-1">
          Δημιουργία χρήστη
        </button>
      </SavableForm>
    </div>
  );
}
