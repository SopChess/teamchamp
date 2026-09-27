import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { createMeeting } from "./actions";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MeetingsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name")
    .eq("id", params.id)
    .single();

  const { data: meetings } = await supabase
    .from("meetings")
    .select("id, meeting_number, board_count")
    .eq("competition_id", params.id)
    .order("meeting_number");

  const { data: allTokens } = await supabase
    .from("qr_tokens")
    .select("id, meeting_id, board_number, token");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const boundCreate = createMeeting.bind(null, params.id);

  // Server-side QR image generation (data URLs) — δεν χρειάζεται καμία
  // client-side βιβλιοθήκη, το <img> απλά δείχνει το data: URI.
  const qrByMeeting = new Map<string, { board_number: number; dataUrl: string }[]>();
  for (const t of allTokens ?? []) {
    const url = `${siteUrl}/r/${t.token}`;
    const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 160 });
    const list = qrByMeeting.get(t.meeting_id) ?? [];
    list.push({ board_number: t.board_number, dataUrl });
    qrByMeeting.set(t.meeting_id, list);
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <Link href={`/admin/${params.id}`} className="text-xs text-muted hover:text-gold">
          ← {competition?.name ?? "Διοργάνωση"}
        </Link>
        <h1 className="font-serif font-bold text-2xl mt-2">Συναντήσεις &amp; QR</h1>
        <p className="text-xs text-muted mt-1">
          Μόνιμα QR ανά (Συνάντηση, Σκακιέρα) — δημιουργούνται μία φορά, τυπώνονται μία
          φορά. Η αντιστοίχιση ομάδων σε Συνάντηση γίνεται ανά γύρο, στη σελίδα Γύροι.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {(meetings ?? []).map((m) => (
          <div key={m.id} className="bg-card border border-cardBorder rounded-xl p-4">
            <div className="font-semibold mb-3">
              Συνάντηση {m.meeting_number} · {m.board_count} σκακιέρες
            </div>
            <div className="flex flex-wrap gap-4">
              {(qrByMeeting.get(m.id) ?? [])
                .sort((a, b) => a.board_number - b.board_number)
                .map((q) => (
                  <div key={q.board_number} className="flex flex-col items-center gap-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={q.dataUrl} alt={`QR Συνάντηση ${m.meeting_number} Σκακιέρα ${q.board_number}`} width={120} height={120} />
                    <div className="text-xs text-muted">Σκακιέρα {q.board_number}</div>
                  </div>
                ))}
            </div>
          </div>
        ))}
        {(meetings ?? []).length === 0 && (
          <p className="text-sm text-muted">Καμία συνάντηση ακόμα.</p>
        )}
      </div>

      <form action={boundCreate} className="flex flex-col gap-3 bg-card border border-cardBorder rounded-xl p-5">
        <div className="text-xs uppercase tracking-wide text-muted">Νέα Συνάντηση</div>
        <div className="flex gap-3">
          <label className="flex flex-col gap-1 text-sm flex-1">
            Αριθμός Συνάντησης
            <input
              name="meeting_number"
              type="number"
              required
              placeholder="π.χ. 1"
              className="bg-panel border border-cardBorder rounded-lg px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm flex-1">
            Αριθμός Σκακιερών
            <input
              name="board_count"
              type="number"
              required
              placeholder="π.χ. 4"
              className="bg-panel border border-cardBorder rounded-lg px-3 py-2"
            />
          </label>
        </div>
        <button type="submit" className="bg-gold text-bg font-semibold rounded-lg py-2.5 text-sm mt-1">
          Δημιουργία Συνάντησης + QR
        </button>
      </form>
    </div>
  );
}
