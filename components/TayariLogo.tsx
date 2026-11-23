/** TayariHub logo: the graduation cap icon from public/tayari-icon.png plus the wordmark in text. */
export default function TayariLogo({ size = 38, light = false }: { size?: number; light?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
      <img src="/tayari-icon.png" alt="" width={size} height={size} style={{ width: size, height: size, ...(light ? { background: "#fff", borderRadius: 10, padding: 3 } : {}) }} />
      <span style={{ display: "grid", lineHeight: 1.05 }}>
        <b style={{ fontSize: size * 0.58, color: light ? "#fff" : "#14213D", letterSpacing: "-.01em", fontWeight: 800 }}>
          Tayari<span style={{ color: light ? "#5BE0B5" : "#13A384" }}>Hub</span>
        </b>
        <small style={{ marginTop: 3, fontSize: 8.5, letterSpacing: ".12em", color: light ? "#C9D6F5" : "#5B6782", fontWeight: 600 }}>TEST PREP &amp; ASSESSMENT PLATFORM</small>
      </span>
    </span>
  );
}
