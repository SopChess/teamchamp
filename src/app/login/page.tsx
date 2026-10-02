import Link from "next/link";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  invalid: "Το link πρόσβασης δεν ισχύει ή έχει ανακληθεί.",
  denied: "Δεν έχετε πρόσβαση σε αυτή τη σελίδα, ή η πρόσβασή σας έχει λήξει.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const message = searchParams.error ? MESSAGES[searchParams.error] : null;

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col gap-4">
        <span className="font-serif font-bold text-gold tracking-wide text-sm">TEAM ALMA</span>
        <p className="text-sm text-muted">
          Η πρόσβαση γίνεται με το προσωπικό σας link. Ανοίξτε το link που σας έχει δοθεί. Αν το
          έχετε χάσει ή δεν λειτουργεί, μπορείτε να ζητήσετε νέο από την αρχική σελίδα, στην
          ενότητα «Πρόσβαση».
        </p>
        {message && <p className="text-sm text-red-400">{message}</p>}
        <Link href="/" className="text-sm text-gold underline">
          Μετάβαση στην αρχική σελίδα
        </Link>
      </div>
    </div>
  );
}
