import {
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Singleton config row (id=1) holding every admin-tunable knob from
 * master spec §14. Seeded from env vars on first boot; existing row
 * is left alone on subsequent boots so ops SQL edits survive
 * redeploys. Read via MatchingConfigService.getConfig().
 */
@Entity('matching_config')
export class MatchingConfig {
  @PrimaryColumn({ type: 'int' })
  id: number;

  // ─── Group size + geometry ─────────────────────────────────
  @Column({ type: 'int', default: 4 })
  defaultMaxGroupSize: number;

  @Column({ type: 'int', default: 5000 })
  defaultServiceRadiusMeters: number;

  @Column({ type: 'int', default: 20 })
  detourBoundPercent: number;

  // ─── Mixed / packages-only trip guardrails (§5.4, §6.2) ────
  @Column({ type: 'int', default: 2 })
  mixedPassengerMin: number;

  @Column({ type: 'int', default: 3 })
  mixedPassengerMax: number;

  @Column({ type: 'int', default: 3 })
  mixedPackageMin: number;

  @Column({ type: 'int', default: 5 })
  mixedPackageMax: number;

  @Column({ type: 'int', default: 7 })
  packagesOnlyPackageMin: number;

  @Column({ type: 'int', default: 15 })
  packagesOnlyPackageMax: number;

  // ─── Package slot values (§6.2) ────────────────────────────
  @Column({ type: 'int', default: 1 })
  slotValueSmall: number;

  @Column({ type: 'int', default: 2 })
  slotValueMedium: number;

  @Column({ type: 'int', default: 3 })
  slotValueLarge: number;

  // ─── Time thresholds ───────────────────────────────────────
  @Column({ type: 'int', default: 12 })
  passengerWaitToleranceMinutes: number;

  @Column({ type: 'int', default: 12 })
  packageWaitToleranceMinutes: number;

  @Column({ type: 'int', default: 300 })
  handlingSecondsPerPackageStop: number;

  @Column({ type: 'int', default: 30 })
  offerCountdownSeconds: number;

  @Column({ type: 'int', default: 30 })
  driverSearchLeadMinutes: number;

  @Column({ type: 'int', default: 15 })
  nowWindowMinMinutes: number;

  @Column({ type: 'int', default: 30 })
  nowWindowMaxMinutes: number;

  @Column({ type: 'int', default: 30 })
  sweepIntervalSeconds: number;

  // ─── Cascade / broadcast / penalties (§9.4, §9.5) ──────────
  @Column({ type: 'int', default: 3 })
  urgentEarlyBroadcastDeclines: number;

  @Column({ type: 'int', default: 5 })
  broadcastTriggerDeclineCount: number;

  @Column({ type: 'int', default: 10 })
  declinePenaltyBase: number;

  @Column({ type: 'int', default: 7 })
  declinePenaltyDecayDays: number;

  @Column({ type: 'int', default: 15 })
  driverCancelPenalty: number;

  // ─── Grace periods (§6.7, §10) ─────────────────────────────
  @Column({ type: 'int', default: 10 })
  recipientGraceMinutes: number;

  @Column({ type: 'int', default: 7 })
  senderNoShowGraceMinutes: number;

  @Column({ type: 'int', default: 5 })
  assignedDriverOfflineGraceMinutes: number;

  // ─── Fees + discount (amounts owned by finance / §14) ──────
  @Column({ type: 'decimal', precision: 6, scale: 2, default: 2.0 })
  cancellationFeeAmountJod: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 3.0 })
  noShowFeeAmountJod: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 5.0 })
  returnRedeliveryFeeAmountJod: string;

  @Column({ type: 'int', default: 10 })
  fullCarDiscountPercent: number;

  // ─── Going-home boundary (§9.6) ────────────────────────────
  @Column({ type: 'int', default: 0 })
  goingHomeDayBoundaryHourLocal: number;

  // ─── Prohibited items list (§6.4) ──────────────────────────
  @Column({ type: 'jsonb', nullable: true })
  prohibitedItemsListJson: unknown | null;

  // ─── Map provider fallback strategy ────────────────────────
  @Column({ type: 'varchar', length: 20, default: 'haversine' })
  mapProviderFallback: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
