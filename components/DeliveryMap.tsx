// @ts-nocheck
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import { createClient } from "@supabase/supabase-js";
import { geometryToLeafletPoints } from "../lib/osrm";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "anon-key"
);

type Point = [number, number];
type City = { name: string; lat: number; lng: number };

const truckIcon = new L.Icon({ iconUrl: "/truck.png", iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -20] });
const makeVehicleIcon = (avatar?: string | null) => avatar ? L.divIcon({className:"",html:`<div class="vehicle-avatar"><img src="${avatar}" alt="vehicle"/></div>`,iconSize:[44,44],iconAnchor:[22,22]}) : truckIcon;
const startIcon = new L.Icon({ iconUrl: "/start.png", iconSize: [38, 38], iconAnchor: [19, 38], popupAnchor: [0, -36] });
const finishIcon = new L.Icon({ iconUrl: "/finish.png", iconSize: [38, 38], iconAnchor: [19, 38], popupAnchor: [0, -36] });
const cityIcon = new L.Icon({ iconUrl: "/city.png", iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -30] });

function normalizeCity(city: any): City | null {
  const lat = Number(city?.lat);
  const lng = Number(city?.lng);
  if (!city?.name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { name: String(city.name), lat, lng };
}

function cityToPoint(city: City): Point {
  return [city.lat, city.lng];
}

function getPositionByProgress(points: Point[], progress: number): Point {
  if (points.length < 2) return points[0] || [55.7558, 37.6173];
  const safe = Math.max(0, Math.min(1, progress));
  const totalSegments = points.length - 1;
  const raw = safe * totalSegments;
  const index = Math.min(Math.floor(raw), totalSegments - 1);
  const part = raw - index;
  const [lat1, lng1] = points[index];
  const [lat2, lng2] = points[index + 1];
  return [lat1 + (lat2 - lat1) * part, lng1 + (lng2 - lng1) * part];
}
  function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function getPassedRoute(points: Point[], progress: number): Point[] {
  if (points.length < 2) return points;
  const safe = Math.max(0, Math.min(1, progress));
  const totalSegments = points.length - 1;
  const raw = safe * totalSegments;
  const index = Math.min(Math.floor(raw), totalSegments - 1);
  return [...points.slice(0, index + 1), getPositionByProgress(points, safe)];
}

function photoIcon(photoUrl?: string) {
  if (!photoUrl) {
    return L.divIcon({ className: "", html: `<div class="checkpoint-pin">•</div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
  }
  return L.divIcon({ className: "", html: `<div class="checkpoint-photo-marker"><img src="${photoUrl}" alt="checkpoint" /></div>`, iconSize: [42, 42], iconAnchor: [21, 21] });
}

function AutoCenter({ position }: { position: Point }) {
  const map = useMap();
  useEffect(() => {
    if (position?.[0] && position?.[1]) map.flyTo(position, Math.max(map.getZoom(), 6), { duration: 0.8 });
  }, [position?.[0], position?.[1], map]);
  return null;
}

export default function DeliveryMap({ deliveryId }: { deliveryId: string }) {
  const [route, setRoute] = useState<Point[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [progress, setProgress] = useState(0);
  const [photos, setPhotos] = useState<any[]>([]);
  const [carAvatar, setCarAvatar] = useState<string | null>(null);
  useEffect(() => {
    loadAll();
    const interval = setInterval(loadLiveData, 3000);
    return () => clearInterval(interval);
  }, [deliveryId]);

  async function loadAll() {
    await loadRoute();
    await loadLiveData();
    await loadCarAvatar();
  }

  async function loadLiveData() {
    await loadProgress();
    await loadPhotos();
  }

  async function loadCarAvatar() {
    const { data: delivery } = await supabase.from("deliveries").select("car_id").eq("id", deliveryId).maybeSingle();
    if (!delivery?.car_id) return;
    const { data: car } = await supabase.from("cars").select("avatar_url").eq("id", delivery.car_id).maybeSingle();
    setCarAvatar(car?.avatar_url || null);
  }

  async function loadRoute() {
    const { data: delivery } = await supabase.from("deliveries").select("route_id").eq("id", deliveryId).maybeSingle();
    if (!delivery?.route_id) return;
    const { data: routeData } = await supabase.from("routes").select("cities, geometry").eq("id", delivery.route_id).maybeSingle();
    const routeCities = Array.isArray(routeData?.cities) ? routeData.cities.map(normalizeCity).filter(Boolean) : [];
    const geometryPoints = geometryToLeafletPoints(routeData?.geometry);
    setCities(routeCities);
    setRoute(geometryPoints.length > 1 ? geometryPoints : routeCities.map(cityToPoint));
  }

  async function loadProgress() {
    const { data } = await supabase.from("deliveries").select("progress").eq("id", deliveryId).maybeSingle();
    if (data) setProgress(Number(data.progress || 0));
  }

  async function loadPhotos() {
    const { data } = await supabase.from("route_photos").select("*").eq("delivery_id", deliveryId).order("taken_at", { ascending: true });
    setPhotos(data || []);
  }

  const photosByCity = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    for (const photo of photos) {
      const key = String(photo.city_name || "");
      grouped[key] = grouped[key] || [];
      grouped[key].push(photo);
    }
    return grouped;
  }, [photos]);

  const startPoint = cities[0] ? cityToPoint(cities[0]) : route[0] || [55.7558, 37.6173];
    const easedProgress = easeInOut(progress);
    const carPosition = getPositionByProgress(route, easedProgress);
    const passedRoute = getPassedRoute(route, easedProgress);

  return (
    <div style={{ height: 500, width: "100%", overflow: "hidden", borderRadius: 24 }}>
      <MapContainer center={carPosition || startPoint} zoom={6} style={{ height: "100%", width: "100%" }}>
        <AutoCenter position={carPosition} />
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {route.length > 0 && <Polyline positions={route} pathOptions={{ color: "#6b8fcf", weight: 5, opacity: 0.6 }} />}
        {passedRoute.length > 0 && <Polyline positions={passedRoute} pathOptions={{ color: "#1769ff", weight: 6, opacity: 0.95 }} />}

        {cities.map((city, index) => {
          const cityPhotos = photosByCity[city.name] || [];
          const firstPhoto = cityPhotos[0]?.photo_url;
          const icon = index === 0 ? startIcon : index === cities.length - 1 ? finishIcon : photoIcon(firstPhoto) || cityIcon;
          return (
            <Marker key={`${city.name}-${index}`} position={cityToPoint(city)} icon={icon}>
              <Popup maxWidth={320}>
                <div style={{ width: 280 }}>
                  <strong style={{ fontSize: 16 }}>{city.name}</strong>
                  {cityPhotos.length ? (
                    <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                      {cityPhotos.map((photo) => (
                        <div key={photo.id}>
                                                    {String(photo.media_type || "photo") === "video" ? <video src={photo.photo_url} controls style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 12 }} /> : <img src={photo.photo_url} alt="Фото точки" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 12 }} />}
                          <div style={{ marginTop: 6 }}>{photo.comment || "Без комментария"}</div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>{new Date(photo.taken_at || photo.created_at).toLocaleString("ru-RU")}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ marginTop: 10, color: "#64748b" }}>Фото машины пока нет</div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {route.length > 0 && <Marker position={carPosition} icon={makeVehicleIcon(carAvatar)}><Popup>Автомобиль находится здесь</Popup></Marker>}
      </MapContainer>
    </div>
  );
}
