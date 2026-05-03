'use client';

import { useActionState } from 'react';
import { manualAssignAction, type ManualAssignResult } from '../actions';
import type { DriverProfile } from '@/lib/types';

export interface Prefill {
  tripRequestIds?: string;
  type?: string;
  originCity?: string;
  destinationCity?: string;
  departureTime?: string;
  pickupLat?: string;
  pickupLng?: string;
  dropoffLat?: string;
  dropoffLng?: string;
}

export default function ManualAssignForm({
  drivers,
  prefill = {},
}: {
  drivers: DriverProfile[];
  prefill?: Prefill;
}) {
  const [state, formAction, pending] = useActionState<
    ManualAssignResult | null,
    FormData
  >(manualAssignAction, null);

  return (
    <form action={formAction} className="space-y-6">
      <Section title="Assignment">
        <Select
          label="Driver"
          name="driverId"
          required
          options={drivers.map((d) => ({
            value: String(d.id),
            label: `${d.name ?? '—'} · ${d.countryCode} ${d.phoneNumber} · ${d.status}`,
          }))}
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Trip type"
            name="type"
            defaultValue={prefill.type ?? 'shared'}
            options={[
              { value: 'shared', label: 'Shared' },
              { value: 'women_only', label: 'Women-only' },
              { value: 'mixed', label: 'Mixed' },
              { value: 'packages_only', label: 'Packages only' },
            ]}
          />
          <Field
            label="Departure (local)"
            name="departureTime"
            type="datetime-local"
            required
            defaultValue={prefill.departureTime ?? ''}
          />
        </div>
      </Section>

      <Section title="Route">
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Origin city"
            name="originCity"
            required
            defaultValue={prefill.originCity ?? 'Irbid'}
          />
          <Field
            label="Destination city"
            name="destinationCity"
            required
            defaultValue={prefill.destinationCity ?? 'Amman'}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Pickup lat"
            name="pickupLat"
            type="number"
            step="any"
            required
            defaultValue={prefill.pickupLat ?? '32.5556'}
          />
          <Field
            label="Pickup lng"
            name="pickupLng"
            type="number"
            step="any"
            required
            defaultValue={prefill.pickupLng ?? '35.85'}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Dropoff lat"
            name="dropoffLat"
            type="number"
            step="any"
            required
            defaultValue={prefill.dropoffLat ?? '31.9539'}
          />
          <Field
            label="Dropoff lng"
            name="dropoffLng"
            type="number"
            step="any"
            required
            defaultValue={prefill.dropoffLng ?? '35.9106'}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Pickup address" name="pickupAddress" />
          <Field label="Dropoff address" name="dropoffAddress" />
        </div>
      </Section>

      <Section title="Payload">
        <Field
          label="Trip request IDs (comma-separated)"
          name="tripRequestIds"
          required
          placeholder="1,2,3"
          defaultValue={prefill.tripRequestIds ?? ''}
        />
        <Field
          label="Package delivery IDs (optional, comma-separated)"
          name="packageDeliveryIds"
          placeholder="10,11"
        />
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Commission rate (0-1, default 0.15)"
            name="commissionRate"
            type="number"
            step="0.01"
            min={0}
            max={1}
          />
          <Field
            label="Offer countdown seconds (default 45)"
            name="offerCountdownSeconds"
            type="number"
            min={5}
            max={600}
          />
        </div>
      </Section>

      {state?.error && (
        <div
          className="rounded-md px-3 py-2 text-sm"
          style={{
            color: 'var(--color-sarfees-error)',
            backgroundColor: 'rgba(198,40,40,0.08)',
            border: '1px solid rgba(198,40,40,0.25)',
          }}
        >
          {state.error}
        </div>
      )}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? 'Creating offer…' : 'Create OFFERED trip'}
      </button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="surface-card p-5 space-y-4">
      <h2
        className="text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: 'var(--color-sarfees-gold)' }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}
function Field({ label, ...rest }: FieldProps) {
  return (
    <div>
      <label className="field-label" htmlFor={rest.name}>
        {label}
      </label>
      <input {...rest} id={rest.name} className="input-field" />
    </div>
  );
}

function Select({
  label,
  name,
  defaultValue,
  required,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="field-label" htmlFor={name}>
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="input-field"
      >
        <option value="" disabled>
          Choose…
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
