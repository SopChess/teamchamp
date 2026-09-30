import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { registrationStatus, REGISTRATION_STATUS_LABEL } from "@/lib/competitions/registration";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("el-GR");
}

function formatDeadline(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleString("el-GR", { dateStyle: "medium", timeStyle: "short" });
}

const STATUS_STYLE: Record<string, string> = {
  open: "bg-good/15 text-good border-good/30",
  closed: "bg-red-400/15 text-red-400 border-red-400/30",
  unscheduled: "bg-panel text-muted border-cardBorder",
};

export default async function ChampionshipsPage() {
  const supabase = createClient();
  const { data: competitions } = await supabase
    .from("competitions")
    .select("id, name, starts_on, ends_on, venue, announcement_url, venue_maps_url, registration_deadline")
    .order("starts_on", { ascending: false, nullsFirst: false });

  return (
    <div className="min-h-screen px-6 py-12 max-w-3xl mx-auto flex flex-col gap-8">
      <div>
        <Link href="/" className="text-xs text-muted hover:text-gold">
          ← Αρχική
        </Link>
        <h1 className="font-serif font-bold text-2xl mt-2">Ομαδικά Πρωταθλήματα</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(competitions ?? []).map((c) => {
          const from = formatDate(c.starts_on);
          const to = formatDate(c.ends_on);
          const dates = from && to && from !== to ? `${from} – ${to}` : from ?? to;
          const status = registrationStatus(c.registration_deadline);
          const deadline = formatDeadline(c.registration_deadline);

          return (
            <div
              key={c.id}
              className="bg-card border border-cardBorder rounded-xl p-5 flex flex-col gap-3 hover:border-gold transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <Link href={`/championships/${c.id}`} className="font-serif font-bold text-lg hover:text-gold">
                  {c.name}
                </Link>
                <span
                  className={`shrink-0 text-xs border rounded-full px-2.5 py-1 whitespace-nowrap ${STATUS_STYLE[status]} ${status === "open" ? "soft-glow" : ""}`}
                >
                  {REGISTRATION_STATUS_LABEL[status]}
                </span>
              </div>

              <div className="text-sm text-muted flex flex-col gap-1">
                {dates && <div>📅 {dates}</div>}
                {c.venue && (
                  <div>
                    📍 {c.venue}
                    {c.venue_maps_url && (
                      <>
                        {" "}
                        <a
                          href={c.venue_maps_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-gold underline"
                        >
                          (Google Maps)
                        </a>
                      </>
                    )}
                  </div>
                )}
                {deadline && <div>⏱ Προθεσμία εγγραφών: {deadline}</div>}
              </div>

              <div className="flex gap-4 mt-1">
                {c.announcement_url && (
                  <a href={c.announcement_url} target="_blank" rel="noreferrer" className="text-xs text-gold underline">
                    Προκήρυξη →
                  </a>
                )}
                <Link href={`/championships/${c.id}`} className="text-xs text-gold underline">
                  Κατάταξη &amp; Αποτελέσματα →
                </Link>
              </div>
              {status === "open" && (
                <Link
                  href={`/championships/${c.id}/register`}
                  className="mt-1 bg-gold text-bg font-semibold rounded-lg py-2 text-sm text-center hover:bg-goldSoft transition-colors"
                >
                  Εγγραφή Ομάδας
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {(competitions ?? []).length === 0 && (
        <p className="text-sm text-muted">Δεν υπάρχουν ακόμα καταχωρημένα πρωταθλήματα.</p>
      )}
    </div>
  );
}
