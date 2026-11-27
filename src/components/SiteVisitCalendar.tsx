import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  CalendarCheck2,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Lock,
  Mail,
  Phone,
  RefreshCw,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCallModal } from '../context/CallContext';
import { useCms } from '../context/CmsContext';
import {
  Appointment,
  DayAvailability,
  TimeSlotDef,
  buildClientReceiptMailto,
  buildGoogleCalendarUrl,
  formatDateHuman,
  getIcsDownloadUrl,
  playNotificationChime,
  triggerBrowserNotification,
} from '../utils/calendarClient';

interface SiteVisitCalendarProps {
  onOpenOwnerDashboard: () => void;
}

interface AvailabilityResponse {
  todayIso: string;
  slots: TimeSlotDef[];
  days: DayAvailability[];
}

export function SiteVisitCalendar({ onOpenOwnerDashboard }: SiteVisitCalendarProps) {
  const { language } = useLanguage();
  const { openCallModal } = useCallModal();
  const { cms } = useCms();
  const biz = cms.business;
  const calCopy = cms.sections.calendar;

  const [todayIso, setTodayIso] = useState('');
  const [slots, setSlots] = useState<TimeSlotDef[]>([]);
  const [daysMap, setDaysMap] = useState<Record<string, DayAvailability>>({});
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');

  const lotOptions = useMemo(
    () =>
      cms.pricing.lotSizes.map((l) => (language === 'es' ? l.labelEs : l.labelEn)),
    [cms.pricing.lotSizes, language]
  );

  const serviceOptions = useMemo(
    () =>
      cms.services.map((s) => (language === 'es' ? s.titleEs : s.titleEn)),
    [cms.services, language]
  );

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [lotSize, setLotSize] = useState(lotOptions[2] ?? lotOptions[0] ?? '1.00 Acre');
  const [serviceType, setServiceType] = useState(serviceOptions[0] ?? 'Forestry Mulching');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmedAppointment, setConfirmedAppointment] = useState<Appointment | null>(null);
  const [browserAlertState, setBrowserAlertState] = useState<
    'idle' | 'granted' | 'denied' | 'unsupported'
  >('idle');

  useEffect(() => {
    if (lotOptions.length > 0 && !lotOptions.includes(lotSize)) {
      setLotSize(lotOptions[0]);
    }
    if (serviceOptions.length > 0 && !serviceOptions.includes(serviceType)) {
      setServiceType(serviceOptions[0]);
    }
  }, [lotOptions, serviceOptions, lotSize, serviceType]);

  const copy = useMemo(
    () =>
      language === 'es'
        ? {
            kicker: calCopy.kicker.es,
            title: calCopy.title.es,
            subtitle: calCopy.subtitle.es,
            ownerBtn: 'Agenda del Dueño',
            weekdays: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
            closedSun: 'Cerrado',
            blockedDay: 'Lleno',
            slotsOpenSuffix: 'libres',
            pickTimeTitle: 'Horarios Disponibles para',
            noSlotsDay: 'No hay horarios libres este día. Selecciona otra fecha.',
            bookedTag: 'Ocupado',
            formTitle: 'Confirma Tus Datos de Visita',
            pickSlotPrompt: 'Selecciona una fecha y horario en el calendario para continuar.',
            nameLabel: 'Nombre Completo *',
            namePlaceholder: 'Ej. Roberto Díaz',
            phoneLabel: 'Teléfono *',
            phonePlaceholder: '(850) 555-0188',
            emailLabel: 'Correo (opcional para copia de recibo)',
            emailPlaceholder: 'correo@ejemplo.com',
            addressLabel: 'Dirección de la Propiedad / Ciudad *',
            addressPlaceholder: `Calle o parcela, ${biz.cityState}`,
            lotSizeLabel: 'Tamaño Aproximado *',
            serviceLabel: 'Servicio Principal',
            notesLabel: 'Notas de maleza o acceso (opcional)',
            notesPlaceholder: 'Portón cerrado, palma enana densa, tocones...',
            submitBtn: 'Confirmar Visita al Terreno',
            submittingBtn: 'Guardando cita...',
            validationErr:
              'Selecciona fecha y horario e ingresa tu nombre, teléfono válido y dirección de la propiedad.',
            confirmedTitle: '¡Visita Agendada en Calendario!',
            confirmedSub: `Tu cita ya quedó registrada en la agenda de ${biz.shortName} y el propietario fue notificado al instante.`,
            refLabel: 'Código de Cita',
            notifSectionTitle: 'Recordatorios y Notificación (Sin Apps Externas)',
            downloadIcsBtn: 'Guardar Recordatorio (.ics)',
            icsHint: 'Agrega alertas 24h y 1h antes en Apple, Outlook o Google.',
            googleCalBtn: 'Agregar a Google Calendar',
            browserNotifBtn: 'Activar Alerta en Este Navegador',
            browserNotifSent: 'Alerta de confirmación activada en el navegador',
            browserNotifBlocked: 'Notificaciones bloqueadas en este navegador',
            emailReceiptBtn: 'Enviar Copia a Mi Correo',
            callBtn: 'Llamar a Despacho',
            bookAnotherBtn: 'Agendar Otra Visita',
          }
        : {
            kicker: calCopy.kicker.en,
            title: calCopy.title.en,
            subtitle: calCopy.subtitle.en,
            ownerBtn: 'Owner Agenda',
            weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            closedSun: 'Closed',
            blockedDay: 'Full',
            slotsOpenSuffix: 'open',
            pickTimeTitle: 'Available Arrival Windows for',
            noSlotsDay: 'No open windows remain on this day. Please choose another date.',
            bookedTag: 'Booked',
            formTitle: 'Confirm Your Visit Details',
            pickSlotPrompt: 'Choose a date and time window on the calendar to continue.',
            nameLabel: 'Full Name *',
            namePlaceholder: 'e.g. John Miller',
            phoneLabel: 'Phone Number *',
            phonePlaceholder: '(850) 555-0188',
            emailLabel: 'Email (optional for copy receipt)',
            emailPlaceholder: 'you@example.com',
            addressLabel: 'Property Address / City *',
            addressPlaceholder: `Street or parcel ID, ${biz.cityState}`,
            lotSizeLabel: 'Approx. Acreage *',
            serviceLabel: 'Primary Service',
            notesLabel: 'Brush / gate notes (optional)',
            notesPlaceholder: 'Gate code, thick saw palmetto, stumps...',
            submitBtn: 'Confirm Site Evaluation Visit',
            submittingBtn: 'Booking slot...',
            validationErr:
              'Please choose a date & time window and enter your name, valid phone number, and property address.',
            confirmedTitle: 'Site Visit Scheduled!',
            confirmedSub: `Your appointment is saved in ${biz.shortName}’s live agenda and the business owner has been notified immediately.`,
            refLabel: 'Reference Code',
            notifSectionTitle: 'Client Reminders & Receipt (Zero External APIs)',
            downloadIcsBtn: 'Download Calendar Reminder (.ics)',
            icsHint: 'Includes 24h & 1h alerts for Apple, Outlook, and Google Calendar.',
            googleCalBtn: 'Add to Google Calendar',
            browserNotifBtn: 'Send Browser Reminder Alert',
            browserNotifSent: 'Browser confirmation alert delivered',
            browserNotifBlocked: 'Browser notifications blocked in settings',
            emailReceiptBtn: 'Email Copy Receipt',
            callBtn: 'Call Dispatch',
            bookAnotherBtn: 'Book Another Visit',
          },
    [language, calCopy, biz.cityState, biz.shortName]
  );

  const fetchAvailability = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar/availability?days=62');
      if (!res.ok) return;
      const data = (await res.json()) as AvailabilityResponse;
      setTodayIso(data.todayIso);
      setSlots(data.slots);

      const map: Record<string, DayAvailability> = {};
      for (const day of data.days) {
        map[day.date] = day;
      }
      setDaysMap(map);

      setSelectedDate((prevDate) => {
        if (prevDate && map[prevDate] && map[prevDate].openSlots.length > 0) {
          return prevDate;
        }
        const firstOpen = data.days.find((d) => d.openSlots.length > 0);
        return firstOpen?.date ?? '';
      });
    } catch {
      // keep existing state on transient error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAvailability();
    const onUpdated = () => {
      void fetchAvailability();
    };
    window.addEventListener('clearview:calendar-updated', onUpdated);
    return () => window.removeEventListener('clearview:calendar-updated', onUpdated);
  }, [fetchAvailability]);

  useEffect(() => {
    const day = daysMap[selectedDate];
    if (!day || day.openSlots.length === 0) {
      setSelectedSlot('');
      return;
    }
    if (!selectedSlot || !day.openSlots.includes(selectedSlot)) {
      setSelectedSlot(day.openSlots[0]);
    }
  }, [selectedDate, daysMap, selectedSlot]);

  const calendarMeta = useMemo(() => {
    const baseParts = (todayIso || new Date().toISOString().slice(0, 10)).split('-').map(Number);
    const baseDate = new Date(Date.UTC(baseParts[0], baseParts[1] - 1 + monthOffset, 1));
    const year = baseDate.getUTCFullYear();
    const month = baseDate.getUTCMonth();

    const monthTitle = baseDate.toLocaleDateString(language === 'es' ? 'es-US' : 'en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });

    const firstWeekday = baseDate.getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    const cells: (string | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push(iso);
    }
    while (cells.length % 7 !== 0) cells.push(null);

    return { monthTitle, cells };
  }, [todayIso, monthOffset, language]);

  const activeDay = selectedDate ? daysMap[selectedDate] : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = clientPhone.replace(/\D/g, '');
    if (
      !selectedDate ||
      !selectedSlot ||
      !clientName.trim() ||
      digits.length < 7 ||
      !propertyAddress.trim()
    ) {
      setFormError(copy.validationErr);
      return;
    }

    setFormError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          timeSlot: selectedSlot,
          clientName: clientName.trim(),
          clientPhone: clientPhone.trim(),
          clientEmail: clientEmail.trim() || undefined,
          propertyAddress: propertyAddress.trim(),
          lotSize,
          serviceType,
          notes: notes.trim() || undefined,
        }),
      });

      const payload = (await res.json()) as {
        appointment?: Appointment;
        error?: string;
      };

      if (!res.ok || !payload.appointment) {
        setFormError(payload.error || copy.validationErr);
        void fetchAvailability();
        return;
      }

      setConfirmedAppointment(payload.appointment);
      playNotificationChime();
      void fetchAvailability();

      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        void triggerBrowserNotification(
          `${biz.shortName} · ${payload.appointment.id}`,
          `${formatDateHuman(payload.appointment.date, language)} (${payload.appointment.timeSlotLabel})`,
          biz.logoUrl || undefined
        );
        setBrowserAlertState('granted');
      }
    } catch {
      setFormError(copy.validationErr);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnableBrowserReminder = async () => {
    if (!confirmedAppointment) return;
    const status = await triggerBrowserNotification(
      language === 'es'
        ? `Visita Confirmada (${confirmedAppointment.id})`
        : `Site Visit Confirmed (${confirmedAppointment.id})`,
      `${formatDateHuman(confirmedAppointment.date, language)} · ${confirmedAppointment.timeSlotLabel} · ${confirmedAppointment.propertyAddress}`,
      biz.logoUrl || undefined
    );
    setBrowserAlertState(status);
  };

  return (
    <section id="schedule" className="bg-white py-16 sm:py-22 border-b border-[#DDD1C0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Section Header + Quick Owner Agenda Button */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <p className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[var(--cv-primary)]">
              <CalendarDays className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{copy.kicker}</span>
            </p>
            <h2
              className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#231710]"
              style={{ textWrap: 'balance' }}
            >
              {copy.title}
            </h2>
            <p className="text-sm sm:text-base text-neutral-600 leading-relaxed">
              {copy.subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenOwnerDashboard}
            className="self-start md:self-auto inline-flex items-center gap-2 bg-[var(--cv-dark-surface)] hover:bg-[var(--cv-primary)] text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-md transition-colors cursor-pointer shrink-0"
          >
            <Lock className="w-4 h-4 text-[var(--cv-accent)]" aria-hidden="true" />
            <span>{copy.ownerBtn}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Calendar Grid + Time Slot Picker */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-[#F4EFE6] border border-[#DDD1C0] rounded-xl p-4 sm:p-6 space-y-5">
              {/* Month Controls */}
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-2xl font-bold text-[#231710] capitalize">
                  {calendarMeta.monthTitle}
                </h3>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void fetchAvailability()}
                    aria-label="Refresh availability"
                    className="w-9 h-9 rounded-md bg-white border border-[#DDD1C0] hover:border-[var(--cv-primary)] text-neutral-600 hover:text-[var(--cv-primary)] flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    type="button"
                    disabled={monthOffset <= 0}
                    onClick={() => setMonthOffset((m) => Math.max(0, m - 1))}
                    aria-label="Previous month"
                    className="w-9 h-9 rounded-md bg-white border border-[#DDD1C0] hover:border-[var(--cv-primary)] disabled:opacity-40 text-[#231710] flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={monthOffset >= 1}
                    onClick={() => setMonthOffset((m) => Math.min(1, m + 1))}
                    aria-label="Next month"
                    className="w-9 h-9 rounded-md bg-white border border-[#DDD1C0] hover:border-[var(--cv-primary)] disabled:opacity-40 text-[#231710] flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-1.5 text-center">
                {copy.weekdays.map((wd, idx) => (
                  <div
                    key={wd}
                    className={`text-[11px] font-semibold py-1 ${
                      idx === 0 || idx === 6 ? 'text-neutral-400' : 'text-neutral-600'
                    }`}
                  >
                    {wd}
                  </div>
                ))}
              </div>

              {/* Month Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {calendarMeta.cells.map((dateIso, idx) => {
                  if (!dateIso) {
                    return <div key={`empty-${idx}`} className="h-14 sm:h-16" />;
                  }

                  const dayInfo = daysMap[dateIso];
                  const dayNum = Number(dateIso.slice(8, 10));
                  const isSelected = selectedDate === dateIso;
                  const openCount = dayInfo?.openSlots.length ?? 0;
                  const isWeekend = dayInfo?.dayOfWeek === 0 || dayInfo?.dayOfWeek === 6;
                  const isDisabled =
                    !dayInfo || dayInfo.isClosedDay || dayInfo.isBlockedDate || openCount === 0;

                  return (
                    <button
                      key={dateIso}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        setSelectedDate(dateIso);
                        setConfirmedAppointment(null);
                      }}
                      className={`h-14 sm:h-16 rounded-lg border p-1.5 flex flex-col items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-[var(--cv-primary)] border-[var(--cv-primary)] text-white cursor-pointer'
                          : isDisabled
                          ? 'bg-neutral-100 border-[#DDD1C0] text-neutral-400 cursor-not-allowed'
                          : 'bg-white border-[#DDD1C0] hover:border-[var(--cv-primary)] text-[#231710] cursor-pointer'
                      }`}
                    >
                      <span className="font-mono text-xs sm:text-sm font-bold tabular-nums leading-none">
                        {dayNum}
                      </span>
                      <span
                        className={`text-[9px] sm:text-[10px] font-medium leading-none truncate max-w-full ${
                          isSelected
                            ? 'text-[var(--cv-accent)]'
                            : isWeekend
                            ? 'text-neutral-400'
                            : openCount > 0
                            ? 'text-[var(--cv-primary)]'
                            : 'text-neutral-400'
                        }`}
                      >
                        {isWeekend
                          ? copy.closedSun
                          : dayInfo?.isBlockedDate
                          ? copy.blockedDay
                          : openCount > 0
                          ? `${openCount} ${copy.slotsOpenSuffix}`
                          : ''}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Time Window Picker */}
              <div className="pt-4 border-t border-[#DDD1C0] space-y-3">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#231710]">
                  <Clock className="w-4 h-4 text-[var(--cv-primary)] shrink-0" aria-hidden="true" />
                  <span>
                    {copy.pickTimeTitle}{' '}
                    <span className="text-[var(--cv-primary)]">
                      {selectedDate ? formatDateHuman(selectedDate, language) : '—'}
                    </span>
                  </span>
                </div>

                {!activeDay || activeDay.openSlots.length === 0 ? (
                  <p className="text-xs text-neutral-600">{copy.noSlotsDay}</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {slots.map((slot) => {
                      const isOpen = activeDay.openSlots.includes(slot.id);
                      const isChosen = selectedSlot === slot.id && isOpen;
                      const label = language === 'es' ? slot.labelEs : slot.labelEn;

                      return (
                        <button
                          key={slot.id}
                          type="button"
                          disabled={!isOpen}
                          onClick={() => {
                            setSelectedSlot(slot.id);
                            setConfirmedAppointment(null);
                          }}
                          className={`px-3.5 py-2.5 rounded-lg border text-left flex items-center justify-between gap-2 transition-colors ${
                            isChosen
                              ? 'bg-[var(--cv-primary)] border-[var(--cv-primary)] text-white cursor-pointer'
                              : isOpen
                              ? 'bg-white border-[#DDD1C0] hover:border-[var(--cv-primary)] text-[#231710] cursor-pointer'
                              : 'bg-neutral-100 border-[#DDD1C0] text-neutral-400 line-through cursor-not-allowed'
                          }`}
                        >
                          <span className="font-mono text-xs sm:text-sm font-semibold tabular-nums">
                            {label}
                          </span>
                          {!isOpen && (
                            <span className="text-[10px] font-medium no-underline">
                              {copy.bookedTag}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Booking Form or Confirmation + Zero-API Notifications */}
          <div className="lg:col-span-5">
            <div className="bg-[var(--cv-dark-surface)] border border-[var(--cv-dark-surface)] rounded-xl overflow-hidden text-white shadow-xl">
              {confirmedAppointment ? (
                <div className="p-6 sm:p-7 space-y-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--cv-primary)]/25 text-[var(--cv-light-green)] flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-bold text-white leading-tight">
                        {copy.confirmedTitle}
                      </h3>
                      <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                        {copy.confirmedSub}
                      </p>
                    </div>
                  </div>

                  {/* Appointment Summary Card */}
                  <div className="bg-[var(--cv-dark-card)] border border-white/10 rounded-lg p-4 space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-neutral-400">{copy.refLabel}:</span>
                      <span className="font-mono font-bold text-[var(--cv-accent)]">
                        {confirmedAppointment.id}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-neutral-400">
                        {language === 'es' ? 'Fecha' : 'Date'}:
                      </span>
                      <span className="font-semibold text-white text-right">
                        {formatDateHuman(confirmedAppointment.date, language)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-neutral-400">
                        {language === 'es' ? 'Horario' : 'Window'}:
                      </span>
                      <span className="font-mono text-white text-right">
                        {confirmedAppointment.timeSlotLabel}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-white/10 text-neutral-300 text-xs">
                      {confirmedAppointment.propertyAddress} · {confirmedAppointment.lotSize}
                    </div>
                  </div>

                  {/* Zero-External-API Notification & Calendar Sync Actions */}
                  <div className="space-y-2.5 pt-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                      {copy.notifSectionTitle}
                    </p>

                    <a
                      href={getIcsDownloadUrl(confirmedAppointment.id)}
                      download={`site-visit-${confirmedAppointment.id}.ics`}
                      className="w-full inline-flex items-center justify-center gap-2 bg-[var(--cv-primary)] hover:bg-[var(--cv-primary-dark)] text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-md transition-colors"
                    >
                      <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{copy.downloadIcsBtn}</span>
                    </a>
                    <p className="text-[11px] text-neutral-400 text-center">{copy.icsHint}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <a
                        href={buildGoogleCalendarUrl(confirmedAppointment, biz)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 bg-[var(--cv-dark-card)] hover:bg-white/10 border border-white/15 text-white font-medium text-xs px-3 py-2 rounded-md transition-colors"
                      >
                        <CalendarPlus className="w-3.5 h-3.5 text-[var(--cv-accent)]" aria-hidden="true" />
                        <span>{copy.googleCalBtn}</span>
                      </a>

                      <a
                        href={buildClientReceiptMailto(confirmedAppointment, language, biz)}
                        className="inline-flex items-center justify-center gap-1.5 bg-[var(--cv-dark-card)] hover:bg-white/10 border border-white/15 text-white font-medium text-xs px-3 py-2 rounded-md transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5 text-[var(--cv-light-green)]" aria-hidden="true" />
                        <span>{copy.emailReceiptBtn}</span>
                      </a>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleEnableBrowserReminder()}
                      className="w-full inline-flex items-center justify-center gap-2 bg-[var(--cv-dark-card)] hover:bg-white/10 border border-[var(--cv-accent)]/40 text-[var(--cv-accent)] font-medium text-xs px-3 py-2 rounded-md transition-colors cursor-pointer"
                    >
                      <BellRing className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        {browserAlertState === 'granted'
                          ? copy.browserNotifSent
                          : browserAlertState === 'denied'
                          ? copy.browserNotifBlocked
                          : copy.browserNotifBtn}
                      </span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2.5 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        openCallModal();
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs px-3 py-2.5 rounded-md transition-colors cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5 text-[var(--cv-light-green)]" aria-hidden="true" />
                      <span>{copy.callBtn}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmedAppointment(null)}
                      className="text-xs font-medium text-neutral-300 hover:text-white border border-white/15 px-3 py-2.5 rounded-md transition-colors cursor-pointer"
                    >
                      {copy.bookAnotherBtn}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="p-6 sm:p-7 space-y-4">
                  <div className="space-y-1.5">
                    <h3 className="font-display text-2xl font-bold text-white leading-tight">
                      {copy.formTitle}
                    </h3>
                    {selectedDate && selectedSlot ? (
                      <div className="inline-flex items-center gap-2 bg-[var(--cv-primary)]/25 border border-[var(--cv-light-green)]/45 text-[var(--cv-accent)] text-xs font-semibold px-3 py-1.5 rounded-md">
                        <CalendarCheck2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {formatDateHuman(selectedDate, language)} ·{' '}
                          {slots.find((s) => s.id === selectedSlot)?.[
                            language === 'es' ? 'labelEs' : 'labelEn'
                          ] ?? selectedSlot}
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-300">{copy.pickSlotPrompt}</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="cal-name"
                          className="block text-xs font-semibold text-neutral-200 mb-1"
                        >
                          {copy.nameLabel}
                        </label>
                        <input
                          id="cal-name"
                          type="text"
                          required
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          placeholder={copy.namePlaceholder}
                          className="w-full bg-[var(--cv-dark-card)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3 py-2 text-sm text-white placeholder:text-neutral-500"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="cal-phone"
                          className="block text-xs font-semibold text-neutral-200 mb-1"
                        >
                          {copy.phoneLabel}
                        </label>
                        <input
                          id="cal-phone"
                          type="tel"
                          required
                          value={clientPhone}
                          onChange={(e) => setClientPhone(e.target.value)}
                          placeholder={copy.phonePlaceholder}
                          className="w-full bg-[var(--cv-dark-card)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3 py-2 text-sm font-mono text-white placeholder:text-neutral-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="cal-email"
                        className="block text-xs font-semibold text-neutral-200 mb-1"
                      >
                        {copy.emailLabel}
                      </label>
                      <input
                        id="cal-email"
                        type="email"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder={copy.emailPlaceholder}
                        className="w-full bg-[var(--cv-dark-card)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3 py-2 text-sm text-white placeholder:text-neutral-500"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="cal-address"
                        className="block text-xs font-semibold text-neutral-200 mb-1"
                      >
                        {copy.addressLabel}
                      </label>
                      <input
                        id="cal-address"
                        type="text"
                        required
                        value={propertyAddress}
                        onChange={(e) => setPropertyAddress(e.target.value)}
                        placeholder={copy.addressPlaceholder}
                        className="w-full bg-[var(--cv-dark-card)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3 py-2 text-sm text-white placeholder:text-neutral-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="cal-lot"
                          className="block text-xs font-semibold text-neutral-200 mb-1"
                        >
                          {copy.lotSizeLabel}
                        </label>
                        <select
                          id="cal-lot"
                          value={lotSize}
                          onChange={(e) => setLotSize(e.target.value)}
                          className="w-full bg-[var(--cv-dark-card)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3 py-2 text-sm text-white"
                        >
                          {lotOptions.map((opt) => (
                            <option key={opt} value={opt} className="bg-[var(--cv-dark-surface)]">
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="cal-service"
                          className="block text-xs font-semibold text-neutral-200 mb-1"
                        >
                          {copy.serviceLabel}
                        </label>
                        <select
                          id="cal-service"
                          value={serviceType}
                          onChange={(e) => setServiceType(e.target.value)}
                          className="w-full bg-[var(--cv-dark-card)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3 py-2 text-sm text-white"
                        >
                          {serviceOptions.map((opt) => (
                            <option key={opt} value={opt} className="bg-[var(--cv-dark-surface)]">
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="cal-notes"
                        className="block text-xs font-semibold text-neutral-200 mb-1"
                      >
                        {copy.notesLabel}
                      </label>
                      <input
                        id="cal-notes"
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={copy.notesPlaceholder}
                        className="w-full bg-[var(--cv-dark-card)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3 py-2 text-sm text-white placeholder:text-neutral-500"
                      />
                    </div>
                  </div>

                  {formError && (
                    <p role="alert" className="text-xs text-[var(--cv-accent)] font-medium">
                      {formError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || !selectedDate || !selectedSlot}
                    className="w-full bg-[var(--cv-primary)] hover:bg-[var(--cv-primary-dark)] disabled:opacity-50 text-white font-semibold text-sm py-3 px-4 rounded-md transition-colors cursor-pointer"
                  >
                    {submitting ? copy.submittingBtn : copy.submitBtn}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
