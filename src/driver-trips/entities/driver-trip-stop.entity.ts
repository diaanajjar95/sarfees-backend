import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DriverTrip } from './driver-trip.entity';
import { DriverTripStopPassenger } from './driver-trip-stop-passenger.entity';
import { DriverTripStopPackage } from './driver-trip-stop-package.entity';
import { DriverTripStopStatus } from '../../shared/enums/driver-trip-stop-status.enum';
import { DriverTripStopType } from '../../shared/enums/driver-trip-stop-type.enum';

@Entity('driver_trip_stops')
export class DriverTripStop {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => DriverTrip, (trip) => trip.stops, { onDelete: 'CASCADE' })
  trip: DriverTrip;

  @Column()
  order: number;

  @Column({ type: 'enum', enum: DriverTripStopType })
  type: DriverTripStopType;

  @Column()
  city: string;

  @Column({ nullable: true })
  address: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lng: number;

  @Column({
    type: 'enum',
    enum: DriverTripStopStatus,
    default: DriverTripStopStatus.PENDING,
  })
  status: DriverTripStopStatus;

  /** Cash to collect at this stop (sum of fares for alighting passengers + delivering packages) */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  cashExpected: number;

  @Column({ type: 'timestamp', nullable: true })
  arrivedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date;

  @OneToMany(() => DriverTripStopPassenger, (sp) => sp.stop, {
    cascade: true,
    eager: false,
  })
  passengers: DriverTripStopPassenger[];

  @OneToMany(() => DriverTripStopPackage, (sp) => sp.stop, {
    cascade: true,
    eager: false,
  })
  packages: DriverTripStopPackage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
