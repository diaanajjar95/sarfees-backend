import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { App, cert, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { ServiceAccount } from 'firebase-admin/app';
import { DeviceOwnerType, DeviceToken } from './entities/device-token.entity';
import { NotificationTopic } from './entities/notification-topic.entity';

export const TOPIC_ALL_CUSTOMERS = 'all_customers';
export const TOPIC_ALL_DRIVERS = 'all_drivers';

export interface PushMessage {
  title: string;
  body: string;
  /** FCM data payload — values must be strings. */
  data?: Record<string, string>;
}

/**
 * Firebase Cloud Messaging wrapper. Credentials come from ops
 * (service-account JSON, base64 in FIREBASE_SERVICE_ACCOUNT_B64 or
 * raw in FIREBASE_SERVICE_ACCOUNT_JSON). Until they're configured the
 * service runs DISABLED: every send is a debug log no-op, and the
 * in-database notifications keep working untouched.
 */
@Injectable()
export class PushService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PushService.name);
  private app: App | null = null;

  constructor(
    @InjectRepository(DeviceToken)
    private readonly tokensRepo: Repository<DeviceToken>,
    @InjectRepository(NotificationTopic)
    private readonly topicsRepo: Repository<NotificationTopic>,
    private readonly cfg: ConfigService,
  ) {}

  get enabled(): boolean {
    return this.app !== null;
  }

  async onApplicationBootstrap(): Promise<void> {
    // Seed the two platform topics (idempotent).
    for (const [name, description] of [
      [TOPIC_ALL_CUSTOMERS, 'Every passenger device (auto-subscribed)'],
      [TOPIC_ALL_DRIVERS, 'Every driver device (auto-subscribed)'],
    ] as const) {
      const existing = await this.topicsRepo.findOne({ where: { name } });
      if (!existing) {
        await this.topicsRepo.save(
          this.topicsRepo.create({ name, description, builtIn: true }),
        );
      }
    }

    const b64 = this.cfg.get<string>('FIREBASE_SERVICE_ACCOUNT_B64');
    const raw = this.cfg.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    const json = b64
      ? Buffer.from(b64, 'base64').toString('utf8')
      : (raw ?? '');
    if (!json.trim()) {
      this.logger.warn(
        'FCM disabled — set FIREBASE_SERVICE_ACCOUNT_B64 (service-account JSON, base64) to enable push.',
      );
      return;
    }
    try {
      const credential = cert(JSON.parse(json) as ServiceAccount);
      this.app = initializeApp({ credential });
      this.logger.log('FCM enabled — Firebase Admin initialized.');
    } catch (err) {
      this.logger.error(
        `FCM init failed (push stays disabled): ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  // ─── Device registration ──────────────────────────────────────

  /**
   * Upsert a device token and auto-subscribe it to its platform topic.
   * A token already registered to another owner is re-homed (same
   * physical device, new login).
   */
  async registerToken(
    ownerType: DeviceOwnerType,
    ownerId: number,
    token: string,
    platform?: string,
  ): Promise<{ registered: boolean; pushEnabled: boolean }> {
    const existing = await this.tokensRepo.findOne({ where: { token } });
    if (existing) {
      existing.ownerType = ownerType;
      existing.ownerId = ownerId;
      existing.platform = platform ?? existing.platform;
      await this.tokensRepo.save(existing);
    } else {
      await this.tokensRepo.save(
        this.tokensRepo.create({
          ownerType,
          ownerId,
          token,
          platform: platform ?? null,
        }),
      );
    }

    const topic =
      ownerType === DeviceOwnerType.DRIVER
        ? TOPIC_ALL_DRIVERS
        : TOPIC_ALL_CUSTOMERS;
    if (this.app) {
      try {
        await getMessaging(this.app).subscribeToTopic([token], topic);
      } catch (err) {
        this.logger.warn(
          `topic subscribe failed (${topic}): ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    return { registered: true, pushEnabled: this.enabled };
  }

  async removeToken(token: string): Promise<void> {
    await this.tokensRepo.delete({ token });
  }

  // ─── Sending ──────────────────────────────────────────────────

  /**
   * Types that must ALWAYS reach the app's own FCM handler — a push
   * with a `notification` block is displayed by Android itself when
   * the app is backgrounded/killed and `onMessageReceived` never
   * runs, so the full-screen offer overlay / countdown / auto-dismiss
   * logic would be skipped. These are sent DATA-ONLY (title/body move
   * into `data`; the app renders its own notification) with
   * high-priority delivery hints for both platforms.
   */
  private static readonly DATA_ONLY_TYPES = new Set([
    'offer_received',
    'offer_no_longer_available',
    'trip_assigned',
    'trip_reminder',
    'trip_updated',
    'passenger_cancelled',
  ]);

  /** FCM message body for one recipient set — data-only when the type demands it. */
  private buildMessage(msg: PushMessage): {
    notification?: { title: string; body: string };
    data: Record<string, string>;
    android?: { priority: 'high' | 'normal' };
    apns?: {
      headers?: Record<string, string>;
      payload: { aps: Record<string, unknown> };
    };
  } {
    const type = msg.data?.type ?? '';
    if (PushService.DATA_ONLY_TYPES.has(type)) {
      return {
        data: { ...(msg.data ?? {}), title: msg.title, body: msg.body },
        android: { priority: 'high' },
        apns: {
          headers: { 'apns-priority': '5', 'apns-push-type': 'background' },
          payload: { aps: { 'content-available': 1 } },
        },
      };
    }
    return {
      notification: { title: msg.title, body: msg.body },
      data: msg.data ?? {},
    };
  }

  /** Push to every registered device of one passenger/driver. */
  async sendToOwner(
    ownerType: DeviceOwnerType,
    ownerId: number,
    msg: PushMessage,
  ): Promise<void> {
    if (!this.app) {
      this.logger.debug(
        `[push disabled] ${ownerType}#${ownerId}: ${msg.title}`,
      );
      return;
    }
    const rows = await this.tokensRepo.find({ where: { ownerType, ownerId } });
    if (rows.length === 0) return;

    try {
      const res = await getMessaging(this.app).sendEachForMulticast({
        tokens: rows.map((r) => r.token),
        ...this.buildMessage(msg),
      });
      // Prune tokens Firebase reports as dead.
      const dead: string[] = [];
      res.responses.forEach((r, i) => {
        const code = r.error?.code ?? '';
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          dead.push(rows[i].token);
        }
      });
      if (dead.length) await this.tokensRepo.delete({ token: In(dead) });
    } catch (err) {
      this.logger.warn(
        `push to ${ownerType}#${ownerId} failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /** Broadcast to an FCM topic (admin portal). */
  async sendToTopic(topicName: string, msg: PushMessage): Promise<void> {
    if (!this.app) {
      throw new Error(
        'Push is not configured yet — add the Firebase service-account credentials first.',
      );
    }
    await getMessaging(this.app).send({
      topic: topicName,
      notification: { title: msg.title, body: msg.body },
      data: msg.data,
    });
  }

  // ─── Topics (admin) ───────────────────────────────────────────

  listTopics(): Promise<NotificationTopic[]> {
    return this.topicsRepo.find({ order: { id: 'ASC' } });
  }

  async createTopic(
    name: string,
    description?: string,
  ): Promise<NotificationTopic> {
    const clean = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const existing = await this.topicsRepo.findOne({ where: { name: clean } });
    if (existing) return existing;
    return this.topicsRepo.save(
      this.topicsRepo.create({
        name: clean,
        description: description ?? null,
        builtIn: false,
      }),
    );
  }
}
