import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { User } from '../../users/user.entity';
import { TripStatus } from '../../shared/enums/trip-status.enum';
import { City } from '../../cities/city.entity';

@Entity('trip_requests')
export class TripRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  passenger: User;

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

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  perSeatFare: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalFare: number;

  @Column({ type: 'enum', enum: TripStatus, default: TripStatus.PENDING })
  status: TripStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
