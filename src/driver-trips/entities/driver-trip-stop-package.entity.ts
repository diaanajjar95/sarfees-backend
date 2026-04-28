import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DriverTripStop } from './driver-trip-stop.entity';
import { PackageDelivery } from '../../packages/entities/package-delivery.entity';
import {
  DeliveryFailureReason,
  StopPackageRole,
  StopPackageStatus,
} from '../../shared/enums/stop-package-status.enum';

@Entity('driver_trip_stop_packages')
export class DriverTripStopPackage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => DriverTripStop, (stop) => stop.packages, {
    onDelete: 'CASCADE',
  })
  stop: DriverTripStop;

  @ManyToOne(() => PackageDelivery, { eager: false })
  packageDelivery: PackageDelivery;

  @Column({ type: 'enum', enum: StopPackageRole })
  role: StopPackageRole;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  fee: number;

  @Column({
    type: 'enum',
    enum: StopPackageStatus,
    default: StopPackageStatus.PENDING,
  })
  status: StopPackageStatus;

  @Column({ type: 'enum', enum: DeliveryFailureReason, nullable: true })
  failureReason: DeliveryFailureReason;

  @Column({ type: 'text', nullable: true })
  failureNotes: string;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
