'use client';

import { useActionState, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, UserPlus } from 'lucide-react';
import { createDriverAction, type DriverFormState } from './actions';

const STEPS = ['Driver', 'Vehicle', 'Attachments', 'Confirm'] as const;

const DOCUMENT_TYPES = [
  { value: 'driving_license', label: 'Driving license', numberLabel: 'License number' },
  { value: 'national_id', label: 'National ID', numberLabel: 'ID number' },
  { value: 'vehicle_registration', label: 'Vehicle registration', numberLabel: 'Registration number' },
  { value: 'insurance_certificate', label: 'Insurance certificate', numberLabel: 'Policy number' },
] as const;

interface Summary {
  driver: [string, string][];
  vehicle: [string, string][];
  documents: [string, string][];
}

/**
 * 4-step registration wizard. ONE form wraps every step — steps are
 * hidden with CSS (never unmounted) so all values, including chosen
 * files, survive navigation and submit together in a single FormData.
 */
export default function RegistrationWizard() {
  const [step, setStep] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<DriverFormState | null, FormData>(
    createDriverAction,
    null,
  );

  const validateStep = (idx: number): boolean => {
    const container = formRef.current?.querySelector<HTMLElement>(
      `[data-step="${idx}"]`,
    );
    if (!container) return true;
    const inputs = container.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      'input, select',
    );
    for (const el of Array.from(inputs)) {
      if (!el.checkValidity()) {
        el.reportValidity();
        return false;
      }
    }
    return true;
  };

  const buildSummary = () => {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const g = (k: string) => String(fd.get(k) ?? '').trim();
    const docs: [string, string][] = DOCUMENT_TYPES.map((d) => {
      const file = fd.get(`doc_file_${d.value}`);
      const name =
        file instanceof File && file.size > 0 ? file.name : '— not attached —';
      const num = g(`doc_number_${d.value}`);
      return [d.label, num ? `${name} · No. ${num}` : name];
    });
    setSummary({
      driver: [
        ['Full name', g('name')],
        ['Phone', `${g('countryCode')} ${g('phoneNumber')}`],
        ['Gender', g('gender')],
        ['Language', g('language') === 'ar' ? 'العربية' : 'English'],
        ['Home city', g('homeCity')],
      ],
      vehicle: [
        ['Make / model', `${g('vehicleMake')} ${g('vehicleModel')}`.trim() || '—'],
        ['Color', g('vehicleColor') || '—'],
        ['Year', g('vehicleYear') || '—'],
        ['Capacity', g('passengerCapacity') || '—'],
        ['Plate number', g('plateNumber') || '—'],
      ],
      documents: docs,
    });
  };

  const next = () => {
    if (!validateStep(step)) return;
    if (step === STEPS.length - 2) buildSummary();
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {/* Step indicator */}
      <ol className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
              style={
                i < step
                  ? { background: '#2E7D32', color: '#fff' }
                  : i === step
                    ? { background: 'var(--color-sarfees-gold-bright)', color: '#1A1A1A' }
                    : { background: 'var(--color-sarfees-dark-3)', color: 'var(--color-sarfees-soft)' }
              }
            >
              {i < step ? <Check size={14} /> : i + 1}
            </span>
            <span
              className="text-xs font-semibold"
              style={{ color: i === step ? 'var(--color-sarfees-text)' : 'var(--color-sarfees-soft)' }}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="h-px w-6" style={{ background: 'var(--color-sarfees-border)' }} />
            )}
          </li>
        ))}
      </ol>

      {/* Step 1 — Driver */}
      <div data-step="0" hidden={step !== 0} className="surface-card space-y-4 p-6">
        <div>
          <label className="field-label">Full name</label>
          <input name="name" required minLength={2} className="input-field" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Country code</label>
            <input name="countryCode" defaultValue="+962" required className="input-field" />
          </div>
          <div>
            <label className="field-label">Phone number</label>
            <input name="phoneNumber" required pattern="[0-9]{7,15}" className="input-field" placeholder="7700000001" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Gender</label>
            <select name="gender" defaultValue="male" className="input-field">
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label className="field-label">Language</label>
            <select name="language" defaultValue="en" className="input-field">
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </div>
        </div>
        <div>
          <label className="field-label">Home city</label>
          <input name="homeCity" required className="input-field" placeholder="Amman" />
        </div>
      </div>

      {/* Step 2 — Vehicle */}
      <div data-step="1" hidden={step !== 1} className="surface-card space-y-4 p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Make</label>
            <input name="vehicleMake" className="input-field" placeholder="Toyota" />
          </div>
          <div>
            <label className="field-label">Model</label>
            <input name="vehicleModel" className="input-field" placeholder="Camry" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="field-label">Color</label>
            <input name="vehicleColor" className="input-field" />
          </div>
          <div>
            <label className="field-label">Year</label>
            <input name="vehicleYear" type="number" min={1980} max={2100} className="input-field" />
          </div>
          <div>
            <label className="field-label">Capacity</label>
            <input name="passengerCapacity" type="number" min={1} max={10} defaultValue={4} className="input-field" />
          </div>
        </div>
        <div>
          <label className="field-label">Plate number</label>
          <input name="plateNumber" className="input-field" placeholder="12-34567" />
        </div>
      </div>

      {/* Step 3 — Attachments */}
      <div data-step="2" hidden={step !== 2} className="surface-card space-y-4 p-6">
        <p className="text-xs" style={{ color: 'var(--color-sarfees-soft)' }}>
          JPG / PNG / WebP / HEIC / PDF, up to 10 MB each. All four are
          optional here — anything skipped can be uploaded later from the
          driver&apos;s page. Admin uploads are marked verified automatically.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DOCUMENT_TYPES.map((d) => (
            <div key={d.value} className="rounded-xl border p-3" style={{ borderColor: 'var(--color-sarfees-border)' }}>
              <div className="text-sm font-bold">{d.label}</div>
              <input
                name={`doc_file_${d.value}`}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.heic,.pdf"
                className="mt-2 block w-full text-xs"
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input name={`doc_number_${d.value}`} placeholder={d.numberLabel} className="input-field text-xs" />
                <input name={`doc_expiry_${d.value}`} type="date" title="Expiry date" className="input-field text-xs" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step 4 — Confirm */}
      <div data-step="3" hidden={step !== 3} className="surface-card space-y-5 p-6">
        {summary && (
          <>
            <ReviewBlock title="Driver" rows={summary.driver} />
            <ReviewBlock title="Vehicle" rows={summary.vehicle} />
            <ReviewBlock title="Attachments" rows={summary.documents} />
          </>
        )}
        <p className="text-xs" style={{ color: 'var(--color-sarfees-muted)' }}>
          On confirm the driver is created, the attached documents are
          uploaded as verified, and the driver can sign in immediately via
          the OTP flow.
        </p>
      </div>

      {state && !state.ok && state.error && (
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

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={back}
          disabled={step === 0 || pending}
          className="btn-secondary inline-flex items-center gap-1 disabled:opacity-40"
        >
          <ChevronLeft size={15} /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={next}
            className="btn-primary inline-flex items-center gap-1"
          >
            Next <ChevronRight size={15} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={pending}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
          >
            <UserPlus size={15} /> {pending ? 'Creating…' : 'Confirm & create driver'}
          </button>
        )}
      </div>
    </form>
  );
}

function ReviewBlock({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div>
      <h3
        className="text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: 'var(--color-sarfees-gold)' }}
      >
        {title}
      </h3>
      <dl className="mt-2 space-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt style={{ color: 'var(--color-sarfees-muted)' }}>{label}</dt>
            <dd className="text-right font-semibold">{value || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
