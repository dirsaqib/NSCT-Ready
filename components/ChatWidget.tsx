"use client";
import { useEffect, useRef, useState } from "react";

type Msg = { from: "bot" | "me"; text: string; links?: { label: string; href: string }[] };

// Quick answers the assistant gives straight away. Anything else is passed to the team on WhatsApp.
const ANSWERS: { keys: RegExp; text: string; links?: { label: string; href: string }[] }[] = [
  { keys: /free|fee|cost|price|paisa|paise/i, text: "TayariHub is 100% free for every student. No card or payment is needed.", links: [{ label: "Register free", href: "/signup" }] },
  { keys: /date|when|kab|schedule|january/i, text: "NSCT 2027 is announced for 23 and 24 January 2027. Check the official announcement for any change." },
  { keys: /syllab|outline|topic|weight/i, text: "NSCT has 100 MCQs in 120 minutes. Problem Solving is 20%. Programming, DSA, Databases, Software Engineering, Web, AI/ML and Networks are 10% each. OS and Cyber Security are 5% each." },
  { keys: /mock|paper|test/i, text: "You get Mock 1, 2 and 3. Each student gets a random paper with guidance after every mock. Mock 2 opens after Mock 1.", links: [{ label: "Start preparing", href: "/signup" }] },
  { keys: /register|sign ?up|account|join/i, text: "Registering takes 2 minutes. You need your name, university, CNIC, email and mobile number.", links: [{ label: "Register now", href: "/signup" }, { label: "Sign in", href: "/signin" }] },
  { keys: /focal|universit|department|faculty|hod/i, text: "University focal persons can register their students in bulk, build a university question bank and see reports.", links: [{ label: "Focal person sign up", href: "/signup/focal" }] },
  { keys: /password|login|sign ?in|forgot/i, text: "Use Sign in with your email or university roll number. If your university registered you, your focal person gives you a temporary password.", links: [{ label: "Sign in", href: "/signin" }] },
  { keys: /video|lecture|material|notes|study/i, text: "Study materials have top video lectures for every subject, with short notes for every topic. They are inside your dashboard after you sign in." },
  { keys: /nts|ecat|net|mdcat|gat|nat/i, text: "NTS, NET/ECAT and MDCAT preparation is coming soon. Register now and you will be ready when it opens." },
];

const CHIPS = ["Is it free?", "When is NSCT 2027?", "NSCT syllabus", "How do mock tests work?", "I'm a focal person"];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "bot", text: "Assalam o Alaikum! I'm the TayariHub assistant. Ask me anything about NSCT preparation, or send a message to our team." }]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"chat" | "form" | "sent">("chat");
  const [form, setForm] = useState({ name: "", phone: "", message: "", website: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [waLink, setWaLink] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const wa = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, typing, mode]);
  useEffect(() => { const t = setTimeout(() => setNudge(true), 6000); return () => clearTimeout(t); }, []);

  function ask(q: string) {
    const text = q.trim();
    if (!text) return;
    setMsgs((m) => [...m, { from: "me", text }]);
    setInput(""); setTyping(true);
    const hit = ANSWERS.find((a) => a.keys.test(text));
    setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [...m, hit
        ? { from: "bot", text: hit.text, links: hit.links }
        : { from: "bot", text: "Good question. Let me pass it to our team so a real person can answer you on WhatsApp." }]);
      if (!hit) { setForm((f) => ({ ...f, message: text })); setMode("form"); }
    }, 650);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!/^[A-Za-z][A-Za-z .'-]{1,59}$/.test(form.name.trim())) return setErr("Enter your name using letters only.");
    if (form.phone && !/^(\+92|0)3\d{9}$/.test(form.phone.trim())) return setErr("Enter a mobile number like 03001234567, or leave it empty.");
    if (form.message.trim().length < 3) return setErr("Write your message first.");
    setBusy(true);
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, page: location.pathname }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not send. Please try again.");
      setMode("sent");
      setMsgs((m) => [...m, { from: "bot", text: d.whatsapp ? "Sent! Our team has your message on WhatsApp and will reply soon." : "Thanks! Your message is saved and our team will reply soon." }]);
      // Without the WhatsApp Cloud API, offer WhatsApp with the message ready so it still reaches the team.
      if (!d.whatsapp && wa) setWaLink(`https://wa.me/${wa.replace(/\D/g, "")}?text=${encodeURIComponent(`Assalam o Alaikum, I'm ${form.name.trim()}. ${form.message.trim()}`)}`);
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`cw ${open ? "open" : ""}`}>
      {!open && nudge && <button type="button" className="cw-nudge" onClick={() => setOpen(true)}>Need help preparing for NSCT? 👋</button>}
      <button type="button" className="cw-fab" aria-label={open ? "Close chat" : "Open chat"} onClick={() => setOpen((o) => !o)}>
        {open ? <span className="cw-x">×</span> : <img src="/tayari-icon.png" alt="" width={34} height={34} />}
        {!open && <span className="cw-dot" />}
      </button>
      {open && (
        <div className="cw-panel" role="dialog" aria-label="TayariHub assistant">
          <div className="cw-head">
            <span className="cw-avatar"><img src="/tayari-icon.png" alt="" width={30} height={30} /></span>
            <div><b>TayariHub Assistant</b><small><i /> Online · NSCT, mock tests and registration</small></div>
            <button type="button" className="cw-close" aria-label="Close chat" onClick={() => setOpen(false)}>×</button>
          </div>
          <div className="cw-body">
            {msgs.map((m, i) => (
              <div key={i} className={`cw-msg ${m.from}`}>
                <div className="cw-bubble">{m.text}{m.links && <div className="cw-links">{m.links.map((l) => <a key={l.href} href={l.href}>{l.label} →</a>)}</div>}</div>
              </div>
            ))}
            {typing && <div className="cw-msg bot"><div className="cw-bubble cw-typing"><i /><i /><i /></div></div>}
            {mode === "chat" && msgs.length < 3 && <div className="cw-chips">{CHIPS.map((c) => <button type="button" key={c} onClick={() => ask(c)}>{c}</button>)}</div>}
            {mode === "form" && (
              <form className="cw-form" onSubmit={send} noValidate>
                <input placeholder="Your name *" value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value.replace(/[^A-Za-z .'-]/g, "") })} />
                <input placeholder="Mobile (optional) 03001234567" inputMode="tel" value={form.phone} maxLength={13} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^\d+]/g, "") })} />
                <textarea placeholder="Your message *" rows={3} maxLength={1000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
                <input className="cw-hp" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} aria-hidden="true" />
                {err && <div className="cw-err">{err}</div>}
                <div className="cw-row"><button type="button" className="cw-ghost" onClick={() => setMode("chat")}>Back</button><button type="submit" className="cw-send" disabled={busy}>{busy ? "Sending…" : "Send to team"}</button></div>
              </form>
            )}
            {mode === "sent" && waLink && <a className="cw-wa" href={waLink} target="_blank" rel="noopener noreferrer">Open WhatsApp to send it now</a>}
            <div ref={end} />
          </div>
          {mode !== "form" && (
            <form className="cw-input" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
              <input placeholder="Ask about NSCT, mock tests, registration…" value={input} maxLength={300} onChange={(e) => setInput(e.target.value)} />
              <button type="submit" aria-label="Send">➤</button>
            </form>
          )}
          <div className="cw-foot">
            <button type="button" onClick={() => { setMode("form"); setErr(""); }}>💬 Message our team on WhatsApp</button>
          </div>
        </div>
      )}
    </div>
  );
}
