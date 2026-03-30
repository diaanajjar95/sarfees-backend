import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  phoneNumber: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

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
