import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { User } from '../../users/user.entity';

@Entity('drivers')
export class Driver {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  user: User;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  profilePhotoUrl: string;

  @Column()
  vehicleMake: string;

  @Column()
  vehicleModel: string;

  @Column()
  vehicleColor: string;

  @Column()
  vehicleYear: number;

  @Column({ unique: true })
  plateNumber: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 5.0 })
  rating: number;

  @Column({ default: 0 })
  totalTrips: number;

  @Column({ default: true })
  isAvailable: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
