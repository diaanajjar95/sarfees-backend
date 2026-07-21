import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Driver } from '../../drivers/driver.entity';
import { DriverTrip } from '../../driver-trips/entities/driver-trip.entity';
import { TripGroup } from '../../grouping/entities/trip-group.entity';
import { OfferResponse } from '../../shared/enums/offer-response.enum';

/**
 * One row per (group, driver) cascade offer. Every offer emitted by
 * AssignmentService — cascade or broadcast — is logged here.
 * Powers the decline-penalty accumulator (§9.5), the ops audit trail
 * (§9.7 escalations reference it), and the "no double-offer" guard.
 *
 * driverTripId is the OFFERED DriverTrip we created for this driver;
 * ACCEPTED it moves through the existing lifecycle, DECLINED/TIMEOUT
 * it stays in DriverTripStatus.DECLINED/EXPIRED.
 */
@Entity('trip_offer_history')
@Index('idx_offer_history_group', ['tripGroup'])
@Index('idx_offer_history_driver_pending', ['driver', 'response'])
export class TripOfferHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => TripGroup, { eager: false, nullable: false })
  tripGroup: TripGroup;

  @ManyToOne(() => Driver, { eager: false, nullable: false })
  driver: Driver;

  /** The concrete DriverTrip row that carries this offer to the driver. */
  @ManyToOne(() => DriverTrip, { eager: false, nullable: true })
  driverTrip: DriverTrip | null;

  /** Cascade rank at the moment of offer (0-based). Broadcast rows use -1. */
  @Column({ type: 'int' })
  cascadeIndex: number;

  /** true if this offer was part of a BROADCASTING round (§9.4). */
  @Column({ default: false })
  broadcast: boolean;

  @Column({ type: 'timestamptz' })
  offeredAt: Date;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  respondedAt: Date | null;

  @Column({
    type: 'enum',
    enum: OfferResponse,
    default: OfferResponse.PENDING,
  })
  response: OfferResponse;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
