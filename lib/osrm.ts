export type RouteCity = {
  name: string;
  lat: number;
  lng: number;
};

export type OsrmRoute = {
  geometry: { type: "LineString"; coordinates: [number, number][] };
  distanceKm: number;
};


export const CAR_BRANDS = [
  { zh: "宝马", en: "BMW" }, { zh: "奔驰", en: "Mercedes-Benz" }, { zh: "奥迪", en: "Audi" }, { zh: "丰田", en: "Toyota" }, { zh: "理想", en: "Li Auto" }, { zh: "极氪", en: "Zeekr" }, { zh: "比亚迪", en: "BYD" }, { zh: "蔚来", en: "NIO" }, { zh: "小鹏", en: "XPeng" }, { zh: "问界", en: "AITO" }
];
export const CAR_MODELS = [
  { zh: "宝马 X5", en: "BMW X5" }, { zh: "宝马 M5", en: "BMW M5" }, { zh: "奔驰 S500", en: "Mercedes-Benz S500" }, { zh: "奔驰 GLE", en: "Mercedes-Benz GLE" }, { zh: "奥迪 Q7", en: "Audi Q7" }, { zh: "丰田陆巡 300", en: "Toyota Land Cruiser 300" }, { zh: "理想 L9", en: "Li Auto L9" }, { zh: "极氪 001", en: "Zeekr 001" }, { zh: "比亚迪 仰望 U8", en: "BYD Yangwang U8" }
];

const KNOWN_CITIES: Record<string, { lat: number; lng: number }> = {
  "москва": { lat: 55.7558, lng: 37.6173 },
  "казань": { lat: 55.8304, lng: 49.0661 },
  "владимир": { lat: 56.1291, lng: 40.4066 },
  "нижний новгород": { lat: 56.2965, lng: 43.9361 },
  "чебоксары": { lat: 56.1439, lng: 47.2489 },
  "шанхай": { lat: 31.2304, lng: 121.4737 },
  "пекин": { lat: 39.9042, lng: 116.4074 },
  "урумчи": { lat: 43.8256, lng: 87.6168 },
  "алматы": { lat: 43.2389, lng: 76.8897 },
  "астана": { lat: 51.1694, lng: 71.4491 },
  "хоргос": { lat: 44.2183, lng: 80.4145 },
  "上海": { lat: 31.2304, lng: 121.4737 },
  "北京": { lat: 39.9042, lng: 116.4074 },
  "乌鲁木齐": { lat: 43.8256, lng: 87.6168 },
  "霍尔果斯": { lat: 44.2183, lng: 80.4145 },
  "莫斯科": { lat: 55.7558, lng: 37.6173 },
};

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, "е");
}

export async function geocodeCity(name: string): Promise<RouteCity | null> {
  const clean = name.trim();
  if (!clean) return null;

  const known = KNOWN_CITIES[normalizeName(clean)];
  if (known) return { name: clean, ...known };

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(clean)}`;
  const response = await fetch(url, { headers: { "Accept-Language": "ru,zh,en" } });
  if (!response.ok) return null;

  const [result] = await response.json();
  const lat = Number(result?.lat);
  const lng = Number(result?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { name: clean, lat, lng };
}

export async function resolveRoutePoint(point: Partial<RouteCity>): Promise<RouteCity | null> {
  const name = String(point.name || "").trim();
  const lat = Number(point.lat);
  const lng = Number(point.lng);
  if (name && Number.isFinite(lat) && Number.isFinite(lng)) return { name, lat, lng };
  if (name) return geocodeCity(name);
  return null;
}

export async function buildRouteCities(
  startCity: string,
  endCity: string,
  intermediate: Partial<RouteCity>[] = []
): Promise<RouteCity[] | null> {
  const points = await Promise.all([
    resolveRoutePoint({ name: startCity }),
    ...intermediate.filter((point) => String(point.name || "").trim()).map(resolveRoutePoint),
    resolveRoutePoint({ name: endCity }),
  ]);

  const ready = points.filter(Boolean) as RouteCity[];
  return ready.length >= 2 ? ready : null;
}

async function requestOsrm(points: RouteCity[]): Promise<OsrmRoute | null> {
  if (points.length < 2) return null;
  const coordinates = points.map((city) => `${city.lng},${city.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const payload = await response.json();
  const route = payload?.routes?.[0];
  if (!route?.geometry?.coordinates?.length) return null;
  return { geometry: route.geometry, distanceKm: Math.round(Number(route.distance || 0) / 1000) };
}

export async function calculateOsrmRoute(cities: RouteCity[]): Promise<OsrmRoute | null> {
  const points = cities.filter((city) => city.name && Number.isFinite(city.lat) && Number.isFinite(city.lng));
  if (points.length < 2) return null;

  // First try one complete route through all checkpoints.
  const direct = await requestOsrm(points);
  if (direct) return direct;

  // If public OSRM rejects many/far waypoints, build route segment-by-segment.
  const merged: [number, number][] = [];
  let distanceKm = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const segment = await requestOsrm([points[i], points[i + 1]]);
    if (!segment) return null;
    distanceKm += segment.distanceKm;
    const coords = segment.geometry.coordinates;
    if (merged.length && coords.length) coords.shift();
    merged.push(...coords);
  }

  return { geometry: { type: "LineString", coordinates: merged }, distanceKm };
}

export function geometryToLeafletPoints(geometry: any): [number, number][] {
  if (!Array.isArray(geometry?.coordinates)) return [];

  return geometry.coordinates
    .map(([lng, lat]: [number, number]) => [lat, lng] as [number, number])
    .filter(([lat, lng]: [number, number]) => Number.isFinite(lat) && Number.isFinite(lng));
}
