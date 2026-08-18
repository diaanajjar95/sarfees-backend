import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { City } from '../../cities/city.entity';
import { PackageSize } from '../../shared/enums/package-size.enum';
import { PackageStatus } from '../../shared/enums/package-status.enum';
import { TripGroup } from '../../grouping/entities/trip-group.entity';

@Entity('package_deliveries')
export class PackageDelivery {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  sender: User;

  @ManyToOne(() => City)
  departureCity: City;

  @ManyToOne(() => City)
  arrivalCity: City;

  @Column('json')
  pickupLocation: { lat: number; lng: number };

  @Column('json')
  dropOffLocation: { lat: number; lng: number };

  // Package details
  @Column({ type: 'enum', enum: PackageSize })
  packageSize: PackageSize;

  @Column({ type: 'text', nullable: true })
  packageDescription: string;

  @Column({ nullable: true })
  packagePhotoUrl: string;

  // Receiver details
  @Column()
  receiverName: string;

  @Column()
  receiverPhone: string;

  // Pricing
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  deliveryFee: number;

  // Terms
  @Column({ default: false })
  termsAccepted: boolean;

  // Scheduling — mirrors TripRequest.travelDate / isImmediate semantics.
  @Column({ type: 'timestamp', nullable: true })
  pickupDate: Date;

  @Column({ default: false })
  isImmediate: boolean;

  // Status & tracking
  @Column({ type: 'enum', enum: PackageStatus, default: PackageStatus.PENDING })
  status: PackageStatus;

  /**
   * Master spec §6.2 — weight cap check runs independently of the slot
   * calculation ("whichever cap binds first, wins"). Nullable until the
   * sender-facing form starts collecting it; grouping falls back to a
   * per-size-class default when null.
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  weightKg: string | null;

  /**
   * Master spec §6.6 — URGENT deliveries skip grouping and get a solo
   * trip with instant driver search + premium price. Wired in PR 6;
   * column added here so PR 5 can filter it out of normal grouping.
   */
  @Column({ default: false })
  urgent: boolean;

  /** The Stage-1 grouping bundle this delivery landed in, if any. */
  @ManyToOne(() => TripGroup, { nullable: true })
  tripGroup: TripGroup | null;

  /**
   * 4-digit delivery confirmation code (§6.5). Sent to the recipient
   * (SMS mocked for now — the sender sees it in the app and relays);
   * the driver must present it back at handover.
   */
  @Column({ type: 'varchar', length: 8, nullable: true })
  deliveryCode: string | null;

  /** Driver's photo of the handed-over package (§6.5). */
  @Column({ type: 'text', nullable: true })
  deliveredPhotoUrl: string | null;

  /** Why the delivery was cancelled; ops-entered for admin cancels. */
  @Column({ type: 'text', nullable: true })
  cancellationReason: string | null;

  /** Admin who cancelled this delivery, when ops-initiated. */
  @Column({ type: 'int', nullable: true })
  cancelledByAdminId: number | null;

  /**
   * Anonymous tracking handle for the RECEIVER (not an app user).
   * Shared over WhatsApp as /track/<token> — status timeline only,
   * no map, no auth. Null on legacy rows created before this shipped.
   */
  @Column({ type: 'varchar', length: 40, nullable: true, unique: true })
  trackingToken: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
