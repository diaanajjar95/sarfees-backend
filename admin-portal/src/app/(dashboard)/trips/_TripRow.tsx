'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AdminTripRow } from '@/lib/types';

interface Props {
  trip: AdminTripRow;
  statusColor: { fg: string; border: string };
}

export default function TripRow({ trip, statusColor }: Props) {
  const router = useRouter();
  const detailHref = `/trips/${trip.id}`;

  return (
    <tr
      className="border-t cursor-pointer hover:bg-[rgba(255,255,255,0.02)]"
      style={{ borderColor: 'var(--color-sarfees-border)' }}
      onClick={() => router.push(detailHref)}
    >
      <td className="px-5 py-3 font-mono">
        <Link
          href={detailHref}
          className="font-semibold"
          style={{ color: 'var(--color-sarfees-gold)' }}
          onClick={(e) => e.stopPropagation()}
        >
          #{trip.id}
        </Link>
      </td>
      <td className="px-5 py-3">
        <span className="font-semibold">
          {trip.originCity} → {trip.destinationCity}
        </span>
      </td>
      <td className="px-5 py-3">
        {trip.driverName ? (
          <Link
            href={`/drivers/${trip.driverId}`}
            onClick={(e) => e.stopPropagation()}
          >
            {trip.driverName}
          </Link>
        ) : (
          <span style={{ color: 'var(--color-sarfees-soft)' }}>—</span>
        )}
      </td>
      <td className="px-5 py-3">{trip.type.replace('_', ' ')}</td>
      <td className="px-5 py-3">
        <span
          className="status-pill"
          style={{
            color: statusColor.fg,
            border: `1px solid ${statusColor.border}`,
          }}
        >
          {trip.status.replace('_', ' ')}
        </span>
      </td>
      <td className="px-5 py-3">
        {new Date(trip.departureTime).toLocaleString()}
      </td>
      <td className="px-5 py-3 text-right">
        {Number(trip.totalCashCollected).toFixed(2)} JD
      </td>
      <td className="px-5 py-3 text-right">
        {trip.netEarnings != null
          ? `${Number(trip.netEarnings).toFixed(2)} JD`
          : '—'}
      </td>
    </tr>
  );
}
