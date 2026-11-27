import { defaultSiteCms } from '../data/defaultCms';
import type { Language } from '../data/translations';
import type { CmsBusinessProfile } from '../types/cms';

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type AppointmentSource = 'web' | 'sarah';

export interface TimeSlotDef {
  id: string;
  labelEn: string;
  labelEs: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export interface DayAvailability {
  date: string;
  dayOfWeek: number;
  isClosedDay: boolean;
  isBlockedDate: boolean;
  bookedSlots: string[];
  blockedSlots: string[];
  openSlots: string[];
}

export interface Appointment {
  id: string;
  date: string;
  timeSlot: string;
  timeSlotLabel: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  propertyAddress: string;
  lotSize: string;
  serviceType: string;
  notes?: string;
  source: AppointmentSource;
  status: AppointmentStatus;
  createdAt: string;
}

export interface OwnerNotification {
  id: string;
  appointmentId: string;
  type: 'new_booking' | 'status_change';
  titleEn: string;
  titleEs: string;
  messageEn: string;
  messageEs: string;
  source: AppointmentSource;
  read: boolean;
  createdAt: string;
}

export function formatDateHuman(dateIso: string, language: Language): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return dateIso;
  const [y, m, d] = dateIso.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return utcDate.toLocaleDateString(language === 'es' ? 'es-US' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function getIcsDownloadUrl(appointmentId: string): string {
  return `/api/appointments/${encodeURIComponent(appointmentId)}/invite.ics`;
}

export function buildGoogleCalendarUrl(
  appointment: Appointment,
  biz: CmsBusinessProfile = defaultSiteCms.business
): string {
  const dateCompact = appointment.date.replace(/-/g, '');
  const slotMap: Record<string, { start: string; end: string }> = {
    '09:00': { start: '090000', end: '103000' },
    '11:00': { start: '110000', end: '123000' },
    '13:30': { start: '133000', end: '150000' },
    '15:30': { start: '153000', end: '170000' },
  };
  const win = slotMap[appointment.timeSlot] ?? { start: '090000', end: '103000' };

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Site Evaluation - ${biz.shortName} (${appointment.lotSize})`,
    dates: `${dateCompact}T${win.start}/${dateCompact}T${win.end}`,
    ctz: 'America/New_York',
    location: appointment.propertyAddress,
    details: [
      `Ref: ${appointment.id}`,
      `Client: ${appointment.clientName} (${appointment.clientPhone})`,
      `Scope: ${appointment.serviceType}`,
      `Company Phone: ${biz.phone}`,
    ].join('\n'),
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildClientReceiptMailto(
  appointment: Appointment,
  language: Language,
  biz: CmsBusinessProfile = defaultSiteCms.business
): string {
  const to = appointment.clientEmail || biz.email;
  const subject =
    language === 'es'
      ? `Confirmación de Visita (${appointment.id}) - ${biz.shortName}`
      : `Site Visit Confirmation (${appointment.id}) - ${biz.shortName}`;

  const body =
    language === 'es'
      ? [
          `Referencia: ${appointment.id}`,
          `Fecha: ${formatDateHuman(appointment.date, 'es')}`,
          `Horario: ${appointment.timeSlotLabel}`,
          `Cliente: ${appointment.clientName} (${appointment.clientPhone})`,
          `Propiedad: ${appointment.propertyAddress}`,
          `Tamaño: ${appointment.lotSize}`,
          `Servicio: ${appointment.serviceType}`,
          `Teléfono ${biz.shortName}: ${biz.phone}`,
        ].join('\n')
      : [
          `Reference: ${appointment.id}`,
          `Date: ${formatDateHuman(appointment.date, 'en')}`,
          `Window: ${appointment.timeSlotLabel}`,
          `Client: ${appointment.clientName} (${appointment.clientPhone})`,
          `Property: ${appointment.propertyAddress}`,
          `Lot Size: ${appointment.lotSize}`,
          `Scope: ${appointment.serviceType}`,
          `${biz.shortName} Phone: ${biz.phone}`,
        ].join('\n');

  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildOwnerSmsClientHref(
  appointment: Appointment,
  language: Language,
  biz: CmsBusinessProfile = defaultSiteCms.business
): string {
  const cleanPhone = appointment.clientPhone.replace(/[^\d+]/g, '');
  const message =
    language === 'es'
      ? `Hola ${appointment.clientName}, te confirmamos tu visita de evaluación con ${biz.shortName} para el ${formatDateHuman(appointment.date, 'es')} (${appointment.timeSlotLabel}) en ${appointment.propertyAddress}. Ref: ${appointment.id}.`
      : `Hi ${appointment.clientName}, confirming your property walk-through with ${biz.shortName} on ${formatDateHuman(appointment.date, 'en')} (${appointment.timeSlotLabel}) at ${appointment.propertyAddress}. Ref: ${appointment.id}.`;

  return `sms:${cleanPhone}?body=${encodeURIComponent(message)}`;
}

export function playNotificationChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [587.33, 880.0];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.13);

      gain.gain.setValueAtTime(0.001, now + idx * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.13 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.13 + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.13);
      osc.stop(now + idx * 0.13 + 0.26);
    });
  } catch {
    // ignore autoplay restriction
  }
}

export async function triggerBrowserNotification(
  title: string,
  body: string,
  iconUrl?: string
): Promise<'granted' | 'denied' | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  if (permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: iconUrl || defaultSiteCms.business.logoUrl || undefined,
      });
    } catch {
      // ignore desktop notification quirk inside strict frames
    }
    return 'granted';
  }

  return 'denied';
}
