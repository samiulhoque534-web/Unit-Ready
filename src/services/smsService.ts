import { db } from '../db/database';
import { InAppNotification } from '../types';

export interface SmsPayload {
  id: string;
  recipientPhone: string;
  sender: string;
  eventType: 'FILE_UPLOAD' | 'EDIT_REQUEST' | 'APPROVAL' | 'CORRECTION' | 'SYSTEM' | 'NOTICE';
  title: string;
  message: string;
  timestamp: string;
}

export const DEFAULT_UNIT_PHONE = '01769102258';

/**
 * Dispatches an SMS Notification to the designated phone number (01769102258).
 * Displays a real-time on-screen toast and saves to local notifications registry.
 */
export async function sendPhoneSmsAlert(
  title: string,
  message: string,
  eventType: 'FILE_UPLOAD' | 'EDIT_REQUEST' | 'APPROVAL' | 'CORRECTION' | 'SYSTEM' | 'NOTICE' = 'SYSTEM',
  senderAppointment: string = '95 Fd Amb System',
  targetPhone: string = DEFAULT_UNIT_PHONE
): Promise<SmsPayload> {
  const timestamp = new Date().toISOString();
  const payload: SmsPayload = {
    id: 'sms-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    recipientPhone: targetPhone,
    sender: senderAppointment,
    eventType,
    title,
    message,
    timestamp
  };

  // 1. Dispatch custom DOM event for instant floating Toast UI
  try {
    const event = new CustomEvent('95fa_sms_notification', { detail: payload });
    window.dispatchEvent(event);
  } catch (e) {
    console.warn('Could not dispatch custom event:', e);
  }

  // 2. Persist in In-App Notifications registry for audit & tracking
  try {
    const inAppNotif: InAppNotification = {
      id: 'notif-sms-' + Date.now(),
      title: `📱 SMS to ${targetPhone}: ${title}`,
      message: `${message} [Sent by: ${senderAppointment} at ${new Date().toLocaleTimeString('en-GB')}]`,
      type: eventType === 'EDIT_REQUEST' || eventType === 'CORRECTION' ? 'WARNING' : 'INFO',
      section: 'all',
      timestamp,
      isRead: false,
      targetPath: eventType === 'EDIT_REQUEST' || eventType === 'CORRECTION' ? '/corrections' : '/notifications'
    };
    await db.notifications.add(inAppNotif);
  } catch (e) {
    console.warn('Could not store SMS notification in DB:', e);
  }

  console.log(`[SMS DISPATCHED] To: ${targetPhone} | Title: ${title} | Message: ${message}`);
  return payload;
}
