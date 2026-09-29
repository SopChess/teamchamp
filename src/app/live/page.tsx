import Link from "next/link";

export default function LivePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-sm flex flex-col gap-3">
        <div className="font-serif font-bold text-gold tracking-wide text-sm">TEAM ALMA</div>
        <p className="text-muted text-sm">
          Η ζωντανή κατάταξη βρίσκεται πλέον στη σελίδα κάθε πρωταθλήματος.
        </p>
        <Link href="/" className="text-sm text-gold underline">
          Μετάβαση στα πρωταθλήματα →
        </Link>
      </div>
    </div>
  );
}
