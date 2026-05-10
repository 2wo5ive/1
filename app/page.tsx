"use client";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { createClient } from "@supabase/supabase-js";
import { dictionary, getLang, setLang as saveLang, type Lang } from "../lib/i18n";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "anon-key");

export default function HomePage() {
  const [lang, setLang] = useState<Lang>("ru");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const tr = dictionary[lang];

  useEffect(() => setLang(getLang()), []);

  function changeLang(next: Lang) {
    setLang(next);
    saveLang(next);
  }

  async function findDeliveryByCar(carId: string) {
    const { data } = await supabase.from("deliveries").select("id").eq("car_id", carId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    return data;
  }

  async function searchTracker() {
    setError("");
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      setError(tr.emptySearch);
      return;
    }
    setLoading(true);
    const { data: directDelivery } = await supabase.from("deliveries").select("id").eq("id", cleanQuery).maybeSingle();
    if (directDelivery?.id) {
      window.location.href = `/track/${directDelivery.id}`;
      return;
    }
    const { data: cars } = await supabase.from("cars").select("id").or(`vin.ilike.${cleanQuery},car_number.ilike.${cleanQuery}`).limit(1);
    const car = cars?.[0];
    if (!car) {
      setLoading(false);
      setError(tr.notFoundCar);
      return;
    }
    const delivery = await findDeliveryByCar(car.id);
    setLoading(false);
    if (!delivery?.id) {
      setError(tr.notFoundDelivery);
      return;
    }
    window.location.href = `/track/${delivery.id}`;
  }

  return (
    <main style={s.page}>
      <section style={s.heroCard}>
        <div style={s.imageLayer} />
        <div style={s.topRow}>
          <div style={s.langSwitch}>
            <button onClick={() => changeLang("ru")} style={lang === "ru" ? s.langActive : s.langButton}>RU</button>
            <button onClick={() => changeLang("zh")} style={lang === "zh" ? s.langActive : s.langButton}>中文</button>
          </div>
        </div>
        <div style={s.searchPanel} className="fade-up">
          <h1 style={s.title}>{tr.clientHeadline}</h1>
          <p style={s.subtitle}>{tr.clientSubline}</p>
          <div style={s.searchBox}>
            <span style={s.searchIcon}>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && searchTracker()} placeholder={tr.searchPlaceholder} style={s.input} />
            <button onClick={searchTracker} disabled={loading} className="premium-button" style={s.button}>{loading ? "..." : tr.searchButton}</button>
          </div>
          <div style={s.example}>VIN · WBAXXX5C8EF712345 · AT-000001</div>
          {error && <div style={s.error}>{error}</div>}
        </div>
      </section>
    </main>
  );
}

const s: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", padding: 0, background: "#f6fbff" },
  heroCard: { position: "relative", minHeight: "100vh", overflow: "hidden" },
  imageLayer: { position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(247,251,255,.96) 0%,rgba(247,251,255,.72) 35%,rgba(247,251,255,.08) 78%), url('/hero-taotaoche.png') center / cover no-repeat" },
    topRow: { position: "relative", zIndex: 2, display: "flex", justifyContent: "flex-end", alignItems: "center", padding: "20px min(4vw,34px)" },
  logo: { width: 170, height: 70, objectFit: "contain" },
  langSwitch: { display: "inline-flex", padding: 4, borderRadius: 999, background: "rgba(255,255,255,.72)", border: "1px solid rgba(23,105,255,.18)", backdropFilter: "blur(14px)", boxShadow: "var(--soft-shadow)" },
  langButton: { border: 0, borderRadius: 999, padding: "9px 14px", background: "transparent", color: "#33516f", fontWeight: 900, cursor: "pointer" },
  langActive: { border: 0, borderRadius: 999, padding: "9px 14px", background: "#1769ff", color: "white", fontWeight: 900, cursor: "pointer" },
  searchPanel: { position: "relative", zIndex: 2, width: "min(560px, calc(100% - 32px))", margin: "min(8vh,86px) 0 0 min(6vw,76px)", padding: "34px", borderRadius: 28, background: "rgba(255,255,255,.42)", border: "1px solid rgba(255,255,255,.62)", boxShadow: "0 26px 70px rgba(15,72,140,.16)", backdropFilter: "blur(20px)" },
  title: { margin: 0, fontSize: "clamp(30px,4vw,52px)", lineHeight: 1.08, fontWeight: 900, letterSpacing: -1.2, color: "#0b1b34" },
  subtitle: { margin: "16px 0 32px", color: "#4a607a", fontSize: 17, lineHeight: 1.6, fontWeight: 700 },
  searchBox: { width: "100%", minHeight: 58, display: "grid", gridTemplateColumns: "34px 1fr 122px", alignItems: "center", padding: "0 8px 0 14px", border: "1px solid rgba(23,105,255,.20)", borderRadius: 16, background: "rgba(255,255,255,.76)", boxShadow: "var(--soft-shadow)", backdropFilter: "blur(14px)" },
  searchIcon: { color: "#6d83a0", fontSize: 18 },
  input: { width: "100%", height: 44, border: "0!important", background: "transparent!important", color: "#0b1b34", padding: "0 10px", outline: "none", fontWeight: 700 },
  button: { height: 44, borderRadius: 12 },
  example: { marginTop: 13, color: "#61758d", fontSize: 13, fontWeight: 700 },
  error: { marginTop: 14, color: "var(--red)", fontWeight: 800, background: "rgba(239,68,68,.10)", border: "1px solid rgba(239,68,68,.20)", borderRadius: 14, padding: 12 },
};
