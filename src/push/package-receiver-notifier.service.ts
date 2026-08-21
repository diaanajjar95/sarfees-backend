import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { PackageDelivery } from '../packages/entities/package-delivery.entity';
import { WhatsAppService } from './whatsapp.service';

export type ReceiverStage = 'assigned' | 'picked_up' | 'delivered';

const TEXTS: Record<ReceiverStage, { en: string; ar: string }> = {
  assigned: {
    en: 'A Sarfees driver was assigned to deliver your package.',
    ar: 'تم تعيين سائق سرفيس لتوصيل طردك.',
  },
  picked_up: {
    en: 'Your package is on its way with the driver.',
    ar: 'طردك في الطريق إليك مع السائق.',
  },
  delivered: {
    en: 'Your package was delivered. Thank you for using Sarfees!',
    ar: 'تم تسليم طردك. شكراً لاستخدامك سرفيس!',
  },
};

/**
 * Keeps the package RECEIVER (not an app user) in the loop over
 * WhatsApp at every stage, always with the anonymous no-map tracking
 * link. Fire-and-forget; a WhatsApp failure never breaks the trip.
 */
@Injectable()
export class PackageReceiverNotifier {
  private readonly logger = new Logger(PackageReceiverNotifier.name);

  constructor(
    @InjectRepository(PackageDelivery)
    private readonly packagesRepo: Repository<PackageDelivery>,
    private readonly whatsapp: WhatsAppService,
    private readonly cfg: ConfigService,
  ) {}

  private trackingUrl(token: string): string {
    const base =
      this.cfg.get<string>('TRACKING_BASE_URL') ?? 'http://169.58.67.105';
    return `${base.replace(/\/$/, '')}/track/${token}`;
  }

  async notifyByPackageIds(
    packageIds: number[],
    stage: ReceiverStage,
  ): Promise<void> {
    if (packageIds.length === 0) return;
    try {
      const rows = await this.packagesRepo.find({
        where: { id: In(packageIds) },
      });
      for (const pkg of rows) {
        if (!pkg.receiverPhone) continue;
        // Legacy rows predate tracking tokens — mint one on first use.
        if (!pkg.trackingToken) {
          pkg.trackingToken = randomBytes(12).toString('hex');
          await this.packagesRepo.update(
            { id: pkg.id },
            { trackingToken: pkg.trackingToken },
          );
        }
        const t = TEXTS[stage];
        const link = this.trackingUrl(pkg.trackingToken);
        const text = `${t.ar}\n${t.en}\n\n${link}`;
        void this.whatsapp.sendText(pkg.receiverPhone, text);
      }
    } catch (err) {
      this.logger.warn(
        `receiver notify (${stage}) failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
