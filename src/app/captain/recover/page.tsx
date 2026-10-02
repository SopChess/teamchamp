import { recoverCaptainLink } from "./actions";
import SavableForm from "@/components/SavableForm";

export default function RecoverCaptainLinkPage() {
  return (
    <div className="min-h-screen px-6 py-12 max-w-sm mx-auto flex flex-col gap-6">
      <div>
        <h1 className="font-serif font-bold text-2xl">Ξέχασα το Link μου</h1>
        <p className="text-xs text-muted mt-1">
          Αν έχετε εγγράψει ομάδα, δώστε το email και το τηλέφωνο που χρησιμοποιήσατε — αν ταιριάζουν,
          θα σας στείλουμε ξανά το ίδιο link του Team Portal.
        </p>
      </div>

      <SavableForm
        action={recoverCaptainLink}
        successMessage="Αν βρέθηκε λογαριασμός με αυτά τα στοιχεία, θα λάβετε email."
        className="flex flex-col gap-3"
      >
        <input name="email" required type="email" placeholder="Email" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm" />
        <input name="phone" required type="tel" placeholder="Τηλέφωνο" className="bg-panel border border-cardBorder rounded-lg px-3 py-2 text-sm" />
        <button type="submit" className="bg-gold text-bg font-semibold rounded-xl py-3 text-sm">
          Αποστολή Link
        </button>
      </SavableForm>
    </div>
  );
}
