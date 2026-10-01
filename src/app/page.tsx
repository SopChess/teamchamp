import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { isRegistrationOpen, type TournamentStatus } from "@/lib/competitions/tournamentStatus";
import almaLogo from "../../public/alma-logo.png";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CARDS = [
  {
    href: "/championships",
    title: "Πρωταθλήματα",
    subtitle: "Δείτε όλες τις διοργανώσεις",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 4h10v4a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4Z" />
        <path d="M7 5H4a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4" />
        <path d="M17 5h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4" />
        <path d="M12 13v4" />
        <path d="M9 20h6" />
        <path d="M10 17h4v3h-4z" />
      </svg>
    ),
  },
  {
    href: "/championships",
    title: "Εγγραφή Ομάδας",
    subtitle: "Δηλώστε τη συμμετοχή σας",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z" />
        <path d="M6 6h12v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6Z" />
        <path d="M9 12h6" />
        <path d="M9 16h4" />
      </svg>
    ),
  },
  {
    href: "/championships",
    title: "Live Κατάταξη",
    subtitle: "Αποτελέσματα σε πραγματικό χρόνο",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19V10" />
        <path d="M10 19V5" />
        <path d="M16 19v-7" />
        <path d="M22 19V3" />
      </svg>
    ),
  },
];

export default async function Home() {
  const supabase = createClient();
  const { data: competitions } = await supabase
    .from("competitions")
    .select("name, registration_deadline, status");

  const open = (competitions ?? []).filter((c) => isRegistrationOpen((c.status ?? "open") as TournamentStatus, c.registration_deadline));

  return (
    <div className="chess-bg min-h-screen px-6 py-14 flex flex-col items-center gap-10">
      <div className="max-w-sm w-full flex flex-col items-center text-center gap-4">
        <Image src={almaLogo} alt="Team ALMA" width={168} height={168} priority />
        <p className="text-sm text-muted leading-relaxed max-w-xs">
          Οργανώστε και διαχειριστείτε ομαδικά πρωταθλήματα σκάκι — κλήρωση, σύνθεση, αποτελέσματα,
          όλα σε ένα μέρος.
        </p>
      </div>

      <div className="max-w-sm w-full flex flex-col gap-3">
        {CARDS.map((c) => (
          <Link
            key={c.title}
            href={c.href}
            className="flex items-center gap-3.5 px-5 py-4.5 rounded-2xl bg-card border border-cardBorder transition-all duration-200 hover:-translate-y-0.5 hover:border-gold hover:shadow-[0_0_24px_-6px_rgba(201,161,90,0.45)]"
          >
            <span className="w-10 h-10 rounded-xl bg-gold/10 text-gold flex items-center justify-center flex-shrink-0">
              {c.icon}
            </span>
            <span className="flex-1">
              <span className="block font-serif font-bold text-base">{c.title}</span>
              <span className="block text-xs text-muted mt-0.5">{c.subtitle}</span>
            </span>
            <span className="text-muted">→</span>
          </Link>
        ))}
      </div>

      {open.length > 0 && (
        <div className="max-w-sm w-full px-4 py-3 rounded-xl bg-good/10 border border-good/30 flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-good flex-shrink-0 soft-glow" />
          <span className="text-xs">
            {open.length === 1 ? (
              <>Ανοιχτές εγγραφές: <strong className="text-good">{open[0]!.name}</strong></>
            ) : (
              <><strong className="text-good">{open.length}</strong> διοργανώσεις δέχονται εγγραφές τώρα</>
            )}
          </span>
        </div>
      )}

      <p className="text-[11px] text-muted2 text-center mt-2">
        TEAM ALMA · Σύστημα Διαχείρισης Ομαδικών Πρωταθλημάτων
      </p>
    </div>
  );
}
