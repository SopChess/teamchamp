import { createClient } from "@/lib/supabase/server";
import { createCompetition } from "./actions";
import Link from "next/link";
import CreateTournamentForm from "./CreateTournamentForm";

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
        <div className="flex items-center justify-between">
          <h1 className="font-serif font-bold text-2xl">Διοργανώσεις</h1>
          <div className="flex gap-4">
            <Link href="/admin/users" className="text-xs text-gold underline">
              Χρήστες &amp; Πρόσβαση
            </Link>
            <Link href="/admin/clubs" className="text-xs text-gold underline">
              Σύλλογοι/Σχολεία
            </Link>
            <Link href="/admin/directory" className="text-xs text-gold underline">
              Κατάλογος Αθλητών
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
          </Link>
        ))}
        {(competitions ?? []).length === 0 && (
          <p className="text-sm text-muted">Καμία διοργάνωση ακόμα.</p>
        )}
      </div>

      <CreateTournamentForm action={createCompetition} />
    </div>
  );
}
