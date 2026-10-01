"use client";

import SavableForm from "@/components/SavableForm";

/**
 * Ελαφριά γραμμή για κρυμμένο τουρνουά — μόνο το όνομα, καμία φόρτωση
 * δεδομένων ομάδας μέχρι να το ξαναδείξει ο υπεύθυνος (επιβεβαιωμένο: δική
 * του επιλογή, ποτέ δεν χάνονται δεδομένα, μόνο κρύβεται η προβολή).
 */
export default function HiddenTournamentRow({
  title,
  show,
}: {
  title: string;
  show: () => Promise<void>;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-panel border border-cardBorder rounded-lg">
      <span className="text-sm text-muted truncate">{title}</span>
      <SavableForm action={show} successMessage="Το τουρνουά εμφανίζεται ξανά.">
        <button type="submit" className="text-xs text-gold underline whitespace-nowrap">
          Επανεμφάνιση
        </button>
      </SavableForm>
    </div>
  );
}
