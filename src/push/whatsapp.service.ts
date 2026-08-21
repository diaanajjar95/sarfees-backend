import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * WhatsApp Business Cloud API (Meta) sender. Used for people who are
 * NOT app users — chiefly package receivers, who get status updates
 * and their anonymous tracking link over WhatsApp.
 *
 * Disabled until ops provides WHATSAPP_ACCESS_TOKEN +
 * WHATSAPP_PHONE_NUMBER_ID; every send is then a log no-op.
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly token: string;
  private readonly phoneNumberId: string;
  private readonly baseUrl: string;

  constructor(cfg: ConfigService) {
    this.token = cfg.get<string>('WHATSAPP_ACCESS_TOKEN') ?? '';
    this.phoneNumberId = cfg.get<string>('WHATSAPP_PHONE_NUMBER_ID') ?? '';
    this.baseUrl =
      cfg.get<string>('WHATSAPP_API_BASE_URL') ?? 'https://graph.facebook.com/v20.0';
  }

  get enabled(): boolean {
    return !!(this.token && this.phoneNumberId);
  }

  /**
   * Send a plain text message. `phone` may be local (07…) or E.164;
   * local Jordanian numbers are normalized to +962.
   */
  async sendText(phone: string, text: string): Promise<void> {
    const to = this.normalize(phone);
    if (!this.enabled) {
      this.logger.debug(`[whatsapp disabled] to ${to}: ${text.slice(0, 80)}`);
      return;
    }
    try {
      const res = await fetch(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: text },
          }),
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!res.ok) {
        this.logger.warn(
          `whatsapp send to ${to} failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `whatsapp send to ${to} failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private normalize(phone: string): string {
    const digits = phone.replace(/[^0-9+]/g, '');
    if (digits.startsWith('+')) return digits.slice(1);
    if (digits.startsWith('00')) return digits.slice(2);
    if (digits.startsWith('0')) return `962${digits.slice(1)}`; // 079… → 96279…
    if (digits.startsWith('962')) return digits;
    return `962${digits}`;
  }
}
