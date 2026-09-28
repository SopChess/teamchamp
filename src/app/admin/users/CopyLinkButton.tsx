"use client";

import { useState } from "react";

export default function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    await navigator.clipboard.writeText(`${base}/access/${token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="text-xs bg-panel border border-cardBorder rounded-lg px-3 py-1.5"
    >
      {copied ? "Αντιγράφηκε" : "Αντιγραφή link"}
    </button>
  );
}
