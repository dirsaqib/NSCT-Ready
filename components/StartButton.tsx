"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { type: string; subject?: string; topic?: string; difficulty?: number; assessmentCode?: string; label: string; className?: string; confirmText?: string };

export default function StartButton({ type, subject, topic, difficulty, assessmentCode, label, className, confirmText }: Props) {
  const r = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <>
      <button
        className={className ?? "btn"}
        disabled={busy}
        onClick={async () => {
          if (confirmText && !window.confirm(confirmText)) return;
          setBusy(true);
          setErr("");
          try {
            let device = "unknown";
            try { device = localStorage.getItem("nr-device") || crypto.randomUUID(); localStorage.setItem("nr-device", device); } catch { /* ignore */ }
            const r0 = await fetch("/api/tests", { method: "POST", headers: { "Content-Type": "application/json", "X-Device-Id": device }, body: JSON.stringify({ type, subject, topic: topic || undefined, difficulty, assessmentCode }) });
            const a = await r0.json();
            if (!r0.ok) { if (a.code === "PRO_REQUIRED") { r.push("/pro"); return; } throw new Error(a.error || "Could not start."); }
            r.push(`/test/${a.id}`);
          } catch (e) {
            setErr((e as Error).message);
            setBusy(false);
          }
        }}
      >
        {busy ? "Preparing..." : label}
      </button>
      {err && <div className="notice bad" style={{ marginTop: 10 }}>{err}</div>}
    </>
  );
}
