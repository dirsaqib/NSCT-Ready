// Small single-hue charts with hover tooltips. No chart library needed.

export function ColChart({ values, labels, every, suffix = "", height = 160 }: { values: number[]; labels: string[]; every?: number; suffix?: string; height?: number }) {
  const W = 640, H = height, pad = 30, n = Math.max(1, values.length), max = Math.max(1, ...values), bw = (W - pad) / n;
  const step = every ?? Math.ceil(n / 8);
  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} width="100%" role="img" style={{ display: "block" }}>
      {[0.5, 1].map((f) => (
        <g key={f}>
          <line x1={pad} x2={W} y1={H - (H - 12) * f} y2={H - (H - 12) * f} stroke="#E8EDE9" />
          <text x={pad - 6} y={H - (H - 12) * f + 4} textAnchor="end" fontSize="10" fill="#5E6B64">{Math.round(max * f)}{suffix}</text>
        </g>
      ))}
      <line x1={pad} x2={W} y1={H} y2={H} stroke="#C9D3CC" />
      {values.map((v, i) => {
        const h = ((H - 12) * v) / max, x = pad + i * bw;
        return (
          <g key={i}>
            <title>{`${labels[i]}: ${v}${suffix}`}</title>
            <rect x={x + 1} y={H - h} width={Math.max(1, bw - 2)} height={Math.max(0, h)} rx={Math.min(3, bw / 4)} fill="#0B6E4F" />
            <rect x={x} y={0} width={bw} height={H} fill="transparent" />
            {i % step === 0 && <text x={x + bw / 2} y={H + 16} textAnchor="middle" fontSize="10" fill="#5E6B64">{labels[i]}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function HBars({ rows, max, grade }: { rows: { label: string; sub?: string; v: number; text?: string }[]; max?: number; grade?: boolean }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.v));
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar-row" key={r.label} title={`${r.label}: ${r.text ?? r.v}`}>
          <div className="small"><b>{r.label}</b>{r.sub && <span className="muted tiny"> {r.sub}</span>}</div>
          <div className="bar"><i className={grade ? (r.v >= 70 ? "" : r.v >= 50 ? "w" : "b") : ""} style={{ width: `${Math.round((100 * r.v) / m)}%` }} /></div>
          <div className="small" style={{ textAlign: "right" }}>{r.text ?? r.v}</div>
        </div>
      ))}
    </div>
  );
}

export const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
