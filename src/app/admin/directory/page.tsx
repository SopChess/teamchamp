import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import DirectoryTester from "./DirectoryTester";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DirectoryPage() {
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  let total: number | null = null;
  let tableMissing = false;
  if (hasServiceKey) {
    const db = createClient();
    const { count, error } = await db.from("players_directory").select("id", { count: "exact", head: true });
    if (error) tableMissing = true;
    else total = count ?? 0;
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <Link href="/admin" className="text-xs text-muted hover:text-gold">
          ← Διοργανώσεις
        </Link>
        <h1 className="font-serif font-bold text-2xl mt-2">Κατάλογος Αθλητών</h1>
        <p className="text-xs text-muted mt-1">
          Ο κατάλογος βοηθά στην εγγραφή ομάδων: ο υπεύθυνος αναζητά αθλητή και τα στοιχεία του
          συμπληρώνονται αυτόματα. Περιέχει προσωπικά δεδομένα (και ανηλίκων), γι' αυτό διαβάζεται μόνο
          από τον server και δεν είναι προσβάσιμος με το δημόσιο κλειδί.
        </p>
      </div>

      {!hasServiceKey && (
        <div className="bg-card border border-red-400/40 rounded-xl p-4 text-sm">
          <div className="font-semibold text-red-400 mb-1">Λείπει το service key</div>
          Ο κατάλογος δεν μπορεί να διαβαστεί μέχρι να οριστεί η μεταβλητή{" "}
          <code>SUPABASE_SERVICE_ROLE_KEY</code> στο Vercel (Settings → Environment Variables) και να γίνει
          Redeploy. Χρησιμοποιήστε το κλειδί <code>service_role</code> από την καρτέλα Legacy API Keys του
          Supabase, και όχι με πρόθεμα NEXT_PUBLIC_.
        </div>
      )}

      {hasServiceKey && tableMissing && (
        <div className="bg-card border border-red-400/40 rounded-xl p-4 text-sm">
          <div className="font-semibold text-red-400 mb-1">Ο πίνακας δεν υπάρχει ακόμα</div>
          Τρέξτε στο SQL Editor του Supabase (του teamchamp) το αρχείο <code>supabase/setup_directory.sql</code>.
        </div>
      )}

      {hasServiceKey && total !== null && (
        <div className="bg-card border border-cardBorder rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Αθλητές στον κατάλογο</div>
            <div className="font-serif font-bold text-2xl mt-1">{total.toLocaleString("el-GR")}</div>
          </div>
          {total === 0 && (
            <div className="text-xs text-muted text-right max-w-[14rem]">
              Ο κατάλογος είναι άδειος. Φορτώστε το CSV από το Table Editor του Supabase (Import data from CSV).
            </div>
          )}
        </div>
      )}

      {hasServiceKey && total !== null && total > 0 && (
        <div className="flex flex-col gap-3">
          <div className="text-xs uppercase tracking-wide text-muted">Δοκιμαστική αναζήτηση</div>
          <DirectoryTester />
        </div>
      )}
    </div>
  );
}
