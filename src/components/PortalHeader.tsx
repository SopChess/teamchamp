import Link from "next/link";
import Image from "next/image";
import almaLogo from "../../public/alma-logo.png";

/**
 * Κοινό header admin/Portal Αρχηγού: λογότυπο στοιχισμένο πάνω, ετικέτα ποιο
 * portal είναι (επιβεβαιωμένο), και προαιρετικό μόνιμο link επιστροφής — λύνει
 * το πρόβλημα πλοήγησης («δεν μπορείς να γυρίσεις πίσω») με έναν πάντα-ορατό
 * σύνδεσμο, ανεξάρτητα από το πόσο βαθιά έχει μπει κανείς.
 */
export default function PortalHeader({
  label,
  homeHref,
  homeLabel = "Αρχική",
}: {
  label: string;
  homeHref?: string;
  homeLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-2">
      <div className="flex items-center gap-2.5">
        <Image src={almaLogo} alt="Team ALMA" width={32} height={32} className="rounded-md flex-shrink-0" />
        <div>
          <div className="font-serif font-bold text-gold tracking-wide text-xs leading-none">TEAM ALMA</div>
          <div className="text-[11px] text-muted leading-none mt-1">{label}</div>
        </div>
      </div>
      {homeHref && (
        <Link href={homeHref} className="text-xs text-muted hover:text-gold whitespace-nowrap">
          ← {homeLabel}
        </Link>
      )}
    </div>
  );
}
