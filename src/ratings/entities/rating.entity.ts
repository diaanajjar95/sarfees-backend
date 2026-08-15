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
import { RaterType, RatingLevel } from '../../shared/enums/rating.enum';

/**
 * One rating per completed trip-request per direction:
 *   raterType=passenger → the passenger rated the driver
 *   raterType=driver    → the driver rated that passenger
 * Ratings are optional; a `bad` rating requires a message.
 */
@Entity('ratings')
@Unique(['tripRequest', 'raterType'])
export class Rating {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => TripRequest, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tripRequestId' })
  tripRequest: TripRequest;

  @Column()
  tripRequestId: number;

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
