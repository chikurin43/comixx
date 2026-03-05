"use client";

import { useEffect, useState } from "react";
import { probeSupabaseConnection, type ConnectionStatus } from "@/lib/supabase";

const statusLabel: Record<ConnectionStatus, string> = {
  idle: "Idle",
  loading: "Loading",
  success: "Success",
  error: "Error",
};

export function SupabaseProbeCard() {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [message, setMessage] = useState("Starting connectivity check...");

  useEffect(() => {
    let active = true;

    const run = async () => {
      setStatus("loading");
      setMessage("Running Supabase read probe...");

      const result = await probeSupabaseConnection();
      if (!active) {
        return;
      }

      setStatus(result.status);
      setMessage(result.message);
    };

    run();

    return () => {
      active = false;
    };
  }, []);

  return (
    <article className="card status-card" data-status={status}>
      <h3>Supabase Connectivity</h3>
      <p className="status-pill">{statusLabel[status]}</p>
      <p className="small">{message}</p>
    </article>
  );
}
