import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Captain portal — αυθεντικοποιείται μέσω URL token (§2 του document), όχι
 * μέσω Supabase Auth session. Phase 1: μόνο βασική επιβεβαίωση ταυτότητας
 * ομάδας· η πλήρης οθόνη (countdown, αντίπαλος, ειδοποιήσεις — βλ. τα
 * mockups) έρχεται σε επόμενο πέρασμα μαζί με τη λειτουργικότητα γύρων.
 */
export default async function CaptainPortal({ params }: { params: { token: string } }) {
  const supabase = createClient();

  const { data: team } = await supabase
    .from("teams")
    .select("id, status, clubs_schools(name)")
    .eq("captain_access_token", params.token)
    .maybeSingle();

  if (!team) {
    notFound();
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-sm mx-auto flex flex-col gap-6">
      <div className="font-serif font-bold text-gold tracking-wide text-sm">TEAM ALMA</div>
      <div>
        <div className="text-xs text-muted mb-1">Portal Αρχηγού</div>
        <h1 className="font-serif font-bold text-xl">
          {/* @ts-expect-error — Supabase join typing simplified for Phase 1 */}
          {team.clubs_schools?.name ?? "Ομάδα"}
        </h1>
      </div>
      <p className="text-sm text-muted">
        Κατάσταση: {team.status}. Η πλήρης οθόνη (κατάθεση σύνθεσης, αντίπαλος,
        ειδοποιήσεις) προστίθεται στο επόμενο πέρασμα.
      </p>
    </div>
  );
}
