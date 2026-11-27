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

const STATIC_STORE_KEY = 'madison_static_calendar_v1';

interface StaticCalendarStore {
  appointments: Appointment[];
  notifications: OwnerNotification[];
  blockedDates: string[];
  blockedSlots: Record<string, string[]>;
  ownerPasscode: string | null;
}

function getEasternTodayIso(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function readStaticStore(): StaticCalendarStore {
  const empty: StaticCalendarStore = {
    appointments: [],
    notifications: [],
    blockedDates: [],
    blockedSlots: {},
    ownerPasscode: null,
  };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(STATIC_STORE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<StaticCalendarStore>;
    return {
      appointments: Array.isArray(parsed.appointments) ? parsed.appointments : [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      blockedDates: Array.isArray(parsed.blockedDates) ? parsed.blockedDates : [],
      blockedSlots:
        parsed.blockedSlots && typeof parsed.blockedSlots === 'object' ? parsed.blockedSlots : {},
      ownerPasscode: typeof parsed.ownerPasscode === 'string' ? parsed.ownerPasscode : null,
    };
  } catch {
    return empty;
  }
}

function writeStaticStore(store: StaticCalendarStore): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STATIC_STORE_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent('clearview:calendar-updated'));
  } catch {
    // ignore storage quota error
  }
}

export function buildStaticAvailability(daysCount = 62): {
  todayIso: string;
  slots: TimeSlotDef[];
  days: DayAvailability[];
} {
  const todayIso = getEasternTodayIso();
  const [y, m, d] = todayIso.split('-').map(Number);
  const store = readStaticStore();
  const days: DayAvailability[] = [];

  for (let i = 0; i < daysCount; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i, 12, 0, 0));
    const date = dt.toISOString().slice(0, 10);
    const dayOfWeek = dt.getUTCDay();
    const isClosedDay = dayOfWeek === 0 || dayOfWeek === 6;
    const isPast = date <= todayIso;
    const isBlockedDate = store.blockedDates.includes(date);

    const dayAllowed = isClosedDay
      ? []
      : dayOfWeek === 2
      ? STATIC_SITE_VISIT_SLOTS.filter((s) => s.startHour >= 12)
      : STATIC_SITE_VISIT_SLOTS;

    const bookedSlots = store.appointments
      .filter((a) => a.date === date && a.status !== 'cancelled')
      .map((a) => a.timeSlot);
    const blockedSlots = Array.isArray(store.blockedSlots[date]) ? store.blockedSlots[date] : [];

    const openSlots =
      isClosedDay || isPast || isBlockedDate
        ? []
        : dayAllowed
            .map((s) => s.id)
            .filter((slotId) => !bookedSlots.includes(slotId) && !blockedSlots.includes(slotId));

    days.push({
      date,
      dayOfWeek,
      isClosedDay,
      isBlockedDate,
      bookedSlots,
      blockedSlots,
      openSlots,
    });
  }

  return {
    todayIso,
    slots: STATIC_SITE_VISIT_SLOTS,
    days,
  };
}

