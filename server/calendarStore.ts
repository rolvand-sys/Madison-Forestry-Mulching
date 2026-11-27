import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getPublicCms } from './cmsStore.ts';

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

export const SITE_VISIT_SLOTS: TimeSlotDef[] = [
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

interface OwnerCredential {
  salt: string;
  hash: string;
  claimedAt: string;
}

interface CalendarStoreData {
  appointments: Appointment[];
  notifications: OwnerNotification[];
  blockedDates: string[];
  blockedSlots: Record<string, string[]>;
  ownerCredential: OwnerCredential | null;
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

export interface CreateAppointmentInput {
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
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.resolve(DATA_DIR, 'calendar-store.json');
const FALLBACK_SESSION_SECRET = crypto.randomBytes(32).toString('hex');

type OwnerEventListener = (eventName: string, payload: unknown) => void;
const ownerListeners = new Set<OwnerEventListener>();

let writeQueue: Promise<void> = Promise.resolve();

function getSessionSecret(): string {
  const envSecret = process.env.OWNER_SESSION_SECRET?.trim();
  return envSecret && envSecret.length >= 16 ? envSecret : FALLBACK_SESSION_SECRET;
}

function defaultStore(): CalendarStoreData {
  return {
    appointments: [],
    notifications: [],
    blockedDates: [],
    blockedSlots: {},
    ownerCredential: null,
  };
}

function readStoreSync(): CalendarStoreData {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      return defaultStore();
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<CalendarStoreData>;
    return {
      appointments: Array.isArray(parsed.appointments) ? parsed.appointments : [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      blockedDates: Array.isArray(parsed.blockedDates) ? parsed.blockedDates : [],
      blockedSlots:
        parsed.blockedSlots && typeof parsed.blockedSlots === 'object' ? parsed.blockedSlots : {},
      ownerCredential: parsed.ownerCredential ?? null,
    };
  } catch {
    return defaultStore();
  }
}

async function writeStoreAtomic(data: CalendarStoreData): Promise<void> {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = path.resolve(
    DATA_DIR,
    `calendar-store.${process.pid}.${Date.now()}.tmp`
  );
  if (!tmpPath.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid store path resolution');
  }
  await fs.promises.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  await fs.promises.rename(tmpPath, STORE_PATH);
}

function enqueueMutation<T>(fn: (store: CalendarStoreData) => T | Promise<T>): Promise<T> {
  const run = writeQueue.then(async () => {
    const store = readStoreSync();
    const result = await fn(store);
    await writeStoreAtomic(store);
    return result;
  });
  writeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export function subscribeOwnerEvents(listener: OwnerEventListener): () => void {
  ownerListeners.add(listener);
  return () => {
    ownerListeners.delete(listener);
  };
}

function broadcastOwnerEvent(eventName: string, payload: unknown): void {
  for (const listener of ownerListeners) {
    try {
      listener(eventName, payload);
    } catch {
      // ignore disconnected listeners
    }
  }
}

export function getFloridaTodayIso(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

export function addDaysIso(dateIso: string, deltaDays: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

export function isValidDateIso(dateIso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return false;
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function getDayOfWeek(dateIso: string): number {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function getSlotDef(slotId: string): TimeSlotDef | undefined {
  return SITE_VISIT_SLOTS.find((s) => s.id === slotId);
}

export function getAvailabilityForRange(startDateIso?: string, daysCount = 35): DayAvailability[] {
  const todayIso = getFloridaTodayIso();
  const safeStart =
    startDateIso && isValidDateIso(startDateIso) ? startDateIso : todayIso;
  const clampedDays = Math.min(62, Math.max(1, Number(daysCount) || 35));

  const store = readStoreSync();
  const activeAppointments = store.appointments.filter((a) => a.status !== 'cancelled');
  const blockedDateSet = new Set(store.blockedDates);

  const result: DayAvailability[] = [];

  for (let i = 0; i < clampedDays; i++) {
    const date = addDaysIso(safeStart, i);
    const dayOfWeek = getDayOfWeek(date);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isPast = date < todayIso;
    const isClosedDay = isWeekend || isPast;
    const isBlockedDate = blockedDateSet.has(date);

    const bookedSlots = activeAppointments
      .filter((a) => a.date === date)
      .map((a) => a.timeSlot);
    const blockedSlots = Array.isArray(store.blockedSlots[date])
      ? store.blockedSlots[date]
      : [];

    const dayAllowedSlots =
      dayOfWeek === 2
        ? SITE_VISIT_SLOTS.filter((s) => s.startHour >= 12).map((s) => s.id)
        : SITE_VISIT_SLOTS.map((s) => s.id);

    const openSlots =
      isClosedDay || isBlockedDate
        ? []
        : dayAllowedSlots.filter(
            (id) => !bookedSlots.includes(id) && !blockedSlots.includes(id)
          );

    result.push({
      date,
      dayOfWeek,
      isClosedDay,
      isBlockedDate,
      bookedSlots,
      blockedSlots,
      openSlots,
    });
  }

  return result;
}

export async function createAppointment(
  input: CreateAppointmentInput
): Promise<
  | { ok: true; appointment: Appointment; notification: OwnerNotification }
  | { ok: false; statusCode: number; error: string; availableSlots: string[] }
> {
  const date = input.date.trim();
  const timeSlot = input.timeSlot.trim();
  const clientName = input.clientName.trim().slice(0, 120);
  const clientPhone = input.clientPhone.trim().slice(0, 40);
  const rawEmail = input.clientEmail?.trim().slice(0, 160);
  const clientEmail = rawEmail && rawEmail.length > 0 ? rawEmail : undefined;
  const propertyAddress = input.propertyAddress.trim().slice(0, 240);
  const lotSize = input.lotSize.trim().slice(0, 80);
  const serviceType = (input.serviceType || 'Forestry Mulching & Site Assessment')
    .trim()
    .slice(0, 120);
  const rawNotes = input.notes?.trim().slice(0, 500);
  const notes = rawNotes && rawNotes.length > 0 ? rawNotes : undefined;

  if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Invalid email address format.',
      availableSlots: [],
    };
  }

  if (!isValidDateIso(date)) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Invalid date format. Expected YYYY-MM-DD.',
      availableSlots: [],
    };
  }

  const slotDef = getSlotDef(timeSlot);
  if (!slotDef) {
    return {
      ok: false,
      statusCode: 400,
      error: `Invalid time slot. Valid slots: ${SITE_VISIT_SLOTS.map((s) => s.id).join(', ')}.`,
      availableSlots: [],
    };
  }

  const todayIso = getFloridaTodayIso();
  if (date < todayIso) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Cannot schedule a site visit in the past.',
      availableSlots: [],
    };
  }

  const dayOfWeek = getDayOfWeek(date);
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Saturdays and Sundays are closed. Please choose Monday through Friday.',
      availableSlots: [],
    };
  }

  if (dayOfWeek === 2 && slotDef.startHour < 12) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Tuesdays open at 12:00 PM. Please choose an afternoon window (1:30 PM or 3:30 PM).',
      availableSlots: [],
    };
  }

  const digits = clientPhone.replace(/\D/g, '');
  if (!clientName || digits.length < 7 || !propertyAddress || !lotSize) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Name, valid phone number, property address, and lot size are required.',
      availableSlots: [],
    };
  }

  return enqueueMutation((store) => {
    const isBlockedDay = store.blockedDates.includes(date);
    const dayBlockedSlots = store.blockedSlots[date] ?? [];
    const dayBookedSlots = store.appointments
      .filter((a) => a.date === date && a.status !== 'cancelled')
      .map((a) => a.timeSlot);

    const dayAllowedSlots =
      dayOfWeek === 2
        ? SITE_VISIT_SLOTS.filter((s) => s.startHour >= 12).map((s) => s.id)
        : SITE_VISIT_SLOTS.map((s) => s.id);

    const openSlots = isBlockedDay
      ? []
      : dayAllowedSlots.filter(
          (id) => !dayBlockedSlots.includes(id) && !dayBookedSlots.includes(id)
        );

    if (isBlockedDay || dayBlockedSlots.includes(timeSlot) || dayBookedSlots.includes(timeSlot)) {
      return {
        ok: false as const,
        statusCode: 409,
        error: `Slot ${slotDef.labelEn} on ${date} is no longer available.`,
        availableSlots: openSlots,
      };
    }

    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    const appointment: Appointment = {
      id: `ML-APT-${suffix}`,
      date,
      timeSlot,
      timeSlotLabel: slotDef.labelEn,
      clientName,
      clientPhone,
      clientEmail,
      propertyAddress,
      lotSize,
      serviceType,
      notes,
      source: input.source,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const assistantName = getPublicCms().business.assistantName || 'Jessica';
    const sourceTagEn = input.source === 'sarah' ? `via ${assistantName} AI` : 'via Web Calendar';
    const sourceTagEs = input.source === 'sarah' ? `vía ${assistantName} IA` : 'vía Calendario Web';

    const notification: OwnerNotification = {
      id: `NOTIF-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      appointmentId: appointment.id,
      type: 'new_booking',
      titleEn: `New Site Visit (${sourceTagEn})`,
      titleEs: `Nueva Visita Agendada (${sourceTagEs})`,
      messageEn: `${clientName} · ${date} (${slotDef.labelEn}) · ${propertyAddress} (${lotSize})`,
      messageEs: `${clientName} · ${date} (${slotDef.labelEs}) · ${propertyAddress} (${lotSize})`,
      source: input.source,
      read: false,
      createdAt: appointment.createdAt,
    };

    store.appointments.unshift(appointment);
    store.notifications.unshift(notification);
    if (store.notifications.length > 100) {
      store.notifications = store.notifications.slice(0, 100);
    }

    broadcastOwnerEvent('new_appointment', { appointment, notification });

    return {
      ok: true as const,
      appointment,
      notification,
    };
  });
}

export function getAppointmentById(id: string): Appointment | undefined {
  const store = readStoreSync();
  return store.appointments.find((a) => a.id === id);
}

export function buildIcsInvite(appointment: Appointment): string {
  const slot = getSlotDef(appointment.timeSlot) ?? SITE_VISIT_SLOTS[0];
  const dateCompact = appointment.date.replace(/-/g, '');
  const startClock =
    String(slot.startHour).padStart(2, '0') +
    String(slot.startMinute).padStart(2, '0') +
    '00';
  const endClock =
    String(slot.endHour).padStart(2, '0') +
    String(slot.endMinute).padStart(2, '0') +
    '00';
  const dtStamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');

  const escapeIcs = (val: string) =>
    val
      .replace(/\r\n?/g, '\n')
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');

  const cmsBiz = getPublicCms().business;

  const descriptionLines = [
    `Reference: ${escapeIcs(appointment.id)}`,
    `Client: ${escapeIcs(appointment.clientName)} (${escapeIcs(appointment.clientPhone)})`,
    `Lot Size: ${escapeIcs(appointment.lotSize)}`,
    `Scope: ${escapeIcs(appointment.serviceType)}`,
    appointment.notes ? `Notes: ${escapeIcs(appointment.notes)}` : '',
    `Company Phone: ${escapeIcs(cmsBiz.phone)}`,
  ]
    .filter(Boolean)
    .join('\\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${escapeIcs(cmsBiz.shortName)}//Site Visit Scheduler//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${appointment.id}@forestry-scheduler.local`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=America/New_York:${dateCompact}T${startClock}`,
    `DTEND;TZID=America/New_York:${dateCompact}T${endClock}`,
    `SUMMARY:${escapeIcs(`Site Evaluation - ${cmsBiz.shortName} (${appointment.lotSize})`)}`,
    `LOCATION:${escapeIcs(appointment.propertyAddress)}`,
    `DESCRIPTION:${descriptionLines}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT24H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcs(`Reminder: ${cmsBiz.shortName} site visit tomorrow (${slot.labelEn})`)}`,
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcs(`Reminder: ${cmsBiz.shortName} arriving in 1 hour window (${slot.labelEn})`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

export function getOwnerDashboardSnapshot() {
  const store = readStoreSync();
  const sortedAppointments = [...store.appointments].sort((a, b) => {
    const keyA = `${a.date} ${a.timeSlot}`;
    const keyB = `${b.date} ${b.timeSlot}`;
    return keyA.localeCompare(keyB);
  });
  const unreadCount = store.notifications.filter((n) => !n.read).length;

  return {
    todayIso: getFloridaTodayIso(),
    appointments: sortedAppointments,
    notifications: store.notifications,
    unreadCount,
    blockedDates: [...store.blockedDates].sort(),
    blockedSlots: store.blockedSlots,
    slots: SITE_VISIT_SLOTS,
  };
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus
): Promise<Appointment | null> {
  return enqueueMutation((store) => {
    const target = store.appointments.find((a) => a.id === id);
    if (!target) return null;
    target.status = status;
    broadcastOwnerEvent('calendar_updated', { appointmentId: id, status });
    return target;
  });
}

export async function deleteAppointment(id: string): Promise<boolean> {
  return enqueueMutation((store) => {
    const prevLen = store.appointments.length;
    store.appointments = store.appointments.filter((a) => a.id !== id);
    store.notifications = store.notifications.filter((n) => n.appointmentId !== id);
    if (store.appointments.length !== prevLen) {
      broadcastOwnerEvent('calendar_updated', { appointmentId: id, deleted: true });
      return true;
    }
    return false;
  });
}

export async function toggleBlockedDate(date: string): Promise<string[]> {
  return enqueueMutation((store) => {
    const idx = store.blockedDates.indexOf(date);
    if (idx >= 0) {
      store.blockedDates.splice(idx, 1);
    } else {
      store.blockedDates.push(date);
    }
    broadcastOwnerEvent('calendar_updated', { date });
    return [...store.blockedDates].sort();
  });
}

export async function toggleBlockedSlot(date: string, timeSlot: string): Promise<string[]> {
  return enqueueMutation((store) => {
    const current = Array.isArray(store.blockedSlots[date]) ? store.blockedSlots[date] : [];
    if (current.includes(timeSlot)) {
      store.blockedSlots[date] = current.filter((s) => s !== timeSlot);
      if (store.blockedSlots[date].length === 0) {
        delete store.blockedSlots[date];
      }
    } else {
      store.blockedSlots[date] = [...current, timeSlot];
    }
    broadcastOwnerEvent('calendar_updated', { date, timeSlot });
    return store.blockedSlots[date] ?? [];
  });
}

export async function markNotificationsRead(notificationId?: string): Promise<number> {
  return enqueueMutation((store) => {
    for (const n of store.notifications) {
      if (!notificationId || n.id === notificationId) {
        n.read = true;
      }
    }
    return store.notifications.filter((n) => !n.read).length;
  });
}

// --- Server-Side Owner Passcode Auth & Session Tokens ---

export function getOwnerAuthStatus(): { configuredViaEnv: boolean; claimed: boolean } {
  const envPass = process.env.OWNER_PASSCODE?.trim();
  const store = readStoreSync();
  return {
    configuredViaEnv: Boolean(envPass),
    claimed: Boolean(store.ownerCredential?.hash),
  };
}

export async function claimOwnerPasscode(
  passcode: string
): Promise<{ ok: true; token: string } | { ok: false; statusCode: number; error: string }> {
  const trimmed = passcode.trim();
  if (trimmed.length < 4 || trimmed.length > 64) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Passcode must be between 4 and 64 characters.',
    };
  }

  return enqueueMutation((store) => {
    const envPass = process.env.OWNER_PASSCODE?.trim();
    if (envPass || store.ownerCredential?.hash) {
      return {
        ok: false as const,
        statusCode: 409,
        error: 'Owner passcode has already been configured.',
      };
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(trimmed, salt, 64).toString('hex');
    store.ownerCredential = {
      salt,
      hash,
      claimedAt: new Date().toISOString(),
    };

    return {
      ok: true as const,
      token: issueOwnerToken(),
    };
  });
}

export function verifyOwnerPasscode(passcode: string): boolean {
  const candidate = passcode.trim();
  if (!candidate) return false;

  const envPass = process.env.OWNER_PASSCODE?.trim();
  if (envPass) {
    const a = Buffer.from(candidate, 'utf8');
    const b = Buffer.from(envPass, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  const store = readStoreSync();
  if (!store.ownerCredential?.salt || !store.ownerCredential?.hash) {
    return false;
  }

  const derived = crypto.scryptSync(candidate, store.ownerCredential.salt, 64);
  const expected = Buffer.from(store.ownerCredential.hash, 'hex');
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

export function issueOwnerToken(): string {
  const payload = Buffer.from(
    JSON.stringify({
      role: 'owner',
      exp: Date.now() + 1000 * 60 * 60 * 12,
      nonce: crypto.randomBytes(8).toString('hex'),
    })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyOwnerToken(authHeader?: string): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [payloadB64, sigB64] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payloadB64)
    .digest('base64url');

  const a = Buffer.from(sigB64, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      role?: string;
      exp?: number;
    };
    return parsed.role === 'owner' && typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}
