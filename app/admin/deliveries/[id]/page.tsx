"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { createClient } from "@supabase/supabase-js";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const MapWrapper = dynamic(() => import("../../../../components/MapWrapper"), {
  ssr: false,
});

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co"),
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "anon-key")
);


function calculateFixedEta(delivery: any, route: any) {
  const base = delivery?.created_at || delivery?.route_started_at;
  if (!base || !route?.duration_hours) return delivery?.eta_at ? new Date(delivery.eta_at) : null;
  const routeMinutes = Number(route.duration_hours || 0) * 60;
  const adjustmentMinutes = Number(delivery?.time_adjustment_minutes || 0);
  return new Date(new Date(base).getTime() + Math.max(0, routeMinutes + adjustmentMinutes) * 60 * 1000);
}

export default function DeliveryAdminPage() {
  const params = useParams();
  const deliveryId = params.id as string;

  const [delivery, setDelivery] = useState<any>(null);
  const [car, setCar] = useState<any>(null);
  const [route, setRoute] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);

  const [progress, setProgress] = useState(0);
  const [passedKm, setPassedKm] = useState(0);
  const [totalKm, setTotalKm] = useState(0);
  const [status, setStatus] = useState("in_progress");

  const [kmInput, setKmInput] = useState("");
  const [addMinutes, setAddMinutes] = useState("");
  const [activeSection, setActiveSection] = useState<"delivery" | "map" | "photos" | "history">("delivery");

  const [etaInput, setEtaInput] = useState("");

  const [cityName, setCityName] = useState("");
  const [routePhotoFile, setRoutePhotoFile] = useState<File | null>(null);
  const [comment, setComment] = useState("");

  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    if (deliveryId) {
      loadAll();
    }
  }, [deliveryId]);

  useEffect(() => {
    const interval = setInterval(() => {
      autoMove();
    }, 1000);

    return () => clearInterval(interval);
  }, [status, progress, route, delivery]);


  async function logDeliveryAction(action: string, comment: string) {
    await supabase.from("action_logs").insert({
      user_name: "delivery_panel",
      user_role: "manager",
      action,
      entity_type: "delivery",
      entity_id: deliveryId,
      comment,
    });
  }

  async function loadAll() {
    const { data: deliveryData } = await supabase
      .from("deliveries")
      .select("*")
      .eq("id", deliveryId)
      .maybeSingle();

    if (!deliveryData) return;

    setDelivery(deliveryData);
    setProgress(Number(deliveryData.progress || 0));
    setPassedKm(Number(deliveryData.passed_km || 0));
    setTotalKm(Number(deliveryData.total_km || 0));
    setStatus(deliveryData.status || "in_progress");

    if (deliveryData.eta_at) {
      setEtaInput(deliveryData.eta_at.slice(0, 16));
    }

    if (deliveryData.car_id) {
      const { data: carData } = await supabase
        .from("cars")
        .select("*")
        .eq("id", deliveryData.car_id)
        .maybeSingle();

      setCar(carData);
    }

    if (deliveryData.route_id) {
      const { data: routeData } = await supabase
        .from("routes")
        .select("*")
        .eq("id", deliveryData.route_id)
        .maybeSingle();

      setRoute(routeData);

      if (Array.isArray(routeData?.cities) && routeData.cities.length > 0) {
        setCityName(routeData.cities[0].name);
      }
    }

    await loadPhotos();
  }

  async function loadPhotos() {
    const { data } = await supabase
      .from("route_photos")
      .select("*")
      .eq("delivery_id", deliveryId)
      .order("created_at", { ascending: false });

    setPhotos(data || []);
  }

  async function autoMove() {
    if (!delivery) return;
    if (status !== "in_progress") return;
    if (!route?.duration_hours) return;

    const durationMinutes = Number(route.duration_hours) * 60;
    const adjustmentMinutes = Number(delivery.time_adjustment_minutes || 0);
    const totalMinutes = Math.max(1, durationMinutes + adjustmentMinutes);

    const addProgress = 1 / (totalMinutes * 60);
    const newProgress = Math.min(progress + addProgress, 1);
    const newPassedKm = totalKm > 0 ? totalKm * newProgress : passedKm;

    const newStatus = newProgress >= 1 ? "delivered" : "in_progress";

    await supabase
      .from("deliveries")
      .update({
        progress: newProgress,
        passed_km: newPassedKm,
        status: newStatus,
      })
      .eq("id", deliveryId);

    setProgress(newProgress);
    setPassedKm(newPassedKm);
    setStatus(newStatus);
  }

  async function saveProgress(newProgress: number) {
    const safeProgress = Math.max(0, Math.min(newProgress, 1));
    const newPassedKm = totalKm > 0 ? totalKm * safeProgress : passedKm;

    await supabase
      .from("deliveries")
      .update({
        progress: safeProgress,
        passed_km: newPassedKm,
        status: safeProgress >= 1 ? "delivered" : "in_progress",
      })
      .eq("id", deliveryId);

    setProgress(safeProgress);
    setPassedKm(newPassedKm);
    setStatus(safeProgress >= 1 ? "delivered" : "in_progress");
  }

  async function addKm() {
    const km = Number(kmInput);

    if (!km || km <= 0) {
      alert("Введите километры больше 0");
      return;
    }

    if (!totalKm || totalKm <= 0) {
      alert("Откройте карту, чтобы система рассчитала километры маршрута");
      return;
    }

    await saveProgress((passedKm + km) / totalKm);
    await logDeliveryAction("add_delivery_km", `Добавлено километров: ${km}`);
    setKmInput("");
  }

  async function subtractKm() {
    const km = Number(kmInput);

    if (!km || km <= 0) {
      alert("Введите километры больше 0");
      return;
    }

    if (!totalKm || totalKm <= 0) {
      alert("Откройте карту, чтобы система рассчитала километры маршрута");
      return;
    }

    await saveProgress((passedKm - km) / totalKm);
    await logDeliveryAction("subtract_delivery_km", `Убрано километров: ${km}`);
    setKmInput("");
  }
