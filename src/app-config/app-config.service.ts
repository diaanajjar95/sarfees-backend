import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nContext } from 'nestjs-i18n';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MobilePlatform } from './dto/init-query.dto';

export interface LocalizedDocument {
  ar: string;
  en: string;
  /** ISO date string of the last file edit; client can prompt re-acceptance when this changes. */
  updatedAt: string;
}

export interface LegalPayload {
  terms: LocalizedDocument;
  privacy: LocalizedDocument;
}

export interface PlatformVersionInfo {
  latestVersion: string;
  minVersion: string;
  storeUrl: string;
}

export interface ForceUpdateResult {
  forceUpdate: boolean;
  updateAvailable: boolean;
  minVersion: string;
  latestVersion: string;
  storeUrl: string;
}

@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);

  /**
   * Legal documents are read once at first access and memoised. Replace with a
   * DB-backed admin-editable store if/when ops needs to update T&C without
   * a redeploy.
   */
  private legalCache: LegalPayload | null = null;

  constructor(private readonly config: ConfigService) {}

  /** Per-platform version metadata driven by env vars. */
  getPlatformVersion(platform: MobilePlatform): PlatformVersionInfo {
    if (platform === MobilePlatform.IOS) {
      return {
        latestVersion: this.config.get<string>('IOS_LATEST_VERSION') ?? '1.0.0',
        minVersion: this.config.get<string>('IOS_MIN_VERSION') ?? '1.0.0',
        storeUrl:
          this.config.get<string>('IOS_STORE_URL') ??
          'https://apps.apple.com/app/idPLACEHOLDER',
      };
    }
    return {
      latestVersion:
        this.config.get<string>('ANDROID_LATEST_VERSION') ?? '1.0.0',
      minVersion: this.config.get<string>('ANDROID_MIN_VERSION') ?? '1.0.0',
      storeUrl:
        this.config.get<string>('ANDROID_STORE_URL') ??
        'https://play.google.com/store/apps/details?id=PLACEHOLDER',
    };
  }

  /** Static URLs and other launch-time values. */
  getAppLinks() {
    return {
      termsUrl:
        this.config.get<string>('TERMS_URL') ??
        'https://sarfees.com/legal/terms',
      privacyUrl:
        this.config.get<string>('PRIVACY_URL') ??
        'https://sarfees.com/legal/privacy',
      supportEmail:
        this.config.get<string>('SUPPORT_EMAIL') ?? 'support@sarfees.com',
      supportPhone: this.config.get<string>('SUPPORT_PHONE') ?? null,
    };
  }

  /** Feature-flag / toggle values surfaced on app launch. */
  getSettings() {
    return {
      maintenanceMode:
        (this.config.get<string>('MAINTENANCE_MODE') ?? 'false') === 'true',
      maintenanceMessage:
        this.config.get<string>('MAINTENANCE_MESSAGE') ?? null,
      defaultLanguage: this.config.get<string>('DEFAULT_LANGUAGE') ?? 'en',
      supportedLanguages: (
        this.config.get<string>('SUPPORTED_LANGUAGES') ?? 'en,ar'
      )
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }

  /**
   * Decide whether a client should be forced or nudged to update.
   * Returns sane defaults when platform / version are not supplied.
   */
  getForceUpdate(
    platform: MobilePlatform | undefined,
    currentVersion: string | undefined,
  ): ForceUpdateResult {
    const resolvedPlatform = platform ?? MobilePlatform.IOS;
    const version = this.getPlatformVersion(resolvedPlatform);

    // If we can't parse the client version, don't force an update.
    if (!currentVersion) {
      return {
        forceUpdate: false,
        updateAvailable: false,
        minVersion: version.minVersion,
        latestVersion: version.latestVersion,
        storeUrl: version.storeUrl,
      };
    }

    const cmp = (a: string, b: string): number => {
      const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
      const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
      for (let i = 0; i < 3; i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (diff !== 0) return diff > 0 ? 1 : -1;
      }
      return 0;
    };

    const forceUpdate = cmp(currentVersion, version.minVersion) < 0;
    const updateAvailable = cmp(currentVersion, version.latestVersion) < 0;

    return {
      forceUpdate,
      updateAvailable,
      minVersion: version.minVersion,
      latestVersion: version.latestVersion,
      storeUrl: version.storeUrl,
    };
  }

  /**
   * Resolved request language from Accept-Language header (via nestjs-i18n).
   * Falls back to DEFAULT_LANGUAGE env (or 'en') when called outside an i18n
   * request scope.
   */
  getCurrentLanguage(): string {
    return (
      I18nContext.current()?.lang ??
      this.config.get<string>('DEFAULT_LANGUAGE') ??
      'en'
    );
  }

  /** Terms & conditions and privacy policy in both supported languages. */
  getLegal(): LegalPayload {
    if (!this.legalCache) {
      this.legalCache = {
        terms: this.readDoc('terms'),
        privacy: this.readDoc('privacy'),
      };
    }
    return this.legalCache;
  }

  private readDoc(name: 'terms' | 'privacy'): LocalizedDocument {
    // Resolves to dist/app-config/legal/ at runtime; nest-cli copies the .md
    // assets into dist via the assets rule.
    const dir = join(__dirname, 'legal');
    const en = this.safeRead(join(dir, `${name}.en.md`));
    const ar = this.safeRead(join(dir, `${name}.ar.md`));
    let updatedAt = new Date(0).toISOString();
    try {
      const enStat = statSync(join(dir, `${name}.en.md`));
      const arStat = statSync(join(dir, `${name}.ar.md`));
      const newest = Math.max(enStat.mtimeMs, arStat.mtimeMs);
      updatedAt = new Date(newest).toISOString();
    } catch {
      /* keep epoch fallback */
    }
    return { en, ar, updatedAt };
  }

  private safeRead(path: string): string {
    try {
      return readFileSync(path, 'utf8');
    } catch (err) {
      this.logger.warn(`Legal doc missing at ${path}: ${(err as Error).message}`);
      return '';
    }
  }
}
