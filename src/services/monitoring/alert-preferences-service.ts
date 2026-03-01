import { prisma } from '@/lib/prisma';

export type AlertPreferences = {
  inApp: boolean;
  sms: boolean;
  email: boolean;
  smsRecipients: string[];
  emailRecipients: string[];
};

const DEFAULT_PREFERENCES: AlertPreferences = {
  inApp: true,
  sms: false,
  email: false,
  smsRecipients: [],
  emailRecipients: [],
};

export class AlertPreferencesService {
  async getPreferences(farmId: string): Promise<AlertPreferences> {
    const latest = await prisma.event.findFirst({
      where: { farmId, type: 'ALERT_NOTIFICATION_PREFERENCES_UPDATED' },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) {
      return DEFAULT_PREFERENCES;
    }

    const payload = latest.payload as Partial<AlertPreferences> | null;
    return {
      inApp: Boolean(payload?.inApp ?? true),
      sms: Boolean(payload?.sms ?? false),
      email: Boolean(payload?.email ?? false),
      smsRecipients: Array.isArray(payload?.smsRecipients) ? payload?.smsRecipients : [],
      emailRecipients: Array.isArray(payload?.emailRecipients) ? payload?.emailRecipients : [],
    };
  }

  async savePreferences(input: {
    farmId: string;
    userId: string;
    idempotencyKey: string;
    preferences: AlertPreferences;
  }) {
    const existing = await prisma.event.findUnique({
      where: {
        farmId_idempotencyKey: {
          farmId: input.farmId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });

    if (existing) {
      return { reused: true, eventId: existing.id };
    }

    const event = await prisma.event.create({
      data: {
        farmId: input.farmId,
        type: 'ALERT_NOTIFICATION_PREFERENCES_UPDATED',
        payload: input.preferences,
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      },
    });

    return { status: 'UPDATED', eventId: event.id };
  }

  async dispatchForAlert(input: {
    farmId: string;
    alertId: string;
    level: string;
    message: string;
    userId: string;
  }) {
    const preferences = await this.getPreferences(input.farmId);
    const channels: string[] = [];

    if (preferences.inApp) {
      channels.push('IN_APP');
    }
    if (preferences.sms && preferences.smsRecipients.length) {
      channels.push('SMS');
    }
    if (preferences.email && preferences.emailRecipients.length) {
      channels.push('EMAIL');
    }

    if (!channels.length) {
      return { channels: [], status: 'SKIPPED' as const };
    }

    await prisma.$transaction(async (tx) => {
      await Promise.all(channels.map((channel) => tx.alertAction.create({
        data: {
          farmId: input.farmId,
          alertId: input.alertId,
          action: channel,
          payload: {
            level: input.level,
            message: input.message,
            recipients: channel === 'SMS'
              ? preferences.smsRecipients
              : channel === 'EMAIL'
                ? preferences.emailRecipients
                : ['in-app'],
            status: 'QUEUED',
          },
        },
      })));

      await tx.event.create({
        data: {
          farmId: input.farmId,
          type: 'ALERT_NOTIFICATION_DISPATCHED',
          payload: {
            alertId: input.alertId,
            channels,
            level: input.level,
          },
          userId: input.userId,
        },
      });
    }, { isolationLevel: 'Serializable' });

    return { channels, status: 'DISPATCHED' as const };
  }
}

export const alertPreferencesService = new AlertPreferencesService();
