import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum EarlyAccessRole {
  PASSENGER = 'passenger',
  DRIVER = 'driver',
}

/**
 * Pre-launch "Join Early" registration submitted from the public
 * landing page (§ signup section). Free-text fields are capped short —
 * the endpoint is unauthenticated.
 */
@Entity('early_access_signups')
export class EarlyAccessSignup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: EarlyAccessRole })
  role: EarlyAccessRole;

  /** Free text, e.g. "Irbid – Amman". */
  @Column({ type: 'varchar', length: 160, nullable: true })
  route: string | null;

  /** Passenger only: daily | weekly | few-times | rarely */
  @Column({ type: 'varchar', length: 20, nullable: true })
  frequency: string | null;

  /** Passenger only: morning | midday | afternoon | evening */
  @Column({ type: 'varchar', length: 20, nullable: true })
  travelTime: string | null;

  /** Passenger only: "what price feels fair?" in JD. */
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  fairPriceJod: number | null;

  /** Driver only: whatsapp | own-base | other */
  @Column({ type: 'varchar', length: 20, nullable: true })
  findMethod: string | null;

  /** yes | maybe | no */
  @Column({ type: 'varchar', length: 10, nullable: true })
  pilotWilling: string | null;

  /** Only collected when pilotWilling is yes/maybe. */
  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  /** Page language at submit time (en | ar). */
  @Column({ type: 'varchar', length: 5, nullable: true })
  locale: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
