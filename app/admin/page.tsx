"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { createClient } from "@supabase/supabase-js";
import { buildRouteCities, calculateOsrmRoute, CAR_BRANDS, CAR_MODELS } from "../../lib/osrm";
import { CITY_OPTIONS } from "../../lib/cities";

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co"),
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "anon-key")
);

type Role = "manager" | "admin";
type Tab = "deliveries" | "cars" | "routes" | "users" | "logs";
type Lang = "ru" | "zh";

const TEXT = {
  ru: {
    loginTitle: "Вход в Admin Panel",
    loginSubtitle: "Панель управления доставками AutoTTC",
    login: "Логин",
    password: "Пароль",
    enter: "Войти",
    logout: "Выйти",
    panel: "Admin Panel",
    deliveries: "Доставки",
    cars: "Автомобили",
    routes: "Маршруты",
    users: "Пользователи",
    logs: "Логи",
    addCar: "+ Добавить машину",
    addRoute: "+ Добавить маршрут",
    addUser: "+ Добавить пользователя",
    search: "Поиск по ID, VIN, модели, маршруту",
  },
  zh: {
    loginTitle: "登录 Admin Panel",
    loginSubtitle: "AutoTTC 运输管理面板",
    login: "账号",
    password: "密码",
    enter: "登录",
    logout: "退出",
    panel: "Admin Panel",
    deliveries: "运输",
    cars: "车辆",
    routes: "路线",
    users: "用户",
    logs: "日志",
    addCar: "+ 添加车辆",
    addRoute: "+ 添加路线",
    addUser: "+ 添加用户",
    search: "按 ID、VIN、车型、路线搜索",
  },
};

function generateCarNumber(existingCars: any[]) {
  const next = existingCars.length + 1;
  return `AT-${String(next).padStart(6, "0")}`;
}

