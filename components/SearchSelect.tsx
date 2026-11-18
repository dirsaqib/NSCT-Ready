"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type Opt = { id: string; name: string; hint?: string; keywords?: string };

/**
 * A search box with a dropdown list. Type to filter, click to choose.
 * With allowFree, whatever is typed is kept even if nothing is chosen (sent as textName).
 */
export default function SearchSelect({ options, value, onChange, name, textName, placeholder = "Search or select", required, allowFree, onText, disabled }: {
  options: Opt[]; value: string; onChange: (id: string) => void; name?: string; textName?: string; placeholder?: string;
  required?: boolean; allowFree?: boolean; onText?: (t: string) => void; disabled?: boolean;
}) {
  const chosen = options.find((o) => o.id === value);
  const [q, setQ] = useState(chosen?.name ?? "");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (chosen) setQ(chosen.name); }, [chosen?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const list = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length || q === chosen?.name) return options.slice(0, 300);
    return options.filter((o) => { const n = `${o.name} ${o.hint ?? ""} ${o.keywords ?? ""}`.toLowerCase(); return words.every((w) => n.includes(w)); }).slice(0, 300);
  }, [q, options, chosen?.name]);
  const pick = (o: Opt) => { onChange(o.id); setQ(o.name); onText?.(o.name); setOpen(false); };
  const exact = options.some((o) => o.name.toLowerCase() === q.trim().toLowerCase());

  return (
    <div ref={box} style={{ position: "relative" }}>
      {name && <input type="hidden" name={name} value={value} />}
      {textName && <input type="hidden" name={textName} value={q.trim()} />}
      <input
        type="search" value={q} placeholder={placeholder} required={required} autoComplete="off" disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); onText?.(e.target.value); setOpen(true); if (value) onChange(""); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && open && list.length) { e.preventDefault(); pick(list[0]); }
          if (e.key === "Escape") setOpen(false);
        }}
        style={{ paddingRight: 30 }}
      />
      <span onClick={() => !disabled && setOpen(!open)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", cursor: "pointer", fontSize: 11, color: "var(--muted, #5E6B64)" }}>▼</span>
      {open && !disabled && (
        <div style={{ position: "absolute", zIndex: 30, left: 0, right: 0, top: "100%", maxHeight: 280, overflowY: "auto", background: "#fff", color: "#13201A", border: "1px solid #dfe5e1", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.12)", marginTop: 4 }}>
          {list.map((o) => (
            <div key={o.id} onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              style={{ padding: "8px 12px", cursor: "pointer", fontSize: 14, background: o.id === value ? "#eef6f1" : undefined }}>
              {o.name}{o.hint && <span style={{ color: "#5E6B64", fontSize: 12 }}> · {o.hint}</span>}
            </div>
          ))}
          {list.length === 0 && !allowFree && <div style={{ padding: "8px 12px", fontSize: 13, color: "#5E6B64" }}>No match. Check the spelling.</div>}
          {allowFree && q.trim().length > 2 && !exact && (
            <div onMouseDown={(e) => { e.preventDefault(); setOpen(false); }} style={{ padding: "8px 12px", fontSize: 13, color: "#0B6E4F", borderTop: "1px solid #eef1ef", cursor: "pointer" }}>
              Use &ldquo;{q.trim()}&rdquo; as typed
            </div>
          )}
        </div>
      )}
    </div>
  );
}
