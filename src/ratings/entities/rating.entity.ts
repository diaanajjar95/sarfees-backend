import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Driver } from '../../drivers/driver.entity';
import { User } from '../../users/user.entity';
import { DriverTrip } from '../../driver-trips/entities/driver-trip.entity';
import { TripRequest } from '../../trips/entities/trip-request.entity';
import { PackageDelivery } from '../../packages/entities/package-delivery.entity';
import { RaterType, RatingLevel } from '../../shared/enums/rating.enum';

/**
 * One rating per completed booking per direction. A rating anchors to
 * EITHER a trip request (passenger ↔ driver) OR a package delivery
 * (sender ↔ driver) — exactly one of the two refs is set:
 *   raterType=passenger → the customer rated the driver
 *   raterType=driver    → the driver rated that customer
 * Ratings are optional; a `bad` rating requires a message. Postgres
 * treats NULLs as distinct, so each unique pair only constrains its
 * own booking kind.
 */
@Entity('ratings')
@Unique(['tripRequest', 'raterType'])
@Unique(['packageDelivery', 'raterType'])
export class Rating {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => TripRequest, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tripRequestId' })
  tripRequest: TripRequest | null;

  @Column({ nullable: true })
  tripRequestId: number | null;

  @ManyToOne(() => PackageDelivery, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'packageDeliveryId' })
  packageDelivery: PackageDelivery | null;

  @Column({ nullable: true })
  packageDeliveryId: number | null;

  @ManyToOne(() => DriverTrip, { nullable: false })
  driverTrip: DriverTrip;

  @Column({ type: 'enum', enum: RaterType })
  raterType: RaterType;

  @Index()
  @ManyToOne(() => Driver, { nullable: false })
  @JoinColumn({ name: 'driverId' })
  driver: Driver;

  @Column()
  driverId: number;

  @Index()
  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'passengerId' })
  passenger: User;

  @Column()
  passengerId: number;

  @Column({ type: 'enum', enum: RatingLevel })
  level: RatingLevel;

  /** Numeric 5..1 mirror of `level` — feeds the running averages. */
  @Column({ type: 'int' })
  value: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  message: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
