import MapClientLoader from './MapClientLoader';

/**
 * Live driver map page. Server component renders the header shell;
 * the actual Leaflet map runs client-only (Leaflet touches `window`
 * at import time and can't SSR).
 */
export default function MapPage() {
  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Live driver map</h1>
        <p className="text-sm text-gray-500">
          Currently active + on-trip drivers. Auto-refreshes every 30 seconds.
        </p>
      </div>
      <MapClientLoader />
    </div>
  );
}
