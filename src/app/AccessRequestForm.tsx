"use client";

import { useState } from "react";
import { requestAccessLink } from "./access-request/actions";
import { accessRequestMessage, type AccessRequestStatus } from "@/lib/accessRequest";

export default function AccessRequestForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<AccessRequestStatus | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const result = await requestAccessLink(email);
      setStatus(result.status);
    } catch {
      setStatus("send_failed");
    } finally {
      setLoading(false);
    }
  }

  const isGood = status === "sent";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="email"
        required
        placeholder="Το email σας"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="bg-panel border border-cardBorder rounded-xl px-4 py-3 text-sm"
      />
      <button
        type="submit"
        disabled={loading}
        className="bg-gold text-bg font-semibold rounded-xl py-3 text-sm disabled:opacity-60"
      >
        {loading ? "Έλεγχος..." : "Λήψη link πρόσβασης"}
      </button>
      {status && (
        <p className={`text-sm ${isGood ? "text-good" : "text-muted"}`}>
          {accessRequestMessage(status)}
        </p>
      )}
    </form>
  );
}
