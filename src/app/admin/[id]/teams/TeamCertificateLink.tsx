"use client";

import { useState } from "react";
import { getCertificateUrlForAdmin } from "./actions";

/**
 * Το link λήψης δημιουργείται μόνο κατόπιν αιτήματος (όχι για όλες τις ομάδες
 * στη φόρτωση της σελίδας) — μικρότερο κόστος και το link λήγει σε 10 λεπτά.
 */
export default function TeamCertificateLink({ teamId, name }: { teamId: string; name: string }) {
  const [loading, setLoading] = useState(false);

  async function open() {
    setLoading(true);
    try {
      const url = await getCertificateUrlForAdmin(teamId);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" onClick={open} disabled={loading} className="text-gold hover:underline disabled:opacity-50">
      {loading ? "..." : name}
    </button>
  );
}
