import { defaultSiteCms } from '../data/defaultCms';
import type { Language } from '../data/translations';
import type { CmsBusinessProfile } from '../types/cms';
import { resolveAssetUrl } from './assetUrl';

export function isStaticPagesHost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.endsWith('.github.io');
}

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

export const STATIC_SITE_VISIT_SLOTS: TimeSlotDef[] = [
  {
    id: '09:00',
    labelEn: '9:00 AM – 10:30 AM',
    labelEs: '9:00 AM – 10:30 AM',
    startHour: 9,
    startMinute: 0,
    endHour: 10,
    endMinute: 30,
  },
  {
    id: '11:00',
    labelEn: '11:00 AM – 12:30 PM',
    labelEs: '11:00 AM – 12:30 PM',
    startHour: 11,
    startMinute: 0,
    endHour: 12,
    endMinute: 30,
  },
  {
    id: '13:30',
    labelEn: '1:30 PM – 3:00 PM',
    labelEs: '1:30 PM – 3:00 PM',
    startHour: 13,
    startMinute: 30,
    endHour: 15,
    endMinute: 0,
  },
  {
    id: '15:30',
    labelEn: '3:30 PM – 5:00 PM',
    labelEs: '3:30 PM – 5:00 PM',
    startHour: 15,
    startMinute: 30,
    endHour: 17,
    endMinute: 0,
  },
];

export interface DayAvailability {
  date: string;
  dayOfWeek: number;
  isClosedDay: boolean;
  isBlockedDate: boolean;
  bookedSlots: string[];
  blockedSlots: string[];
  openSlots: string[];
}

export function buildStaticAvailability(daysCount = 62): {
  todayIso: string;
  slots: TimeSlotDef[];
  days: DayAvailability[];
} {
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const [y, m, d] = todayIso.split('-').map(Number);
  const days: DayAvailability[] = [];

  for (let i = 0; i < daysCount; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i, 12, 0, 0));
    const date = dt.toISOString().slice(0, 10);
    const dayOfWeek = dt.getUTCDay();
    const isClosedDay = dayOfWeek === 0 || dayOfWeek === 6;
    const isPast = date <= todayIso;
    const dayAllowed = isClosedDay
      ? []
      : dayOfWeek === 2
      ? STATIC_SITE_VISIT_SLOTS.filter((s) => s.startHour >= 12)
      : STATIC_SITE_VISIT_SLOTS;
    const openSlots = isClosedDay || isPast ? [] : dayAllowed.map((s) => s.id);
    days.push({
      date,
      dayOfWeek,
      isClosedDay,
      isBlockedDate: false,
      bookedSlots: [],
      blockedSlots: [],
      openSlots,
    });
  }

  return {
    todayIso,
    slots: STATIC_SITE_VISIT_SLOTS,
    days,
  };
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

export function buildClientIcsHref(
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
  const esc = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${esc(biz.shortName)}//Site Visit//EN`,
    'BEGIN:VEVENT',
    `UID:${appointment.id}@madisonlandclearing.local`,
    `DTSTART;TZID=America/New_York:${dateCompact}T${win.start}`,
    `DTEND;TZID=America/New_York:${dateCompact}T${win.end}`,
    `SUMMARY:${esc(`Site Evaluation - ${biz.shortName} (${appointment.lotSize})`)}`,
    `LOCATION:${esc(appointment.propertyAddress)}`,
    `DESCRIPTION:${esc(`Ref: ${appointment.id} | Scope: ${appointment.serviceType} | Phone: ${biz.phone}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines)}`;
}

export function getIcsDownloadUrl(
  appointmentId: string,
  appointment?: Appointment,
  biz?: CmsBusinessProfile
): string {
  if (isStaticPagesHost() && appointment) {
    return buildClientIcsHref(appointment, biz);
  }
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
      const resolvedIcon = resolveAssetUrl(iconUrl || defaultSiteCms.business.logoUrl);
      new Notification(title, {
        body,
        icon: resolvedIcon || undefined,
      });
    } catch {
      // ignore desktop notification quirk inside strict frames
    }
    return 'granted';
  }

  return 'denied';
}
