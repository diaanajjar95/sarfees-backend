import { cache } from 'react';
import { apiFetch } from './api';

export interface CurrencyInfo {
  code: string;
  symbolEn: string;
  symbolAr: string;
  nameEn: string;
  nameAr: string;
  decimals: number;
}

const FALLBACK: CurrencyInfo = {
  code: 'JOD',
  symbolEn: 'JD',
  symbolAr: 'د.أ',
  nameEn: 'Jordanian Dinar',
  nameAr: 'دينار أردني',
  decimals: 2,
};

/**
 * Active platform currency — deduped per request via React cache.
 * Falls back to JOD if the API is unreachable so money rows never
 * render bare numbers.
 */
export const getCurrency = cache(async (): Promise<CurrencyInfo> => {
  try {
    return await apiFetch<CurrencyInfo>('/platform/currency', {
      anonymous: true,
    });
  } catch {
    return FALLBACK;
  }
});

/** Just the display symbol, e.g. "JD" or "SYP". */
export const getCurrencySymbol = async (): Promise<string> =>
  (await getCurrency()).symbolEn;
