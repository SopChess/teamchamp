import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CaptainTeamView from "../CaptainTeamView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Συγκεκριμένη ομάδα ενός υπευθύνου με περισσότερες από μία. Επαληθεύει ΞΑΝΑ ότι το token δίνει πρόσβαση σε αυτό ακριβώς το teamId πριν δείξει οτιδήποτε. */
export default async function CaptainTeamPage({ params }: { params: { token: string; teamId: string } }) {
  const supabase = createClient();

  const { data: team } = await supabase.from("teams").select("id, captain_access_token, captain_account_id").eq("id", params.teamId).maybeSingle();
  if (!team) notFound();

  const authorized =
    team.captain_access_token === params.token ||
    (team.captain_account_id &&
      (await supabase.from("captain_accounts").select("id").eq("id", team.captain_account_id).eq("access_token", params.token).maybeSingle()).data);

  if (!authorized) notFound();

  return <CaptainTeamView token={params.token} teamId={params.teamId} />;
}
