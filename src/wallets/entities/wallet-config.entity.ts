import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Singleton (id = 1) wallet knobs, editable at runtime from the admin
 * portal. Seeded from env on first boot (WalletConfigService); an
 * existing row is never overwritten by a redeploy — mirrors the
 * matching_config pattern.
 */
@Entity('wallet_config')
export class WalletConfig {
  @PrimaryColumn({ type: 'int' })
  id: number;

  /**
   * Platform commission as a percentage of the trip's TOTAL price
   * (sum of passenger fares + package fees), 0–100. Snapshotted onto
   * each trip's commissionRate at creation — editing it never
   * rewrites already-created trips.
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 15 })
  commissionPercent: number;

  /** Below this balance the driver sees the "top up" warning. */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 5 })
  lowBalanceThresholdJod: number;

  /** Minimum hours between two low-balance notifications per driver. */
  @Column({ type: 'int', default: 24 })
  lowBalanceNotifyCooldownHours: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
