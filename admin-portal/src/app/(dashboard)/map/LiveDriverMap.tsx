'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Dispatch map. Polls /api/admin/map-overview every 10 s (paused when
 * the tab is hidden) and renders three layers on OSM tiles:
 *   - driver pins (heading arrows, status colors, stale-ping dimming)
 *   - demand pins (groups still hunting a driver; escalations pulse)
 *   - city service circles (the matcher's origin gate)
 * Clicking a driver opens the side card; on-trip drivers can overlay
 * their live route (existing trip-route proxy).
 */

type DriverStatus = 'active' | 'on_trip' | 'inactive' | 'suspended';

interface OverviewDriver {
  id: number;
  name: string;
  phone: string;
  status: DriverStatus;
  lat: number;
  lng: number;
  heading: number | null;
  lastPingAt: string | null;
  rating: number;
  walletBalance: number;
  currentTripId: number | null;
  currentTripStatus: string | null;
}

interface DemandPin {
  groupId: number;
  status: string;
  escalated: boolean;
  originCity: string;
  departureTime: string;
  womenOnly: boolean;
  seats: number;
  packageCount: number;
  requestIds: number[];
  lat: number;
  lng: number;
}

interface Overview {
  drivers: OverviewDriver[];
  demand: DemandPin[];
  kpis: {
    onlineDrivers: number;
    onTripDrivers: number;
    searchingGroups: number;
    escalatedGroups: number;
    pendingRequests: number;
  };
  cities: { id: number; name: string; lat: number; lng: number; radiusMeters: number }[];
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
  geometry: [number, number][] | null;
}

interface RouteOverlay {
  driverId: number;
  driverName: string;
  stops: TripStop[];
  latLngPath: [number, number][];
  meters: number | null;
  durationSeconds: number | null;
  isFallback: boolean;
}

const REFRESH_MS = 10_000;
const STALE_PING_MS = 2 * 60 * 1000;
const JORDAN_CENTER: [number, number] = [31.95, 35.91];
const INITIAL_ZOOM = 8;

const STATUS_COLOR: Record<string, string> = {
  active: '#22c55e',
  on_trip: '#3b82f6',
};

function driverIcon(d: OverviewDriver, stale: boolean, followed: boolean): L.DivIcon {
  const color = stale ? '#9ca3af' : (STATUS_COLOR[d.status] ?? '#9ca3af');
  const rot = d.heading != null ? `transform:rotate(${Math.round(d.heading)}deg);` : '';
  const arrow =
    d.heading != null
      ? `<span style="position:absolute;left:50%;top:-7px;margin-left:-4px;${rot}
           width:0;height:0;border-left:4px solid transparent;
           border-right:4px solid transparent;border-bottom:7px solid ${color};"></span>`
      : '';
  const ring = followed ? 'box-shadow:0 0 0 4px rgba(250,190,44,.55);' : '';
  const html = `
    <span style="position:relative;display:inline-block;width:16px;height:16px;">
      ${arrow}
      <span style="display:inline-block;width:16px;height:16px;border-radius:50%;
        background:${color};border:2px solid white;${ring}
        box-shadow:0 0 0 1px rgba(0,0,0,.35);${stale ? 'opacity:.55;' : ''}"></span>
    </span>`;
  return L.divIcon({
    html,
    className: 'live-driver-marker',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

function demandIcon(g: DemandPin): L.DivIcon {
  const color = g.escalated ? '#ef4444' : '#8b5cf6';
  const pulse = g.escalated
    ? `<span style="position:absolute;inset:-6px;border-radius:50%;
         border:2px solid ${color};animation:sarfees-pulse 1.4s ease-out infinite;"></span>`
    : '';
  const badge = g.packageCount > 0 ? '📦' : g.womenOnly ? '♀' : String(g.seats || 1);
  const html = `
    <span style="position:relative;display:inline-block;width:22px;height:22px;">
      ${pulse}
      <span style="display:flex;align-items:center;justify-content:center;
        width:22px;height:22px;border-radius:6px;background:${color};
        color:white;font:700 11px/1 system-ui;border:2px solid white;
        box-shadow:0 0 0 1px rgba(0,0,0,.3);">${badge}</span>
    </span>`;
  return L.divIcon({
    html,
    className: 'demand-marker',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11],
  });
}

function pingAge(iso: string | null): { label: string; stale: boolean } {
  if (!iso) return { label: 'no GPS ping', stale: true };
  const ms = Date.now() - new Date(iso).getTime();
  const stale = ms > STALE_PING_MS;
  const s = Math.round(ms / 1000);
  if (s < 60) return { label: `${s}s ago`, stale };
  const m = Math.round(s / 60);
  if (m < 60) return { label: `${m} min ago`, stale };
  return { label: `${Math.round(m / 60)} h ago`, stale };
}

/** Imperative helper — lets the follow/fit logic move the map. */
function MapController({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.setView(target, Math.max(map.getZoom(), 12), { animate: true });
  }, [map, target]);
  return null;
}

export default function LiveDriverMap() {
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [showActive, setShowActive] = useState(true);
  const [showOnTrip, setShowOnTrip] = useState(true);
  const [showDemand, setShowDemand] = useState(true);
  const [escalationsOnly, setEscalationsOnly] = useState(false);
  const [showCircles, setShowCircles] = useState(true);
  const [search, setSearch] = useState('');
  const [followId, setFollowId] = useState<number | null>(null);

  // Side card + route overlay
  const [selected, setSelected] = useState<OverviewDriver | null>(null);
  const [route, setRoute] = useState<RouteOverlay | null>(null);
  const [routeLoading, setRouteLoading] = useState<number | null>(null);
  const [routeErr, setRouteErr] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (document.hidden) return; // pause while the tab is in background
      try {
        const res = await fetch('/api/admin/map-overview', {
          credentials: 'same-origin',
        });
        if (!res.ok) throw new Error(`overview returned ${res.status}`);
        const body = (await res.json()) as Overview;
        if (!cancelled) {
          setData(body);
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void poll();
    timerRef.current = setInterval(() => void poll(), REFRESH_MS);
    const onVisible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const drivers = useMemo(() => {
    let rows = data?.drivers ?? [];
    if (!showActive) rows = rows.filter((d) => d.status !== 'active');
    if (!showOnTrip) rows = rows.filter((d) => d.status !== 'on_trip');
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (d) => d.name.toLowerCase().includes(q) || d.phone.includes(q),
      );
    }
    return rows;
  }, [data, showActive, showOnTrip, search]);

  const demand = useMemo(() => {
    if (!showDemand) return [];
    let rows = data?.demand ?? [];
    if (escalationsOnly) rows = rows.filter((g) => g.escalated);
    return rows;
  }, [data, showDemand, escalationsOnly]);

  const followed = useMemo(
    () => drivers.find((d) => d.id === followId) ?? null,
    [drivers, followId],
  );
  const followTarget: [number, number] | null = followed
    ? [followed.lat, followed.lng]
    : null;

  const showTripRoute = useCallback(async (d: OverviewDriver) => {
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
      const geomLatLng: [number, number][] | null = body.geometry
        ? body.geometry.map(([lng, lat]) => [lat, lng])
        : null;
      const stopPath: [number, number][] = body.stops.map((s) => [s.lat, s.lng]);
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

  const k = data?.kpis;

  return (
    <div className="relative">
      {/* pulse animation for escalated demand pins */}
      <style>{`@keyframes sarfees-pulse {
        0% { transform: scale(.6); opacity: .9; }
        100% { transform: scale(1.6); opacity: 0; }
      }`}</style>

      {/* KPI strip */}
      <div className="mb-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Kpi label="Drivers online" value={k?.onlineDrivers} color="#22c55e" />
        <Kpi label="On trip" value={k?.onTripDrivers} color="#3b82f6" />
        <Kpi label="Searching groups" value={k?.searchingGroups} color="#8b5cf6" />
        <Kpi label="Escalations" value={k?.escalatedGroups} color="#ef4444" alert={(k?.escalatedGroups ?? 0) > 0} />
        <Kpi label="Pending requests" value={k?.pendingRequests} color="#B57E0A" />
      </div>

      {/* Filter bar */}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs font-semibold">
        <Toggle checked={showActive} onChange={setShowActive} label="Active" dot="#22c55e" />
        <Toggle checked={showOnTrip} onChange={setShowOnTrip} label="On trip" dot="#3b82f6" />
        <Toggle checked={showDemand} onChange={setShowDemand} label="Demand" dot="#8b5cf6" />
        <Toggle checked={escalationsOnly} onChange={setEscalationsOnly} label="Escalations only" dot="#ef4444" />
        <Toggle checked={showCircles} onChange={setShowCircles} label="City circles" dot="#9ca3af" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!e.target.value) setFollowId(null);
          }}
          placeholder="Search driver name / phone…"
          className="input-field !py-1 w-56 text-xs"
        />
        {followed && (
          <span className="rounded px-2 py-1" style={{ background: 'var(--color-sarfees-gold-surface)', color: 'var(--color-sarfees-gold)' }}>
            Following {followed.name}
            <button className="ml-2 underline" onClick={() => setFollowId(null)}>stop</button>
          </span>
        )}
        {err && <span style={{ color: 'var(--color-sarfees-error)' }}>{err}</span>}
        {loading && <span style={{ color: 'var(--color-sarfees-soft)' }}>loading…</span>}
      </div>

      <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--color-sarfees-border)' }}>
        <MapContainer center={JORDAN_CENTER} zoom={INITIAL_ZOOM} style={{ height: '68vh', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapController target={followTarget} />

          {/* City service circles */}
          {showCircles &&
            (data?.cities ?? []).map((c) => (
              <Circle
                key={c.id}
                center={[c.lat, c.lng]}
                radius={c.radiusMeters}
                pathOptions={{ color: '#9ca3af', weight: 1, dashArray: '6 6', fillOpacity: 0.03 }}
              />
            ))}

          {/* Demand pins */}
          {demand.map((g) => (
            <Marker key={`g${g.groupId}`} position={[g.lat, g.lng]} icon={demandIcon(g)}>
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <b>Group #{g.groupId}</b>{' '}
                  <span style={{ color: g.escalated ? '#ef4444' : '#8b5cf6' }}>
                    {g.escalated ? 'ESCALATED' : g.status}
                  </span>
                  <div>From {g.originCity} · dep {new Date(g.departureTime).toLocaleTimeString()}</div>
                  <div>
                    {g.seats > 0 && <>🧍 {g.seats} seat{g.seats === 1 ? '' : 's'} </>}
                    {g.packageCount > 0 && <>📦 {g.packageCount} </>}
                    {g.womenOnly && <>♀ women-only</>}
                  </div>
                  {g.requestIds.length > 0 && (
                    <a href={`/passenger-requests/${g.requestIds[0]}`} style={{ fontWeight: 700 }}>
                      Open request → assign manually
                    </a>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Driver pins */}
          {drivers.map((d) => {
            const age = pingAge(d.lastPingAt);
            return (
              <Marker
                key={d.id}
                position={[d.lat, d.lng]}
                icon={driverIcon(d, age.stale, d.id === followId)}
                eventHandlers={{ click: () => setSelected(d) }}
              />
            );
          })}

          {/* Route overlay */}
          {route && (
            <>
              <Polyline
                positions={route.latLngPath}
                pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.85, dashArray: route.isFallback ? '8 8' : undefined }}
              />
              {route.stops.map((s0) => (
                <CircleMarker
                  key={`${route.driverId}-${s0.order}`}
                  center={[s0.lat, s0.lng]}
                  radius={6}
                  pathOptions={{ color: '#1d4ed8', fillColor: 'white', fillOpacity: 1, weight: 2 }}
                >
                  <Popup>
                    #{s0.order + 1} {s0.type} — {s0.city ?? ''} {s0.address ?? ''}
                  </Popup>
                </CircleMarker>
              ))}
            </>
          )}
        </MapContainer>
      </div>

      {/* Driver side card */}
      {selected && (
        <div
          className="absolute right-3 top-24 z-[1000] w-72 rounded-2xl p-4 shadow-xl"
          style={{ background: 'var(--color-sarfees-dark-2)', border: '1px solid var(--color-sarfees-border)' }}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-extrabold">{selected.name || `Driver #${selected.id}`}</div>
              <div className="text-xs" style={{ color: 'var(--color-sarfees-muted)' }}>
                ★ {selected.rating.toFixed(2)} ·{' '}
                <span className={selected.status === 'on_trip' ? '' : ''} style={{ color: STATUS_COLOR[selected.status] }}>
                  {selected.status.replace('_', ' ')}
                </span>
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="text-xs" style={{ color: 'var(--color-sarfees-soft)' }}>✕</button>
          </div>
          <dl className="mt-3 space-y-1 text-xs">
            <Row label="Phone"><a href={`tel:${selected.phone}`} className="font-semibold hover:underline">{selected.phone}</a></Row>
            <Row label="Wallet">{selected.walletBalance.toFixed(2)}</Row>
            <Row label="Last GPS ping">
              <span style={{ color: pingAge(selected.lastPingAt).stale ? 'var(--color-sarfees-error)' : undefined }}>
                {pingAge(selected.lastPingAt).label}
              </span>
            </Row>
            {selected.currentTripId && (
              <Row label="Current trip">#{selected.currentTripId} ({selected.currentTripStatus})</Row>
            )}
          </dl>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
            <a href={`/drivers/${selected.id}`} className="btn-secondary !px-2 !py-1">Driver page</a>
            <button className="btn-secondary !px-2 !py-1" onClick={() => setFollowId(selected.id)}>Follow</button>
            {selected.status === 'on_trip' && (
              <button
                className="btn-primary !px-2 !py-1"
                onClick={() => void showTripRoute(selected)}
                disabled={routeLoading === selected.id}
              >
                {routeLoading === selected.id ? 'Loading…' : 'Show route'}
              </button>
            )}
            {route?.driverId === selected.id && (
              <button className="btn-secondary !px-2 !py-1" onClick={() => setRoute(null)}>Hide route</button>
            )}
          </div>
          {routeErr && <p className="mt-2 text-xs" style={{ color: 'var(--color-sarfees-error)' }}>{routeErr}</p>}
          {route?.driverId === selected.id && route.meters != null && (
            <p className="mt-2 text-xs" style={{ color: 'var(--color-sarfees-muted)' }}>
              Route {(route.meters / 1000).toFixed(1)} km
              {route.durationSeconds != null && <> · ~{Math.round(route.durationSeconds / 60)} min</>}
              {route.isFallback && ' (straight-line fallback)'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, color, alert }: { label: string; value: number | undefined; color: string; alert?: boolean }) {
  return (
    <div
      className="surface-card px-3 py-2"
      style={alert ? { border: '1px solid #ef4444' } : undefined}
    >
      <div className="text-lg font-extrabold" style={{ color }}>{value ?? '—'}</div>
      <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-sarfees-soft)' }}>
        {label}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label, dot }: { checked: boolean; onChange: (v: boolean) => void; label: string; dot: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: dot }} />
      {label}
    </label>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt style={{ color: 'var(--color-sarfees-muted)' }}>{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  );
}
