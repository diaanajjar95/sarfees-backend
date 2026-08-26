import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DeviceOwnerType {
  PASSENGER = 'passenger',
  DRIVER = 'driver',
}

/**
 * FCM registration tokens, one row per device. A user/driver may hold
 * several (phone + tablet); a token is unique globally and re-homing
 * it (same device, new login) just updates the owner.
 */
@Entity('device_tokens')
@Index(['ownerType', 'ownerId'])
export class DeviceToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: DeviceOwnerType })
  ownerType: DeviceOwnerType;

  @Column()
  ownerId: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 512 })
  token: string;

  /**
   * Stable per-install device identifier supplied by the app
   * (ANDROID_ID / identifierForVendor). When present, registration
   * replaces any other token for the same device — this is what stops
   * duplicate pushes after FCM token rotation.
   */
  @Column({ type: 'varchar', length: 128, nullable: true })
  deviceId: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  platform: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
