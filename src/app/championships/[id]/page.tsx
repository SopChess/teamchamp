import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ChampionshipPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: c } = await supabase
    .from("competitions")
    .select("id, name, format, rounds_count, starts_on, ends_on, venue")
    .eq("id", params.id)
    .maybeSingle();

  if (!c) notFound();

  const rows: [string, string | null][] = [
    ["Χώρος αγώνων", c.venue],
    ["Ημερομηνίες", [c.starts_on, c.ends_on].filter(Boolean).join(" – ") || null],
    ["Σύστημα", c.format],
    ["Γύροι", c.rounds_count ? String(c.rounds_count) : null],
  ];

  return (
    <div className="min-h-screen px-6 py-12 max-w-xl mx-auto flex flex-col gap-6">
      <div>
        <Link href="/" className="text-xs text-muted hover:text-gold">
          ← Αρχική
        </Link>
        <h1 className="font-serif font-bold text-2xl mt-2">{c.name}</h1>
      </div>
      <div className="bg-card border border-cardBorder rounded-xl divide-y divide-cardBorder">
        {rows
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <div key={label} className="px-4 py-3 flex justify-between gap-4 text-sm">
              <span className="text-muted">{label}</span>
              <span className="text-right">{value}</span>
            </div>
          ))}
      </div>
      <p className="text-sm text-muted">Τα ζωντανά αποτελέσματα θα εμφανίζονται εδώ.</p>
    </div>
  );
}
