'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ApiError, apiFetch } from '@/lib/api';
import type { ManualAssignPayload } from '@/lib/types';

export interface ManualAssignResult {
  ok: boolean;
  error?: string;
}

function num(v: FormDataEntryValue | null): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function str(v: FormDataEntryValue | null): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length === 0 ? undefined : s;
}

function csvIds(v: FormDataEntryValue | null): number[] {
  if (v == null) return [];
  return String(v)
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export async function manualAssignAction(
  _prev: ManualAssignResult | null,
  formData: FormData,
): Promise<ManualAssignResult> {
  const tripRequestIds = csvIds(formData.get('tripRequestIds'));
  if (tripRequestIds.length === 0) {
    return {
      ok: false,
      error: 'Provide at least one tripRequest id (comma-separated).',
    };
  }
  const departureTime = str(formData.get('departureTime'));
  const driverId = num(formData.get('driverId'));
  const pickupLat = num(formData.get('pickupLat'));
  const pickupLng = num(formData.get('pickupLng'));
  const dropoffLat = num(formData.get('dropoffLat'));
  const dropoffLng = num(formData.get('dropoffLng'));
  if (
    !driverId ||
    !departureTime ||
    pickupLat == null ||
    pickupLng == null ||
    dropoffLat == null ||
    dropoffLng == null
  ) {
    return { ok: false, error: 'driverId, departureTime, pickup/dropoff lat & lng are required.' };
  }

  const payload: ManualAssignPayload = {
    driverId,
    type:
      (str(formData.get('type')) as ManualAssignPayload['type']) ?? 'shared',
    originCity: str(formData.get('originCity')) ?? '',
    destinationCity: str(formData.get('destinationCity')) ?? '',
    departureTime: new Date(departureTime).toISOString(),
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    pickupAddress: str(formData.get('pickupAddress')),
    dropoffAddress: str(formData.get('dropoffAddress')),
    tripRequestIds,
    packageDeliveryIds: csvIds(formData.get('packageDeliveryIds')),
    commissionRate: num(formData.get('commissionRate')),
    offerCountdownSeconds: num(formData.get('offerCountdownSeconds')),
  };

  let resp: { tripId: number };
  try {
    resp = await apiFetch<{ tripId: number; status: string; offerExpiresAt: string }>(
      '/admin/trips/manual-assign',
      { method: 'POST', body: payload },
    );
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: 'Unable to create trip.' };
  }
  revalidatePath('/trips');
  redirect(`/trips/${resp.tripId}`);
}

export interface CancelResult {
  ok: boolean;
  error?: string;
}

/**
 * Ops full-stop on a trip. Backend cancels the trip + linked
 * requests/packages/group, releases the driver penalty-free, and
 * notifies everyone. Reason is mandatory.
 */
export async function cancelTripAction(
  _prev: CancelResult | null,
  formData: FormData,
): Promise<CancelResult> {
  const tripId = num(formData.get('tripId'));
  const reason = str(formData.get('reason'));
  if (!tripId) return { ok: false, error: 'Missing trip id.' };
  if (!reason) return { ok: false, error: 'A cancellation reason is required.' };

  try {
    await apiFetch(`/admin/trips/${tripId}/cancel`, {
      method: 'POST',
      body: { reason },
    });
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: 'Unable to cancel the trip.' };
  }
  revalidatePath('/trips');
  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}
