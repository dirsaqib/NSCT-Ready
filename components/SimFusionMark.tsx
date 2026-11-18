"use client";
import { useState } from "react";

/** "By SimFusion (Private) Limited", with the company logo once public/simfusion-logo.png is added. */
export default function SimFusionMark({ light = false }: { light?: boolean }) {
  const [logo, setLogo] = useState(true);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: light ? "#BFE0D2" : "var(--muted, #5E6B64)" }}>
      {logo && <img src="/simfusion-logo.png" alt="SimFusion" height={22} style={{ height: 22, width: "auto" }} onError={() => setLogo(false)} />}
      <span>A product of <b>SimFusion (Private) Limited</b></span>
    </span>
  );
}
