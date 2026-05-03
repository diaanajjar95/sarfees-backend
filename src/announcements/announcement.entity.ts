import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Admin } from '../admins/admin.entity';

@Entity('announcements')
export class Announcement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  /** Optional URL to open when the driver taps the carousel item */
  @Column({ nullable: true })
  ctaUrl: string;

  /** Only ACTIVE announcements appear on the driver home screen */
  @Column({ default: true })
  isActive: boolean;

  /** Optional schedule window — null = always */
  @Column({ type: 'timestamp', nullable: true })
  startsAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  endsAt: Date;

  /** Higher = shown first */
  @Column({ default: 0 })
  priority: number;

  @ManyToOne(() => Admin, { nullable: true })
  createdBy: Admin;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
