'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Live driver map. Polls /admin/drivers/live-map every 30 s and
 * paints markers on an OpenStreetMap raster tile layer. No API key
 * needed — OSM's tile server is free for light admin use (see
 * https://operations.osmfoundation.org/policies/tiles/). If we ever
 * outgrow that, swap the tile URL for MapTiler or a self-hosted
 * tileserver; the marker/popup layer stays the same.
 */

type DriverStatus = 'active' | 'on_trip' | 'inactive' | 'suspended';

interface LiveMapDriver {
  id: number;
  name: string;
  countryCode: string | null;
  phoneNumber: string | null;
  status: DriverStatus;
  lat: number;
  lng: number;
  updatedAt: string;
}

interface LiveMapResponse {
  drivers: LiveMapDriver[];
  generatedAt: string;
}

interface TripStop {
  order: number;
  type: string;
  lat: number;
  lng: number;
  city: string | null;
  address: string | null;
}

interface TripRouteResponse {
  driverId: number;
  driverTripId: number | null;
  stops: TripStop[];
  meters: number | null;
  durationSeconds: number | null;
  /** [lng, lat] pairs from OSRM (GeoJSON convention). */
  geometry: [number, number][] | null;
}

interface RouteOverlay {
  driverId: number;
  driverName: string;
  stops: TripStop[];
  latLngPath: [number, number][]; // Leaflet-friendly [lat, lng] pairs
  meters: number | null;
  durationSeconds: number | null;
  isFallback: boolean; // true when we drew straight lines because OSRM returned no geometry
}

const REFRESH_MS = 30_000;

// Jordan centered on Amman; zoom 8 shows Amman + Irbid together.
const JORDAN_CENTER: [number, number] = [31.95, 35.91];
const INITIAL_ZOOM = 8;

const STATUS_COLOR: Record<DriverStatus, string> = {
  active: '#22c55e', // green
  on_trip: '#3b82f6', // blue
  inactive: '#9ca3af',
  suspended: '#ef4444',
};

