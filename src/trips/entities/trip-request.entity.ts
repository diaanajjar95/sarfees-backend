import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { User } from '../../users/user.entity';
import { TripStatus } from '../../shared/enums/trip-status.enum';
import { City } from '../../cities/city.entity';
import { Driver } from '../../drivers/driver.entity';
import { TripGroup } from '../../grouping/entities/trip-group.entity';

@Entity('trip_requests')
export class TripRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  passenger: User;

  @ManyToOne(() => Driver, { nullable: true, eager: false })
  driver: Driver;

  @ManyToOne(() => City)
  departureCity: City;

  @ManyToOne(() => City)
  arrivalCity: City;

  @Column('json')
  departureLocation: { lat: number; lng: number };

  @Column('json')
  arrivalLocation: { lat: number; lng: number };

  @Column({ nullable: true })
  travelDate: Date;

  @Column({ default: false })
  isImmediate: boolean;

  @Column({ default: 1 })
  seatsCount: number;

  @Column({ default: false })
  isFemaleOnly: boolean;

  /**
   * Master spec §8 "full-car" — passenger buys every seat in the vehicle.
   * Its group is born FROZEN with no additions allowed (other passengers
   * OR packages). Cascade still fires at the normal T-30 mark unless the
   * request also has isImmediate=true, in which case cascade fires now.
   */
  @Column({ default: false })
  bookWholeCar: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  perSeatFare: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalFare: number;

  @Column({ type: 'enum', enum: TripStatus, default: TripStatus.PENDING })
  status: TripStatus;

  /** The Stage-1 grouping bundle this request landed in, if any. */
  @ManyToOne(() => TripGroup, { nullable: true })
  tripGroup: TripGroup | null;

  /**
   * Why the request was cancelled. Free text; ops-entered when the
   * cancellation came from the admin portal, null for passenger
   * self-cancels (the app offers no reason field today).
   */
  @Column({ type: 'text', nullable: true })
  cancellationReason: string | null;

  /** Admin who cancelled this request, when ops-initiated. */
  @Column({ type: 'int', nullable: true })
  cancelledByAdminId: number | null;

  @Column({ nullable: true })
  etaToPickup: string;

  @Column({ nullable: true })
  etaToDestination: string;

  @Column({ nullable: true })
  statusUpdatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
