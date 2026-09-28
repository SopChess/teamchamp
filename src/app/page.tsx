import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AccessRequestForm from "./AccessRequestForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("el-GR");
}

export default async function Home() {
  const supabase = createClient();
  const { data: competitions } = await supabase
    .from("competitions")
    .select("id, name, starts_on, ends_on, venue")
    .order("starts_on", { ascending: false, nullsFirst: false });

  return (
    <div className="min-h-screen px-6 py-12 max-w-xl mx-auto flex flex-col gap-12">
      <div>
        <div className="font-serif font-bold text-gold tracking-wide text-sm">TEAM ALMA</div>
        <p className="text-sm text-muted mt-1">Διαχείριση ομαδικών σκακιστικών πρωταθλημάτων.</p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-serif font-bold text-xl">Ομαδικά Πρωταθλήματα</h2>
        <div className="flex flex-col gap-3">
          {(competitions ?? []).map((c) => {
            const from = formatDate(c.starts_on);
            const to = formatDate(c.ends_on);
            const dates = from && to && from !== to ? `${from} – ${to}` : from ?? to;
            return (
              <Link
                key={c.id}
                href={`/championships/${c.id}`}
                className="bg-card border border-cardBorder rounded-xl px-4 py-3 hover:border-gold transition-colors"
              >
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-muted mt-0.5">
                  {[dates, c.venue].filter(Boolean).join(" · ") || "—"}
                </div>
              </Link>
            );
          })}
          {(competitions ?? []).length === 0 && (
            <p className="text-sm text-muted">Δεν υπάρχουν ακόμα καταχωρημένα πρωταθλήματα.</p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-serif font-bold text-xl">Πρόσβαση</h2>
        <p className="text-sm text-muted">
          Για το επιτελείο της διοργάνωσης. Εισαγάγετε το email σας για να λάβετε το προσωπικό σας
          link πρόσβασης.
        </p>
        <AccessRequestForm />
      </section>
    </div>
  );
}