export function createStaticAppointment(input: {
  date: string;
  timeSlot: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  propertyAddress: string;
  lotSize: string;
  serviceType?: string;
  notes?: string;
  source: AppointmentSource;
}):
  | { ok: true; appointment: Appointment }
  | { ok: false; error: string; availableSlots: string[] } {
  const availability = buildStaticAvailability(62);
  const day = availability.days.find((d) => d.date === input.date);
  if (!day) {
    return {
      ok: false,
      error: 'Selected date is outside the open booking window.',
      availableSlots: [],
    };
  }
  if (!day.openSlots.includes(input.timeSlot)) {
    return {
      ok: false,
      error: 'That time slot is no longer available.',
      availableSlots: day.openSlots,
    };
  }

  const slotDef = STATIC_SITE_VISIT_SLOTS.find((s) => s.id === input.timeSlot);
  const appointment: Appointment = {
    id: `ML-${Date.now().toString(36).slice(-5).toUpperCase()}`,
    date: input.date,
    timeSlot: input.timeSlot,
    timeSlotLabel: slotDef?.labelEn ?? input.timeSlot,
    clientName: input.clientName.trim(),
    clientPhone: input.clientPhone.trim(),
    clientEmail: input.clientEmail?.trim() || undefined,
    propertyAddress: input.propertyAddress.trim(),
    lotSize: input.lotSize.trim() || 'TBD',
    serviceType: input.serviceType?.trim() || 'Forestry Mulching & Brush Clearing',
    notes: input.notes?.trim() || undefined,
    source: input.source,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  const store = readStaticStore();
  store.appointments.unshift(appointment);

  const sourceLabelEn = input.source === 'sarah' ? 'Jessica AI' : 'Web Calendar';
  const sourceLabelEs = input.source === 'sarah' ? 'Jessica IA' : 'Calendario Web';
  const notification: OwnerNotification = {
    id: `notif-${Date.now()}`,
    appointmentId: appointment.id,
    type: 'new_booking',
    titleEn: `New Site Visit (${sourceLabelEn})`,
    titleEs: `Nueva Visita Agendada (${sourceLabelEs})`,
    messageEn: `${appointment.clientName} · ${appointment.date} (${appointment.timeSlotLabel}) · ${appointment.propertyAddress}`,
    messageEs: `${appointment.clientName} · ${appointment.date} (${appointment.timeSlotLabel}) · ${appointment.propertyAddress}`,
    source: input.source,
    read: false,
    createdAt: appointment.createdAt,
  };
  store.notifications.unshift(notification);
  writeStaticStore(store);

  return { ok: true, appointment };
}

export function getStaticOwnerAuthStatus(): { configuredViaEnv: boolean; claimed: boolean } {
  const store = readStaticStore();
  return {
    configuredViaEnv: false,
    claimed: Boolean(store.ownerPasscode),
  };
}

export function claimStaticOwnerPasscode(passcode: string): { ok: true; token: string } | { ok: false; error: string } {
  const trimmed = passcode.trim();
  if (trimmed.length < 4) {
    return { ok: false, error: 'Passcode must be at least 4 characters.' };
  }
  const store = readStaticStore();
  if (store.ownerPasscode) {
    return { ok: false, error: 'Owner passcode already configured.' };
  }
  store.ownerPasscode = trimmed;
  writeStaticStore(store);
  return { ok: true, token: 'static-owner-session' };
}

export function verifyStaticOwnerPasscode(passcode: string): { ok: true; token: string } | { ok: false; error: string } {
  const store = readStaticStore();
  if (!store.ownerPasscode || passcode.trim() !== store.ownerPasscode) {
    return { ok: false, error: 'Incorrect passcode.' };
  }
  return { ok: true, token: 'static-owner-session' };
}

export function getStaticOwnerDashboard(): {
  todayIso: string;
  appointments: Appointment[];
  notifications: OwnerNotification[];
  unreadCount: number;
  blockedDates: string[];
  blockedSlots: Record<string, string[]>;
  slots: TimeSlotDef[];
} {
  const store = readStaticStore();
  return {
    todayIso: getEasternTodayIso(),
    appointments: [...store.appointments].sort((a, b) =>
      `${a.date} ${a.timeSlot}`.localeCompare(`${b.date} ${b.timeSlot}`)
    ),
    notifications: store.notifications,
    unreadCount: store.notifications.filter((n) => !n.read).length,
    blockedDates: store.blockedDates,
    blockedSlots: store.blockedSlots,
    slots: STATIC_SITE_VISIT_SLOTS,
  };
}

export function updateStaticAppointmentStatus(id: string, status: AppointmentStatus): void {
  const store = readStaticStore();
  store.appointments = store.appointments.map((apt) =>
    apt.id === id ? { ...apt, status } : apt
  );
  writeStaticStore(store);
}

export function deleteStaticAppointment(id: string): void {
  const store = readStaticStore();
  store.appointments = store.appointments.filter((apt) => apt.id !== id);
  store.notifications = store.notifications.filter((n) => n.appointmentId !== id);
  writeStaticStore(store);
}

export function toggleStaticBlockedDate(date: string): void {
  const store = readStaticStore();
  if (store.blockedDates.includes(date)) {
    store.blockedDates = store.blockedDates.filter((d) => d !== date);
  } else {
    store.blockedDates.push(date);
  }
  writeStaticStore(store);
}

export function toggleStaticBlockedSlot(date: string, timeSlot: string): void {
  const store = readStaticStore();
  const current = Array.isArray(store.blockedSlots[date]) ? store.blockedSlots[date] : [];
  if (current.includes(timeSlot)) {
    store.blockedSlots[date] = current.filter((s) => s !== timeSlot);
  } else {
    store.blockedSlots[date] = [...current, timeSlot];
  }
  writeStaticStore(store);
}

export function markStaticNotificationsRead(): void {
  const store = readStaticStore();
  store.notifications = store.notifications.map((n) => ({ ...n, read: true }));
  writeStaticStore(store);
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
