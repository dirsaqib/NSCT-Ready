// Radar chart of domain performance. Up to three series: me, university, national.
type Series = { name: string; values: (number | null)[]; color: string; dash?: string };

export default function Radar({ labels, series, size = 320 }: { labels: string[]; series: Series[]; size?: number }) {
  const c = size / 2, r = size / 2 - 50, n = labels.length;
  const pt = (i: number, v: number) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return [c + r * (v / 100) * Math.cos(a), c + r * (v / 100) * Math.sin(a)]; };
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size }} role="img" aria-label="Performance by domain">
      {[25, 50, 75, 100].map((g) => <polygon key={g} points={labels.map((_, i) => pt(i, g).join(",")).join(" ")} fill="none" stroke="#E2E8E3" />)}
      {labels.map((l, i) => {
        const [x, y] = pt(i, 118);
        return <g key={l}><line x1={c} y1={c} x2={pt(i, 100)[0]} y2={pt(i, 100)[1]} stroke="#E2E8E3" /><text x={x} y={y} fontSize="10" textAnchor="middle" dominantBaseline="middle" fill="#5E6B64">{l}</text></g>;
      })}
      {series.map((s) => (
        <g key={s.name}>
          <title>{`${s.name}: ${labels.map((l, i) => `${l} ${s.values[i] ?? "n/a"}%`).join(", ")}`}</title>
          <polygon points={s.values.map((v, i) => pt(i, v ?? 0).join(",")).join(" ")} fill={s.dash ? "none" : s.color} fillOpacity={0.15} stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} />
        </g>
      ))}
    </svg>
  );
}
