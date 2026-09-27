"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = params.get("next") ?? "/admin";

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    // Χωρίς emailRedirectTo: το Supabase στέλνει τον κωδικό {{ .Token }} στο
    // email, όχι (μόνο) ένα κλικ-λινκ. Ένα πληκτρολογημένο 6ψήφιο δεν μπορεί
    // να "καταναλωθεί" από αυτόματο prefetch email scanner (π.χ. Gmail) —
    // ακριβώς το πρόβλημα που είχαμε με το κλικ-λινκ.
    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setStep("code");
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      router.push(next);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <span className="font-serif font-bold text-gold tracking-wide text-sm">
            TEAM ALMA
          </span>
        </div>

        {step === "email" && (
          <form onSubmit={requestCode} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-panel border border-cardBorder rounded-xl px-4 py-3 text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-gold text-bg font-semibold rounded-xl py-3 text-sm disabled:opacity-60"
            >
              {loading ? "Αποστολή..." : "Αποστολή κωδικού σύνδεσης"}
            </button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={verifyCode} className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              Στείλαμε 6ψήφιο κωδικό στο {email}. Γράψ&#39; τον εδώ (όχι κλικ σε
              link μέσα στο email).
            </p>
            <input
              type="text"
              inputMode="numeric"
              required
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="bg-panel border border-cardBorder rounded-xl px-4 py-3 text-sm tracking-widest text-center"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-gold text-bg font-semibold rounded-xl py-3 text-sm disabled:opacity-60"
            >
              {loading ? "Έλεγχος..." : "Σύνδεση"}
            </button>
            <button
              type="button"
              onClick={() => setStep("email")}
              className="text-xs text-muted underline"
            >
              Άλλο email
            </button>
          </form>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
