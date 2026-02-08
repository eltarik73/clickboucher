// KLIK&GO — Notification Service (stub)
// Schema migration pending - minimal exports

export interface NotificationPayload {
  userId: string;
  orderId?: string;
  channel: string;
  title: string;
  body: string;
}

export interface INotificationService {
  send(payload: NotificationPayload): Promise<void>;
  sendOrderUpdate(orderId: string, title: string, body: string): Promise<void>;
  sendSms(phone: string, message: string): Promise<void>;
  sendWhatsApp(phone: string, templateName: string, params: Record<string, string>): Promise<void>;
}

export const WA_TEMPLATES = {} as Record<string, { name: string; body: string }>;
export const SMS_TEMPLATES = {} as Record<string, string>;

class StubNotificationService implements INotificationService {
  async send(payload: NotificationPayload): Promise<void> {
    console.log(`[STUB NOTIF] ${payload.channel} -> ${payload.userId}: ${payload.title}`);
  }
  async sendOrderUpdate(orderId: string, title: string, body: string): Promise<void> {
    console.log(`[STUB NOTIF] Order ${orderId}: ${title} - ${body}`);
  }
  async sendSms(phone: string, message: string): Promise<void> {
    console.log(`[STUB SMS] -> ${phone}: ${message}`);
  }
  async sendWhatsApp(phone: string, templateName: string, params: Record<string, string>): Promise<void> {
    console.log(`[STUB WA] -> ${phone}: ${templateName}`, params);
  }
}

export const notificationService: INotificationService = new StubNotificationService();

export async function notifyOrderStatus(
  _orderId: string,
  _status: string,
  _extra: Record<string, string> = {}
): Promise<void> {
  console.log("[STUB] notifyOrderStatus - schema migration pending");
}
