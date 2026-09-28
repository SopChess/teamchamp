"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Αντίστροφη μέτρηση μέχρι τη λήξη του παραθύρου κατάθεσης. Στο 0 ανανεώνει τη σελίδα. */
export default function Countdown({ endsAt }: { endsAt: string }) {
  const router = useRouter();
  const refreshed = useRef(false);
  const [seconds, setSeconds] = useState(() =>
    Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    const id = setInterval(() => {
      const left = Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000));
      setSeconds(left);
      if (left === 0 && !refreshed.current) {
        refreshed.current = true;
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt, router]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return <span className="font-serif font-bold text-3xl tracking-wide">{mm}:{ss}</span>;
}
