// Shown instantly while the next page loads, so navigation never feels frozen.
export default function Loading() {
  return (
    <div className="page-loading" aria-busy="true" aria-label="Loading">
      <div className="pl-bar" />
      <div className="pl-head" />
      <div className="pl-grid">
        <div className="pl-card" /><div className="pl-card" /><div className="pl-card" />
      </div>
      <div className="pl-block" />
    </div>
  );
}
