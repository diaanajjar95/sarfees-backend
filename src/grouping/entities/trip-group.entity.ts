import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { City } from '../../cities/city.entity';
import { Driver } from '../../drivers/driver.entity';
import { TripGroupStatus } from '../../shared/enums/trip-group-status.enum';

/**
 * A set of compatible passenger + package requests sharing one vehicle.
 * Created by GroupingService (Stage 1) as requests come in; frozen by
 * MatchingSweeperService at T-30 min; handed to AssignmentService
 * (Stage 2, PR 3) to find a driver.
 *
 * Master spec §2 glossary + §11 state machine.
 */
@Entity('trip_groups')
@Index('idx_trip_groups_status_departure', ['status', 'departureTime'])
export class TripGroup {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => City, { eager: true })
  originCity: City;

  @ManyToOne(() => City, { eager: true })
  destCity: City;

  @Column({ type: 'timestamptz' })
  departureTime: Date;

  @Column({
    type: 'enum',
    enum: TripGroupStatus,
    default: TripGroupStatus.OPEN,
  })
  status: TripGroupStatus;

  /**
   * Set from the first request when the group is born. Once true,
   * only women-only-flagged female-passenger requests may join (§7 hard
   * rule — no path can add a male passenger, even during broadcast).
   */
  @Column({ default: false })
  womenOnly: boolean;

  /** Born FROZEN, no other passengers, no packages ever added (§8). */
  @Column({ default: false })
  fullCar: boolean;

  /** Born FROZEN, solo, immediate driver search (§6.6). */
  @Column({ default: false })
  urgent: boolean;

  /** Populated on ASSIGNED (PR 3). */
  @ManyToOne(() => Driver, { nullable: true })
  assignedDriver: Driver | null;

  /**
   * FK to the DriverTrip created when the group is accepted by a driver
   * (PR 3). No relation object — we don't want a TypeORM cycle with
   * DriverTrip.
   */
  @Column({ type: 'int', nullable: true })
  driverTripId: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  frozenAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  assignedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