async function pauseDelivery() {
    await supabase
      .from("deliveries")
      .update({ status: "paused" })
      .eq("id", deliveryId);

    setStatus("paused");
    await logDeliveryAction("pause_delivery", "Доставка поставлена на паузу");
  }

  async function continueDelivery() {
    await supabase
      .from("deliveries")
      .update({ status: "in_progress" })
      .eq("id", deliveryId);

    setStatus("in_progress");
    await logDeliveryAction("resume_delivery", "Доставка продолжена");
  }

  async function resetDelivery() {
    const { error } = await supabase
      .from("deliveries")
      .update({
        status: "in_progress",
        progress: 0,
        passed_km: 0,
        time_adjustment_minutes: 0,
        delivered_at: null,
        delete_after: null,
        route_started_at: new Date().toISOString(),
      })
      .eq("id", deliveryId);

    if (error) {
      alert("Ошибка сброса доставки: " + error.message);
      return;
    }

    setStatus("in_progress");
    setProgress(0);
    setPassedKm(0);

    await logDeliveryAction("reset_delivery", "Доставка сброшена");
    await loadAll();
    alert("Доставка сброшена");
  }

  async function confirmDelivered() {
    const now = new Date();
    const deleteAfter = new Date(now);
    deleteAfter.setMonth(deleteAfter.getMonth() + 3);

    await supabase
      .from("deliveries")
      .update({
        status: "delivered",
        progress: 1,
        passed_km: totalKm,
        delivered_at: now.toISOString(),
        delete_after: deleteAfter.toISOString(),
      })
      .eq("id", deliveryId);

    setStatus("delivered");
    setProgress(1);
    setPassedKm(totalKm);

    await logDeliveryAction("confirm_delivered", "Доставка подтверждена");
    alert("Доставка подтверждена");
  }

  async function adjustTimeToRoute(direction: "add" | "subtract") {
    const minutes = Number(addMinutes || 0);

    if (!minutes || minutes <= 0) {
      alert("Введите минуты больше 0");
      return;
    }

    const currentAdjustment = Number(delivery?.time_adjustment_minutes || 0);
    const newAdjustment =
      direction === "add"
        ? currentAdjustment + minutes
        : Math.max(0, currentAdjustment - minutes);

    const { data, error } = await supabase
      .from("deliveries")
      .update({ time_adjustment_minutes: newAdjustment })
      .eq("id", deliveryId)
      .select()
      .single();

    if (error) {
      alert("Ошибка изменения времени: " + error.message);
      return;
    }

    setDelivery(data);
    setAddMinutes("");

    await logDeliveryAction(
      direction === "add" ? "add_delivery_time" : "subtract_delivery_time",
      `${direction === "add" ? "Добавлено" : "Убрано"} времени: ${minutes} минут`
    );
    alert(direction === "add" ? "Время добавлено" : "Время убрано");
  }

  async function saveEta() {
    if (!etaInput) {
      alert("Выберите дату и время");
      return;
    }

    const { data } = await supabase
      .from("deliveries")
      .update({
        eta_at: new Date(etaInput).toISOString(),
      })
      .eq("id", deliveryId)
      .select()
      .single();

    setDelivery(data);
    await logDeliveryAction("save_eta", "Дата прибытия сохранена вручную");
    alert("Дата прибытия сохранена");
  }

  async function uploadRoutePhoto() {
    if (!routePhotoFile) {
      alert("Выберите фото с компьютера");
      return;
    }

    if (!cityName) {
      alert("Выберите город");
      return;
    }

    const fileExt = routePhotoFile.name.split(".").pop() || "jpg";
    const fileName = `${deliveryId}-${cityName}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("route-photos")
      .upload(fileName, routePhotoFile, {
        upsert: true,
      });

    if (uploadError) {
      alert("Ошибка загрузки фото: " + uploadError.message);
      return;
    }

    const { data: publicData } = supabase.storage
      .from("route-photos")
      .getPublicUrl(fileName);

    const photoUrl = publicData.publicUrl;

    const { error: insertError } = await supabase.from("route_photos").insert({
      delivery_id: deliveryId,
      city_name: cityName,
      photo_url: photoUrl,
      comment: comment.trim() || null,
    });

    if (insertError) {
      alert("Ошибка сохранения фото: " + insertError.message);
      return;
    }

    setRoutePhotoFile(null);
    setComment("");
    await loadPhotos();

    await logDeliveryAction("add_route_photo", `Добавлено фото для точки ${cityName}`);
    alert("Фото добавлено");
  }

  const progressPercent = Math.round(progress * 100);
  const remainingKm = Math.max(totalKm - passedKm, 0);

  const routeHours = Number(route?.duration_hours || 0);
  const adjustmentMinutes = Number(delivery?.time_adjustment_minutes || 0);
  const totalRouteMinutes = routeHours * 60 + adjustmentMinutes;
  const remainingMinutes = Math.max(
    0,
    Math.round(totalRouteMinutes * (1 - progress))
  );
  const remainingDays = Math.floor(remainingMinutes / 1440);
  const remainingHours = Math.floor((remainingMinutes % 1440) / 60);
  const remainingMins = remainingMinutes % 60;

  const autoEta = calculateFixedEta(delivery, route);

  const statusText =
    status === "paused"
      ? "На паузе"
      : status === "delivered"
      ? "Доставлено"
      : "В пути";
      if (!delivery) {
    return (
      <main style={{ padding: 30, fontFamily: "Arial" }}>
        <h1>Доставка не найдена</h1>
        <a href="/admin">← Назад в админку</a>
      </main>
    );
  }

  return (
    <main style={layout}>
      <aside style={sidebar}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>AutoTTC</div>

        <div style={{ color: "var(--primary-2)", fontSize: 14, marginBottom: 28 }}>
          Управление доставкой
        </div>

        <a href="/admin" style={{ textDecoration: "none" }}>
          <MenuItem>← Назад к списку</MenuItem>
        </a>

        <MenuItem active={activeSection === "delivery"} onClick={() => setActiveSection("delivery")}>Доставка</MenuItem>
        <MenuItem active={activeSection === "map"} onClick={() => setActiveSection("map")}>Карта</MenuItem>
        <MenuItem active={activeSection === "photos"} onClick={() => setActiveSection("photos")}>Фото</MenuItem>
        <MenuItem active={activeSection === "history"} onClick={() => setActiveSection("history")}>История</MenuItem>
      </aside>

      <section style={{ padding: 28 }}>
        <header style={header}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {car?.avatar_url && (
              <img src={car.avatar_url} alt="car" style={bigAvatar} />
            )}

            <div>
              <h1 style={{ margin: 0, fontSize: 34 }}>
                {car
                  ? `${car.car_number || "—"} · ${car.brand} ${car.model}`
                  : "Управление доставкой"}
              </h1>

              <p style={{ color: "var(--muted)", marginTop: 6 }}>
                VIN: {car?.vin || "—"} · Цвет: {car?.color || "—"} · Маршрут:{" "}
                {route?.name || "—"}
              </p>
            </div>
          </div>

          <button onClick={() => setActiveSection("map")} style={primaryButton}>
            Показать карту
          </button>
        </header>

        <section style={heroCard}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <p style={{ margin: "0 0 8px", color: "#bfdbfe" }}>
                Текущий статус
              </p>

              <h2 style={{ margin: 0, fontSize: 32 }}>{statusText}</h2>
            </div>

            <div style={statusBadge}>{progressPercent}%</div>
          </div>

          <div style={{ marginTop: 28 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <span>Прогресс доставки</span>
              <strong>{progressPercent}%</strong>
            </div>

            <div style={progressBarBg}>
              <div
                style={{
                  height: "100%",
                  width: `${progressPercent}%`,
                  background: "#38bdf8",
                }}
              />
            </div>
          </div>
        </section>

        <section style={statsGrid}>
          <InfoCard title="Всего маршрут" value={`${Math.round(totalKm)} км`} />
          <InfoCard title="Пройдено" value={`${Math.round(passedKm)} км`} />
          <InfoCard title="Осталось" value={`${Math.round(remainingKm)} км`} />
          <InfoCard
            title="Время маршрута"
            value={`${routeHours || 0} ч. + ${adjustmentMinutes} мин.`}
          />
          <InfoCard
            title="Осталось ехать"
            value={`${remainingDays} дн. ${remainingHours} ч. ${remainingMins} мин.`}
          />
          <InfoCard title="Расчётная дата прибытия" value={autoEta ? autoEta.toLocaleString("ru-RU") : "—"} />
        </section>
        <section style={cardGrid}>
          <Card title="Управление движением">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button onClick={pauseDelivery}>Пауза</Button>
              <Button onClick={continueDelivery}>Продолжить</Button>
              <Button onClick={resetDelivery}>Сброс</Button>
              <Button onClick={confirmDelivered}>Подтвердить доставку</Button>
            </div>
          </Card>

          <Card title="Корректировка километров">
            <Input
              type="number"
              value={kmInput}
              onChange={(event: any) => setKmInput(event.target.value)}
              placeholder="Сколько км"
            />

            <div style={{ display: "flex", gap: 10 }}>
              <Button onClick={addKm}>Прибавить км</Button>
              <Button onClick={subtractKm}>Убавить км</Button>
            </div>
          </Card>

          <Card title="Корректировка времени в пути">
            <label style={label}>Минуты</label>
            <Input
              type="number"
              value={addMinutes}
              onChange={(event: any) => setAddMinutes(event.target.value)}
              placeholder="Например 30"
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button onClick={() => adjustTimeToRoute("add")}>Добавить минуты</Button>
              <Button onClick={() => adjustTimeToRoute("subtract")}>Убрать минуты</Button>
            </div>
          </Card>

          <Card title="Ручная корректировка даты прибытия">
            <Input
              type="datetime-local"
              value={etaInput}
              onChange={(event: any) => setEtaInput(event.target.value)}
            />

            <Button onClick={saveEta}>Сохранить дату</Button>
          </Card>

          <Card title="Фото машины по маршруту">
            <label style={label}>Город</label>

            <select
              value={cityName}
              onChange={(event) => setCityName(event.target.value)}
              style={input}
            >
              {Array.isArray(route?.cities) &&
                route.cities.map((city: any) => (
                  <option key={city.name} value={city.name}>
                    {city.name}
                  </option>
                ))}
            </select>

            <label style={label}>Фото с компьютера</label>

            <input
              type="file"
              accept="image/*"
              onChange={(event) =>
                setRoutePhotoFile(event.target.files?.[0] || null)
              }
              style={input}
            />

            <label style={label}>Комментарий</label>

            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Например: машина на автовозе, всё по графику"
              style={{
                ...input,
                minHeight: 90,
                resize: "vertical",
              }}
            />

            <Button onClick={uploadRoutePhoto}>Загрузить фото</Button>
          </Card>

          <Card title="Последние фото">
            <div style={{ display: "grid", gap: 12 }}>
              {photos.map((photo) => (
                <div key={photo.id} style={photoRow}>
                  <img
                    src={photo.photo_url}
                    alt="Фото машины"
                    style={photoThumb}
                  />

                  <div>
                    <strong>{photo.city_name}</strong>
                    <div style={{ color: "var(--muted)", fontSize: 13 }}>
                      {photo.comment || "Без комментария"}
                    </div>
                    <div style={{ color: "#9ca3af", fontSize: 12 }}>
                      {new Date(photo.created_at).toLocaleString("ru-RU")}
                    </div>
                  </div>
                </div>
              ))}

              {!photos.length && (<div style={{ color: "var(--muted)" }}>Фото пока нет</div>
              )}
            </div>
          </Card>
        </section>

        {activeSection === "map" && (
          <section style={widePanel}>
            <h2 style={{ marginTop: 0 }}>Карта маршрута</h2>
            <div style={embeddedMap}>
              <MapWrapper deliveryId={deliveryId} />
            </div>
          </section>
        )}

        {activeSection === "photos" && (
          <section style={widePanel}>
            <h2 style={{ marginTop: 0 }}>Фото по маршруту</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {photos.map((photo) => (
                <div key={photo.id} style={photoRow}>
                  <img src={photo.photo_url} alt="Фото машины" style={photoThumb} />
                  <div>
                    <strong>{photo.city_name}</strong>
                    <div style={{ color: "var(--muted)", fontSize: 13 }}>{photo.comment || "Без комментария"}</div>
                    <div style={{ color: "#9ca3af", fontSize: 12 }}>{new Date(photo.created_at).toLocaleString("ru-RU")}</div>
                  </div>
                </div>
              ))}
              {!photos.length && <div style={{ color: "var(--muted)" }}>Фото пока нет</div>}
            </div>
          </section>
        )}

        {activeSection === "history" && (
          <section style={widePanel}>
            <h2 style={{ marginTop: 0 }}>История</h2>
            <div style={{ color: "var(--muted)" }}>История действий доступна в разделе “Логи” админки. Подробная лента доставки будет добавлена следующим этапом.</div>
          </section>
        )}
      </section>

      {showMap && (
        <div onClick={() => setShowMap(false)} style={modalOverlay}>
          <div onClick={(event) => event.stopPropagation()} style={mapModal}>
            <button
              onClick={() => setShowMap(false)}
              style={closeButton}
            >
              Закрыть
            </button>

            <MapWrapper deliveryId={deliveryId} />
          </div>
        </div>
      )}
    </main>
  );
}
function MenuItem({ children, active, onClick }: any) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "12px 14px",
        borderRadius: 14,
        marginBottom: 8,
        background: active ? "var(--primary)" : "transparent",
        color: active ? "white" : "var(--text)",
        fontWeight: active ? 800 : 500,
        cursor: "pointer",
      }}
    >
      {children}
    </div>
  );
}

function Card({ title, children }: any) {
  return (
    <section style={card}>
      <h2 style={{ margin: "0 0 16px", fontSize: 22 }}>{title}</h2>
      {children}
    </section>
  );
}

function InfoCard({ title, value }: any) {
  return (
    <div style={infoCard}>
      <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 8 }}>
        {title}
      </div>
      <strong style={{ fontSize: 20 }}>{value}</strong>
    </div>
  );
}

function Button({ children, onClick }: any) {
  return (
    <button onClick={onClick} style={primaryButton}>
      {children}
    </button>
  );
}

function Input(props: any) {
  return <input {...props} style={input} />;
}

const layout: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(135deg,#f7fbff,#eef6ff)",
  fontFamily: "Arial, sans-serif",
  color: "var(--text)",
  display: "grid",
  gridTemplateColumns: "220px 1fr",
};

const sidebar: CSSProperties = {
  background: "rgba(255,255,255,.88)",
  color: "var(--text)",
  padding: 22,
  minHeight: "100vh",
  borderRight: "1px solid var(--line)",
  boxShadow: "8px 0 30px rgba(25,78,140,.06)",
};

const header: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "center",
  marginBottom: 24,
};

const bigAvatar: CSSProperties = {
  width: 74,
  height: 74,
  borderRadius: 22,
  objectFit: "cover",
  background: "var(--text)",
};

const heroCard: CSSProperties = {
  background: "linear-gradient(135deg,#1769ff,#0d63f3)",
  color: "white",
  borderRadius: 24,
  padding: 28,
  marginBottom: 20,
  boxShadow: "0 20px 50px rgba(23,105,255,.22)",
};

const statusBadge: CSSProperties = {
  background: "rgba(255,255,255,.15)",
  padding: "12px 18px",
  borderRadius: 999,
  fontWeight: 900,
  height: "fit-content",
};

const progressBarBg: CSSProperties = {
  height: 14,
  background: "rgba(255,255,255,.25)",
  borderRadius: 999,
  overflow: "hidden",
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 16,
  marginBottom: 24,
};

const infoCard: CSSProperties = {
  background: "var(--panel)",
  borderRadius: 22,
  padding: 20,
  boxShadow: "var(--soft-shadow)",
};

const cardGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 20,
};

const card: CSSProperties = {
  background: "var(--panel)",
  borderRadius: 24,
  padding: 18,
  boxShadow: "var(--soft-shadow)",
};

const primaryButton: CSSProperties = {
  border: "none",
  borderRadius: 14,
  padding: "12px 16px",
  background: "var(--primary)",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const input: CSSProperties = {
  width: "100%",
  padding: 13,
  borderRadius: 14,
  border: "1px solid var(--line)",
  color: "var(--text)",
  background: "rgba(255,255,255,.88)",
  boxSizing: "border-box",
  marginBottom: 12,
};

const label: CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "var(--muted)",
  marginBottom: 6,
  fontWeight: 700,
};

const photoRow: CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  border: "1px solid var(--line)",
  borderRadius: 16,
  padding: 10,
};

const photoThumb: CSSProperties = {
  width: 72,
  height: 54,
  objectFit: "cover",
  borderRadius: 12,
  background: "var(--text)",
};

const modalOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.65)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};

const mapModal: CSSProperties = {
  width: "min(1100px, 96vw)",
  height: "min(720px, 86vh)",
  background: "var(--panel)",
  borderRadius: 24,
  overflow: "hidden",
  position: "relative",
  boxShadow: "0 30px 80px rgba(0,0,0,.35)",
};

const closeButton: CSSProperties = {
  position: "absolute",
  top: 14,
  right: 14,
  zIndex: 10000,
  border: "none",
  borderRadius: 12,
  padding: "10px 14px",
  background: "var(--red)",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};


const widePanel: CSSProperties = {
  background: "var(--panel)",
  borderRadius: 24,
  padding: 22,
  marginTop: 22,
  boxShadow: "var(--soft-shadow)",
};

const embeddedMap: CSSProperties = {
  height: 520,
  borderRadius: 20,
  overflow: "hidden",
  border: "1px solid var(--line)",
};
