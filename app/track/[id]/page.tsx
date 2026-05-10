"use client";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { createClient } from "@supabase/supabase-js";
import { useParams } from "next/navigation";
import MapWrapper from "../../../components/MapWrapper";
import { dictionary, getLang, setLang as saveLang, type Lang } from "../../../lib/i18n";

const supabase = createClient((process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co"), (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "anon-key"));

function statusLabel(lang: Lang, status: string) {
  if (status === "delivered") return dictionary[lang].statusDelivered;
  if (status === "paused") return dictionary[lang].statusPaused;
  return dictionary[lang].statusInProgress;
}
function chipClass(status: string) { return status === "delivered" ? "status-chip green" : status === "paused" ? "status-chip yellow" : "status-chip"; }
function formatDate(value?: string | Date | null) { return value ? new Date(value).toLocaleString("ru-RU") : "—"; }
function fixedEta(delivery: any, route: any) {
  const base = delivery?.created_at || delivery?.route_started_at;
  if (!base || !route?.duration_hours) return delivery?.eta_at || null;
  const routeMinutes = Number(route.duration_hours || 0) * 60;
  const adjustmentMinutes = Number(delivery?.time_adjustment_minutes || 0);
  return new Date(new Date(base).getTime() + Math.max(0, routeMinutes + adjustmentMinutes) * 60 * 1000);
}

export default function TrackPage() {
  const params = useParams();
  const id = String(params.id || "");
  const [lang, setLang] = useState<Lang>("ru");
  const [delivery, setDelivery] = useState<any>(null);
  const [car, setCar] = useState<any>(null);
  const [route, setRoute] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const tr = dictionary[lang];

  useEffect(() => { setLang(getLang()); }, []);
  useEffect(() => { if (id) loadAll(); }, [id]);

  function changeLang(next: Lang) {
    setLang(next);
    saveLang(next);
  }

  async function loadAll() {
    setLoading(true);
    const { data: deliveryData } = await supabase.from("deliveries").select("*").eq("id", id).maybeSingle();
    if (!deliveryData) { setLoading(false); return; }
    setDelivery(deliveryData);
    const [carResult, routeResult, photosResult] = await Promise.all([
      supabase.from("cars").select("*").eq("id", deliveryData.car_id).maybeSingle(),
      supabase.from("routes").select("*").eq("id", deliveryData.route_id).maybeSingle(),
      supabase.from("route_photos").select("*").eq("delivery_id", id).order("taken_at", { ascending: false }),
    ]);
    const routeData = routeResult.data;
    let nextDelivery = deliveryData;
    if (deliveryData.status === "in_progress" && deliveryData.route_started_at && routeData?.duration_hours) {
      const durationMinutes = Math.max(1, Number(routeData.duration_hours || 0) * 60 + Number(deliveryData.time_adjustment_minutes || 0));
      const elapsedMinutes = Math.max(0, (Date.now() - new Date(deliveryData.route_started_at).getTime()) / 60000);
      const autoProgress = Math.min(elapsedMinutes / durationMinutes, 1);
      if (autoProgress > Number(deliveryData.progress || 0)) {
        const totalKm = Number(deliveryData.total_km || routeData.distance_km || 0);
        const updatePayload = { progress: autoProgress, passed_km: totalKm * autoProgress, status: autoProgress >= 1 ? "delivered" : "in_progress" };
        await supabase.from("deliveries").update(updatePayload).eq("id", id);
        nextDelivery = { ...deliveryData, ...updatePayload };
      }
    }
    setDelivery(nextDelivery);
    setCar(carResult.data);
    setRoute(routeData);
    setPhotos(photosResult.data || []);
    setLoading(false);
  }

  const cities = useMemo(() => Array.isArray(route?.cities) ? route.cities : [], [route]);
  if (loading) return <main className="app-bg" style={s.page}><section className="glass-card" style={s.empty}>{lang === "zh" ? "正在加载..." : "Загрузка трекера..."}</section></main>;
  if (!delivery) return <main className="app-bg" style={s.page}><section className="glass-card" style={s.empty}><h1>{lang === "zh" ? "未找到运输订单" : "Доставка не найдена"}</h1><a href="/" style={s.back}>{lang === "zh" ? "返回查询" : "Вернуться к поиску"}</a></section></main>;

  const progress = Math.round(Number(delivery.progress || 0) * 100);
  const totalKm = Number(delivery.total_km || route?.distance_km || 0);
  const passedKm = Math.round(Number(delivery.passed_km || 0));
  const remainingKm = Math.max(Math.round(totalKm - passedKm), 0);
  const number = car?.car_number || "T-000000";
  const eta = fixedEta(delivery, route);

  return (
    <main className="app-bg" style={s.page}>
      <section style={s.shell}>
        <header style={s.topBar}>
          <a href="/" style={s.back}>‹ {tr.tracker}</a>
          <div style={s.actions}>
            <div style={s.langSwitch}>
              <button onClick={() => changeLang("ru")} style={lang === "ru" ? s.langActive : s.langButton}>RU</button>
              <button onClick={() => changeLang("zh")} style={lang === "zh" ? s.langActive : s.langButton}>中文</button>
            </div>
          </div>
        </header>

        <section className="glass-card fade-up" style={s.hero}>
          <div style={s.headingBlock}>
            <div style={s.titleLine}><h1 style={s.title}>{number} · {car?.brand || "Auto"} {car?.model || ""}</h1><span className={chipClass(delivery.status)}>{statusLabel(lang, delivery.status)}</span></div>
            <p style={s.meta}>VIN: {car?.vin || "—"} · {lang === "zh" ? "颜色" : "Цвет"}: {car?.color || "—"} · {car?.year || ""}</p>
          </div>
          {car?.avatar_url && <img src={car.avatar_url} alt="vehicle" style={s.carImage} />}
        </section>

        <section style={s.metricGrid} className="mobile-stack">
          <Metric title={tr.eta} value={formatDate(eta)} sub={lang === "zh" ? "固定计算" : "Фиксированный расчёт"} />
          <Metric title={lang === "zh" ? "总里程" : "Всего маршрут"} value={totalKm ? `${Math.round(totalKm).toLocaleString("ru-RU")} км` : "—"} sub={lang === "zh" ? "路线距离" : "Дистанция маршрута"} />
          <Metric title={tr.progress} value={`${progress}%`} sub={lang === "zh" ? "当前订单" : "Текущая доставка"} />
        </section>

        <section className="glass-card" style={s.stepsCard}>
          <div style={s.routeLine}>
            {cities.map((city: any, index: number) => {
              const stepProgress = cities.length <= 1 ? 0 : index / (cities.length - 1);
              const done = Number(delivery.progress || 0) >= stepProgress;
              return <div key={`${city.name}-${index}`} style={s.step}><span style={done ? s.stepDone : s.stepFuture}>{done ? "✓" : ""}</span><strong>{city.name}</strong><small>{index === 0 ? (lang === "zh" ? "已接收" : "Старт") : index === cities.length - 1 ? (lang === "zh" ? "目的地" : "Финиш") : (lang === "zh" ? "在途" : "В пути")}</small></div>;
            })}
          </div>
          <div style={s.thinTrack}><div style={{ ...s.thinFill, width: `${progress}%` }} /></div>
        </section>

        <section style={s.mainGrid} className="mobile-stack">
          <div className="glass-card dark-map-glow" style={s.mapBox}>
            <MapWrapper deliveryId={id} />
          </div>
          <aside style={s.sideStack}>
            <div className="glass-card" style={s.sideCard}><h3>{lang === "zh" ? "运输信息" : "Информация о доставке"}</h3><Info label={lang === "zh" ? "起始地" : "Откуда"} value={route?.start_city || "—"} /><Info label={lang === "zh" ? "目的地" : "Куда"} value={route?.end_city || "—"} /><Info label={lang === "zh" ? "创建日期" : "Дата создания"} value={formatDate(delivery.created_at)} /><Info label={tr.eta} value={formatDate(eta)} /><Info label={lang === "zh" ? "当前状态" : "Статус"} value={statusLabel(lang, delivery.status)} /></div>
            <div className="glass-card" style={s.sideCard}><h3>{lang === "zh" ? "里程信息" : "Пробег"}</h3><Info label={lang === "zh" ? "总里程" : "Всего"} value={`${Math.round(totalKm)} км`} /><Info label={lang === "zh" ? "已行驶" : "Пройдено"} value={`${passedKm} км`} /><Info label={lang === "zh" ? "剩余里程" : "Осталось"} value={`${remainingKm} км`} /></div>
          </aside>
        </section>

        <section style={s.lowerGrid} className="mobile-stack">
          <div className="glass-card" style={s.panel}><h2>{lang === "zh" ? "路线节点" : "Точки маршрута"}</h2>{cities.map((city: any, index: number) => <div key={`${city.name}-timeline`} style={s.timelineItem}><span style={index === 0 ? s.timelineDone : index === cities.length - 1 ? s.timelineFuture : s.timelineCurrent} /><div><strong>{city.name}</strong><p>{index === 0 ? (lang === "zh" ? "已接收车辆" : "Автомобиль принят") : index === cities.length - 1 ? (lang === "zh" ? "目的地" : "Пункт прибытия") : (lang === "zh" ? "运输节点" : "Промежуточная точка")}</p></div></div>)}</div>
          <div className="glass-card" style={s.panel}><h2>{tr.photos}</h2>{photos.length === 0 && <p style={s.muted}>{lang === "zh" ? "暂无路线照片" : "Фото маршрута пока нет"}</p>}<div style={s.gallery}>{photos.map((photo) => <article key={photo.id} style={s.photo}><img src={photo.photo_url} alt={photo.city_name} /><strong>{photo.city_name}</strong><p>{photo.comment || "—"}</p></article>)}</div></div>
        </section>
      </section>
    </main>
  );
}

function Metric({ title, value, sub }: { title: string; value: string; sub: string }) { return <div className="glass-card hover-lift" style={s.metric}><span>{title}</span><strong>{value}</strong><small>{sub}</small></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div style={s.info}><span>{label}</span><strong>{value}</strong></div>; }

const s: Record<string, CSSProperties> = {
  page: { padding: "18px 16px 36px" }, shell: { maxWidth: 1380, margin: "0 auto" }, empty: { maxWidth: 520, margin: "120px auto", padding: 30, borderRadius: 20 }, topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }, back: { color: "var(--primary-2)", textDecoration: "none", fontWeight: 900 }, actions: { display: "flex", gap: 8 }, langSwitch: { display: "inline-flex", padding: 4, borderRadius: 999, background: "rgba(255,255,255,.72)", border: "1px solid rgba(23,105,255,.18)", backdropFilter: "blur(14px)", boxShadow: "var(--soft-shadow)" }, langButton: { border: 0, borderRadius: 999, padding: "9px 14px", background: "transparent", color: "#33516f", fontWeight: 900, cursor: "pointer" }, langActive: { border: 0, borderRadius: 999, padding: "9px 14px", background: "#1769ff", color: "white", fontWeight: 900, cursor: "pointer" }, hero: { position: "relative", minHeight: 142, borderRadius: 10, padding: "28px 30px", display: "flex", justifyContent: "space-between", alignItems: "center", overflow: "hidden" }, headingBlock: { position: "relative", zIndex: 2 }, titleLine: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }, title: { margin: 0, fontSize: "clamp(24px,2.8vw,36px)", letterSpacing: -.4 }, meta: { margin: "10px 0 0", color: "var(--muted)", fontWeight: 700 }, carImage: { width: "min(310px,32vw)", height: 120, objectFit: "cover", borderRadius: 12, filter: "drop-shadow(0 20px 28px rgba(0,0,0,.38))" }, metricGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 12 }, metric: { minHeight: 112, padding: 18, borderRadius: 10, display: "grid", alignContent: "center", gap: 8 }, muted: { color: "var(--muted)" }, stepsCard: { marginTop: 12, padding: 18, borderRadius: 10 }, routeLine: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 12, alignItems: "start" }, step: { display: "grid", justifyItems: "center", textAlign: "center", gap: 7, color: "var(--muted)", fontSize: 12 }, stepDone: { display: "grid", placeItems: "center", width: 25, height: 25, borderRadius: "50%", background: "var(--primary)", color: "white", boxShadow: "var(--glow)" }, stepFuture: { display: "grid", placeItems: "center", width: 25, height: 25, borderRadius: "50%", background: "rgba(100,116,139,.35)" }, thinTrack: { height: 4, background: "rgba(100,116,139,.28)", borderRadius: 999, marginTop: 14, overflow: "hidden" }, thinFill: { height: "100%", background: "linear-gradient(90deg,var(--primary),var(--cyan))", borderRadius: 999 }, mainGrid: { display: "grid", gridTemplateColumns: "1fr 320px", gap: 12, marginTop: 12 }, mapBox: { borderRadius: 10, padding: 10, overflow: "hidden" }, sideStack: { display: "grid", gap: 12 }, sideCard: { borderRadius: 10, padding: 18 }, info: { display: "flex", justifyContent: "space-between", gap: 14, padding: "10px 0", borderBottom: "1px solid var(--line)", color: "var(--muted)" }, lowerGrid: { display: "grid", gridTemplateColumns: "360px 1fr", gap: 12, marginTop: 12 }, panel: { borderRadius: 10, padding: 20 }, timelineItem: { display: "grid", gridTemplateColumns: "18px 1fr", gap: 12, marginTop: 14 }, timelineDone: { width: 13, height: 13, borderRadius: "50%", background: "var(--primary)", marginTop: 5 }, timelineCurrent: { width: 13, height: 13, borderRadius: "50%", background: "var(--cyan)", marginTop: 5, animation: "softPulse 2s infinite" }, timelineFuture: { width: 13, height: 13, borderRadius: "50%", background: "rgba(100,116,139,.5)", marginTop: 5 }, gallery: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }, photo: { border: "1px solid var(--line)", borderRadius: 12, padding: 10, background: "var(--panel-2)" },
};
