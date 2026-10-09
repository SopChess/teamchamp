"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import SavableForm from "@/components/SavableForm";
import AthletePicker from "./AthletePicker";
import type { DirectoryHit } from "@/lib/players/directory";
import type { RosterRules } from "@/lib/rosterRules/types";

interface Props {
  action: (formData: FormData) => Promise<void> | void;
  fieldLabel: string;
  fieldExample: string;
  needsEsoCode: boolean;
  search: (epitheto: string, onoma: string) => Promise<DirectoryHit[]>;
  searchByNumber: (number: string) => Promise<DirectoryHit | null>;
  rules: Pick<RosterRules, "assignment_mode" | "roster_size" | "match_board_count" | "board_rules" | "reserve_count" | "one_player_per_category"> | null;
  referenceYear: number;
}

const inputCls = "bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm";

/**
 * Εγγραφή ομάδας σε δύο βήματα τύπου κουίζ (επιβεβαιωμένο): Βήμα 1 «Ομάδα & Υπεύθυνος»,
 * Βήμα 2 «Βασική Σύνθεση». Και τα δύο βήματα μένουν ΠΑΝΤΑ στο DOM (το ανενεργό κρύβεται
 * με `hidden`), ώστε μία ενιαία υποβολή της φόρμας να στέλνει όλα τα πεδία — η
 * αποθήκευση (registerTeam) παραμένει αμετάβλητη, μία ενέργεια για όλα.
 */
export default function RegisterWizard({ action, fieldLabel, fieldExample, needsEsoCode, search, searchByNumber, rules, referenceYear }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const step1Ref = useRef<HTMLDivElement>(null);

  function goNext() {
    const fields = step1Ref.current?.querySelectorAll<HTMLInputElement>("input") ?? [];
    for (const f of Array.from(fields)) {
      if (!f.reportValidity()) return; // δείχνει το μήνυμα του browser και μένει στο Βήμα 1
    }
    setStep(2);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Το Enter μέσα σε πεδίο δεν πρέπει να υποβάλλει τη φόρμα: στο Βήμα 1 προχωράει στο
  // επόμενο βήμα, στο Βήμα 2 δεν κάνει τίποτα (η υποβολή γίνεται μόνο με το κουμπί).
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter" || (e.target as HTMLElement).tagName !== "INPUT") return;
    e.preventDefault();
    if (step === 1) goNext();
  }

  const dot = (n: 1 | 2) => {
    const done = step > n;
    const active = step === n;
    return (
      <span
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
          done ? "bg-okBg text-okText" : active ? "bg-gold text-bg" : "bg-panel text-muted border border-cardBorder"
        }`}
        aria-current={active ? "step" : undefined}
      >
        {done ? "✓" : n}
      </span>
    );
  };

  return (
    <SavableForm
      action={action}
      successMessage="Η εγγραφή καταχωρήθηκε — μεταφορά στο Team Portal σας..."
      className="flex flex-col gap-4"
    >
      <div onKeyDown={onKeyDown} className="flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-2">
            {dot(1)}
            <div className={`flex-1 h-1 rounded ${step > 1 ? "bg-gold" : "bg-cardBorder"}`} />
            {dot(2)}
          </div>
          <div className="flex justify-between text-[11px] font-semibold mt-1.5">
            <span className={step === 1 ? "text-gold" : "text-muted"}>Ομάδα &amp; Υπεύθυνος</span>
            <span className={step === 2 ? "text-gold" : "text-muted"}>Βασική Σύνθεση</span>
          </div>
        </div>

        <div ref={step1Ref} className={step === 1 ? "flex flex-col gap-4" : "hidden"}>
          <div className="bg-card border border-cardBorder rounded-xl p-4 flex flex-col gap-3">
            <div className="text-xs uppercase tracking-wide text-muted">{fieldLabel}</div>
            <input name="new_team_name" required placeholder={fieldExample} className={`${inputCls} uppercase`} />
            {needsEsoCode && (
              <input name="eso_code" required placeholder="Κωδικός ΕΣΟ του συλλόγου" className={inputCls} />
            )}
            <p className="text-xs text-muted">
              Αν ο σύλλογος/σχολείο έχει ήδη καταχωρηθεί με το ίδιο ακριβώς όνομα, θα αναγνωριστεί
              αυτόματα — δεν χρειάζεται να ελέγξετε εσείς αν υπάρχει ήδη.
            </p>
          </div>

          <div className="bg-card border border-cardBorder rounded-xl p-4 flex flex-col gap-3">
            <div className="text-xs uppercase tracking-wide text-muted">Στοιχεία Υπευθύνου</div>
            <div className="flex gap-2">
              <input name="last_name" required placeholder="Επώνυμο" className={`${inputCls} flex-1 min-w-0 uppercase`} />
              <input name="first_name" required placeholder="Όνομα" className={`${inputCls} flex-1 min-w-0 uppercase`} />
            </div>
            <input name="phone" required placeholder="Τηλέφωνο" type="tel" className={inputCls} />
            <input name="email" required placeholder="Email" type="email" className={inputCls} />
            <p className="text-xs text-muted">
              Στο email αυτό θα σας σταλεί ο σύνδεσμος πρόσβασης στο Team Portal. Αν είστε ήδη υπεύθυνος
              άλλης ομάδας με το ίδιο email και τηλέφωνο, θα βλέπετε όλες τις ομάδες σας από το ίδιο Team Portal.
            </p>
          </div>

          <button type="button" onClick={goNext} className="bg-gold text-bg font-semibold rounded-xl py-3 text-sm">
            Συνέχεια στη Βασική Σύνθεση →
          </button>
        </div>

        <div className={step === 2 ? "flex flex-col gap-4" : "hidden"}>
          <div className="bg-card border border-cardBorder rounded-xl p-4 flex flex-col gap-3">
            <div className="text-xs uppercase tracking-wide text-muted">Βασική Σύνθεση</div>
            <AthletePicker search={search} searchByNumber={searchByNumber} rules={rules} referenceYear={referenceYear} />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 bg-panel border border-cardBorder rounded-xl py-3 text-sm"
            >
              ← Πίσω
            </button>
            <button type="submit" className="flex-[2] bg-gold text-bg font-semibold rounded-xl py-3 text-sm">
              Ολοκλήρωση Εγγραφής
            </button>
          </div>

          <p className="text-xs text-muted">
            Θα λάβετε email με τα στοιχεία της διοργάνωσης και σύνδεσμο προς το Team Portal σας.
            Μπορείτε να επεξεργάζεστε την ομάδα σας μέχρι την προθεσμία εγγραφών.
          </p>
        </div>
      </div>
    </SavableForm>
  );
}
