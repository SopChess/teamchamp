export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  invalid: "Το link πρόσβασης δεν ισχύει ή έχει ανακληθεί.",
  denied: "Δεν έχεις πρόσβαση σε αυτή τη σελίδα, ή η πρόσβασή σου έχει λήξει.",
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
          Η πρόσβαση γίνεται με το προσωπικό σου link. Άνοιξε το link που σου έχει δοθεί — αν το
          έχεις χάσει ή δεν λειτουργεί, ζήτα νέο από τον διαχειριστή.
        </p>
        {message && <p className="text-sm text-red-400">{message}</p>}
      </div>
    </div>
  );
}
