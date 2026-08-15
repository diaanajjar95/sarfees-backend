import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Driver } from '../../drivers/driver.entity';
import { Admin } from '../../admins/admin.entity';
import { DriverTrip } from '../../driver-trips/entities/driver-trip.entity';
import { TopupCard } from './topup-card.entity';
import { WalletTransactionType } from '../../shared/enums/wallet.enum';

/**
 * Append-only driver wallet ledger. Every balance change goes through
 * WalletsService.applyTransaction, which locks the driver row, writes
 * the new balance, and inserts exactly one of these rows — so
 * `balanceAfter` forms an auditable chain per driver.
 *
 * Amounts are SIGNED: credits positive, commission negative.
 */
@Entity('wallet_transactions')
export class WalletTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @ManyToOne(() => Driver, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driverId' })
  driver: Driver;

  @Column()
  driverId: number;

  @Column({ type: 'enum', enum: WalletTransactionType })
  type: WalletTransactionType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  balanceAfter: number;

  /** Set for card_topup rows. */
  @ManyToOne(() => TopupCard, { nullable: true })
  card: TopupCard | null;

  /** Acting admin/seller for card_topup / admin_credit / refund / adjustment. */
  @ManyToOne(() => Admin, { nullable: true })
  admin: Admin | null;

  /** Set for commission rows. */
  @ManyToOne(() => DriverTrip, { nullable: true })
  driverTrip: DriverTrip | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
