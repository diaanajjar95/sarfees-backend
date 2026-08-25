import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export enum MobileApp {
  PASSENGER = 'passenger',
  DRIVER = 'driver',
}

/**
 * Per-app runtime configuration, editable from the admin portal.
 * One row per app (passenger / driver) — maintenance switch and the
 * version gates the init/force-update endpoints serve. Seeded from the
 * legacy env vars on first boot; portal edits survive redeploys.
 */
@Entity('mobile_app_configs')
export class MobileAppConfig {
  @PrimaryColumn({ type: 'enum', enum: MobileApp })
  app: MobileApp;

  @Column({ default: false })
  maintenanceMode: boolean;

  @Column({ type: 'text', nullable: true })
  maintenanceMessageEn: string | null;

  @Column({ type: 'text', nullable: true })
  maintenanceMessageAr: string | null;

  // ── Android ──
  @Column({ default: '1.0.0' })
  androidMinVersion: string;

  @Column({ default: '1.0.0' })
  androidLatestVersion: string;

  @Column({ default: 'https://play.google.com/store/apps/details?id=PLACEHOLDER' })
  androidStoreUrl: string;

  // ── iOS ──
  @Column({ default: '1.0.0' })
  iosMinVersion: string;

  @Column({ default: '1.0.0' })
  iosLatestVersion: string;

  @Column({ default: 'https://apps.apple.com/app/idPLACEHOLDER' })
  iosStoreUrl: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
