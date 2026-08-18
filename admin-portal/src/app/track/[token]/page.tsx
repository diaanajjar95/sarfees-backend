import { apiFetch, ApiError } from '@/lib/api';

/**
 * Anonymous receiver tracking page — opened from the WhatsApp link.
 * No auth, no map: a simple bilingual status timeline. Auth-exempt in
 * middleware; Caddy routes :80/track/* here.
 */

export const dynamic = 'force-dynamic';

interface TrackStep {
  key: string;
  labelEn: string;
  labelAr: string;
  done: boolean;
}

interface TrackData {
  status: string;
  packageSize: string;
  from: string | null;
  fromAr: string | null;
  to: string | null;
  toAr: string | null;
  receiverName: string;
  cancelled: boolean;
  updatedAt: string;
  steps: TrackStep[];
}

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function TrackPage({ params }: PageProps) {
  const { token } = await params;
  let data: TrackData | null = null;
  try {
    data = await apiFetch<TrackData>(`/track/${token}`, { anonymous: true });
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#FFF8E7' }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg"
        style={{ border: '1px solid #FDD97E' }}
      >
        <div className="flex items-center gap-2 mb-5">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl font-black text-white"
            style={{ background: '#FABE2C' }}
          >
            S
          </span>
          <span className="text-lg font-extrabold text-gray-900">Sarfees</span>
        </div>

        {!data ? (
          <div className="text-center py-8">
            <p className="font-bold text-gray-900">رمز التتبع غير معروف</p>
            <p className="text-sm text-gray-500 mt-1">Unknown tracking code.</p>
          </div>
        ) : data.cancelled ? (
          <div className="text-center py-8">
            <p className="font-bold text-gray-900">تم إلغاء هذا الطرد</p>
            <p className="text-sm text-gray-500 mt-1">
              This delivery was cancelled.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-extrabold text-gray-900">
              تتبع الطرد · Package tracking
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {data.fromAr ?? data.from} ← {data.toAr ?? data.to}
              {' · '}
              {data.from} → {data.to}
            </p>

            <ol className="mt-6 space-y-0">
              {data.steps.map((s, i) => (
                <li key={s.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-black"
                      style={{
                        background: s.done ? '#FABE2C' : '#F3F4F6',
                        color: s.done ? '#fff' : '#9CA3AF',
                      }}
                    >
                      {s.done ? '✓' : i + 1}
                    </span>
                    {i < data.steps.length - 1 && (
                      <span
                        className="w-0.5 flex-1 my-1"
                        style={{
                          background: s.done ? '#FDD97E' : '#F3F4F6',
                          minHeight: 24,
                        }}
                      />
                    )}
                  </div>
                  <div className="pb-6">
                    <p
                      className="font-bold"
                      style={{ color: s.done ? '#111827' : '#9CA3AF' }}
                    >
                      {s.labelAr}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: s.done ? '#6B7280' : '#D1D5DB' }}
                    >
                      {s.labelEn}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mt-2 text-xs text-gray-400">
              آخر تحديث · Last update:{' '}
              {new Date(data.updatedAt).toLocaleString()}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
