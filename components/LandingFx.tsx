"use client";
import { useEffect } from "react";

/** Front page effects: reveal on scroll, count-up numbers, header shadow and the mobile menu. */
export default function LandingFx() {
  useEffect(() => {
    const root = document.querySelector(".lp");
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.classList.add("fx");

    // Reveal sections as they scroll into view.
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    items.forEach((el) => (reduce ? el.classList.add("in") : io.observe(el)));
    // Safety net: anything already on screen, or anything still hidden after 2 seconds, is shown.
    const showAll = () => items.forEach((el) => el.classList.add("in"));
    requestAnimationFrame(() => items.forEach((el) => { const r = el.getBoundingClientRect(); if (r.top < window.innerHeight && r.bottom > 0) el.classList.add("in"); }));
    const safety = window.setTimeout(showAll, 2000);

    // Count numbers up from zero the first time they are seen.
    const counters = Array.from(root.querySelectorAll<HTMLElement>("[data-count]"));
    const co = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement; co.unobserve(el);
        const end = Number(el.dataset.count || 0);
        if (reduce || !end) continue;
        const t0 = performance.now(), dur = 1400;
        const step = (t: number) => {
          const p = Math.min(1, (t - t0) / dur), v = Math.round(end * (1 - Math.pow(1 - p, 3)));
          el.textContent = v.toLocaleString("en-US");
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.4 });
    counters.forEach((el) => co.observe(el));

    // Header shadow once the page scrolls.
    const top = root.querySelector(".lp-top");
    const onScroll = () => top?.classList.toggle("scrolled", window.scrollY > 8);
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });

    // Mobile menu.
    const btn = root.querySelector<HTMLButtonElement>(".lp-burger");
    const toggle = () => { const open = top?.classList.toggle("open"); btn?.setAttribute("aria-expanded", open ? "true" : "false"); };
    const close = (e: Event) => { if ((e.target as HTMLElement).closest(".lp-mnav a")) { top?.classList.remove("open"); btn?.setAttribute("aria-expanded", "false"); } };
    btn?.addEventListener("click", toggle); top?.addEventListener("click", close);

    return () => { window.clearTimeout(safety); io.disconnect(); co.disconnect(); window.removeEventListener("scroll", onScroll); btn?.removeEventListener("click", toggle); top?.removeEventListener("click", close); };
  }, []);
  return null;
}
