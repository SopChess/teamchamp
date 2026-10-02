import Image from "next/image";
import almaLogo from "../../public/alma-logo.png";
import BackHome from "./BackHome";

/**
 * Κοινό header admin/Portal Αρχηγού: λογότυπο στοιχισμένο πάνω, ετικέτα ποιο
 * portal είναι, ΚΑΙ η μόνιμη γραμμή «Πίσω + Αρχική» (επιβεβαιωμένο: σε κάθε
 * οθόνη, όχι μόνο admin) — λύνει το πρόβλημα πλοήγησης με πάντα-ορατά links,
 * ανεξάρτητα από το πόσο βαθιά έχει μπει κανείς.
 */
export default function PortalHeader({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-3 px-6 pt-5 pb-2">
      <div className="flex items-center gap-2.5">
        <Image src={almaLogo} alt="Team ALMA" width={32} height={32} className="rounded-md flex-shrink-0" />
        <div>
          <div className="font-serif font-bold text-gold tracking-wide text-xs leading-none">TEAM ALMA</div>
          <div className="text-[11px] text-muted leading-none mt-1">{label}</div>
        </div>
      </div>
      <BackHome />
    </div>
  );
}
