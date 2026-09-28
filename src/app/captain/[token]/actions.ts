"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RosterRules } from "@/lib/rosterRules/types";

/**
 * Κάθε action εδώ επαληθεύει το token ΞΑΝΑ από την αρχή — δεν εμπιστευόμαστε
 * καμία κατάσταση session, γιατί ο αρχηγός αυθεντικοποιείται αποκλειστικά
 * μέσω αυτού του token-in-URL (§2 του document), όχι μέσω Supabase Auth.
 */
async function getTeamByToken(token: string) {
  const supabase = createClient();
  const { data: team, error } = await supabase
    .from("teams")
    .select("id, competition_id, status, roster_lock_deadline, roster_locked")
    .eq("captain_access_token", token)
    .maybeSingle();

  if (error || !team) {
    throw new Error("Άκυρο ή ληγμένο link.");
  }
  return team;
}

function assertRosterEditable(team: { roster_locked: boolean; roster_lock_deadline: string | null }) {
  if (team.roster_locked) {
    throw new Error("Η βασική σύνθεση είναι ήδη κλειδωμένη.");
  }
  if (team.roster_lock_deadline && new Date(team.roster_lock_deadline) < new Date()) {
    throw new Error("Η προθεσμία κατάθεσης βασικής σύνθεσης έχει λήξει.");
  }
}

export async function addPlayerToRoster(token: string, formData: FormData) {
  const supabase = createClient();
  const team = await getTeamByToken(token);
  assertRosterEditable(team);

  const { data: rules } = await supabase
    .from("roster_rules")
    .select("roster_size")
    .eq("competition_id", team.competition_id)
    .maybeSingle<Pick<RosterRules, "roster_size">>();

  const { count } = await supabase
    .from("roster_entries")
    .select("id", { count: "exact", head: true })
    .eq("team_id", team.id);

  if (rules?.roster_size != null && (count ?? 0) >= rules.roster_size) {
    throw new Error(`Η βασική σύνθεση επιτρέπει το πολύ ${rules.roster_size} αθλητές.`);
  }

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const birthDate = String(formData.get("birth_date") ?? "") || null;
  const gender = String(formData.get("gender") ?? "") || null;
  const ratingNational = formData.get("rating_national")
    ? Number(formData.get("rating_national"))
    : null;
  const ratingFide = formData.get("rating_fide") ? Number(formData.get("rating_fide")) : null;
  const nationalId = String(formData.get("national_id") ?? "") || null;
  const fideId = String(formData.get("fide_id") ?? "") || null;

  if (!firstName || !lastName) {
    throw new Error("Όνομα και επώνυμο (λατινικά) είναι υποχρεωτικά.");
  }

  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert({
      first_name: firstName,
      last_name: lastName,
      birth_date: birthDate,
      gender,
      rating_national: ratingNational,
      rating_fide: ratingFide,
      national_id: nationalId,
      fide_id: fideId,
    })
    .select("id")
    .single();

  if (playerError) {
    throw new Error(`Αποτυχία καταχώρησης αθλητή: ${playerError.message}`);
  }

  const nextOrder = (count ?? 0) + 1;

  const { error: entryError } = await supabase.from("roster_entries").insert({
    team_id: team.id,
    player_id: player.id,
    declared_order: nextOrder,
  });

  if (entryError) {
    throw new Error(`Αποτυχία προσθήκης στη σύνθεση: ${entryError.message}`);
  }

  revalidatePath(`/captain/${token}`);
}

export async function removeRosterEntry(token: string, entryId: string) {
  const supabase = createClient();
  const team = await getTeamByToken(token);
  assertRosterEditable(team);

  const { error } = await supabase
    .from("roster_entries")
    .delete()
    .eq("id", entryId)
    .eq("team_id", team.id);

  if (error) {
    throw new Error(`Αποτυχία αφαίρεσης: ${error.message}`);
  }

  revalidatePath(`/captain/${token}`);
}

export async function moveRosterEntry(token: string, entryId: string, direction: "up" | "down") {
  const supabase = createClient();
  const team = await getTeamByToken(token);
  assertRosterEditable(team);

  const { data: entries } = await supabase
    .from("roster_entries")
    .select("id, declared_order")
    .eq("team_id", team.id)
    .order("declared_order", { ascending: true });

  if (!entries) return;

  const index = entries.findIndex((e) => e.id === entryId);
  const swapWith = direction === "up" ? index - 1 : index + 1;

  if (index === -1 || swapWith < 0 || swapWith >= entries.length) {
    return; // already at the edge — no-op
  }

  const a = entries[index];
  const b = entries[swapWith];

  // Swap via a temporary order value to avoid the unique(team_id, declared_order) conflict.
  await supabase.from("roster_entries").update({ declared_order: -1 }).eq("id", a.id);
  await supabase.from("roster_entries").update({ declared_order: a.declared_order }).eq("id", b.id);
  await supabase.from("roster_entries").update({ declared_order: b.declared_order }).eq("id", a.id);

  revalidatePath(`/captain/${token}`);
}

export async function saveCaptainInfo(token: string, formData: FormData) {
  const supabase = createClient();
  const team = await getTeamByToken(token);

  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!firstName || !lastName) {
    throw new Error("Όνομα και επώνυμο αρχηγού (λατινικά) είναι υποχρεωτικά.");
  }

  const { data: existing } = await supabase
    .from("captains")
    .select("id")
    .eq("team_id", team.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("captains")
      .update({ first_name: firstName, last_name: lastName, phone })
      .eq("id", existing.id);
    if (error) throw new Error(`Αποτυχία αποθήκευσης αρχηγού: ${error.message}`);
  } else {
    const { error } = await supabase.from("captains").insert({
      team_id: team.id,
      first_name: firstName,
      last_name: lastName,
      phone,
    });
    if (error) throw new Error(`Αποτυχία αποθήκευσης αρχηγού: ${error.message}`);
  }

  revalidatePath(`/captain/${token}`);
}

export async function confirmRoster(token: string) {
  const supabase = createClient();
  const team = await getTeamByToken(token);
  assertRosterEditable(team);

  const { count } = await supabase
    .from("roster_entries")
    .select("id", { count: "exact", head: true })
    .eq("team_id", team.id);

  if (!count) {
    throw new Error("Προσθέστε τουλάχιστον έναν αθλητή πριν την επιβεβαίωση.");
  }

  const { error } = await supabase
    .from("teams")
    .update({ status: "confirmed", roster_locked: true })
    .eq("id", team.id);

  if (error) {
    throw new Error(`Αποτυχία επιβεβαίωσης: ${error.message}`);
  }

  revalidatePath(`/captain/${token}`);
}
