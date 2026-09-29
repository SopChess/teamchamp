import Link from "next/link";
import AccessRequestForm from "./AccessRequestForm";

export default function Home() {
  return (
    <div className="min-h-screen px-6 py-16 flex flex-col items-center justify-center gap-16">
      <div className="max-w-xl w-full flex flex-col items-center text-center gap-6">
        <div className="font-serif font-bold text-gold tracking-wide text-sm">TEAM ALMA</div>
        <h1 className="font-serif font-bold text-3xl md:text-4xl leading-tight">
          Σύστημα Διαχείρισης
          <br />
          Ομαδικών Πρωταθλημάτων
        </h1>
        <Link
          href="/championships"
          className="bg-gold text-bg font-semibold rounded-xl px-8 py-3.5 text-sm hover:bg-goldSoft transition-colors"
        >
          Ομαδικά Πρωταθλήματα
        </Link>
      </div>

      <section className="max-w-sm w-full flex flex-col gap-4">
        <h2 className="font-serif font-bold text-lg text-center">Πρόσβαση</h2>
        <p className="text-xs text-muted text-center">
          Για το επιτελείο της διοργάνωσης. Εισαγάγετε το email σας για να λάβετε το προσωπικό σας
          link πρόσβασης.
        </p>
        <AccessRequestForm />
      </section>
    </div>
  );
}
