import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { PassengerNotificationType } from '../../shared/enums/passenger-notification-type.enum';

/**
 * Per-passenger inbox row. Stored bilingually (EN + AR) so the read endpoint
 * can pick the right copy based on the request's Accept-Language header
 * without having to re-render the message at fetch time.
 */
@Entity('passenger_notifications')
@Index(['user', 'createdAt'])
export class PassengerNotification {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'enum', enum: PassengerNotificationType })
  type: PassengerNotificationType;

  @Column()
  titleEn: string;

  @Column()
  titleAr: string;

  @Column({ type: 'text' })
  bodyEn: string;

  @Column({ type: 'text' })
  bodyAr: string;

  /** Free-form metadata for deep-linking (e.g. { tripId, requestId, packageId }) */
  @Column({ type: 'json', nullable: true })
  payload: Record<string, unknown>;

  @Column({ default: false })
  read: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
