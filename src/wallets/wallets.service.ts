import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { randomInt, randomUUID } from 'crypto';
import { I18nContext } from 'nestjs-i18n';
import { Driver } from '../drivers/driver.entity';
import { DriverNotificationsService } from '../notifications/driver-notifications.service';
import { DriverNotificationType } from '../shared/enums/driver-notification-type.enum';
import {
  TopupCardStatus,
  WalletTransactionType,
} from '../shared/enums/wallet.enum';
import { TopupCard } from './entities/topup-card.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { WalletConfigService } from './wallet-config.service';

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ApplyTransactionInput {
  driverId: number;
  type: WalletTransactionType;
  /** Signed: credits positive, commission negative. */
  amount: number;
  cardId?: number;
  adminId?: number;
  driverTripId?: number;
  note?: string;
}

export interface ApplyTransactionResult {
  previousBalance: number;
  newBalance: number;
  transactionId: number;
}

/**
 * All wallet money movement funnels through applyTransaction: lock the
 * driver row, compute the new balance, write driver + one ledger row.
 * Lock order across every flow: card row first, driver row second —
 * commission locks the driver only, so no deadlock cycle exists.
 */
@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    @InjectRepository(TopupCard)
    private readonly cardsRepo: Repository<TopupCard>,
    @InjectRepository(WalletTransaction)
    private readonly txRepo: Repository<WalletTransaction>,
    @InjectRepository(Driver)
    private readonly driversRepo: Repository<Driver>,
    private readonly walletConfig: WalletConfigService,
    private readonly driverNotifications: DriverNotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Core ledger write (caller owns the transaction) ──────────

  async applyTransaction(
    mgr: EntityManager,
    input: ApplyTransactionInput,
  ): Promise<ApplyTransactionResult> {
    if (
      input.type !== WalletTransactionType.COMMISSION &&
      input.type !== WalletTransactionType.ADJUSTMENT &&
      input.amount <= 0
    ) {
      throw new BadRequestException('Credit amount must be positive');
    }

    // FOR NO KEY UPDATE: serializes balance writes without blocking
    // FK key-share locks (e.g. notification rows referencing the
    // driver) — plain FOR UPDATE self-deadlocks against those.
    const driver = await mgr
      .createQueryBuilder(Driver, 'd')
      .where('d.id = :id', { id: input.driverId })
      .setLock('pessimistic_partial_write')
      .getOne();
    if (!driver) throw new NotFoundException('Driver not found');

    const previousBalance = Number(driver.walletBalance);
    const newBalance = round2(previousBalance + input.amount);

    await mgr.update(Driver, { id: driver.id }, { walletBalance: newBalance });

    const tx = mgr.create(WalletTransaction, {
      driverId: driver.id,
      type: input.type,
      amount: round2(input.amount),
      balanceAfter: newBalance,
      card: input.cardId ? ({ id: input.cardId } as TopupCard) : null,
      admin: input.adminId ? ({ id: input.adminId } as never) : null,
      driverTrip: input.driverTripId
        ? ({ id: input.driverTripId } as never)
        : null,
      note: input.note ?? null,
    });
    const saved = await mgr.save(tx);

    // A credit that lifts the balance re-arms the low-balance alert.
    if (input.amount > 0) {
      const threshold = Number(
        (await this.walletConfig.getConfig()).lowBalanceThresholdJod,
      );
      if (newBalance >= threshold && driver.walletLowBalanceNotifiedAt) {
        await mgr.update(
          Driver,
          { id: driver.id },
          { walletLowBalanceNotifiedAt: null },
        );
      }
    }

    return { previousBalance, newBalance, transactionId: saved.id };
  }

  // ─── Card batches (seller / super admin) ──────────────────────

  async generateBatch(
    adminId: number,
    amount: number,
    count: number,
  ): Promise<{ batchId: string; amount: number; codes: string[] }> {
    const batchId = randomUUID();
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
      // Retry on the (astronomically rare) unique-code collision.
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = Array.from({ length: 12 }, () =>
          String(randomInt(0, 10)),
        ).join('');
        try {
          await this.cardsRepo.insert({
            code,
            batchId,
            amount: round2(amount),
            status: TopupCardStatus.AVAILABLE,
            createdByAdminId: adminId,
          });
          codes.push(code);
          break;
        } catch (err) {
          if (attempt === 4) throw err;
        }
      }
    }

    this.logger.log(
      `Card batch ${batchId}: ${codes.length} × ${amount} JD by admin #${adminId}`,
    );
    return { batchId, amount: round2(amount), codes };
  }

  async listCards(opts: {
    adminId?: number; // sellers are scoped to their own cards
    batchId?: string;
    status?: TopupCardStatus;
    page: number;
    limit: number;
  }) {
    const qb = this.cardsRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.redeemedForDriver', 'd')
      .orderBy('c.id', 'DESC');
    if (opts.adminId)
      qb.andWhere('c.createdByAdminId = :aid', { aid: opts.adminId });
    if (opts.batchId) qb.andWhere('c.batchId = :bid', { bid: opts.batchId });
    if (opts.status) qb.andWhere('c.status = :st', { st: opts.status });

    const [rows, totalItems] = await qb
      .skip((opts.page - 1) * opts.limit)
      .take(opts.limit)
      .getManyAndCount();

    return {
      data: rows.map((c) => ({
        id: c.id,
        codeMasked: `••••-••••-${c.code.slice(-4)}`,
        batchId: c.batchId,
        amount: Number(c.amount),
        status: c.status,
        redeemedAt: c.redeemedAt,
        redeemedForDriverName: c.redeemedForDriver?.name ?? null,
        createdAt: c.createdAt,
      })),
      page: opts.page,
      limit: opts.limit,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / opts.limit)),
    };
  }

  async listBatches(adminId?: number) {
    const qb = this.cardsRepo
      .createQueryBuilder('c')
      .select('c.batchId', 'batchId')
      .addSelect('MIN(c.createdAt)', 'createdAt')
      .addSelect('c.amount', 'amount')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        `COUNT(*) FILTER (WHERE c.status = 'available')`,
        'available',
      )
      .addSelect(`COUNT(*) FILTER (WHERE c.status = 'redeemed')`, 'redeemed')
      .groupBy('c.batchId')
      .addGroupBy('c.amount')
      .orderBy('MIN(c.createdAt)', 'DESC')
      .limit(100);
    if (adminId) qb.where('c.createdByAdminId = :aid', { aid: adminId });
    const rows = await qb.getRawMany<{
      batchId: string;
      createdAt: Date;
      amount: string;
      total: string;
      available: string;
      redeemed: string;
    }>();
    return rows.map((r) => ({
      batchId: r.batchId,
      createdAt: r.createdAt,
      amount: Number(r.amount),
      total: Number(r.total),
      available: Number(r.available),
      redeemed: Number(r.redeemed),
    }));
  }

  // ─── Redemption (seller enters driver phone + card code) ──────

  async redeemCard(
    adminId: number,
    isSeller: boolean,
    code: string,
    driverPhone: string,
    countryCode = '+962',
  ): Promise<{ driverName: string; amount: number }> {
    const normalized = code.replace(/[^0-9]/g, '');
    const t = (key: string) =>
      I18nContext.current()?.t(key) ?? key.split('.').pop() ?? key;

    return this.dataSource.transaction(async (mgr) => {
      // Lock the card row first (lock order: card → driver).
      const card = await mgr
        .createQueryBuilder(TopupCard, 'c')
        .where('c.code = :code', { code: normalized })
        .setLock('pessimistic_write')
        .getOne();

      if (!card) throw new NotFoundException(t('admin.Card not found'));
      if (isSeller && card.createdByAdminId !== adminId) {
        // Sellers may only redeem cards from their own batches.
        throw new NotFoundException(t('admin.Card not found'));
      }
      if (card.status === TopupCardStatus.REDEEMED) {
        throw new ConflictException(t('admin.Card already redeemed'));
      }
      if (card.status === TopupCardStatus.VOID) {
        throw new BadRequestException(t('admin.Card voided'));
      }

      const driver = await mgr.findOne(Driver, {
        where: { phoneNumber: driverPhone.trim(), countryCode },
      });
      if (!driver) {
        throw new NotFoundException(t('admin.Driver phone not found'));
      }

      const amount = Number(card.amount);
      await this.applyTransaction(mgr, {
        driverId: driver.id,
        type: WalletTransactionType.CARD_TOPUP,
        amount,
        cardId: card.id,
        adminId,
      });

      await mgr.update(
        TopupCard,
        { id: card.id },
        {
          status: TopupCardStatus.REDEEMED,
          redeemedForDriver: { id: driver.id } as Driver,
          redeemedByAdmin: { id: adminId } as never,
          redeemedAt: new Date(),
        },
      );

      return { driverId: driver.id, driverName: driver.name, amount };
    }).then(async (result) => {
      // Post-commit: notify outside the transaction so the insert never
      // waits on our row locks.
      await this.driverNotifications.emit({
        driverId: result.driverId,
        type: DriverNotificationType.EARNINGS_RECORDED,
        title: 'Wallet topped up',
        body: `${result.amount.toFixed(2)} JD was added to your wallet.`,
        payload: { amount: result.amount, source: 'card_topup' },
      });
      return { driverName: result.driverName, amount: result.amount };
    });
  }

  async voidCard(cardId: number): Promise<void> {
    const card = await this.cardsRepo.findOne({ where: { id: cardId } });
    if (!card) throw new NotFoundException('Card not found');
    if (card.status !== TopupCardStatus.AVAILABLE) {
      throw new BadRequestException(
        `Only available cards can be voided (this one is ${card.status})`,
      );
    }
    await this.cardsRepo.update({ id: cardId }, { status: TopupCardStatus.VOID });
  }

  // ─── Admin credit / refund ────────────────────────────────────

  async creditDriver(
    adminId: number,
    driverId: number,
    amount: number,
    kind: 'credit' | 'refund',
    note?: string,
  ): Promise<ApplyTransactionResult> {
    const result = await this.dataSource.transaction(async (mgr) =>
      this.applyTransaction(mgr, {
        driverId,
        type:
          kind === 'refund'
            ? WalletTransactionType.REFUND
            : WalletTransactionType.ADMIN_CREDIT,
        amount: round2(amount),
        adminId,
        note,
      }),
    );

    // Post-commit notification (never inside the row-lock window).
    await this.driverNotifications.emit({
      driverId,
      type: DriverNotificationType.EARNINGS_RECORDED,
      title: kind === 'refund' ? 'Refund received' : 'Wallet credited',
      body: `${round2(amount).toFixed(2)} JD was added to your wallet.`,
      payload: { amount: round2(amount), source: kind },
    });

    return result;
  }

  /** PII-minimal driver lookup for the seller redeem confirm step. */
  async lookupDriverByPhone(
    phoneNumber: string,
    countryCode = '+962',
  ): Promise<{ found: boolean; driverName: string | null }> {
    const driver = await this.driversRepo.findOne({
      where: { phoneNumber: phoneNumber.trim(), countryCode },
    });
    return { found: !!driver, driverName: driver?.name ?? null };
  }

  // ─── Reads ────────────────────────────────────────────────────

  async getWalletSummary(driverId: number) {
    const driver = await this.driversRepo.findOne({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Driver not found');
    const cfg = await this.walletConfig.getConfig();
    const balance = Number(driver.walletBalance);
    return {
      balance,
      lowBalanceThreshold: Number(cfg.lowBalanceThresholdJod),
      isLow: balance < Number(cfg.lowBalanceThresholdJod),
      commissionPercent: Number(cfg.commissionPercent),
    };
  }

  async listTransactions(driverId: number, page: number, limit: number) {
    const [rows, totalItems] = await this.txRepo.findAndCount({
      where: { driverId },
      relations: ['driverTrip', 'card'],
      order: { id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: rows.map((r) => ({
        id: r.id,
        type: r.type,
        amount: Number(r.amount),
        balanceAfter: Number(r.balanceAfter),
        note: r.note,
        tripId: r.driverTrip?.id ?? null,
        cardCodeMasked: r.card ? `••••-••••-${r.card.code.slice(-4)}` : null,
        createdAt: r.createdAt,
      })),
      page,
      limit,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limit)),
    };
  }

  // ─── Low-balance notification (deduped) ───────────────────────

  async maybeNotifyLowBalance(
    driver: Driver,
    requiredHint?: number,
  ): Promise<void> {
    try {
      const cfg = await this.walletConfig.getConfig();
      const cooldownMs =
        Number(cfg.lowBalanceNotifyCooldownHours) * 60 * 60 * 1000;
      const last = driver.walletLowBalanceNotifiedAt
        ? new Date(driver.walletLowBalanceNotifiedAt).getTime()
        : 0;
      if (Date.now() - last < cooldownMs) return;

      const balance = Number(driver.walletBalance);
      await this.driverNotifications.emit({
        driverId: driver.id,
        type: DriverNotificationType.WALLET_LOW_BALANCE,
        title: 'Wallet balance too low',
        body: requiredHint
          ? `Your wallet (${balance.toFixed(2)} JD) can't cover the next trip's commission (~${requiredHint.toFixed(2)} JD). Top up to keep receiving trips.`
          : `Your wallet balance is ${balance.toFixed(2)} JD. Top up to keep receiving trips.`,
        payload: {
          balance,
          threshold: Number(cfg.lowBalanceThresholdJod),
          requiredHint: requiredHint ?? null,
        },
      });
      await this.driversRepo.update(
        { id: driver.id },
        { walletLowBalanceNotifiedAt: new Date() },
      );
    } catch (err) {
      // Never let a notification failure break matching or completion.
      this.logger.warn(
        `low-balance notify failed for driver #${driver.id}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
