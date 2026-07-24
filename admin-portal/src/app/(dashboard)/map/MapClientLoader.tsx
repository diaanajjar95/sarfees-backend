'use client';

import dynamic from 'next/dynamic';

/**
 * Client-only wrapper for the Leaflet map. Marked 'use client' so
 * dynamic({ ssr: false }) is legal (Next 15 rejects ssr:false in
 * Server Components).
 */
const LiveDriverMap = dynamic(() => import('./LiveDriverMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-gray-500">
      Loading map…
    </div>
  ),
});

export default function MapClientLoader() {
  return <LiveDriverMap />;
}
