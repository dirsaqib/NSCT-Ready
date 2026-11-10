"use client";
import { useState } from "react";
import { api } from "@/components/api";

type M = { role: "user" | "assistant"; content: string };

export default function Tutor() {
  const [msgs, setMsgs] = useState<M[]>([]);
  const [input, setInput] = useState("");
  const [lang, setLang] = useState("English");
  const [busy, setBusy] = useState(false);
  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const next: M[] = [...msgs, { role: "user", content: text.trim() }];
    setMsgs([...next, { role: "assistant", content: "Thinking..." }]);
    setBusy(true);
    try {
      const r = await api<{ text: string }>("/api/ai/chat", { body: { messages: next.slice(-12), lang } });
      setMsgs([...next, { role: "assistant", content: r.text }]);
    } catch (e) {
      setMsgs([...next, { role: "assistant", content: (e as Error).message }]);
    }
    setBusy(false);
  };
  return (
    <>
      <div className="top">
        <div><h1>AI tutor</h1><p className="sub">Ask anything from the NSCT syllabus. The tutor knows your weak subjects.</p></div>
        <select value={lang} onChange={(e) => setLang(e.target.value)} style={{ width: "auto" }}>{["English", "Urdu", "Roman Urdu"].map((l) => <option key={l}>{l}</option>)}</select>
      </div>
      <div className="grid tutorgrid">
        <div className="card">
          <div className="chat">
            {msgs.length ? msgs.map((m, i) => <div key={i} className={`msg ${m.role === "user" ? "u" : "a"}`}>{m.content}</div>) : <div className="empty">Ask your first question to start.</div>}
          </div>
          <form className="row" style={{ marginTop: 14, flexWrap: "nowrap" }} onSubmit={(e) => { e.preventDefault(); send(input); setInput(""); }}>
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. Explain normalization with an example" />
            <button className="btn" type="submit" disabled={busy}>Send</button>
          </form>
        </div>
        <div className="card flat">
          <h3>Try asking</h3>
          <div className="grid" style={{ gap: 8 }}>
            {["Explain Big-O with examples I can remember", "What is the difference between TCP and UDP?", "Give me 3 tricky SQL JOIN questions", "How should I manage time in a 60 question test?"].map((t) => (
              <button key={t} className="btn sec sm" style={{ whiteSpace: "normal", textAlign: "left" }} onClick={() => send(t)}>{t}</button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
