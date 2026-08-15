import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Driver } from '../../drivers/driver.entity';
import { DriverTripStatus } from '../../shared/enums/driver-trip-status.enum';
import { DriverTripType } from '../../shared/enums/driver-trip-type.enum';
import { DriverTripStop } from './driver-trip-stop.entity';

@Entity('driver_trips')
export class DriverTrip {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Driver, { eager: false })
  driver: Driver;

  @Column({ type: 'enum', enum: DriverTripType })
  type: DriverTripType;

  @Column({
    type: 'enum',
    enum: DriverTripStatus,
    default: DriverTripStatus.OFFERED,
  })
  status: DriverTripStatus;

  @Column()
  originCity: string;

  @Column()
  destinationCity: string;

  @Column({ type: 'timestamp' })
  departureTime: Date;

  @Column({ default: 0 })
  currentStopIndex: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalCashExpected: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalCashCollected: number;

  /** Platform commission as a fraction, e.g. 0.15 = 15% */
  @Column({ type: 'decimal', precision: 4, scale: 3, default: 0.15 })
  commissionRate: number;

  /**
   * Commission actually deducted from the driver's wallet at
   * completion = round(totalCashExpected × commissionRate). Null on
   * trips completed before the wallet shipped — readers fall back to
   * recomputing from collected cash for those legacy rows (see
   * tripCommission helper below).
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  commissionAmount: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  netEarnings: number;

  // ─── Lifecycle timestamps ─────────────────────────────────
  @Column({ type: 'timestamp', nullable: true })
  offeredAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  offerExpiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  acceptedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  declinedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date;

  @Column({ type: 'text', nullable: true })
  cancellationReason: string;

  /** 1 = before start (no penalty), 2 = after start before first pickup (soft penalty) */
  @Column({ nullable: true })
  cancellationZone: number;

  /** Admin who cancelled this trip, when ops-initiated (null = driver cancel). */
  @Column({ type: 'int', nullable: true })
  cancelledByAdminId: number | null;

  // ─── Relations ────────────────────────────────────────────
  @OneToMany(() => DriverTripStop, (stop) => stop.trip, {
    cascade: true,
    eager: false,
  })
  stops: DriverTripStop[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/**
 * Commission for a completed trip: the stored wallet deduction when
 * present, else the legacy recomputation (collected × rate) for trips
 * completed before the prepaid wallet shipped.
 */
export function tripCommission(t: {
  commissionAmount?: number | null;
  totalCashCollected: number;
  commissionRate: number;
}): number {
  if (t.commissionAmount != null) return Number(t.commissionAmount);
  return (
    Math.round(Number(t.totalCashCollected) * Number(t.commissionRate) * 100) /
    100
  );
}
