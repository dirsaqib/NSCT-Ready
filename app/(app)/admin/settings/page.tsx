"use client";
import { useState } from "react";
import { api } from "@/components/api";
import { Page, Card, useApi, Loading } from "@/components/ui";

const GROUPS: [string, string][] = [["branding", "Branding"], ["notify", "Notifications"], ["test", "Scoring and test rules"], ["pricing", "Pricing and free limits"], ["ai", "AI tutor"], ["reports", "HEC reports"], ["content", "Content"]];
const LABEL: Record<string, string> = {
  "branding.name": "Platform name", "branding.tagline": "Tagline", "branding.primaryColor": "Main colour",
  "notify.channels": "Default channels (comma separated: EMAIL, SMS, WHATSAPP)", "notify.reminderDays": "Reminder days before a test (comma separated)",
  "test.negativeMarking": "Negative marking per wrong answer (0 to 1)", "test.passMark": "Pass mark %", "test.multiSelectPartialCredit": "Partial credit on multi-select (true or false)",
  "test.autosaveSeconds": "Auto-save every (seconds)", "test.fastCompletionSecPerQuestion": "Flag if faster than (seconds per question)", "test.maxTabSwitches": "Flag after this many tab switches",
  "pricing.proMonthlyPkr": "Pro, 1 month (PKR)", "pricing.proThreeMonthPkr": "Pro, 3 months (PKR)", "pricing.freeMockLimit": "Free mock tests", "pricing.freeAiCallsPerDay": "Free AI calls per day",
  "ai.dailyLimit": "AI calls per day (Pro)", "reports.minGroup": "Minimum group size in HEC data", "reports.scheduleCron": "Weekly snapshot schedule", "content.helpEmail": "Help email",
};

/** Every configurable rule in one place. Changes apply within 30 seconds. */
export default function Settings() {
  const { data, error, reload } = useApi<{ settings: Record<string, unknown> }>("/api/admin/settings");
  const [msg, setMsg] = useState("");
  if (!data) return <Loading error={error} />;
  const parse = (orig: unknown, v: string) => (Array.isArray(orig) ? v.split(",").map((x) => x.trim()).filter(Boolean).map((x) => (typeof orig[0] === "number" ? Number(x) : x)) : typeof orig === "number" ? Number(v) : typeof orig === "boolean" ? v === "true" : v);
  return (
    <Page title="Settings" sub="Branding, notifications, scoring, pricing and limits.">
      {msg && <div className="notice info" style={{ marginBottom: 12 }}>{msg}</div>}
      <form onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const body = Object.fromEntries(Object.entries(data.settings).map(([k, orig]) => [k, parse(orig, String(f.get(k) ?? ""))]));
        await api("/api/admin/settings", { method: "PUT", body }).then(() => { setMsg("Saved. Changes apply within 30 seconds."); reload(); }).catch((er) => setMsg(er.message));
      }}>
        <div className="grid g2">
          {GROUPS.map(([g, title]) => (
            <Card key={g} title={title}>
              {Object.entries(data.settings).filter(([k]) => k.startsWith(`${g}.`)).map(([k, v]) => (
                <label key={k} className="f">{LABEL[k] ?? k}
                  {typeof v === "boolean" ? <select name={k} defaultValue={String(v)}><option value="true">Yes</option><option value="false">No</option></select>
                    : k === "branding.primaryColor" ? <input name={k} type="color" defaultValue={String(v)} />
                    : <input name={k} type={typeof v === "number" ? "number" : "text"} step="any" defaultValue={Array.isArray(v) ? v.join(", ") : String(v)} />}
                </label>
              ))}
            </Card>
          ))}
        </div>
        <div style={{ marginTop: 16 }}><button className="btn" type="submit">Save all settings</button></div>
      </form>
    </Page>
  );
}
