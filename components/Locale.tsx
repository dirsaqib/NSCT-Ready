"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { t as tr, type Locale } from "@/lib/i18n";
import { api } from "./api";

const Ctx = createContext<{ locale: Locale; set: (l: Locale) => void }>({ locale: "en", set: () => {} });

export function LocaleProvider({ initial, children }: { initial: Locale; children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(initial);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ur" ? "rtl" : "ltr";
  }, [locale]);
  const set = (l: Locale) => { setLocale(l); api("/api/me/locale", { method: "PATCH", body: { locale: l } }).catch(() => {}); };
  return <Ctx.Provider value={{ locale, set }}>{children}</Ctx.Provider>;
}

export function useT() {
  const { locale, set } = useContext(Ctx);
  return { t: (k: string) => tr(locale, k), locale, setLocale: set };
}

export function LanguageToggle() {
  const { t, locale, setLocale } = useT();
  const { update } = useSession();
  return <button className="btn sm sec" onClick={() => { setLocale(locale === "en" ? "ur" : "en"); update(); }}>{t("common.language")}</button>;
}
