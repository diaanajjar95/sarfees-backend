import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { City } from '../../cities/city.entity';
import { PackageSize } from '../../shared/enums/package-size.enum';
import { PackageStatus } from '../../shared/enums/package-status.enum';

@Entity('package_deliveries')
export class PackageDelivery {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  sender: User;

  @ManyToOne(() => City)
  departureCity: City;

  @ManyToOne(() => City)
  arrivalCity: City;

  @Column('json')
  pickupLocation: { lat: number; lng: number };

  @Column('json')
  dropOffLocation: { lat: number; lng: number };

  // Package details
  @Column({ type: 'enum', enum: PackageSize })
  packageSize: PackageSize;

  @Column({ type: 'text', nullable: true })
  packageDescription: string;

  @Column({ nullable: true })
  packagePhotoUrl: string;

  // Receiver details
  @Column()
  receiverName: string;

  @Column()
  receiverPhone: string;

  // Pricing
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  deliveryFee: number;

  // Terms
  @Column({ default: false })
  termsAccepted: boolean;

  // Status & tracking
  @Column({ type: 'enum', enum: PackageStatus, default: PackageStatus.PENDING })
  status: PackageStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
