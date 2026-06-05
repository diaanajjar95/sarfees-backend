import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Driver } from '../../drivers/driver.entity';
import { TripRequest } from './trip-request.entity';

@Entity('driver_locations')
@Index(['driver', 'recordedAt'])
export class DriverLocation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Driver)
  driver: Driver;

  /**
   * Optional. Populated only when the location was recorded inside a
   * specific active trip's "where is my driver?" view. NULL for the
   * high-frequency driver self-ping used by the matcher.
   */
  @ManyToOne(() => TripRequest, { nullable: true })
  trip: TripRequest | null;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lng: number;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
  heading: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  speed: number;

  /** Reported accuracy radius in meters (optional). */
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  accuracy: number;

  @CreateDateColumn()
  recordedAt: Date;
}
