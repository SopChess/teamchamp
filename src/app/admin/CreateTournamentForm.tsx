"use client";

import { useState } from "react";
import SavableForm from "@/components/SavableForm";
import { AUDIENCE_LABELS } from "@/lib/teams/teams";
import { TOURNAMENT_CATEGORIES, CATEGORY_LABEL } from "@/lib/competitions/category";
import { TOURNAMENT_FORMATS, FORMAT_LABEL } from "@/lib/competitions/format";

/**
 * Δημιουργία τουρνουά πίσω από κουμπί "+ Νέο Τουρνουά" (επιβεβαιωμένο) — η φόρμα δεν
 * είναι πια μόνιμα ορατή στην αρχική admin. Έχει πλέον ΟΛΑ τα πεδία που έχει και η
 * επεξεργασία διοργάνωσης (το ίδιο action τα δεχόταν ήδη όλα — έλειπαν μόνο τα input).
 */
export default function CreateTournamentForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-gold text-bg font-semibold rounded-lg py-2.5 px-5 text-sm self-start"
      >
        + Νέο Τουρνουά
      </button>
    );
  }

  return (
    <SavableForm action={action} className="flex flex-col gap-3 bg-card border border-cardBorder rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted">Νέα Διοργάνωση</div>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:text-gold">
          Ακύρωση
        </button>
      </div>
      <input
        name="name"
        required
        placeholder="π.χ. 18ο Πανελλήνιο Ομαδικό Παίδων-Κορασίδων"
        className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
      />
      <label className="flex flex-col gap-1 text-sm text-muted">
        Διοργανώτρια αρχή
        <input
          name="organizer"
          placeholder="π.χ. Σκακιστικός Όμιλος Πολίχνης"
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Κατηγορία διοργάνωσης
        <select name="category" defaultValue="other" className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm">
          {TOURNAMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
          ))}
        </select>
      </label>
      <div className="flex gap-3">
        <label className="flex flex-col gap-1 text-sm flex-1 text-muted">
          Σύστημα αγώνων
          <select name="format" defaultValue="swiss" className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm">
            {TOURNAMENT_FORMATS.map((f) => (
              <option key={f} value={f}>{FORMAT_LABEL[f]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Γύροι
          <input
            name="rounds_count"
            type="number"
            placeholder="γύροι"
            className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm w-20"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Αριθμός σκακιερών ανά συνάντηση
        <input
          name="match_board_count"
          type="number"
          min={1}
          placeholder="π.χ. 4"
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
        />
        <span className="text-xs text-muted">Μπορεί να οριστεί/αλλάξει και αργότερα στους Κανόνες Σύνθεσης.</span>
      </label>
      <input
        name="venue"
        placeholder="Χώρος αγώνων"
        className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
      />
      <div className="flex gap-3">
        <input name="starts_on" type="date" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1" />
        <input name="ends_on" type="date" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm flex-1" />
      </div>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Σε ποιους απευθύνεται
        <select name="audience_type" defaultValue="eso_club" className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm">
          {(Object.entries(AUDIENCE_LABELS) as [string, string][]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Μέγιστες ομάδες ανά σύλλογο (μόνο για «Ομάδες μέλη ΕΣΟ»)
        <input
          name="max_teams_per_club"
          type="number"
          min={1}
          defaultValue={1}
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Προκήρυξη (link, π.χ. Google Drive)
        <input
          name="announcement_url"
          type="url"
          placeholder="https://drive.google.com/..."
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Χώρος αγώνων — link Google Maps
        <input
          name="venue_maps_url"
          type="url"
          placeholder="https://maps.app.goo.gl/..."
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Link αποτελεσμάτων (chess-results.com)
        <input
          name="chess_results_url"
          type="url"
          placeholder="https://chess-results.com/tnr..."
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Χρόνος σκέψης
        <input
          name="time_control"
          placeholder="π.χ. 15΄+10΄΄/κίνηση"
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Προθεσμία εγγραφών
        <input
          name="registration_deadline"
          type="datetime-local"
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="requires_certificate" defaultChecked />
        Απαιτείται βεβαίωση φοίτησης
      </label>
      <div className="flex gap-3">
        <label className="flex flex-col gap-1 text-sm flex-1 text-muted">
          Παράβολο συμμετοχής (€)
          <input
            name="entry_fee_amount"
            type="number"
            step="0.01"
            min={0}
            placeholder="κενό = χωρίς παράβολο"
            className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm flex-1 text-muted">
          Σημείωση παραβόλου
          <input
            name="entry_fee_note"
            placeholder="π.χ. ανά αθλητή"
            className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Προθεσμία πληρωμής παραβόλου
        <input
          name="entry_fee_deadline"
          type="datetime-local"
          className="w-full bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm"
        />
        <span className="text-xs text-muted">Προαιρετική, ξεχωριστή από την προθεσμία εγγραφών.</span>
      </label>
      <p className="text-xs text-muted -mt-1">
        Αν αφήσετε το ποσό παραβόλου κενό, η ενότητα παραβόλου δεν εμφανίζεται καθόλου στο Portal Αρχηγού.
      </p>
      <button type="submit" className="bg-gold text-bg font-semibold rounded-lg py-2.5 text-sm mt-1">
        Δημιουργία
      </button>
    </SavableForm>
  );
}
