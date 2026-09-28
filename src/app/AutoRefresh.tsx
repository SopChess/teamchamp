"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Ανανεώνει τα δεδομένα της σελίδας κάθε λίγα δευτερόλεπτα (όπως το Live του ατομικού). */
export default function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
