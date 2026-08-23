import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export enum PlatformCurrency {
  JOD = 'JOD',
  SYP = 'SYP',
}

/** Singleton (id=1) — platform-wide settings editable from the portal. */
@Entity('platform_config')
export class PlatformConfig {
  @PrimaryColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: PlatformCurrency,
    default: PlatformCurrency.JOD,
  })
  currencyCode: PlatformCurrency;

  @UpdateDateColumn()
  updatedAt: Date;
}
