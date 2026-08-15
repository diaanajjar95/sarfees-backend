import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Admin } from '../../admins/admin.entity';
import { Driver } from '../../drivers/driver.entity';
import { TopupCardStatus } from '../../shared/enums/wallet.enum';

/**
 * Prepaid wallet top-up card (§ wallet spec). Generated in batches by
 * a seller (or super admin) on the portal; redeemed onto a driver's
 * wallet by entering the driver's mobile number — telecom-shop style.
 *
 * `code` is 12 crypto-random digits stored without separators
 * (displayed XXXX-XXXX-XXXX). Only authenticated sellers can attempt
 * redemption, so 10^12 keyspace is ample.
 */
@Entity('topup_cards')
export class TopupCard {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 16 })
  code: string;

  /** One uuid per generation run — groups a print batch. */
  @Index()
  @Column({ type: 'varchar', length: 40 })
  batchId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: TopupCardStatus,
    default: TopupCardStatus.AVAILABLE,
  })
  status: TopupCardStatus;

  @ManyToOne(() => Admin, { nullable: false })
  @JoinColumn({ name: 'createdByAdminId' })
  createdByAdmin: Admin;

  @Column()
  createdByAdminId: number;

  @ManyToOne(() => Driver, { nullable: true })
  redeemedForDriver: Driver | null;

  @ManyToOne(() => Admin, { nullable: true })
  redeemedByAdmin: Admin | null;

  @Column({ type: 'timestamp', nullable: true })
  redeemedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
