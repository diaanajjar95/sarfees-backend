import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { DriverStatus } from '../shared/enums/driver-status.enum';
import { DriverSuspensionCategory } from '../shared/enums/driver-suspension-category.enum';

@Entity('drivers')
@Unique('UQ_driver_phone_country', ['countryCode', 'phoneNumber'])
export class Driver {
  @PrimaryGeneratedColumn()
  id: number;

  // ─── Identity ───────────────────────────────────────────────
  @Column({ nullable: true })
  name: string;

  @Column()
  phoneNumber: string;

  @Column()
  countryCode: string;

  @Column({ type: 'enum', enum: ['male', 'female'], nullable: true })
  gender: 'male' | 'female';

  @Column({ nullable: true })
  homeCity: string;

  @Column({ nullable: true })
  profilePhotoUrl: string;

  // ─── Lifecycle ──────────────────────────────────────────────
  @Column({
    type: 'enum',
    enum: DriverStatus,
    default: DriverStatus.INACTIVE,
  })
  status: DriverStatus;

  @Column({ type: 'enum', enum: ['ar', 'en'], default: 'en' })
  language: 'ar' | 'en';

  // ─── Vehicle ────────────────────────────────────────────────
  @Column({ nullable: true })
  vehicleMake: string;

  @Column({ nullable: true })
  vehicleModel: string;

  @Column({ nullable: true })
  vehicleColor: string;

  @Column({ nullable: true })
  vehicleYear: number;

  @Column({ nullable: true })
  plateNumber: string;

  @Column({ default: 4 })
  passengerCapacity: number;

  // ─── Reputation & Metrics ───────────────────────────────────
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 5.0 })
  rating: number;

  @Column({ default: 0 })
  ratingCount: number;

  @Column({ default: 0 })
  totalTrips: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  outstandingBalance: number;

  // ─── Active Session Preferences (populated only while active) ─
  @Column({ nullable: true })
  prefDestinationCity: string;

  @Column({ type: 'simple-array', nullable: true })
  prefTripTypes: string[];

  @Column({ default: false })
  prefGoingHome: boolean;

  @Column({ nullable: true })
  prefMinPassengers: number;

  @Column({ nullable: true })
  prefActivatedAt: Date;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  prefLocationLat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  prefLocationLng: number;

  // ─── Auth ───────────────────────────────────────────────────
  @Column({ default: false })
  hasVerifiedOtpBefore: boolean;

  @Column({ nullable: true })
  refreshToken: string;

  @Column({ nullable: true })
  fcmToken: string;

  @Column({ nullable: true })
  otp: string;

  @Column({ nullable: true })
  otpExpiresAt: Date;

  @Column({ default: 0 })
  otpRequestCount: number;

  @Column({ nullable: true })
  otpLastRequestAt: Date;

  @Column({ default: 0 })
  otpAttemptCount: number;

  @Column({ nullable: true })
  otpLockedUntil: Date;

  // ─── Notifications ──────────────────────────────────────────
  @Column({ default: true })
  notifyTripOffers: boolean;

  @Column({ default: true })
  notifyTripUpdates: boolean;

  @Column({ default: true })
  notifyEarnings: boolean;

  @Column({ default: true })
  notifyAnnouncements: boolean;

  // ─── Session audit (last activate/deactivate cycle) ─────────
  /** When the driver most recently transitioned to ACTIVE. Survives deactivate. */
  @Column({ type: 'timestamp', nullable: true })
  lastSessionStartedAt: Date;

  /** When the driver most recently transitioned back to INACTIVE. */
  @Column({ type: 'timestamp', nullable: true })
  lastSessionEndedAt: Date;

  // ─── Suspension audit (admin suspend/reinstate) ─────────────
  /** When admin last suspended the driver. Cleared on reinstate. */
  @Column({ type: 'timestamp', nullable: true })
  suspendedAt: Date;

  /** Optional reason string admin provides on suspend. Cleared on reinstate. */
  @Column({ type: 'text', nullable: true })
  suspensionReason: string;

  /**
   * Category bucket admin picks on suspend — drives the mobile suspended-state
   * card variant (documents / rating / payment / violation). `null` for
   * legacy suspensions predating this feature. Cleared on reinstate.
   */
  @Column({ type: 'enum', enum: DriverSuspensionCategory, nullable: true })
  suspensionCategory: DriverSuspensionCategory;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
