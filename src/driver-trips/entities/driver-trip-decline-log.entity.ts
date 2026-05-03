import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Driver } from '../../drivers/driver.entity';
import { DriverTrip } from './driver-trip.entity';
import { DriverTripDeclineReason } from '../../shared/enums/driver-trip-decline-reason.enum';

@Entity('driver_trip_decline_logs')
export class DriverTripDeclineLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Driver)
  driver: Driver;

  @ManyToOne(() => DriverTrip)
  trip: DriverTrip;

  @Column({ type: 'enum', enum: DriverTripDeclineReason })
  reason: DriverTripDeclineReason;

  /** True when the offer expired without a response (auto-decline) */
  @Column({ default: false })
  autoDeclined: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  declinedAt: Date;
}
