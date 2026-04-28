import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, UpdateDateColumn } from 'typeorm';
import { Driver } from '../../drivers/driver.entity';
import { TripRequest } from './trip-request.entity';

@Entity('driver_locations')
export class DriverLocation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Driver)
  driver: Driver;

  @ManyToOne(() => TripRequest)
  trip: TripRequest;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  lng: number;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
  heading: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  speed: number;

  @CreateDateColumn()
  recordedAt: Date;
}
