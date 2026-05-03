import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AdminRole } from '../shared/enums/admin-role.enum';

@Entity('admins')
@Index('UQ_admin_email', ['email'], { unique: true })
export class Admin {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  email: string;

  @Column({ nullable: true })
  fullName: string;

  /** bcrypt hash */
  @Column()
  passwordHash: string;

  @Column({ type: 'enum', enum: AdminRole, default: AdminRole.SUPPORT })
  role: AdminRole;

  /** Disabled accounts cannot log in */
  @Column({ default: true })
  isActive: boolean;

  /** Forces a change-password redirect on next login */
  @Column({ default: false })
  mustChangePassword: boolean;

  @Column({ nullable: true })
  refreshToken: string;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
