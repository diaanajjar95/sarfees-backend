'use client';

import { useActionState, useState } from 'react';
import { Save, TriangleAlert } from 'lucide-react';
import { updateAppConfigAction } from './actions';

export interface AppConfigRow {
  app: string;
  maintenanceMode: boolean;
  maintenanceMessageEn: string | null;
  maintenanceMessageAr: string | null;
  androidMinVersion: string;
  androidLatestVersion: string;
  androidStoreUrl: string;
  iosMinVersion: string;
  iosLatestVersion: string;
  iosStoreUrl: string;
  updatedAt: string;
}

export default function AppConfigForm({ config }: { config: AppConfigRow }) {
  const [state, formAction, pending] = useActionState(updateAppConfigAction, null);
  const [maintenance, setMaintenance] = useState(config.maintenanceMode);
  const title = config.app === 'passenger' ? 'Passenger app' : 'Driver app';

  return (
    <form action={formAction} className="surface-card space-y-4 p-6">
      <input type="hidden" name="app" value={config.app} />
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">{title}</h2>
        {maintenance && (
          <span
            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold"
            style={{ color: 'var(--color-sarfees-error)', background: 'var(--color-sarfees-error-light)' }}
          >
            <TriangleAlert size={12} /> under maintenance
          </span>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          name="maintenanceMode"
          checked={maintenance}
          onChange={(e) => setMaintenance(e.target.checked)}
        />
        Maintenance mode — the app shows the message below and blocks usage
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="field-label">Message (English)</label>
          <textarea name="maintenanceMessageEn" rows={2} maxLength={500} defaultValue={config.maintenanceMessageEn ?? ''} className="input-field" placeholder="We are performing scheduled maintenance…" />
        </div>
        <div>
          <label className="field-label">Message (العربية)</label>
          <textarea name="maintenanceMessageAr" rows={2} maxLength={500} dir="rtl" defaultValue={config.maintenanceMessageAr ?? ''} className="input-field" placeholder="نقوم بصيانة مجدولة…" />
        </div>
      </div>

      <PlatformBlock
        label="Android"
        min={config.androidMinVersion}
        latest={config.androidLatestVersion}
        store={config.androidStoreUrl}
        prefix="android"
      />
      <PlatformBlock
        label="iOS"
        min={config.iosMinVersion}
        latest={config.iosLatestVersion}
        store={config.iosStoreUrl}
        prefix="ios"
      />

      <p className="text-xs" style={{ color: 'var(--color-sarfees-soft)' }}>
        Clients below <b>min version</b> are force-updated (blocked until they
        update). Clients below <b>latest version</b> get an optional update
        nudge. Apps pick changes up on next launch / foreground via
        <code> GET /app/init?app={config.app}</code>.
      </p>

      {state && !state.ok && (
        <p className="text-xs" style={{ color: 'var(--color-sarfees-error)' }}>{state.error}</p>
      )}
      {state?.ok && <p className="text-xs" style={{ color: '#2E7D32' }}>Saved.</p>}

      <button type="submit" disabled={pending} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60">
        <Save size={15} /> {pending ? 'Saving…' : `Save ${title.toLowerCase()}`}
      </button>
    </form>
  );
}

function PlatformBlock({
  label,
  min,
  latest,
  store,
  prefix,
}: {
  label: string;
  min: string;
  latest: string;
  store: string;
  prefix: 'android' | 'ios';
}) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: 'var(--color-sarfees-border)' }}>
      <div className="text-sm font-bold">{label}</div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Min version (force update)</label>
          <input name={`${prefix}MinVersion`} defaultValue={min} required pattern="\d+\.\d+\.\d+" className="input-field font-mono" />
        </div>
        <div>
          <label className="field-label">Latest version (optional update)</label>
          <input name={`${prefix}LatestVersion`} defaultValue={latest} required pattern="\d+\.\d+\.\d+" className="input-field font-mono" />
        </div>
      </div>
      <div className="mt-2">
        <label className="field-label">Store URL</label>
        <input name={`${prefix}StoreUrl`} defaultValue={store} className="input-field text-xs" />
      </div>
    </div>
  );
}
