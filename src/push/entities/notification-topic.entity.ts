import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * FCM topics ops can broadcast to. Two platform topics are seeded and
 * auto-subscribed on device registration:
 *   all_customers — every passenger device
 *   all_drivers   — every driver device
 * Ops may add custom topics later (apps subscribe by name).
 */
@Entity('notification_topics')
export class NotificationTopic {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  description: string | null;

  /** Seeded platform topics can't be deleted from the portal. */
  @Column({ default: false })
  builtIn: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
