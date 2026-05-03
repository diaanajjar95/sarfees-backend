import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DriverTripStop } from './driver-trip-stop.entity';
import { TripRequest } from '../../trips/entities/trip-request.entity';
import {
  StopPassengerRole,
  StopPassengerStatus,
} from '../../shared/enums/stop-passenger-status.enum';

@Entity('driver_trip_stop_passengers')
export class DriverTripStopPassenger {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => DriverTripStop, (stop) => stop.passengers, {
    onDelete: 'CASCADE',
  })
  stop: DriverTripStop;

  @ManyToOne(() => TripRequest, { eager: false })
  tripRequest: TripRequest;

  @Column({ type: 'enum', enum: StopPassengerRole })
  role: StopPassengerRole;

  /** Fare due at the alighting stop (for boarding rows we copy the same value for clarity) */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  fare: number;

  @Column({
    type: 'enum',
    enum: StopPassengerStatus,
    default: StopPassengerStatus.PENDING,
  })
  status: StopPassengerStatus;

  /** Whether cash was actually collected at dropoff. Null for boarding rows. */
  @Column({ type: 'boolean', nullable: true })
  cashCollected: boolean;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