export default function AdminPage() {
  const [lang, setLang] = useState<Lang>("zh");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("deliveries");

  const [loginValue, setLoginValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [loginError, setLoginError] = useState("");

  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [cars, setCars] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [carSearch, setCarSearch] = useState("");
  const [carSort, setCarSort] = useState("newest");
  const [logSearch, setLogSearch] = useState("");
  const [logActionFilter, setLogActionFilter] = useState("all");
  const [isMobile, setIsMobile] = useState(false);

  const [showCreateDelivery, setShowCreateDelivery] = useState(false);
  const [showCreateRoute, setShowCreateRoute] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [editingRoute, setEditingRoute] = useState<any>(null);

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [vin, setVin] = useState("");
  const [color, setColor] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const [startCity, setStartCity] = useState("");
  const [endCity, setEndCity] = useState("");

  const [routeStartCity, setRouteStartCity] = useState("");
  const [routeEndCity, setRouteEndCity] = useState("");
  const [durationHours, setDurationHours] = useState("120");
  const [routePoints, setRoutePoints] = useState<any[]>([]);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("manager");

  const t = TEXT[lang];
  const role: Role | null = currentUser?.role || null;

  useEffect(() => {
    const updateMobile = () => setIsMobile(window.innerWidth < 800);
    updateMobile();
    window.addEventListener("resize", updateMobile);
    return () => window.removeEventListener("resize", updateMobile);
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem("autottc_user");
    const savedLang = localStorage.getItem("autottc_lang") as Lang | null;

    if (savedLang === "ru" || savedLang === "zh") {
      setLang(savedLang);
    }

    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }

    loadAll();
  }, []);

  async function loadAll() {
    const { data: deliveriesData } = await supabase
      .from("deliveries")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: carsData } = await supabase
      .from("cars")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: routesData } = await supabase
      .from("routes")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: logsData } = await supabase
      .from("action_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    const { data: usersData } = await supabase
      .from("app_users")
      .select("*")
      .order("created_at", { ascending: false });

    setDeliveries(deliveriesData || []);
    setCars(carsData || []);
    setRoutes(routesData || []);
    setLogs(logsData || []);
    setUsers(usersData || []);
  }

  async function logAction(
    action: string,
    entityType?: string,
    entityId?: string,
    comment?: string
  ) {
    await supabase.from("action_logs").insert({
      user_name: currentUser?.username || "unknown",
      user_role: currentUser?.role || "unknown",
      action,
      entity_type: entityType || null,
      entity_id: entityId || null,
      comment: comment || null,
    });
  }

  async function login() {
    const username = loginValue.trim().toLowerCase();
    const password = passwordValue.trim();

    const { data: user } = await supabase
      .from("app_users")
      .select("*")
      .eq("username", username)
      .eq("password", password)
      .eq("is_active", true)
      .maybeSingle();

    if (!user) {
      setLoginError(lang === "ru" ? "Неверный логин или пароль" : "账号或密码错误");
      return;
    }

    setCurrentUser(user);
    localStorage.setItem("autottc_user", JSON.stringify(user));
    localStorage.setItem("autottc_lang", lang);
    setLoginError("");

    await supabase.from("action_logs").insert({
      user_name: user.username,
      user_role: user.role,
      action: "login",
      entity_type: "user",
      entity_id: user.id,
      comment: "Пользователь вошёл в Admin Panel",
    });

    await loadAll();
  }

  async function logout() {
    await logAction("logout", "user", currentUser?.id, "Пользователь вышел");
    localStorage.removeItem("autottc_user");
    setCurrentUser(null);
    setLoginValue("");
    setPasswordValue("");
  }

  function changeLang(nextLang: Lang) {
    setLang(nextLang);
    localStorage.setItem("autottc_lang", nextLang);
  }

  function getCar(carId: string) {
    return cars.find((car) => car.id === carId);
  }

  function getRoute(routeId: string) {
    return routes.find((route) => route.id === routeId);
  }

  function findRouteByCities(from: string, to: string) {
    return routes.find((route) => {
      return (
        String(route.start_city || "").trim().toLowerCase() ===
          from.trim().toLowerCase() &&
        String(route.end_city || "").trim().toLowerCase() ===
          to.trim().toLowerCase()
      );
    });
  }

  async function uploadAvatar(carId: string) {
    if (!avatarFile) return null;

    const fileExt = avatarFile.name.split(".").pop() || "jpg";
    const fileName = `${carId}-${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage
      .from("car-avatars")
      .upload(fileName, avatarFile, { upsert: true });

    if (error) {
      alert("Ошибка загрузки аватарки: " + error.message);
      return null;
    }

    const { data } = supabase.storage.from("car-avatars").getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function createDelivery() {
    if (!avatarFile) {
      alert("Загрузите аватарку машины");
      return;
    }

    if (!brand.trim() || !model.trim() || !vin.trim()) {
      alert("Заполните марку, модель и VIN");
      return;
    }

    if (!startCity.trim() || !endCity.trim()) {
      alert("Заполните точку отправления и точку прибытия");
      return;
    }

    const route = findRouteByCities(startCity, endCity);

    if (!route) {
      alert("Маршрут не найден, обратитесь к администратору");
      return;
    }

    const carNumber = generateCarNumber(cars);

    const { data: car, error: carError } = await supabase
      .from("cars")
      .insert({
        car_number: carNumber,
        brand: brand.trim(),
        model: model.trim(),
        year: year ? Number(year) : null,
        vin: vin.trim(),
        color: color.trim() || null,
      })
      .select()
      .single();

    if (carError || !car) {
      alert("Ошибка создания машины: " + carError?.message);
      return;
    }

    const avatarUrl = await uploadAvatar(car.id);

    if (!avatarUrl) {
      return;
    }

    await supabase
      .from("cars")
      .update({ avatar_url: avatarUrl })
      .eq("id", car.id);

    const createdAt = new Date();
    const etaAt = new Date(createdAt.getTime() + Number(route.duration_hours || 0) * 60 * 60 * 1000);

    const { data: delivery, error: deliveryError } = await supabase
      .from("deliveries")
      .insert({
        car_id: car.id,
        route_id: route.id,
        status: "in_progress",
        progress: 0,
        total_km: Number(route.distance_km || 0),
        passed_km: 0,
        time_adjustment_minutes: 0,
        route_started_at: createdAt.toISOString(),
        eta_at: etaAt.toISOString(),
      })
      .select()
      .single();

    if (deliveryError || !delivery) {
      alert("Ошибка создания доставки: " + deliveryError?.message);
      return;
    }

    await logAction("create_car", "car", car.id, `Создан автомобиль ${carNumber}, VIN ${vin}`);
    await logAction(
      "create_delivery",
      "delivery",
      delivery.id,
      `Создана машина ${carNumber}, VIN ${vin}, маршрут ${route.start_city} → ${route.end_city}`
    );

    setBrand("");
    setModel("");
    setYear("");
    setVin("");
    setColor("");
    setStartCity("");
    setEndCity("");
    setAvatarFile(null);
    setShowCreateDelivery(false);

    await loadAll();
  }

  function addRoutePoint() {
    setRoutePoints([...routePoints, { name: "", lat: "", lng: "" }]);
  }

  function updateRoutePoint(index: number, field: string, value: string) {
    setRoutePoints((points) =>
      points.map((point, i) =>
        i === index ? { ...point, [field]: value } : point
      )
    );
  }

  function removeRoutePoint(index: number) {
    setRoutePoints(routePoints.filter((_, i) => i !== index));
  }

  function normalizeRoutePoints() {
    return routePoints
      .map((point) => ({
        name: String(point.name || "").trim(),
        lat: Number(point.lat),
        lng: Number(point.lng),
      }))
      .filter((point) => {
        return point.name && Number.isFinite(point.lat) && Number.isFinite(point.lng);
      });
  }

  async function createRoute() {
    if (role !== "admin") {
      alert("Недостаточно прав. Обратитесь к администратору.");
      return;
    }

    if (!routeStartCity.trim() || !routeEndCity.trim()) {
      alert("Заполните точку отправления и точку прибытия");
      return;
    }

    const points = await buildRouteCities(routeStartCity, routeEndCity, normalizeRoutePoints());

    if (!points) {
      alert("Не удалось определить координаты отправления или прибытия. Уточните названия городов или добавьте координаты промежуточных точек.");
      return;
    }

    const osrm = await calculateOsrmRoute(points);

    if (!osrm) {
      alert("Не удалось построить маршрут по дорогам через OSRM. Проверьте координаты городов.");
      return;
    }

    const { data: route, error } = await supabase
      .from("routes")
      .insert({
        name: `${routeStartCity.trim()} — ${routeEndCity.trim()}`,
        start_city: routeStartCity.trim(),
        end_city: routeEndCity.trim(),
        duration_hours: Number(durationHours || 120),
        cities: points,
        geometry: osrm.geometry,
        distance_km: osrm.distanceKm,
        is_active: true,
      })
      .select()
      .single();

    if (error || !route) {
      alert("Ошибка создания маршрута: " + error?.message);
      return;
    }

    await logAction(
      "create_route",
      "route",
      route.id,
      `Создан маршрут ${routeStartCity} → ${routeEndCity}`
    );
    setRouteStartCity("");
    setRouteEndCity("");
    setDurationHours("120");
    setRoutePoints([]);
    setShowCreateRoute(false);

    await loadAll();
  }

  function startEditRoute(route: any) {
    if (role !== "admin") {
      alert("Недостаточно прав. Обратитесь к администратору.");
      return;
    }

    setEditingRoute(route);
    setRouteStartCity(route.start_city || "");
    setRouteEndCity(route.end_city || "");
    setDurationHours(String(route.duration_hours || 120));

    if (Array.isArray(route.cities) && route.cities.length > 0) {
      setRoutePoints(
        route.cities.map((city: any) => ({
          name: String(city.name || ""),
          lat: String(city.lat || ""),
          lng: String(city.lng || ""),
        }))
      );
    }
  }

  async function saveRouteEdit() {
    if (!editingRoute) return;

    if (role !== "admin") {
      alert("Недостаточно прав. Обратитесь к администратору.");
      return;
    }

    if (!routeStartCity.trim() || !routeEndCity.trim()) {
      alert("Заполните точку отправления и точку прибытия");
      return;
    }

    const points = await buildRouteCities(routeStartCity, routeEndCity, normalizeRoutePoints());

    if (!points) {
      alert("Не удалось определить координаты отправления или прибытия. Уточните названия городов или добавьте координаты промежуточных точек.");
      return;
    }

    const osrm = await calculateOsrmRoute(points);

    if (!osrm) {
      alert("Не удалось построить маршрут по дорогам через OSRM. Проверьте координаты городов.");
      return;
    }

    const { error } = await supabase
      .from("routes")
      .update({
        name: `${routeStartCity.trim()} — ${routeEndCity.trim()}`,
        start_city: routeStartCity.trim(),
        end_city: routeEndCity.trim(),
        duration_hours: Number(durationHours || 120),
        cities: points,
        geometry: osrm.geometry,
        distance_km: osrm.distanceKm,
      })
      .eq("id", editingRoute.id);

    if (error) {
      alert("Ошибка сохранения маршрута: " + error.message);
      return;
    }

    await logAction(
      "edit_route",
      "route",
      editingRoute.id,
      `Изменён маршрут ${routeStartCity} → ${routeEndCity}`
    );

    setEditingRoute(null);
    setRouteStartCity("");
    setRouteEndCity("");
    setDurationHours("120");
    setRoutePoints([]);

    await loadAll();
  }

  async function deleteRoute(route: any) {
    if (role !== "admin") { alert("Недостаточно прав. Обратитесь к администратору."); return; }
    const used = deliveries.some((delivery) => delivery.route_id === route.id);
    if (used) { alert("Нельзя удалить маршрут, который уже используется в доставках."); return; }
    if (!confirm(`Удалить маршрут ${route.name || route.start_city + " — " + route.end_city}?`)) return;
    const { error } = await supabase.from("routes").delete().eq("id", route.id);
    if (error) { alert("Ошибка удаления маршрута: " + error.message); return; }
    await logAction("delete_route", "route", route.id, `Удалён маршрут ${route.name || ""}`);
    await loadAll();
  }

  async function createUser() {
    if (role !== "admin") {
      alert("Недостаточно прав. Обратитесь к администратору.");
      return;
    }

    if (!newUsername.trim() || !newPassword.trim()) {
      alert("Введите логин и пароль");
      return;
    }

    const { data: user, error } = await supabase
      .from("app_users")
      .insert({
        username: newUsername.trim().toLowerCase(),
        password: newPassword.trim(),
        role: newRole,
        is_active: true,
      })
      .select()
      .single();

    if (error || !user) {
      alert("Ошибка создания пользователя: " + error?.message);
      return;
    }

    await logAction(
      "create_user",
      "user",
      user.id,
      `Создан пользователь ${newUsername}`
    );

    setNewUsername("");
    setNewPassword("");
    setNewRole("manager");
    setShowCreateUser(false);

    await loadAll();
  }


  async function editUser(user: any) {
    if (role !== "admin") {
      alert("Недостаточно прав. Обратитесь к администратору.");
      return;
    }

    const username = prompt("Новый логин", user.username);
    if (username === null) return;

    const password = prompt("Новый пароль. Оставьте пустым, если пароль менять не нужно", "");
    if (password === null) return;

    const roleValue = prompt("Роль: admin или manager", user.role || "manager");
    if (roleValue === null) return;

    const nextRole = roleValue.trim().toLowerCase() === "admin" ? "admin" : "manager";
    const updatePayload: any = {
      username: username.trim().toLowerCase(),
      role: nextRole,
    };

    if (password.trim()) {
      updatePayload.password = password.trim();
    }

    if (!updatePayload.username) {
      alert("Логин не может быть пустым");
      return;
    }

    const { error } = await supabase
      .from("app_users")
      .update(updatePayload)
      .eq("id", user.id);

    if (error) {
      alert("Ошибка обновления пользователя: " + error.message);
      return;
    }

    await logAction("edit_user", "user", user.id, `Изменён пользователь ${updatePayload.username}`);
    await loadAll();
  }

  async function toggleUserActive(user: any) {
    if (role !== "admin") {
      alert("Недостаточно прав. Обратитесь к администратору.");
      return;
    }

    await supabase
      .from("app_users")
      .update({ is_active: !user.is_active })
      .eq("id", user.id);

    await logAction(
      "toggle_user",
      "user",
      user.id,
      `${user.username}: ${!user.is_active ? "активирован" : "заблокирован"}`
    );

    await loadAll();
  }


  async function deleteCar(car: any) {
    if (role !== "admin") {
      alert("Удалять автомобили может только администратор.");
      return;
    }
    if (!confirm(`Подтвердите удаление автомобиля ${car.car_number || car.vin || ""}?`)) return;
    const related = deliveries.filter((delivery) => delivery.car_id === car.id);
    if (related.length > 0 && !confirm("У этого автомобиля есть доставки. Удалить автомобиль и связанные доставки?")) return;
    if (related.length > 0) {
      await supabase.from("deliveries").delete().eq("car_id", car.id);
    }
    const { error } = await supabase.from("cars").delete().eq("id", car.id);
    if (error) {
      alert("Ошибка удаления автомобиля: " + error.message);
      return;
    }
    await logAction("delete_car", "car", car.id, `Удалён автомобиль ${car.car_number || ""} VIN ${car.vin || ""}`);
    await loadAll();
  }

  async function confirmDelivered(delivery: any) {
    const now = new Date();
    const deleteAfter = new Date(now);
    deleteAfter.setMonth(deleteAfter.getMonth() + 3);

    await supabase
      .from("deliveries")
      .update({
        status: "delivered",
        progress: 1,
        delivered_at: now.toISOString(),
        delete_after: deleteAfter.toISOString(),
      })
      .eq("id", delivery.id);

    await logAction(
      "confirm_delivered",
      "delivery",
      delivery.id,
      "Доставка подтверждена. Запущен таймер удаления через 3 месяца."
    );

    await loadAll();
  }

  function getRemainingTime(delivery: any) {
    const route = getRoute(delivery.route_id);
    const durationHours = Number(route?.duration_hours || 0);
    const adjustmentMinutes = Number(delivery.time_adjustment_minutes || 0);
    const progress = Number(delivery.progress || 0);

    const totalMinutes = durationHours * 60 + adjustmentMinutes;
    const remainingMinutes = Math.max(
      0,
      Math.round(totalMinutes * (1 - progress))
    );

    const days = Math.floor(remainingMinutes / 1440);
    const hours = Math.floor((remainingMinutes % 1440) / 60);
    const minutes = remainingMinutes % 60;

    return `${days} дн. ${hours} ч. ${minutes} мин.`;
  }

  function getFullRouteTime(delivery: any) {
    const route = getRoute(delivery.route_id);
    const durationHours = Number(route?.duration_hours || 0);
    const adjustmentMinutes = Number(delivery.time_adjustment_minutes || 0);
    const totalMinutes = durationHours * 60 + adjustmentMinutes;
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = Math.round(totalMinutes % 60);

    return `${days} дн. ${hours} ч. ${minutes} мин.`;
  }

  const filteredCars = useMemo(() => {
    const query = carSearch.trim().toLowerCase();
    const list = cars.filter((car) => {
      const text = `${car.car_number || ""} ${car.brand || ""} ${car.model || ""} ${car.vin || ""} ${car.color || ""}`.toLowerCase();
      return !query || text.includes(query);
    });
    return [...list].sort((a, b) => {
      const av = new Date(a.created_at || 0).getTime();
      const bv = new Date(b.created_at || 0).getTime();
      return carSort === "oldest" ? av - bv : bv - av;
    });
  }, [cars, carSearch, carSort]);

  const activeDeliveries = useMemo(() => {
    return deliveries.filter((delivery) => delivery.status !== "delivered");
  }, [deliveries]);

  const filteredDeliveries = activeDeliveries.filter((delivery) => {
    const car = getCar(delivery.car_id);
    const route = getRoute(delivery.route_id);

    const text = `${car?.car_number || ""} ${car?.brand || ""} ${
      car?.model || ""
    } ${car?.vin || ""} ${route?.start_city || ""} ${
      route?.end_city || ""
    } ${delivery.status || ""}`.toLowerCase();

    const matchesText = text.includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || delivery.status === statusFilter;

    return matchesText && matchesStatus;
  });

  const logActions = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.action).filter(Boolean))).sort();
  }, [logs]);

  const filteredLogs = logs.filter((log) => {
    const text = `${log.user_name || ""} ${log.user_role || ""} ${log.action || ""} ${log.entity_type || ""} ${log.comment || ""}`.toLowerCase();
    const matchesText = text.includes(logSearch.trim().toLowerCase());
    const matchesAction = logActionFilter === "all" || log.action === logActionFilter;
    return matchesText && matchesAction;
  });

  if (!currentUser) {
    return (
      <main style={loginPage}>
        <section style={loginCard}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ color: "var(--primary-2)", fontWeight: 900 }}>AutoTTC</div>
              <h1 style={{ margin: "8px 0 8px", fontSize: 34 }}>
                {t.loginTitle}
              </h1>
              <p style={{ color: "var(--muted)", marginTop: 0 }}>
                {t.loginSubtitle}
              </p>
            </div>

            <select
              value={lang}
              onChange={(event) => changeLang(event.target.value as Lang)}
              style={smallSelect}
            >
              <option value="ru">🇷🇺 RU</option>
              <option value="zh">🇨🇳 中文</option>
            </select>
          </div>

          <label style={labelStyle}>{t.login}</label>
          <input
            value={loginValue}
            onChange={(event) => setLoginValue(event.target.value)}
            placeholder="admin / manager"
            style={inputStyle}
          />

          <label style={labelStyle}>{t.password}</label>
          <input
            value={passwordValue}
            onChange={(event) => setPasswordValue(event.target.value)}
            type="password"
            placeholder="admin / manager"
            style={inputStyle}
          />

          {loginError && <div style={warningBox}>{loginError}</div>}

          <button onClick={login} style={{ ...primaryButton, width: "100%" }}>
            {t.enter}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main style={isMobile ? mobileLayout : layout}>
      <aside style={isMobile ? mobileSidebar : sidebar}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>AutoTTC</div>

        <div style={{ color: "var(--primary-2)", fontSize: 14, marginBottom: 18 }}>
          {t.panel}
        </div>

        <select
          value={lang}
          onChange={(event) => changeLang(event.target.value as Lang)}
          style={sideSelect}
        >
          <option value="ru">🇷🇺 Русский</option>
          <option value="zh">🇨🇳 中文</option>
        </select>

        <div style={roleBadge}>
          {currentUser.username} · {currentUser.role}
        </div>

        <MenuItem active={tab === "deliveries"} onClick={() => setTab("deliveries")}>
          {t.deliveries}
        </MenuItem>

        <MenuItem active={tab === "cars"} onClick={() => setTab("cars")}>
          {t.cars}
        </MenuItem>

        <MenuItem active={tab === "routes"} onClick={() => setTab("routes")}>
          {t.routes}
        </MenuItem>

        {role === "admin" && (
          <MenuItem active={tab === "users"} onClick={() => setTab("users")}>
            {t.users}
          </MenuItem>
        )}

        <MenuItem active={tab === "logs"} onClick={() => setTab("logs")}>
          {t.logs}
        </MenuItem>

        <button onClick={logout} style={logoutButton}>
          {t.logout}
        </button>
      </aside>

      <section style={isMobile ? mobileContent : { padding: 28, minWidth: 0 }}>
        {tab === "deliveries" && (
          <>
            <Header
              title={t.deliveries}
              subtitle="Активные доставки, время маршрута и остаток пути."
              button={t.addCar}
              onClick={() => setShowCreateDelivery(true)}
            />

            <Stats deliveries={deliveries} />

            <div style={isMobile ? mobileFilterCard : filterCard}>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t.search}
                style={inputStyle}
              />

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                style={inputStyle}
              >
                <option value="all">Все статусы</option>
                <option value="in_progress">В пути</option>
                <option value="paused">На паузе</option>
                <option value="draft">Черновик</option>
              </select>
            </div>
            <DeliveryTable
              deliveries={filteredDeliveries}
              cars={cars}
              routes={routes}
              getRemainingTime={getRemainingTime}
              getFullRouteTime={getFullRouteTime}
              onConfirmDelivered={confirmDelivered}
            />
          </>
        )}

        {tab === "cars" && (
          <>
            <Header title={t.cars} subtitle="Полная база автомобилей." />
            <div style={isMobile ? mobileFilterCard : filterCard}>
              <input value={carSearch} onChange={(event) => setCarSearch(event.target.value)} placeholder="Поиск по ID, VIN, марке, модели" style={inputStyle} />
              <select value={carSort} onChange={(event) => setCarSort(event.target.value)} style={inputStyle}>
                <option value="newest">Сначала новые</option>
                <option value="oldest">Сначала старые</option>
              </select>
            </div>
            <CarsTable cars={filteredCars} deliveries={deliveries} onDelete={deleteCar} role={role} />
          </>
        )}

        {tab === "routes" && (
          <>
            <Header
              title={t.routes}
              subtitle="Маршруты видят все. Добавлять и редактировать может только админ."
              button={t.addRoute}
              onClick={() => {
                if (role !== "admin") {
                  alert("Недостаточно прав. Обратитесь к администратору.");
                  return;
                }
                setShowCreateRoute(true);
              }}
            />

            <RoutesTable routes={routes} role={role} onEdit={startEditRoute} onDelete={deleteRoute} />
          </>
        )}

        {tab === "users" && role === "admin" && (
          <>
            <Header
              title={t.users}
              subtitle="Создание менеджеров и управление доступом."
              button={t.addUser}
              onClick={() => setShowCreateUser(true)}
            />

            <UsersTable users={users} onToggle={toggleUserActive} onEdit={editUser} />
          </>
        )}

        {tab === "logs" && (
          <>
            <Header title={t.logs} subtitle="Расширенный журнал действий." />
            <div style={isMobile ? mobileFilterCard : filterCard}>
              <input
                value={logSearch}
                onChange={(event) => setLogSearch(event.target.value)}
                placeholder="Поиск по пользователю, действию, комментарию"
                style={inputStyle}
              />
              <select
                value={logActionFilter}
                onChange={(event) => setLogActionFilter(event.target.value)}
                style={inputStyle}
              >
                <option value="all">Все действия</option>
                {logActions.map((action) => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
            </div>
            <LogsTable logs={filteredLogs} />
          </>
        )}
      </section>

      <datalist id="city-options">
        {CITY_OPTIONS.map((city) => (<option key={city.ru} value={city.ru} label={`${city.zh} · ${city.pinyin}`} />))}
      </datalist>

      {showCreateDelivery && (
        <Modal onClose={() => setShowCreateDelivery(false)}>
          <h2 style={modalTitle}>Добавить машину</h2>

          <label style={labelStyle}>Точка отправления</label>
          <input value={startCity} onChange={(event) => setStartCity(event.target.value)} list="city-options" placeholder="Выберите город: 中文 · pinyin" style={inputStyle} />

          <label style={labelStyle}>Точка прибытия</label>
          <input value={endCity} onChange={(event) => setEndCity(event.target.value)} list="city-options" placeholder="Выберите город: 中文 · pinyin" style={inputStyle} />

          <label style={labelStyle}>Аватарка машины</label>
          <input
            type="file"
            accept="image/*"
            onChange={(event) =>
              setAvatarFile(event.target.files?.[0] || null)
            }
            style={inputStyle}
          />

          <label style={labelStyle}>Марка</label>
          <select value={brand} onChange={(event) => setBrand(event.target.value)} style={inputStyle}>
            <option value="">Выберите марку</option>
            {CAR_BRANDS.map((item) => (<option key={item.en} value={item.en}>{item.zh} · {item.en}</option>))}
          </select>

          <label style={labelStyle}>Модель</label>
          <select value={model} onChange={(event) => setModel(event.target.value)} style={inputStyle}>
            <option value="">Выберите модель</option>
            {CAR_MODELS.map((item) => (<option key={item.en} value={item.en}>{item.zh} · {item.en}</option>))}
          </select>

          <label style={labelStyle}>Год</label>
          <input
            value={year}
            onChange={(event) => setYear(event.target.value)}
            type="number"
            style={inputStyle}
          />

          <label style={labelStyle}>VIN</label>
          <input
            value={vin}
            onChange={(event) => setVin(event.target.value)}
            style={inputStyle}
          />

          <label style={labelStyle}>Цвет</label>
          <input
            value={color}
            onChange={(event) => setColor(event.target.value)}
            style={inputStyle}
          />

          <Actions>
            <SecondaryButton onClick={() => setShowCreateDelivery(false)}>
              Отмена
            </SecondaryButton>

            <PrimaryButton onClick={createDelivery}>
              Создать
            </PrimaryButton>
          </Actions>
        </Modal>
      )}

      {showCreateRoute && (
        <Modal onClose={() => setShowCreateRoute(false)}>
          <h2 style={modalTitle}>Добавить маршрут</h2>

          <label style={labelStyle}>Точка отправления</label>
          <input value={routeStartCity} onChange={(event) => setRouteStartCity(event.target.value)} list="city-options" placeholder="Выберите город: 中文 · pinyin" style={inputStyle} />

          <label style={labelStyle}>Точка прибытия</label>
          <input value={routeEndCity} onChange={(event) => setRouteEndCity(event.target.value)} list="city-options" placeholder="Выберите город: 中文 · pinyin" style={inputStyle} />

          <label style={labelStyle}>Длительность (часы)</label>
          <input
            value={durationHours}
            onChange={(event) => setDurationHours(event.target.value)}
            type="number"
            style={inputStyle}
          />

          <label style={labelStyle}>Промежуточные точки маршрута · можно оставить пусто</label>
          {routePoints.map((point, index) => (
            <div key={index} style={routePointRow}>
              <input
                value={point.name}
                onChange={(event) =>
                  updateRoutePoint(index, "name", event.target.value)
                }
                placeholder="Название"
                style={miniInput}
              />
              <input
                value={point.lat}
                onChange={(event) =>
                  updateRoutePoint(index, "lat", event.target.value)
                }
                placeholder="Широта"
                style={miniInput}
              />
              <input
                value={point.lng}
                onChange={(event) =>
                  updateRoutePoint(index, "lng", event.target.value)
                }
                placeholder="Долгота"
                style={miniInput}
              />
              <button
                onClick={() => removeRoutePoint(index)}
                style={dangerSmallButton}
              >
                ×
              </button>
            </div>
          ))}

          <button onClick={addRoutePoint} style={smallButton}>
            + Добавить промежуточную точку
          </button>

          <Actions>
            <SecondaryButton onClick={() => setShowCreateRoute(false)}>
              Отмена
            </SecondaryButton>

            <PrimaryButton onClick={createRoute}>
              Создать
            </PrimaryButton>
          </Actions>
        </Modal>
      )}

      {editingRoute && (
        <Modal onClose={() => setEditingRoute(null)}>
          <h2 style={modalTitle}>Редактировать маршрут</h2>

          <label style={labelStyle}>Точка отправления</label>
          <input value={routeStartCity} onChange={(event) => setRouteStartCity(event.target.value)} list="city-options" placeholder="Выберите город: 中文 · pinyin" style={inputStyle} />

          <label style={labelStyle}>Точка прибытия</label>
          <input value={routeEndCity} onChange={(event) => setRouteEndCity(event.target.value)} list="city-options" placeholder="Выберите город: 中文 · pinyin" style={inputStyle} />

          <label style={labelStyle}>Длительность (часы)</label>
          <input
            value={durationHours}
            onChange={(event) => setDurationHours(event.target.value)}
            type="number"
            style={inputStyle}
          />

          <label style={labelStyle}>Промежуточные точки маршрута · можно оставить пусто</label>
          {routePoints.map((point, index) => (
            <div key={index} style={routePointRow}>
              <input
                value={point.name}
                onChange={(event) =>
                  updateRoutePoint(index, "name", event.target.value)
                }
                placeholder="Название"
                style={miniInput}
              />
              <input
                value={point.lat}
                onChange={(event) =>
                  updateRoutePoint(index, "lat", event.target.value)
                }
                placeholder="Широта"
                style={miniInput}
              />
              <input
                value={point.lng}
                onChange={(event) =>
                  updateRoutePoint(index, "lng", event.target.value)
                }
                placeholder="Долгота"
                style={miniInput}
              />
              <button
                onClick={() => removeRoutePoint(index)}
                style={dangerSmallButton}
              >
                ×
              </button>
            </div>
          ))}

          <button onClick={addRoutePoint} style={smallButton}>
            + Добавить промежуточную точку
          </button>

          <Actions>
            <SecondaryButton onClick={() => setEditingRoute(null)}>
              Отмена
            </SecondaryButton>

            <PrimaryButton onClick={saveRouteEdit}>
              Сохранить
            </PrimaryButton>
          </Actions>
        </Modal>
      )}

      {showCreateUser && (
        <Modal onClose={() => setShowCreateUser(false)}>
          <h2 style={modalTitle}>Добавить пользователя</h2>

          <label style={labelStyle}>Логин</label>
          <input
            value={newUsername}
            onChange={(event) => setNewUsername(event.target.value)}
            style={inputStyle}
          />

          <label style={labelStyle}>Пароль</label>
          <input
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            type="password"
            style={inputStyle}
          />

          <label style={labelStyle}>Роль</label>
          <select
            value={newRole}
            onChange={(event) => setNewRole(event.target.value as Role)}
            style={inputStyle}
          >
            <option value="manager">Менеджер</option>
            <option value="admin">Администратор</option>
          </select>

          <Actions>
            <SecondaryButton onClick={() => setShowCreateUser(false)}>
              Отмена
            </SecondaryButton>

            <PrimaryButton onClick={createUser}>
              Создать
            </PrimaryButton>
          </Actions>
        </Modal>
      )}
    </main>
  );
}

function MenuItem({ children, active, onClick }: any) {
  return (
    <div
      onClick={onClick}
      style={{
        ...menuItem,
        background: active ? "var(--primary)" : "transparent",
        color: active ? "white" : "var(--text)",
      }}
    >
      {children}
    </div>
  );
}

function Stat({ title, value }: any) {
  return (
    <div style={statCard}>
      <div style={muted}>{title}</div>
      <strong style={{ fontSize: 28 }}>{value}</strong>
    </div>
  );
}

function Status({ status }: any) {
  const label =
    status === "paused"
      ? "На паузе"
      : status === "delivered"
      ? "Доставлено"
      : status === "in_progress"
      ? "В пути"
      : "Черновик";

  return <span style={statusBadge}>{label}</span>;
}

function Header({ title, subtitle, button, onClick }: any) {
  return (
    <div style={headerStyle}>
      <div>
        <h2 style={{ margin: 0, fontSize: 26 }}>{title}</h2>
        {subtitle && (
          <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>{subtitle}</p>
        )}
      </div>
      {button && (
        <button onClick={onClick} style={primaryButton}>
          {button}
        </button>
      )}
    </div>
  );
}

function Stats({ deliveries }: any) {
  const total = deliveries.length;
  const active = deliveries.filter((d: any) => d.status === "in_progress").length;
  const delivered = deliveries.filter((d: any) => d.status === "delivered").length;
  const paused = deliveries.filter((d: any) => d.status === "paused").length;

  return (
    <div style={statsGrid}>
      <Stat title="Всего" value={total} />
      <Stat title="В пути" value={active} />
      <Stat title="Доставлено" value={delivered} />
      <Stat title="На паузе" value={paused} />
    </div>
  );
}

function DeliveryTable({ deliveries, cars, routes, getRemainingTime, getFullRouteTime, onConfirmDelivered }: any) {
  if (deliveries.length === 0) return <Empty text="Нет активных доставок" />;

  return (
    <div style={tableCard}>
      <TableHeader
        cols="54px 1.1fr 1.1fr .8fr .8fr 156px"
        items={["Аватар", "Машина", "Маршрут", "Осталось", "Время", "Действие"]}
      />
      {deliveries.map((delivery: any) => {
        const car = cars.find((c: any) => c.id === delivery.car_id);
        const route = routes.find((r: any) => r.id === delivery.route_id);

        return (
          <div key={delivery.id} style={{ ...tableRow, gridTemplateColumns: "54px 1.1fr 1.1fr .8fr .8fr 156px" }}>
            <a href={`/admin/deliveries/${delivery.id}`} title="Открыть доставку">
              <img src={car?.avatar_url || "/placeholder.png"} alt="car" style={avatar} />
            </a>
            <div>
              <strong>{car?.car_number || "—"}</strong>
              <div style={muted}>
                {car?.brand} {car?.model} · VIN: {car?.vin}
              </div>
            </div>
            <div>
              <strong>{route?.start_city} → {route?.end_city}</strong>
              <Status status={delivery.status} />
            </div>
            <div style={{ fontWeight: 700 }}>
              {getRemainingTime(delivery)}
            </div>
            <div style={muted}>{getFullRouteTime(delivery)}</div>
            <div style={{ display: "flex", gap: 8 }}>
  <a href={`/admin/deliveries/${delivery.id}`} style={outlineButton}>
    Открыть
  </a>

  {delivery.status !== "delivered" && (
    <button
      onClick={() => onConfirmDelivered(delivery)}
      style={greenButton}
    >
      Доставлено
    </button>
  )}
</div>
          </div>
        );
      })}
    </div>
  );
}

function CarsTable({ cars, deliveries, onDelete, role }: any) {
  if (cars.length === 0) return <Empty text="Нет автомобилей" />;

  return (
    <div style={tableCard}>
      <TableHeader
        cols="60px 1fr 1.2fr 1.2fr .8fr 140px"
        items={["Аватар", "ID", "Марка/Модель", "VIN", "Дата", "Действие"]}
      />
      {cars.map((car: any) => (
        <div key={car.id} style={{ ...tableRow, gridTemplateColumns: "60px 1fr 1.2fr 1.2fr .8fr 140px" }}>
          <img src={car.avatar_url || "/placeholder.png"} alt="car" style={avatar} />
          <div><strong>{car.car_number}</strong></div>
          <div>{car.brand} {car.model}<div style={muted}>{car.year || "—"} / {car.color || "—"}</div></div>
          <div style={muted}>{car.vin}</div>
          <div style={muted}>{car.created_at ? new Date(car.created_at).toLocaleDateString("ru-RU") : "—"}</div>
          <div>
            {role === "admin" && (
              <button onClick={() => onDelete(car)} style={dangerActionButton}>Удалить</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function RoutesTable({ routes, role, onEdit, onDelete }: any) {
  if (routes.length === 0) return <Empty text="Нет маршрутов" />;

  return (
    <div style={tableCard}>
      <TableHeader
        cols="1fr 1fr 1fr 1fr 180px"
        items={["Название", "Откуда", "Куда", "Длительность (ч)", "Действия"]}
      />
      {routes.map((route: any) => (
        <div key={route.id} style={{ ...tableRow, gridTemplateColumns: "1fr 1fr 1fr 1fr 180px" }}>
          <strong>{route.name}</strong>
          <div>{route.start_city}</div>
          <div>{route.end_city}</div>
          <div>{route.duration_hours}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {role === "admin" && (
              <>
                <button onClick={() => onEdit(route)} style={outlineButton}>Изменить</button>
                <button onClick={() => onDelete(route)} style={dangerActionButton}>Удалить</button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function UsersTable({ users, onToggle, onEdit }: any) {
  if (users.length === 0) return <Empty text="Нет пользователей" />;

  return (
    <div style={tableCard}>
      <TableHeader
        cols="1fr 1fr 1fr 220px"
        items={["Логин", "Роль", "Статус", "Действие"]}
      />
      {users.map((user: any) => (
        <div key={user.id} style={{ ...tableRow, gridTemplateColumns: "1fr 1fr 1fr 220px" }}>
          <strong>{user.username}</strong>
          <div>{user.role === "admin" ? "Администратор" : "Менеджер"}</div>
          <div>{user.is_active ? "Доступ активен" : "Доступ закрыт"}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => onEdit(user)}
              style={{ ...outlineButton, width: "auto" }}
            >
              Изменить
            </button>
            <button
              onClick={() => onToggle(user)}
              style={{
                ...(user.is_active ? dangerSmallButton : smallButton),
                width: "auto",
              }}
            >
              {user.is_active ? "Заблокировать" : "Активировать"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function LogsTable({ logs }: any) {
  if (logs.length === 0) return <Empty text="Нет записей в логах" />;

  return (
    <div style={tableCard}>
      <TableHeader
        cols="1fr 1fr 1fr 2fr 1fr"
        items={["Пользователь", "Действие", "Тип", "Комментарий", "Дата"]}
      />
      {logs.map((log: any) => (
        <div key={log.id} style={{ ...tableRow, gridTemplateColumns: "1fr 1fr 1fr 2fr 1fr" }}>
          <strong>{log.user_name}</strong>
          <div>{log.action}</div>
          <div style={muted}>{log.entity_type || "—"}</div>
          <div style={muted}>{log.comment || "—"}</div>
          <div style={muted}>
            {new Date(log.created_at).toLocaleString("ru-RU")}
          </div>
        </div>
      ))}
    </div>
  );
}

function TableHeader({ cols, items }: any) {
  return (
    <div style={{ ...tableHeader, gridTemplateColumns: cols }}>
      {items.map((item: string) => (
        <div key={item}>{item}</div>
      ))}
    </div>
  );
}

function Empty({ text }: any) {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
      {text}
    </div>
  );
}

function Modal({ children, onClose }: any) {
  return (
    <div onClick={onClose} style={modalOverlay}>
      <div onClick={(e) => e.stopPropagation()} style={modalBox}>
        {children}
      </div>
    </div>
  );
}

function Actions({ children }: any) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: 12,
        marginTop: 20,
      }}
    >
      {children}
    </div>
  );
}

function PrimaryButton({ children, onClick }: any) {
  return (
    <button onClick={onClick} style={primaryButton}>
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick }: any) {
  return (
    <button onClick={onClick} style={secondaryButton}>
      {children}
    </button>
  );
}

const loginPage: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(90deg,rgba(247,251,255,.96) 0%,rgba(247,251,255,.70) 42%,rgba(247,251,255,.12) 100%), url('/hero-taotaoche.png') center/cover",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  fontFamily: "Arial",
};

const loginCard: CSSProperties = {
  width: "min(520px, 96vw)",
  background: "rgba(255,255,255,.48)",
  border: "1px solid rgba(255,255,255,.68)",
  borderRadius: 30,
  padding: 34,
  color: "var(--text)",
  boxShadow: "var(--shadow)",
  backdropFilter: "blur(20px)",
};

const layout: CSSProperties = {
  minHeight: "100vh",
  background: "var(--bg)",
  fontFamily: "Arial",
  color: "var(--text)",
  display: "grid",
  gridTemplateColumns: "260px 1fr",
};

const sidebar: CSSProperties = {
  background: "rgba(255,255,255,.88)",
  padding: 24,
  borderRight: "1px solid var(--line)",
  boxShadow: "8px 0 30px rgba(25,78,140,.06)",
};

const sideSelect: CSSProperties = {
  width: "100%",
  marginBottom: 16,
  padding: 10,
  borderRadius: 12,
  background: "var(--panel-2)",
  color: "var(--text)",
  border: "1px solid var(--line)",
};

const smallSelect: CSSProperties = {
  height: 40,
  borderRadius: 12,
  border: "1px solid #334155",
  padding: "0 10px",
  background: "var(--panel-2)",
  color: "var(--text)",
};

const roleBadge: CSSProperties = {
  background: "linear-gradient(135deg,var(--primary),var(--cyan))",
  color: "white",
  borderRadius: 14,
  padding: 12,
  marginBottom: 20,
  fontWeight: 800,
};

const logoutButton: CSSProperties = {
  marginTop: 24,
  width: "100%",
  border: "none",
  borderRadius: 14,
  padding: 12,
  background: "var(--line)",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const menuItem: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  marginBottom: 8,
  fontWeight: 800,
  cursor: "pointer",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 24,
  gap: 20,
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 16,
  marginBottom: 22,
};

const filterCard: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 240px",
  gap: 14,
  marginBottom: 18,
};

const tableCard: CSSProperties = {
  background: "var(--panel)",
  borderRadius: 24,
  overflowX: "auto",
  border: "1px solid rgba(148,163,184,.12)",
};

const tableHeader: CSSProperties = {
  display: "grid",
  minWidth: 920,
  gap: 10,
  padding: "13px 16px",
  background: "var(--panel-2)",
  color: "var(--muted)",
  fontSize: 13,
  fontWeight: 800,
};

const tableRow: CSSProperties = {
  display: "grid",
  minWidth: 920,
  gap: 10,
  alignItems: "center",
  padding: "13px 16px",
  borderTop: "1px solid rgba(148,163,184,.08)",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: 13,
  borderRadius: 14,
  border: "1px solid #334155",
  background: "var(--panel-2)",
  color: "var(--text)",
  boxSizing: "border-box",
  marginBottom: 12,
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "var(--muted)",
  marginBottom: 6,
  fontWeight: 700,
};

const primaryButton: CSSProperties = {
  border: "none",
  borderRadius: 14,
  padding: "13px 18px",
  background: "var(--primary)",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButton: CSSProperties = {
  border: "none",
  borderRadius: 14,
  padding: "13px 18px",
  background: "var(--line)",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const outlineButton: CSSProperties = {
  textDecoration: "none",
  border: "1px solid #2563eb",
  color: "var(--primary-2)",
  padding: "10px 14px",
  borderRadius: 12,
  fontWeight: 800,
  background: "transparent",
  cursor: "pointer",
};

const greenButton: CSSProperties = {
  border: "none",
  color: "var(--green)",
  background: "rgba(74,222,128,.12)",
  padding: "10px 14px",
  borderRadius: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const smallButton: CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "8px 12px",
  background: "var(--primary)",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const dangerSmallButton: CSSProperties = {
  border: "none",
  width: 38,
  borderRadius: 12,
  background: "var(--red)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const dangerActionButton: CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "10px 14px",
  background: "rgba(239,68,68,.14)",
  color: "var(--red)",
  fontWeight: 800,
  cursor: "pointer",
};

const statCard: CSSProperties = {
  background: "var(--panel)",
  borderRadius: 22,
  padding: 20,
  border: "1px solid rgba(148,163,184,.12)",
};

const muted: CSSProperties = {
  color: "var(--muted)",
  fontSize: 13,
};

const statusBadge: CSSProperties = {
  background: "rgba(37,99,235,.16)",
  color: "var(--primary-2)",
  padding: "7px 10px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 13,
  width: "fit-content",
};

const avatar: CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 14,
  objectFit: "cover",
  background: "var(--panel-2)",
};

const modalOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.7)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};

const modalBox: CSSProperties = {
  width: "min(720px, 96vw)",
  maxHeight: "90vh",
  overflow: "auto",
  background: "var(--panel)",
  border: "1px solid rgba(148,163,184,.12)",
  borderRadius: 28,
  padding: 28,
  color: "var(--text)",
  boxShadow: "var(--shadow)",
};

const modalTitle: CSSProperties = {
  margin: "0 0 18px",
  fontSize: 28,
};

const warningBox: CSSProperties = {
  background: "rgba(239,68,68,.12)",
  color: "var(--red)",
  padding: 14,
  borderRadius: 16,
  marginBottom: 16,
  fontWeight: 700,
};

const routePointRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 50px",
  gap: 10,
  marginBottom: 10,
};

const miniInput: CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: "1px solid #334155",
  background: "var(--panel-2)",
  color: "var(--text)",
  boxSizing: "border-box",
};

const mobileLayout: CSSProperties = {
  minHeight: "100vh",
  background: "var(--bg)",
  fontFamily: "Arial",
  color: "var(--text)",
  display: "block",
};

const mobileSidebar: CSSProperties = {
  background: "var(--panel)",
  padding: 16,
  borderBottom: "1px solid rgba(148,163,184,.12)",
};

const mobileContent: CSSProperties = {
  padding: 16,
  minWidth: 0,
  overflowX: "hidden",
};

const mobileFilterCard: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 10,
  marginBottom: 18,
};
