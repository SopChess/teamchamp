import Link from "next/link";
import Image from "next/image";
import almaLogo from "../../public/alma-logo.png";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Αρχική σελίδα (επιβεβαιωμένο, απλοποιημένη): ένα μόνο κουμπί-πύλη προς τη
 * λίστα πρωταθλημάτων. Καμία ένδειξη "ανοιχτές εγγραφές" εδώ πια (φαίνεται
 * ήδη ανά τουρνουά στην ίδια τη λίστα) — ούτε ξεχωριστά κουμπιά Εγγραφή/Live,
 * αφού αυτά ζουν πλέον μέσα στη σελίδα του κάθε τουρνουά, όχι στην αρχική.
 */
export default function Home() {
  return (
    <div className="chess-bg min-h-screen px-6 py-16 flex flex-col items-center gap-9">
      <div className="max-w-sm w-full flex flex-col items-center text-center gap-4">
        <Image src={almaLogo} alt="Team ALMA" width={168} height={168} priority />
        <p className="text-sm text-muted leading-relaxed max-w-xs">
          Οργανώστε και διαχειριστείτε ομαδικά πρωταθλήματα σκάκι — κλήρωση, σύνθεση, αποτελέσματα,
          όλα σε ένα μέρος.
        </p>
      </div>

      <div className="flex flex-col items-center gap-2.5">
        <Link
          href="/championships"
          className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-card border border-cardBorder transition-all duration-200 hover:-translate-y-0.5 hover:border-gold hover:shadow-[0_0_24px_-6px_rgba(201,161,90,0.45)]"
        >
          <span className="text-xl leading-none">🏆</span>
          <span className="font-serif font-bold text-base">Ομαδικά Πρωταθλήματα</span>
        </Link>
        <p className="text-xs text-muted">Δείτε όλες τις διοργανώσεις</p>
      </div>

      <p className="text-[11px] text-muted2 text-center mt-2">
        TEAM ALMA · Σύστημα Διαχείρισης Ομαδικών Πρωταθλημάτων
      </p>
    </div>
  );
}
