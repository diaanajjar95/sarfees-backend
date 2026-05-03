'use client';

import { useActionState } from 'react';
import type { DriverFormState } from './actions';
import type { DriverProfile } from '@/lib/types';

interface Props {
  initial?: DriverProfile;
  /** Server action bound by the parent (create vs update). */
  action: (prev: DriverFormState | null, formData: FormData) => Promise<DriverFormState>;
  submitLabel: string;
  isEdit?: boolean;
}

export default function DriverForm({ initial, action, submitLabel, isEdit }: Props) {
  const [state, formAction, pending] = useActionState<DriverFormState | null, FormData>(
    action,
    null,
  );

  return (
    <form action={formAction} className="space-y-6">
      <Section title="Identity">
        <Field label="Full name" name="name" defaultValue={initial?.name ?? ''} required />
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Country code"
            name="countryCode"
            defaultValue={initial?.countryCode ?? '+962'}
            required
            disabled={isEdit}
          />
          <Field
            label="Phone number"
            name="phoneNumber"
            defaultValue={initial?.phoneNumber ?? ''}
            required
            disabled={isEdit}
            placeholder="7700000000"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Gender"
            name="gender"
            defaultValue={initial?.gender ?? 'male'}
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
            ]}
          />
          <Select
            label="Language"
            name="language"
            defaultValue={initial?.language ?? 'en'}
            options={[
              { value: 'en', label: 'English' },
              { value: 'ar', label: 'العربية' },
            ]}
          />
        </div>
        <Field
          label="Home city"
          name="homeCity"
          defaultValue={initial?.homeCity ?? ''}
          required
          placeholder="Amman"
        />
      </Section>

      <Section title="Vehicle">
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Make"
            name="vehicleMake"
            defaultValue={initial?.vehicle?.make ?? ''}
            placeholder="Toyota"
          />
          <Field
            label="Model"
            name="vehicleModel"
            defaultValue={initial?.vehicle?.model ?? ''}
            placeholder="Camry"
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field
            label="Color"
            name="vehicleColor"
            defaultValue={initial?.vehicle?.color ?? ''}
          />
          <Field
            label="Year"
            name="vehicleYear"
            type="number"
            defaultValue={initial?.vehicle?.year ?? ''}
            min={1980}
            max={2100}
          />
          <Field
            label="Capacity"
            name="passengerCapacity"
            type="number"
            defaultValue={initial?.vehicle?.passengerCapacity ?? 4}
            min={1}
            max={10}
          />
        </div>
        <Field
          label="Plate number"
          name="plateNumber"
          defaultValue={initial?.vehicle?.plateNumber ?? ''}
        />
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

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </button>
      </div>
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

interface SelectProps {
  label: string;
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
}
function Select({ label, name, defaultValue, options }: SelectProps) {
  return (
    <div>
      <label className="field-label" htmlFor={name}>
        {label}
      </label>
      <select id={name} name={name} defaultValue={defaultValue} className="input-field">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
