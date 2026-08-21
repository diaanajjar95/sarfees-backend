import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity()
@Unique('UQ_user_phone_country', ['countryCode', 'phoneNumber'])
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  phoneNumber: string;

  @Column({ nullable: true })
  countryCode: string;

  @Column({ default: false })
  hasVerifiedOtpBefore: boolean;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  // ─── Reputation (rated by drivers after each trip) ──────────
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 5.0 })
  rating: number;

  @Column({ default: 0 })
  ratingCount: number;

  @Column({ type: 'enum', enum: ['Male', 'Female'], nullable: true })
  gender: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({ nullable: true })
  profilePhotoUrl: string;

  @Column({ default: false })
  isProfileCompleted: boolean;

  @Column({ nullable: true })
  refreshToken: string;

  @Column({ nullable: true })
  otp: string;

  @Column({ nullable: true })
  otpExpiresAt: Date;

  @Column({ default: 0 })
  otpRequestCount: number;

  @Column({ nullable: true })
  otpLastRequestAt: Date;

  @Column({ default: 0 })
  otpAttemptCount: number;

  @Column({ nullable: true })
  otpLockedUntil: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
