import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Bell,
  BellRing,
  Bot,
  CalendarDays,
  Check,
  CheckCheck,
  Clock,
  Download,
  Globe,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  ShieldCheck,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCms } from '../context/CmsContext';
import {
  Appointment,
  AppointmentStatus,
  OwnerNotification,
  TimeSlotDef,
  buildClientReceiptMailto,
  buildOwnerSmsClientHref,
  claimStaticOwnerPasscode,
  deleteStaticAppointment,
  formatDateHuman,
  getIcsDownloadUrl,
  getStaticOwnerAuthStatus,
  getStaticOwnerDashboard,
  isStaticPagesHost,
  markStaticNotificationsRead,
  playNotificationChime,
  toggleStaticBlockedDate,
  toggleStaticBlockedSlot,
  triggerBrowserNotification,
  updateStaticAppointmentStatus,
  verifyStaticOwnerPasscode,
} from '../utils/calendarClient';

interface OwnerDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DashboardPayload {
  todayIso: string;
  appointments: Appointment[];
  notifications: OwnerNotification[];
  unreadCount: number;
  blockedDates: string[];
  blockedSlots: Record<string, string[]>;
  slots: TimeSlotDef[];
}

export function OwnerDashboardModal({ isOpen, onClose }: OwnerDashboardModalProps) {
  const { language } = useLanguage();
  const { cms } = useCms();
  const biz = cms.business;

  // Bearer token stays strictly in React memory
  const [token, setToken] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<{
    configuredViaEnv: boolean;
    claimed: boolean;
  } | null>(null);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [confirmPasscodeInput, setConfirmPasscodeInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [activeTab, setActiveTab] = useState<'agenda' | 'notifications' | 'availability'>('agenda');
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'confirmed' | 'sarah' | 'web'>('all');
  const [selectedManageDate, setSelectedManageDate] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [desktopNotifStatus, setDesktopNotifStatus] = useState<'default' | 'granted' | 'denied'>(
    () =>
      typeof window !== 'undefined' && 'Notification' in window
        ? (Notification.permission as 'default' | 'granted' | 'denied')
        : 'default'
  );
  const [liveToast, setLiveToast] = useState<OwnerNotification | null>(null);

  const copy = useMemo(
    () =>
      language === 'es'
        ? {
            setupTitle: 'Configurar Acceso del Dueño',
            setupSub:
              'Crea la clave privada de la agenda por única vez. Se guarda cifrada en el servidor.',
            createPassLabel: 'Nueva Clave (mín. 4 caracteres)',
            confirmPassLabel: 'Confirmar Clave',
            createPassBtn: 'Guardar Clave y Entrar',
            mismatchErr: 'Las claves no coinciden o tienen menos de 4 caracteres.',
            loginTitle: 'Agenda Privada del Dueño',
            loginSub: `Acceso exclusivo para ${biz.ownerName} (${biz.shortName})`,
            passLabel: 'Clave de Acceso',
            passPlaceholder: 'Ingresa tu clave',
            loginBtn: 'Entrar a la Agenda',
            envHint: 'Usa la clave configurada en OWNER_PASSCODE.',
            closeLabel: 'Cerrar agenda',
            headerTitle: 'Agenda de Citas y Visitas',
            headerSub: `${biz.ownerName} · Sincronizado con Web y ${biz.assistantName} IA`,
            enableDesktopBtn: 'Alertas PC',
            desktopOnLabel: 'Alertas Activas',
            soundOn: 'Sonido activo',
            soundOff: 'Sonido silenciado',
            logoutBtn: 'Salir',
            kpiTotal: 'Citas Activas',
            kpiPending: 'Por Confirmar',
            kpiSarah: `Vía ${biz.assistantName} IA`,
            kpiUnread: 'Notificaciones',
            tabAgenda: 'Agenda de Citas',
            tabNotifs: 'Notificaciones',
            tabBlocks: 'Bloquear Horarios',
            filterAll: 'Todas',
            filterPending: 'Pendientes',
            filterConfirmed: 'Confirmadas',
            filterSarah: `${biz.assistantName} IA`,
            filterWeb: 'Calendario Web',
            emptyAgenda: `Aún no hay citas en esta vista. Cuando un cliente o ${biz.assistantName} agende una visita aparecerá aquí al instante.`,
            sourceSarah: `${biz.assistantName} IA`,
            sourceWeb: 'Calendario Web',
            statusLabels: {
              pending: 'Pendiente',
              confirmed: 'Confirmada',
              completed: 'Completada',
              cancelled: 'Cancelada',
            } as Record<AppointmentStatus, string>,
            confirmAction: 'Confirmar',
            completeAction: 'Completar',
            cancelAction: 'Cancelar',
            deleteAction: 'Eliminar',
            icsAction: 'Calendario (.ics)',
            smsClientAction: 'SMS al Cliente',
            emailClientAction: 'Email al Cliente',
            markAllRead: 'Marcar todas como leídas',
            noNotifs: 'No hay notificaciones registradas todavía.',
            blocksTitle: 'Bloqueo Manual de Fechas y Horarios',
            blocksSub: `Bloquea días completos o ventanas individuales cuando no puedas visitar propiedades. Ni la web ni ${biz.assistantName} podrán agendar en horarios bloqueados.`,
            toggleFullDay: 'Bloquear / Desbloquear Día Completo',
            dayIsBlocked: 'Día Completo Bloqueado',
            dayIsOpen: 'Día Abierto',
            slotBlocked: 'Bloqueado',
            slotOpen: 'Disponible',
            liveBannerPrefix: 'Nueva Cita Recibida:',
          }
        : {
            setupTitle: 'Owner Agenda Initial Setup',
            setupSub:
              'Create your private owner passcode once. It is hashed and stored securely on the backend.',
            createPassLabel: 'Create Passcode (min 4 chars)',
            confirmPassLabel: 'Confirm Passcode',
            createPassBtn: 'Save Passcode & Unlock',
            mismatchErr: 'Passcodes must match and be at least 4 characters.',
            loginTitle: 'Owner Calendar & Agenda',
            loginSub: `Private dispatch portal for ${biz.ownerName} (${biz.shortName})`,
            passLabel: 'Owner Passcode',
            passPlaceholder: 'Enter passcode',
            loginBtn: 'Unlock Agenda',
            envHint: 'Enter your configured OWNER_PASSCODE.',
            closeLabel: 'Close owner agenda',
            headerTitle: 'Owner Appointment Agenda',
            headerSub: `${biz.ownerName} · Synced with Web Calendar & ${biz.assistantName} AI`,
            enableDesktopBtn: 'Desktop Alerts',
            desktopOnLabel: 'Alerts Active',
            soundOn: 'Sound On',
            soundOff: 'Sound Muted',
            logoutBtn: 'Lock',
            kpiTotal: 'Active Visits',
            kpiPending: 'Pending Confirm',
            kpiSarah: `Booked by ${biz.assistantName}`,
            kpiUnread: 'Unread Alerts',
            tabAgenda: 'Appointments',
            tabNotifs: 'Notifications',
            tabBlocks: 'Block Time',
            filterAll: 'All',
            filterPending: 'Pending',
            filterConfirmed: 'Confirmed',
            filterSarah: `${biz.assistantName} AI`,
            filterWeb: 'Web Calendar',
            emptyAgenda: `No site visits in this filter yet. New bookings from the web calendar or ${biz.assistantName} AI appear here instantly.`,
            sourceSarah: `${biz.assistantName} AI`,
            sourceWeb: 'Web Calendar',
            statusLabels: {
              pending: 'Pending',
              confirmed: 'Confirmed',
              completed: 'Completed',
              cancelled: 'Cancelled',
            } as Record<AppointmentStatus, string>,
            confirmAction: 'Confirm',
            completeAction: 'Complete',
            cancelAction: 'Cancel',
            deleteAction: 'Delete',
            icsAction: 'Save .ics',
            smsClientAction: 'Text Client',
            emailClientAction: 'Email Client',
            markAllRead: 'Mark all read',
            noNotifs: 'No notifications yet.',
            blocksTitle: 'Manage Unavailable Dates & Time Windows',
            blocksSub: `Block full days or individual arrival windows whenever your crew is out. Both the Web Calendar and ${biz.assistantName} AI respect blocks immediately.`,
            toggleFullDay: 'Block / Unblock Entire Day',
            dayIsBlocked: 'Full Day Blocked',
            dayIsOpen: 'Day Open',
            slotBlocked: 'Blocked',
            slotOpen: 'Open',
            liveBannerPrefix: 'New Booking Alert:',
          },
    [language, biz]
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const loadAuthStatus = useCallback(async () => {
    if (isStaticPagesHost()) {
      setAuthStatus(getStaticOwnerAuthStatus());
      return;
    }
    try {
      const res = await fetch('/api/owner/auth-status');
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        setAuthStatus(getStaticOwnerAuthStatus());
        return;
      }
      const data = (await res.json()) as { configuredViaEnv: boolean; claimed: boolean };
      setAuthStatus(data);
    } catch {
      setAuthStatus(getStaticOwnerAuthStatus());
    }
  }, []);

  const fetchDashboard = useCallback(async (authToken: string) => {
    if (isStaticPagesHost() || authToken === 'static-owner-session') {
      const data = getStaticOwnerDashboard();
      setDashboard(data);
      setSelectedManageDate((prev) => prev || data.todayIso);
      return;
    }
    try {
      const res = await fetch('/api/owner/dashboard', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.status === 401) {
        setToken(null);
        setDashboard(null);
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as DashboardPayload;
      setDashboard(data);
      setSelectedManageDate((prev) => prev || data.todayIso);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (!token) {
      void loadAuthStatus();
    } else {
      void fetchDashboard(token);
    }
  }, [isOpen, token, loadAuthStatus, fetchDashboard]);

  useEffect(() => {
    if (!isOpen || !token) return;

    if (isStaticPagesHost() || token === 'static-owner-session') {
      const onUpdated = () => {
        const next = getStaticOwnerDashboard();
        setDashboard(next);
        const latest = next.notifications[0];
        if (latest && !latest.read) {
          setLiveToast(latest);
          if (soundEnabled) playNotificationChime();
        }
      };
      window.addEventListener('clearview:calendar-updated', onUpdated);
      window.addEventListener('storage', onUpdated);
      return () => {
        window.removeEventListener('clearview:calendar-updated', onUpdated);
        window.removeEventListener('storage', onUpdated);
      };
    }

    const controller = new AbortController();

    const startStream = async () => {
      try {
        const res = await fetch('/api/owner/events', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() ?? '';

          for (const chunk of chunks) {
            const line = chunk.split('\n').find((l) => l.startsWith('data: '));
            if (!line) continue;
            try {
              const evt = JSON.parse(line.slice(6)) as {
                event?: string;
                payload?: { notification?: OwnerNotification };
              };

              if (evt.event === 'new_appointment') {
                void fetchDashboard(token);
                const notif = evt.payload?.notification;
                if (notif) {
                  setLiveToast(notif);
                  if (soundEnabled) playNotificationChime();
                  if (desktopNotifStatus === 'granted') {
                    void triggerBrowserNotification(
                      language === 'es' ? notif.titleEs : notif.titleEn,
                      language === 'es' ? notif.messageEs : notif.messageEn,
                      biz.logoUrl || undefined
                    );
                  }
                }
              } else if (evt.event === 'calendar_updated') {
                void fetchDashboard(token);
              }
            } catch {
              // ignore heartbeat/malformed line
            }
          }
        }
      } catch {
        // stream aborted on close/logout
      }
    };

    void startStream();
    return () => controller.abort();
  }, [isOpen, token, fetchDashboard, soundEnabled, desktopNotifStatus, language, biz.logoUrl]);

  if (!isOpen) return null;

  const needsInitialClaim =
    authStatus !== null && !authStatus.configuredViaEnv && !authStatus.claimed;

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (needsInitialClaim) {
      if (passcodeInput.trim().length < 4 || passcodeInput !== confirmPasscodeInput) {
        setAuthError(copy.mismatchErr);
        return;
      }
    } else if (!passcodeInput.trim()) {
      setAuthError(copy.passPlaceholder);
      return;
    }

    setAuthBusy(true);
    try {
      if (isStaticPagesHost()) {
        const result = needsInitialClaim
          ? claimStaticOwnerPasscode(passcodeInput)
          : verifyStaticOwnerPasscode(passcodeInput);
        if (!result.ok) {
          setAuthError(result.error);
          return;
        }
        setToken(result.token);
        setPasscodeInput('');
        setConfirmPasscodeInput('');
        return;
      }

      const endpoint = needsInitialClaim ? '/api/owner/claim' : '/api/owner/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcodeInput }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const result = needsInitialClaim
          ? claimStaticOwnerPasscode(passcodeInput)
          : verifyStaticOwnerPasscode(passcodeInput);
        if (!result.ok) {
          setAuthError(result.error);
          return;
        }
        setToken(result.token);
        setPasscodeInput('');
        setConfirmPasscodeInput('');
        return;
      }
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        setAuthError(data.error || 'Authentication failed.');
        return;
      }
      setToken(data.token);
      setPasscodeInput('');
      setConfirmPasscodeInput('');
    } catch {
      setAuthError('Unable to reach server.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleStatusChange = async (id: string, status: AppointmentStatus) => {
    if (!token) return;
    if (isStaticPagesHost() || token === 'static-owner-session') {
      updateStaticAppointmentStatus(id, status);
      void fetchDashboard(token);
      return;
    }
    await fetch(`/api/owner/appointments/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });
    window.dispatchEvent(new CustomEvent('clearview:calendar-updated'));
    void fetchDashboard(token);
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    if (isStaticPagesHost() || token === 'static-owner-session') {
      deleteStaticAppointment(id);
      void fetchDashboard(token);
      return;
    }
    await fetch(`/api/owner/appointments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    window.dispatchEvent(new CustomEvent('clearview:calendar-updated'));
    void fetchDashboard(token);
  };

  const handleToggleDayBlock = async (date: string) => {
    if (!token) return;
    if (isStaticPagesHost() || token === 'static-owner-session') {
      toggleStaticBlockedDate(date);
      void fetchDashboard(token);
      return;
    }
    await fetch('/api/owner/blocks/date', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ date }),
    });
    window.dispatchEvent(new CustomEvent('clearview:calendar-updated'));
    void fetchDashboard(token);
  };

  const handleToggleSlotBlock = async (date: string, timeSlot: string) => {
    if (!token) return;
    if (isStaticPagesHost() || token === 'static-owner-session') {
      toggleStaticBlockedSlot(date, timeSlot);
      void fetchDashboard(token);
      return;
    }
    await fetch('/api/owner/blocks/slot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ date, timeSlot }),
    });
    window.dispatchEvent(new CustomEvent('clearview:calendar-updated'));
    void fetchDashboard(token);
  };

  const handleMarkAllRead = async () => {
    if (!token) return;
    if (isStaticPagesHost() || token === 'static-owner-session') {
      markStaticNotificationsRead();
      setLiveToast(null);
      void fetchDashboard(token);
      return;
    }
    await fetch('/api/owner/notifications/read', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    setLiveToast(null);
    void fetchDashboard(token);
  };

  const handleEnableDesktopAlerts = async () => {
    const res = await triggerBrowserNotification(
      `${biz.shortName}`,
      language === 'es'
        ? 'Las alertas de escritorio para nuevas citas están activas.'
        : 'Desktop alerts for new appointments are now enabled.',
      biz.logoUrl || undefined
    );
    if (res === 'granted') setDesktopNotifStatus('granted');
    else if (res === 'denied') setDesktopNotifStatus('denied');
  };

  const activeAppointments = (dashboard?.appointments ?? []).filter(
    (a) => a.status !== 'cancelled'
  );
  const filteredAppointments = (dashboard?.appointments ?? []).filter((apt) => {
    if (filterMode === 'pending') return apt.status === 'pending';
    if (filterMode === 'confirmed') return apt.status === 'confirmed';
    if (filterMode === 'sarah') return apt.source === 'sarah';
    if (filterMode === 'web') return apt.source === 'web';
    return true;
  });

  const manageableDates = (() => {
    if (!dashboard?.todayIso) return [];
    const list: string[] = [];
    const [y, m, d] = dashboard.todayIso.split('-').map(Number);
    for (let i = 0; i < 30 && list.length < 18; i++) {
      const dt = new Date(Date.UTC(y, m - 1, d + i));
      const day = dt.getUTCDay();
      if (day !== 0 && day !== 6) {
        list.push(dt.toISOString().slice(0, 10));
      }
    }
    return list;
  })();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="owner-dashboard-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      {!token ? (
        <div
          className="max-w-sm w-full bg-[var(--cv-dark-card)] border border-white/15 rounded-xl p-6 sm:p-7 text-white shadow-2xl space-y-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--cv-primary)]/25 text-[var(--cv-light-green)] flex items-center justify-center shrink-0">
                {needsInitialClaim ? (
                  <KeyRound className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <Lock className="w-5 h-5" aria-hidden="true" />
                )}
              </div>
              <div>
                <h2
                  id="owner-dashboard-title"
                  className="font-display text-2xl font-bold leading-none"
                >
                  {needsInitialClaim ? copy.setupTitle : copy.loginTitle}
                </h2>
                <p className="text-xs text-neutral-400 mt-1">
                  {needsInitialClaim ? copy.setupSub : copy.loginSub}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={copy.closeLabel}
              className="text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="owner-passcode"
                className="block text-xs font-semibold text-neutral-200 mb-1.5"
              >
                {needsInitialClaim ? copy.createPassLabel : copy.passLabel}
              </label>
              <input
                id="owner-passcode"
                type="password"
                autoFocus
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                placeholder={copy.passPlaceholder}
                className="w-full bg-[var(--cv-dark-surface)] border border-white/20 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500"
              />
            </div>

            {needsInitialClaim && (
              <div>
                <label
                  htmlFor="owner-passcode-confirm"
                  className="block text-xs font-semibold text-neutral-200 mb-1.5"
                >
                  {copy.confirmPassLabel}
                </label>
                <input
                  id="owner-passcode-confirm"
                  type="password"
                  value={confirmPasscodeInput}
                  onChange={(e) => setConfirmPasscodeInput(e.target.value)}
                  placeholder={copy.passPlaceholder}
                  className="w-full bg-[var(--cv-dark-surface)] border border-white/20 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500"
                />
              </div>
            )}

            {authStatus?.configuredViaEnv && (
              <p className="text-[11px] text-neutral-400 font-mono">{copy.envHint}</p>
            )}

            {authError && (
              <p role="alert" className="text-xs text-[var(--cv-accent)] font-medium">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authBusy}
              className="w-full inline-flex items-center justify-center gap-2 bg-[var(--cv-primary)] hover:bg-[var(--cv-primary-dark)] disabled:opacity-50 text-white font-semibold text-sm py-3 px-4 rounded-md transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              <span>{needsInitialClaim ? copy.createPassBtn : copy.loginBtn}</span>
            </button>
          </form>
        </div>
      ) : (
        <div
          className="max-w-6xl w-full max-h-[92vh] bg-[var(--cv-dark-surface)] border border-white/15 rounded-xl overflow-hidden flex flex-col shadow-2xl text-white"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Bar */}
          <header className="px-4 sm:px-6 py-3.5 bg-[var(--cv-dark-card)] border-b border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-[var(--cv-primary)] text-[var(--cv-accent)] flex items-center justify-center shrink-0">
                <CalendarDays className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2
                  id="owner-dashboard-title"
                  className="font-display text-xl sm:text-2xl font-bold leading-none truncate"
                >
                  {copy.headerTitle}
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5 truncate">{copy.headerSub}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void handleEnableDesktopAlerts()}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-2 rounded-md border transition-colors cursor-pointer ${
                  desktopNotifStatus === 'granted'
                    ? 'bg-[var(--cv-primary)]/25 border-[var(--cv-light-green)]/50 text-[var(--cv-light-green)]'
                    : 'bg-[var(--cv-dark-surface)] border-white/15 hover:border-[var(--cv-accent)] text-neutral-200'
                }`}
              >
                <BellRing className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">
                  {desktopNotifStatus === 'granted' ? copy.desktopOnLabel : copy.enableDesktopBtn}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSoundEnabled((prev) => !prev)}
                title={soundEnabled ? copy.soundOn : copy.soundOff}
                aria-label={soundEnabled ? copy.soundOn : copy.soundOff}
                className="w-9 h-9 rounded-md border border-white/15 flex items-center justify-center text-neutral-300 hover:text-white cursor-pointer"
              >
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-[var(--cv-accent)]" />
                ) : (
                  <VolumeX className="w-4 h-4 text-neutral-500" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setToken(null);
                  setDashboard(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-300 hover:text-white border border-white/15 px-3 py-2 rounded-md transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{copy.logoutBtn}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label={copy.closeLabel}
                className="w-9 h-9 rounded-md border border-white/15 text-neutral-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {liveToast && (
            <div className="bg-[var(--cv-primary)] text-white px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 text-xs sm:text-sm shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <BellRing className="w-4 h-4 text-[var(--cv-accent)] shrink-0" aria-hidden="true" />
                <p className="truncate">
                  <strong className="text-[var(--cv-accent)]">{copy.liveBannerPrefix}</strong>{' '}
                  {language === 'es' ? liveToast.messageEs : liveToast.messageEn}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLiveToast(null)}
                className="text-xs font-semibold underline shrink-0 cursor-pointer"
              >
                OK
              </button>
            </div>
          )}

          {/* KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-white/10 bg-[var(--cv-dark-surface)] border-b border-white/10 shrink-0">
            <div className="p-3.5 sm:px-5">
              <p className="text-[11px] text-neutral-400">{copy.kpiTotal}</p>
              <p className="font-display text-2xl font-bold text-white tabular-nums mt-0.5">
                {activeAppointments.length}
              </p>
            </div>
            <div className="p-3.5 sm:px-5">
              <p className="text-[11px] text-neutral-400">{copy.kpiPending}</p>
              <p className="font-display text-2xl font-bold text-[var(--cv-accent)] tabular-nums mt-0.5">
                {activeAppointments.filter((a) => a.status === 'pending').length}
              </p>
            </div>
            <div className="p-3.5 sm:px-5">
              <p className="text-[11px] text-neutral-400">{copy.kpiSarah}</p>
              <p className="font-display text-2xl font-bold text-[var(--cv-light-green)] tabular-nums mt-0.5">
                {activeAppointments.filter((a) => a.source === 'sarah').length}
              </p>
            </div>
            <div className="p-3.5 sm:px-5">
              <p className="text-[11px] text-neutral-400">{copy.kpiUnread}</p>
              <p className="font-display text-2xl font-bold text-white tabular-nums mt-0.5">
                {dashboard?.unreadCount ?? 0}
              </p>
            </div>
          </div>

          {/* Primary Tabs */}
          <div className="flex items-center border-b border-white/10 bg-[var(--cv-dark-card)] px-4 sm:px-6 gap-4 shrink-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('agenda')}
              className={`py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'agenda'
                  ? 'border-[var(--cv-accent)] text-[var(--cv-accent)]'
                  : 'border-transparent text-neutral-400 hover:text-white'
              }`}
            >
              {copy.tabAgenda}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('notifications')}
              className={`py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap inline-flex items-center gap-2 cursor-pointer ${
                activeTab === 'notifications'
                  ? 'border-[var(--cv-accent)] text-[var(--cv-accent)]'
                  : 'border-transparent text-neutral-400 hover:text-white'
              }`}
            >
              <span>{copy.tabNotifs}</span>
              {(dashboard?.unreadCount ?? 0) > 0 && (
                <span className="bg-[var(--cv-primary)] text-[var(--cv-accent)] text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums">
                  {dashboard?.unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('availability')}
              className={`py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'availability'
                  ? 'border-[var(--cv-accent)] text-[var(--cv-accent)]'
                  : 'border-transparent text-neutral-400 hover:text-white'
              }`}
            >
              {copy.tabBlocks}
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[var(--cv-dark-surface)]">
            {activeTab === 'agenda' && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: 'all', label: copy.filterAll },
                      { id: 'pending', label: copy.filterPending },
                      { id: 'confirmed', label: copy.filterConfirmed },
                      { id: 'sarah', label: copy.filterSarah },
                      { id: 'web', label: copy.filterWeb },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilterMode(f.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        filterMode === f.id
                          ? 'bg-[var(--cv-primary)] text-white'
                          : 'bg-[var(--cv-dark-card)] text-neutral-300 hover:text-white border border-white/10'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {filteredAppointments.length === 0 ? (
                  <div className="bg-[var(--cv-dark-card)] border border-white/10 rounded-xl p-8 text-center text-sm text-neutral-400">
                    {copy.emptyAgenda}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredAppointments.map((apt) => (
                      <div
                        key={apt.id}
                        className="bg-[var(--cv-dark-card)] border border-white/10 rounded-xl p-4 sm:p-5 space-y-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-[var(--cv-accent)]">
                                {apt.id}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded ${
                                  apt.source === 'sarah'
                                    ? 'bg-[var(--cv-primary)]/30 text-[var(--cv-light-green)]'
                                    : 'bg-white/10 text-neutral-200'
                                }`}
                              >
                                {apt.source === 'sarah' ? (
                                  <Bot className="w-3 h-3" aria-hidden="true" />
                                ) : (
                                  <Globe className="w-3 h-3" aria-hidden="true" />
                                )}
                                <span>
                                  {apt.source === 'sarah' ? copy.sourceSarah : copy.sourceWeb}
                                </span>
                              </span>
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                                  apt.status === 'confirmed'
                                    ? 'bg-[var(--cv-primary)] text-white'
                                    : apt.status === 'completed'
                                    ? 'bg-neutral-700 text-neutral-200'
                                    : apt.status === 'cancelled'
                                    ? 'bg-red-950/80 text-red-200'
                                    : 'bg-[var(--cv-accent)] text-[var(--cv-dark-surface)]'
                                }`}
                              >
                                {copy.statusLabels[apt.status]}
                              </span>
                            </div>

                            <h3 className="font-display text-xl font-bold text-white">
                              {apt.clientName}
                            </h3>
                          </div>

                          <div className="text-left sm:text-right">
                            <p className="text-sm font-semibold text-white">
                              {formatDateHuman(apt.date, language)}
                            </p>
                            <p className="text-xs font-mono text-[var(--cv-accent)] tabular-nums flex items-center sm:justify-end gap-1 mt-0.5">
                              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>{apt.timeSlotLabel}</span>
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-neutral-300 pt-2 border-t border-white/10">
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-[var(--cv-light-green)] shrink-0" />
                            <a
                              href={`tel:${apt.clientPhone.replace(/[^\d+]/g, '')}`}
                              className="font-mono text-white hover:text-[var(--cv-accent)]"
                            >
                              {apt.clientPhone}
                            </a>
                            {apt.clientEmail && (
                              <span className="text-neutral-400 truncate">· {apt.clientEmail}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-[var(--cv-light-green)] shrink-0" />
                            <span>
                              {apt.propertyAddress} ({apt.lotSize})
                            </span>
                          </div>
                        </div>

                        {(apt.serviceType || apt.notes) && (
                          <p className="text-xs text-neutral-400">
                            <strong className="text-neutral-200">{apt.serviceType}</strong>
                            {apt.notes ? ` — ${apt.notes}` : ''}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                          <div className="flex flex-wrap gap-1.5">
                            {apt.status !== 'confirmed' && (
                              <button
                                type="button"
                                onClick={() => void handleStatusChange(apt.id, 'confirmed')}
                                className="inline-flex items-center gap-1 text-xs font-semibold bg-[var(--cv-primary)] hover:bg-[var(--cv-primary-dark)] text-white px-2.5 py-1.5 rounded cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{copy.confirmAction}</span>
                              </button>
                            )}
                            {apt.status !== 'completed' && (
                              <button
                                type="button"
                                onClick={() => void handleStatusChange(apt.id, 'completed')}
                                className="inline-flex items-center gap-1 text-xs font-medium bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded cursor-pointer"
                              >
                                <CheckCheck className="w-3.5 h-3.5 text-[var(--cv-light-green)]" />
                                <span>{copy.completeAction}</span>
                              </button>
                            )}
                            {apt.status !== 'cancelled' && (
                              <button
                                type="button"
                                onClick={() => void handleStatusChange(apt.id, 'cancelled')}
                                className="inline-flex items-center gap-1 text-xs font-medium bg-white/10 hover:bg-red-900/60 text-neutral-200 px-2.5 py-1.5 rounded cursor-pointer"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                <span>{copy.cancelAction}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleDelete(apt.id)}
                              aria-label={copy.deleteAction}
                              className="inline-flex items-center gap-1 text-xs font-medium bg-white/5 hover:bg-red-950 text-neutral-400 hover:text-red-200 px-2 py-1.5 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            <a
                              href={getIcsDownloadUrl(apt.id, apt, biz)}
                              download={`site-visit-${apt.id}.ics`}
                              className="inline-flex items-center gap-1 text-xs font-medium bg-[var(--cv-dark-surface)] hover:bg-white/10 border border-white/15 text-neutral-200 px-2.5 py-1.5 rounded"
                            >
                              <Download className="w-3.5 h-3.5 text-[var(--cv-accent)]" />
                              <span>{copy.icsAction}</span>
                            </a>
                            <a
                              href={buildOwnerSmsClientHref(apt, language, biz)}
                              className="inline-flex items-center gap-1 text-xs font-medium bg-[var(--cv-dark-surface)] hover:bg-white/10 border border-white/15 text-neutral-200 px-2.5 py-1.5 rounded"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-[var(--cv-light-green)]" />
                              <span>{copy.smsClientAction}</span>
                            </a>
                            {apt.clientEmail && (
                              <a
                                href={buildClientReceiptMailto(apt, language, biz)}
                                className="inline-flex items-center gap-1 text-xs font-medium bg-[var(--cv-dark-surface)] hover:bg-white/10 border border-white/15 text-neutral-200 px-2.5 py-1.5 rounded"
                              >
                                <Mail className="w-3.5 h-3.5 text-[var(--cv-accent)]" />
                                <span>{copy.emailClientAction}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <Bell className="w-4 h-4 text-[var(--cv-accent)]" />
                    <span>
                      {dashboard?.notifications.length ?? 0} {copy.tabNotifs}
                    </span>
                  </div>
                  {(dashboard?.unreadCount ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleMarkAllRead()}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[var(--cv-primary)] hover:bg-[var(--cv-primary-dark)] text-white px-3 py-1.5 rounded-md cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>{copy.markAllRead}</span>
                    </button>
                  )}
                </div>

                {(dashboard?.notifications.length ?? 0) === 0 ? (
                  <div className="bg-[var(--cv-dark-card)] border border-white/10 rounded-xl p-8 text-center text-sm text-neutral-400">
                    {copy.noNotifs}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {dashboard?.notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`rounded-xl border p-4 flex items-start justify-between gap-3 ${
                          n.read
                            ? 'bg-[var(--cv-dark-card)] border-white/10 text-neutral-300'
                            : 'bg-[var(--cv-primary)]/20 border-[var(--cv-light-green)]/50 text-white'
                        }`}
                      >
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-[var(--cv-accent)]">
                            {language === 'es' ? n.titleEs : n.titleEn}
                          </p>
                          <p className="text-xs sm:text-sm">
                            {language === 'es' ? n.messageEs : n.messageEn}
                          </p>
                          <p className="text-[11px] font-mono text-neutral-400">
                            {new Date(n.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'availability' && dashboard && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="font-display text-2xl font-bold text-white">{copy.blocksTitle}</h3>
                  <p className="text-xs sm:text-sm text-neutral-400">{copy.blocksSub}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {manageableDates.map((dIso) => {
                    const isSelected = selectedManageDate === dIso;
                    const isBlocked = dashboard.blockedDates.includes(dIso);
                    return (
                      <button
                        key={dIso}
                        type="button"
                        onClick={() => setSelectedManageDate(dIso)}
                        className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--cv-primary)] border-[var(--cv-accent)] text-white'
                            : isBlocked
                            ? 'bg-red-950/60 border-red-400/40 text-red-200'
                            : 'bg-[var(--cv-dark-card)] border-white/10 hover:border-white/30 text-neutral-200'
                        }`}
                      >
                        <p className="text-xs font-bold">{formatDateHuman(dIso, language)}</p>
                        <p className="text-[10px] mt-1 opacity-85">
                          {isBlocked ? copy.dayIsBlocked : copy.dayIsOpen}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {selectedManageDate && (
                  <div className="bg-[var(--cv-dark-card)] border border-white/10 rounded-xl p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-display text-xl font-bold text-white">
                        {formatDateHuman(selectedManageDate, language)}
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleToggleDayBlock(selectedManageDate)}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-md cursor-pointer ${
                          dashboard.blockedDates.includes(selectedManageDate)
                            ? 'bg-[var(--cv-primary)] text-white'
                            : 'bg-red-900/70 hover:bg-red-800 text-white'
                        }`}
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>{copy.toggleFullDay}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {dashboard.slots.map((slot) => {
                        const dayBlocks = dashboard.blockedSlots[selectedManageDate] ?? [];
                        const isBlocked =
                          dashboard.blockedDates.includes(selectedManageDate) ||
                          dayBlocks.includes(slot.id);
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            disabled={dashboard.blockedDates.includes(selectedManageDate)}
                            onClick={() =>
                              void handleToggleSlotBlock(selectedManageDate, slot.id)
                            }
                            className={`px-3.5 py-2.5 rounded-lg border flex items-center justify-between text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 ${
                              isBlocked
                                ? 'bg-red-950/60 border-red-400/40 text-red-200'
                                : 'bg-[var(--cv-dark-surface)] border-white/15 hover:border-[var(--cv-light-green)] text-white'
                            }`}
                          >
                            <span className="font-mono">
                              {language === 'es' ? slot.labelEs : slot.labelEn}
                            </span>
                            <span>{isBlocked ? copy.slotBlocked : copy.slotOpen}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
