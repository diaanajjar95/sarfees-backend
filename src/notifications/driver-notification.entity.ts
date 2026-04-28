import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Driver } from '../drivers/driver.entity';
import { DriverNotificationType } from '../shared/enums/driver-notification-type.enum';

@Entity('driver_notifications')
@Index(['driver', 'createdAt'])
export class DriverNotification {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Driver, { onDelete: 'CASCADE' })
  driver: Driver;

  @Column({ type: 'enum', enum: DriverNotificationType })
  type: DriverNotificationType;

  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  /** Free-form metadata (e.g. tripId for deep-linking) */
  @Column({ type: 'json', nullable: true })
  payload: Record<string, unknown>;

  @Column({ default: false })
  read: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
