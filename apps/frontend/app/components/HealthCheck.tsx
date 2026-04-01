"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "ok" | "error";

export default function HealthCheck() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  async function check() {
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("http://localhost:8000/api/v1/health");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatus("ok");
      setMessage(JSON.stringify(data));
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={check}
        disabled={status === "loading"}
        className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-background transition-colors hover:bg-[#383838] disabled:opacity-50"
      >
        {status === "loading" ? "Checking..." : "Ping Backend"}
      </button>

      {status === "ok" && (
        <p className="text-sm text-green-600 dark:text-green-400">
          Backend OK &mdash; {message}
        </p>
      )}
      {status === "error" && (
        <p className="text-sm text-red-500">
          Error: {message}
        </p>
      )}
    </div>
  );
}