function markerIcon(color: string): L.DivIcon {
  // Simple round pin. DivIcon means no PNG asset shipping — safer
  // with Next.js than default Leaflet marker (which relies on
  // package-relative images that don't survive bundling).
  const html = `
    <span style="
      display:inline-block;
      width:16px;height:16px;
      border-radius:50%;
      background:${color};
      border:2px solid white;
      box-shadow:0 0 0 1px rgba(0,0,0,.35);
    "></span>
  `;
  return L.divIcon({
    html,
    className: 'live-driver-marker',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

function formatAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return `${h} h ago`;
}

export default function LiveDriverMap() {
  const [data, setData] = useState<LiveMapResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        // Same-origin proxy route — the httpOnly admin JWT lives in
        // a Next.js cookie the server handler forwards to the API.
        const res = await fetch('/api/admin/live-map', {
          credentials: 'same-origin',
        });
        if (!res.ok) throw new Error(`live-map returned ${res.status}`);
        const body = (await res.json()) as LiveMapResponse;
        if (!cancelled) {
          setData(body);
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void poll();
    timerRef.current = setInterval(() => void poll(), REFRESH_MS);
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const icons = useMemo(
    () => ({
      active: markerIcon(STATUS_COLOR.active),
      on_trip: markerIcon(STATUS_COLOR.on_trip),
      inactive: markerIcon(STATUS_COLOR.inactive),
      suspended: markerIcon(STATUS_COLOR.suspended),
    }),
    [],
  );

  const drivers = data?.drivers ?? [];
  const activeCount = drivers.filter((d) => d.status === 'active').length;
  const onTripCount = drivers.filter((d) => d.status === 'on_trip').length;

  // Route overlay + loading state. Only one route drawn at a time —
  // clicking a different on-trip pin replaces it, clicking anywhere
  // else clears it.
  const [route, setRoute] = useState<RouteOverlay | null>(null);
  const [routeLoading, setRouteLoading] = useState<number | null>(null);
  const [routeErr, setRouteErr] = useState<string | null>(null);

  const showTripRoute = useCallback(async (d: LiveMapDriver) => {
    if (d.status !== 'on_trip') return;
    setRouteLoading(d.id);
    setRouteErr(null);
    try {
      const res = await fetch(`/api/admin/drivers/${d.id}/trip-route`, {
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(`trip-route returned ${res.status}`);
      const body = (await res.json()) as TripRouteResponse;
      if (!body.driverTripId || body.stops.length < 2) {
        setRouteErr('No active trip stops for this driver');
        setRoute(null);
        return;
      }
      // OSRM returns [lng, lat]; Leaflet wants [lat, lng]. Convert.
      const geomLatLng: [number, number][] | null = body.geometry
        ? body.geometry.map(([lng, lat]) => [lat, lng])
        : null;
      // Fallback for providers without road geometry: connect stops
      // with straight lines so we at least show the intent.
      const stopPath: [number, number][] = body.stops.map((s) => [
        s.lat,
        s.lng,
      ]);
      setRoute({
        driverId: d.id,
        driverName: d.name || `Driver #${d.id}`,
        stops: body.stops,
        latLngPath: geomLatLng ?? stopPath,
        meters: body.meters,
        durationSeconds: body.durationSeconds,
        isFallback: !geomLatLng,
      });
    } catch (e) {
      setRouteErr(e instanceof Error ? e.message : String(e));
      setRoute(null);
    } finally {
      setRouteLoading(null);
    }
  }, []);

  return (
    <div className="relative h-[calc(100vh-8rem)] w-full overflow-hidden rounded-xl border">
      <MapContainer
        center={JORDAN_CENTER}
        zoom={INITIAL_ZOOM}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {drivers.map((d) => (
          <Marker
            key={d.id}
            position={[d.lat, d.lng]}
            icon={icons[d.status] ?? icons.active}
            eventHandlers={{
              click: () => showTripRoute(d),
            }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{d.name || `Driver #${d.id}`}</div>
                <div className="text-gray-600">
                  {d.countryCode ?? ''} {d.phoneNumber ?? '—'}
                </div>
                <div className="mt-1">
                  <span
                    className="inline-block rounded px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: STATUS_COLOR[d.status] }}
                  >
                    {d.status}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Last update: {formatAge(d.updatedAt)}
                </div>
                {d.status === 'on_trip' && (
                  <div className="mt-1 text-xs text-blue-600">
                    {routeLoading === d.id
                      ? 'Loading route…'
                      : route?.driverId === d.id
                        ? 'Route shown'
                        : 'Click marker to show route'}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Trip route overlay — polyline + stop pins */}
        {route && (
          <>
            <Polyline
              positions={route.latLngPath}
              pathOptions={{
                color: STATUS_COLOR.on_trip,
                weight: 4,
                opacity: 0.75,
                dashArray: route.isFallback ? '8 8' : undefined,
              }}
            />
            {route.stops.map((s) => (
              <CircleMarker
                key={`${route.driverId}-stop-${s.order}`}
                center={[s.lat, s.lng]}
                radius={6}
                pathOptions={{
                  color: 'white',
                  weight: 2,
                  fillColor: s.type === 'pickup' ? '#f59e0b' : '#8b5cf6',
                  fillOpacity: 1,
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-semibold">
                      Stop {s.order + 1} — {s.type}
                    </div>
                    {s.address && (
                      <div className="text-xs text-gray-600">{s.address}</div>
                    )}
                    {s.city && (
                      <div className="text-xs text-gray-500">{s.city}</div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </>
        )}
      </MapContainer>

      {/* Overlay: legend + counts */}
      <div className="absolute right-4 top-4 z-[1000] rounded-lg bg-white/95 p-3 text-sm shadow-lg backdrop-blur">
        <div className="mb-2 font-semibold">Live drivers</div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: STATUS_COLOR.active }}
          />
          <span>Active: {activeCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: STATUS_COLOR.on_trip }}
          />
          <span>On trip: {onTripCount}</span>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          {loading
            ? 'Loading…'
            : err
              ? `Error: ${err}`
              : `Updated ${data ? formatAge(data.generatedAt) : ''}`}
        </div>
        <div className="mt-1 text-xs text-gray-400">Refresh every 30 s</div>

        {(route || routeErr) && (
          <div className="mt-3 border-t pt-2">
            {route && (
              <>
                <div className="text-xs font-semibold">Trip route</div>
                <div className="text-xs text-gray-600">{route.driverName}</div>
                {route.meters != null && route.durationSeconds != null && (
                  <div className="text-xs text-gray-500">
                    {(route.meters / 1000).toFixed(1)} km ·{' '}
                    {Math.round(route.durationSeconds / 60)} min
                    {route.isFallback && ' (straight-line)'}
                  </div>
                )}
              </>
            )}
            {routeErr && (
              <div className="text-xs text-red-600">{routeErr}</div>
            )}
            <button
              className="mt-1 text-xs text-blue-600 hover:underline"
              onClick={() => {
                setRoute(null);
                setRouteErr(null);
              }}
            >
              Clear route
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
