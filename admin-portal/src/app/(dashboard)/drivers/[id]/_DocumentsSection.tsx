'use client';

import { useActionState, useState } from 'react';
import { FileCheck2, Upload } from 'lucide-react';
import {
  uploadDriverDocumentAction,
  type UploadDocumentResult,
} from '../actions';

export interface DocumentRow {
  id: number;
  type: string;
  fileUrl: string;
  status: string;
  displayStatus: string;
  documentNumber: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  updatedAt?: string;
}

const TYPES: { value: string; label: string; numberLabel: string }[] = [
  { value: 'driving_license', label: 'Driving license', numberLabel: 'License number' },
  { value: 'national_id', label: 'National ID', numberLabel: 'ID number' },
  { value: 'vehicle_registration', label: 'Vehicle registration', numberLabel: 'Registration number' },
  { value: 'insurance_certificate', label: 'Insurance certificate', numberLabel: 'Policy number' },
];

const STATUS_STYLE: Record<string, { color: string; label: string }> = {
  verified: { color: '#2E7D32', label: 'verified' },
  pending_review: { color: '#B57E0A', label: 'pending review' },
  rejected: { color: '#C62828', label: 'rejected' },
  expired: { color: '#C62828', label: 'expired' },
  expiring_soon: { color: '#B57E0A', label: 'expiring soon' },
};

export default function DocumentsSection({
  driverId,
  documents,
}: {
  driverId: number;
  documents: DocumentRow[];
}) {
  const byType = new Map(documents.map((d) => [d.type, d]));
  return (
    <div className="mt-4 surface-card p-5">
      <h2
        className="text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: 'var(--color-sarfees-gold)' }}
      >
        Documents ({documents.length}/{TYPES.length})
      </h2>
      <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {TYPES.map((t) => (
          <DocumentCard
            key={t.value}
            driverId={driverId}
            type={t}
            doc={byType.get(t.value) ?? null}
          />
        ))}
      </div>
    </div>
  );
}

function DocumentCard({
  driverId,
  type,
  doc,
}: {
  driverId: number;
  type: { value: string; label: string; numberLabel: string };
  doc: DocumentRow | null;
}) {
  const [state, formAction, pending] = useActionState<UploadDocumentResult | null, FormData>(
    uploadDriverDocumentAction,
    null,
  );
  const [replacing, setReplacing] = useState(false);
  const chip = doc ? STATUS_STYLE[doc.displayStatus] ?? STATUS_STYLE[doc.status] : null;
  const showForm = !doc || replacing;

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-sarfees-border)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold">{type.label}</span>
        {doc && chip ? (
          <span className="rounded px-2 py-0.5 text-xs font-bold" style={{ color: chip.color, border: `1px solid ${chip.color}44` }}>
            {chip.label}
          </span>
        ) : (
          <span className="text-xs" style={{ color: 'var(--color-sarfees-soft)' }}>missing</span>
        )}
      </div>

      {doc && (
        <div className="mt-2 space-y-1 text-xs" style={{ color: 'var(--color-sarfees-muted)' }}>
          {doc.documentNumber && <div>No. {doc.documentNumber}</div>}
          {doc.expiresAt && <div>Expires {new Date(doc.expiresAt).toLocaleDateString()}</div>}
          <div className="flex gap-3 pt-1">
            <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold hover:underline" style={{ color: 'var(--color-sarfees-gold)' }}>
              <FileCheck2 size={13} /> View file
            </a>
            {!replacing && (
              <button type="button" onClick={() => setReplacing(true)} className="hover:underline" style={{ color: 'var(--color-sarfees-muted)' }}>
                Replace
              </button>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <form action={formAction} className="mt-3 space-y-2">
          <input type="hidden" name="driverId" value={driverId} />
          <input type="hidden" name="type" value={type.value} />
          <input name="file" type="file" required accept=".jpg,.jpeg,.png,.webp,.heic,.pdf" className="block w-full text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <input name="documentNumber" placeholder={type.numberLabel} className="input-field text-xs" />
            <input name="expiresAt" type="date" className="input-field text-xs" title="Expiry date" />
          </div>
          {state && !state.ok && (
            <p className="text-xs" style={{ color: 'var(--color-sarfees-error)' }}>{state.error}</p>
          )}
          <button type="submit" disabled={pending} className="btn-secondary inline-flex items-center gap-2 text-xs disabled:opacity-60">
            <Upload size={13} /> {pending ? 'Uploading…' : doc ? 'Upload replacement' : 'Upload'}
          </button>
        </form>
      )}
    </div>
  );
}
