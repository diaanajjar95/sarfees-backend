import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Admin } from '../../admins/admin.entity';
import { TripGroup } from '../../grouping/entities/trip-group.entity';

/**
 * The safety net (master spec §9.7). When a group runs out the
 * cascade + broadcast without a single driver accepting by
 * departure time, we transition it to UNSERVED_ESCALATION and
 * open one of these cases. Ops staff resolve manually via
 * /admin/escalations.
 *
 * The trip stays open — a late-arriving driver can still accept
 * — while ops works the case.
 */
@Entity('escalation_cases')
@Index('idx_escalation_unresolved', ['resolvedAt'])
export class EscalationCase {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => TripGroup, { eager: true, nullable: false })
  tripGroup: TripGroup;

  @Column({ type: 'timestamptz' })
  escalatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @ManyToOne(() => Admin, { eager: false, nullable: true })
  resolvedBy: Admin | null;

  @Column({ type: 'text', nullable: true })
  resolutionNotes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
