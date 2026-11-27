import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BadgeDollarSign,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  KeyRound,
  Layers,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Palette,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import { useCms } from '../context/CmsContext';
import { useLanguage } from '../context/LanguageContext';
import { defaultSiteCms } from '../data/defaultCms';
import type {
  CmsAddonIcon,
  CmsAddonOption,
  CmsDensityIcon,
  CmsDensityOption,
  CmsFaqItem,
  CmsGoogleReview,
  CmsLotSizeOption,
  CmsServiceIcon,
  CmsServiceItem,
  CmsWorkPhoto,
  SiteCmsData,
} from '../types/cms';

interface AdminCmsDashboardProps {
  onNavigatePublic: () => void;
}

interface UploadedMediaAsset {
  filename: string;
  url: string;
  sizeBytes: number;
  createdAt: string;
}

type AdminTab =
  | 'overview'
  | 'brand'
  | 'pricing'
  | 'copy'
  | 'services'
  | 'media'
  | 'social'
  | 'template';

function moveArrayItem<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(index, 1);
  copy.splice(target, 0, item);
  return copy;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Invalid file payload'));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function AdminCmsDashboard({ onNavigatePublic }: AdminCmsDashboardProps) {
  const { cms, setCmsLocal } = useCms();
  const { language, setLanguage } = useLanguage();

  // Bearer token kept strictly in React memory
  const [token, setToken] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<{
    configuredViaEnv: boolean;
    claimed: boolean;
  } | null>(null);
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  // Admin workspace state
  const [draft, setDraft] = useState<SiteCmsData>(() => structuredClone(cms));
  const [media, setMedia] = useState<UploadedMediaAsset[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);
  const [statusToast, setStatusToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const importJsonRef = useRef<HTMLInputElement | null>(null);

  const es = language === 'es';

  const notify = useCallback((type: 'ok' | 'err', text: string) => {
    setStatusToast({ type, text });
  }, []);

  useEffect(() => {
    if (!statusToast) return;
    const timer = setTimeout(() => setStatusToast(null), 5000);
    return () => clearTimeout(timer);
  }, [statusToast]);

  const loadAuthStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/auth-status', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { configuredViaEnv: boolean; claimed: boolean };
      setAuthStatus(data);
    } catch {
      // ignore transient error
    }
  }, []);

  const fetchAdminCms = useCallback(
    async (authToken: string) => {
      try {
        const res = await fetch('/api/admin/cms', {
          headers: { Authorization: `Bearer ${authToken}` },
          cache: 'no-store',
        });
        if (res.status === 401) {
          setToken(null);
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as {
          cms: SiteCmsData;
          media: UploadedMediaAsset[];
        };
        if (data.cms) {
          setDraft(structuredClone(data.cms));
          setDirty(false);
        }
        if (Array.isArray(data.media)) {
          setMedia(data.media);
        }
      } catch {
        notify('err', es ? 'Error al cargar CMS del servidor.' : 'Failed to load CMS from server.');
      }
    },
    [es, notify]
  );

  useEffect(() => {
    if (!token) {
      void loadAuthStatus();
    } else {
      void fetchAdminCms(token);
    }
  }, [token, loadAuthStatus, fetchAdminCms]);

  const updateDraft = useCallback((updater: (prev: SiteCmsData) => SiteCmsData) => {
    setDraft((prev) => updater(prev));
    setDirty(true);
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const needsClaim =
      authStatus !== null && !authStatus.configuredViaEnv && !authStatus.claimed;

    if (needsClaim) {
      if (passcode.trim().length < 6 || passcode !== confirmPasscode) {
        setAuthError(
          es
            ? 'La clave de administrador debe tener al menos 6 caracteres y coincidir.'
            : 'Admin passcode must be at least 6 characters and match.'
        );
        return;
      }
    } else if (!passcode.trim()) {
      setAuthError(es ? 'Ingresa tu clave de administrador.' : 'Enter your admin passcode.');
      return;
    }

    setAuthBusy(true);
    try {
      const endpoint = needsClaim ? '/api/admin/claim' : '/api/admin/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        setAuthError(data.error || 'Authentication failed.');
        return;
      }
      setToken(data.token);
      setPasscode('');
      setConfirmPasscode('');
    } catch {
      setAuthError(es ? 'No se pudo conectar con el servidor.' : 'Unable to reach server.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSaveCms = async (payloadToSave?: SiteCmsData) => {
    if (!token) return;
    const target = payloadToSave ?? draft;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/cms', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cms: target }),
      });
      const data = (await res.json()) as { cms?: SiteCmsData; error?: string };
      if (!res.ok || !data.cms) {
        notify('err', data.error || (es ? 'Error al guardar.' : 'Save failed.'));
        return;
      }
      setDraft(structuredClone(data.cms));
      setCmsLocal(data.cms);
      window.dispatchEvent(new CustomEvent('clearview:cms-updated'));
      setDirty(false);
      notify(
        'ok',
        es ? 'Cambios guardados y publicados en la web.' : 'Changes saved and published live.'
      );
    } catch {
      notify('err', es ? 'Error de red al guardar.' : 'Network error saving changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadImageFile = async (
    file: File,
    targetKey: string,
    onUrlReady: (url: string) => void
  ) => {
    if (!token) return;
    if (file.size > 5 * 1024 * 1024) {
      notify('err', es ? 'Imagen demasiado grande (máx. 5 MB).' : 'Image exceeds 5 MB limit.');
      return;
    }

    setUploadingTarget(targetKey);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dataUrl }),
      });
      const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !data.url) {
        notify('err', data.error || (es ? 'Error al subir imagen.' : 'Upload failed.'));
        return;
      }
      onUrlReady(data.url);
      // Refresh media library
      const mediaRes = await fetch('/api/admin/media', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (mediaRes.ok) {
        const mJson = (await mediaRes.json()) as { media?: UploadedMediaAsset[] };
        if (mJson.media) setMedia(mJson.media);
      }
      notify(
        'ok',
        es
          ? 'Imagen subida. Haz clic en "Guardar y Publicar" para aplicarla en el sitio.'
          : 'Image uploaded. Click "Save & Publish" to apply it live.'
      );
    } catch {
      notify('err', es ? 'No se pudo subir el archivo.' : 'Failed to upload image file.');
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleDeleteMediaAsset = async (filename: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/media/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setMedia((prev) => prev.filter((item) => item.filename !== filename));
        notify('ok', es ? 'Archivo eliminado.' : 'Media file deleted.');
      }
    } catch {
      notify('err', es ? 'No se pudo eliminar.' : 'Delete failed.');
    }
  };

  const handleApplyPreset = async (preset: 'starter-template' | 'clearview-default') => {
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/template/preset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ preset }),
      });
      const data = (await res.json()) as { cms?: SiteCmsData; error?: string };
      if (!res.ok || !data.cms) {
        notify('err', data.error || 'Preset error.');
        return;
      }
      setDraft(structuredClone(data.cms));
      setCmsLocal(data.cms);
      window.dispatchEvent(new CustomEvent('clearview:cms-updated'));
      setDirty(false);
      notify(
        'ok',
        preset === 'starter-template'
          ? es
            ? 'Plantilla base cargada para nuevo negocio.'
            : 'New business starter template loaded.'
          : es
          ? 'Configuración de Madison Land Clearing restaurada.'
          : 'Madison Land Clearing default configuration restored.'
      );
    } catch {
      notify('err', 'Network error.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportBlueprint = () => {
    const slug = (draft.business.shortName || 'forestry-template')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${slug || 'cms'}-blueprint.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBlueprint = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText) as Partial<SiteCmsData>;
      if (!parsed || typeof parsed !== 'object' || !parsed.business || !parsed.pricing) {
        notify(
          'err',
          es
            ? 'Archivo JSON inválido: falta la estructura de negocio/precios.'
            : 'Invalid JSON blueprint: missing business or pricing config.'
        );
        return;
      }
      await handleSaveCms(parsed as SiteCmsData);
    } catch {
      notify('err', es ? 'No se pudo leer el archivo JSON.' : 'Failed to parse JSON file.');
    }
  };

  const needsInitialClaim =
    authStatus !== null && !authStatus.configuredViaEnv && !authStatus.claimed;

  // =========================================================
  // UNAUTHENTICATED LOGIN / FIRST-RUN SETUP SCREEN
  // =========================================================
  if (!token) {
    return (
      <div className="min-h-screen bg-[#141815] text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#1C211D] border border-white/15 rounded-xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-[var(--cv-primary)] text-[var(--cv-accent)] flex items-center justify-center shrink-0">
                {needsInitialClaim ? (
                  <KeyRound className="w-5 h-5" />
                ) : (
                  <Lock className="w-5 h-5" />
                )}
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold leading-none">
                  {needsInitialClaim
                    ? es
                      ? 'Configurar Clave de Admin CMS'
                      : 'Setup CMS Admin Passcode'
                    : es
                    ? 'Panel Administrativo CMS'
                    : 'CMS Admin Portal'}
                </h1>
                <p className="text-xs text-neutral-400 mt-1">
                  {cms.business.shortName} · /admin
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
              className="text-xs font-semibold px-2.5 py-1 rounded border border-white/15 text-neutral-200 hover:text-[var(--cv-accent)] cursor-pointer"
            >
              {language.toUpperCase()}
            </button>
          </div>

          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
            {needsInitialClaim
              ? es
                ? 'Crea tu clave maestra de administrador por única vez (mínimo 6 caracteres) para controlar precios, textos, imágenes y plantillas.'
                : 'Create your private Admin CMS passcode once (min 6 characters) to manage pricing, texts, images, and white-label templates.'
              : es
              ? 'Ingresa la clave de administrador para editar precios, textos, fotos, colores y exportar plantillas.'
              : 'Enter the admin passcode to edit pricing, copy, images, brand colors, and templates.'}
          </p>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="admin-passcode"
                className="block text-xs font-semibold text-neutral-200 mb-1.5"
              >
                {needsInitialClaim
                  ? es
                    ? 'Nueva Clave Admin (mín. 6 caracteres)'
                    : 'New Admin Passcode (min 6 chars)'
                  : es
                  ? 'Clave de Administrador'
                  : 'Admin Passcode'}
              </label>
              <input
                id="admin-passcode"
                type="password"
                autoFocus
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#141815] border border-white/20 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-600"
              />
            </div>

            {needsInitialClaim && (
              <div>
                <label
                  htmlFor="admin-passcode-confirm"
                  className="block text-xs font-semibold text-neutral-200 mb-1.5"
                >
                  {es ? 'Confirmar Clave Admin' : 'Confirm Admin Passcode'}
                </label>
                <input
                  id="admin-passcode-confirm"
                  type="password"
                  value={confirmPasscode}
                  onChange={(e) => setConfirmPasscode(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#141815] border border-white/20 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-600"
                />
              </div>
            )}

            {authStatus?.configuredViaEnv && (
              <p className="text-[11px] font-mono text-neutral-400">
                {es
                  ? 'Autenticación vinculada a ADMIN_PASSCODE del servidor.'
                  : 'Secured via ADMIN_PASSCODE environment secret.'}
              </p>
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
              <ShieldCheck className="w-4 h-4" />
              <span>
                {needsInitialClaim
                  ? es
                    ? 'Guardar Clave y Entrar al CMS'
                    : 'Claim Passcode & Enter CMS'
                  : es
                  ? 'Entrar al Panel CMS'
                  : 'Sign In to CMS'}
              </span>
            </button>
          </form>

          <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-neutral-400">
            <button
              type="button"
              onClick={onNavigatePublic}
              className="inline-flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{es ? 'Volver a la web pública' : 'Back to public site'}</span>
            </button>
            <span className="font-mono">/admin</span>
          </div>
        </div>
      </div>
    );
  }

  const navItems: {
    id: AdminTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'overview', label: es ? 'Resumen' : 'Overview', icon: LayoutDashboard },
    { id: 'brand', label: es ? 'Marca y Colores' : 'Brand & Colors', icon: Palette },
    { id: 'pricing', label: es ? 'Precios y Lotes' : 'Pricing & Estimator', icon: BadgeDollarSign },
    { id: 'copy', label: es ? 'Textos y Asistente' : 'Texts & AI Agent', icon: FileText },
    { id: 'services', label: es ? 'Servicios' : 'Services', icon: Wrench },
    { id: 'media', label: es ? 'Galería y Media' : 'Gallery & Media', icon: ImageIcon },
    { id: 'social', label: es ? 'Reseñas y FAQ' : 'Reviews & FAQ', icon: Star },
    { id: 'template', label: es ? 'Plantilla White-Label' : 'Multi-Business Template', icon: Layers },
  ];

  const activeNavLabel = navItems.find((n) => n.id === activeTab)?.label ?? 'CMS';

  // =========================================================
  // AUTHENTICATED WORDPRESS-STYLE CMS DASHBOARD
  // =========================================================
  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#141815] flex flex-col lg:flex-row">
      {/* Sidebar (Desktop) */}
      <aside className="hidden lg:flex lg:w-64 bg-[#141815] text-white flex-col shrink-0 border-r border-white/10">
        <div className="h-16 px-5 border-b border-white/10 flex items-center gap-3">
          {draft.business.logoUrl ? (
            <img
              src={draft.business.logoUrl}
              alt={draft.business.shortName}
              className="w-8 h-8 rounded object-cover border border-white/20 shrink-0"
            />
          ) : (
            <span className="w-8 h-8 rounded bg-[var(--cv-primary)] text-white font-display font-bold flex items-center justify-center shrink-0">
              {draft.business.brandMonogram}
            </span>
          )}
          <div className="min-w-0">
            <p className="font-display text-lg font-bold leading-none truncate">
              {draft.business.shortName}
            </p>
            <p className="text-[11px] font-mono text-neutral-400 mt-0.5">/admin · CMS</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-xs font-semibold transition-colors cursor-pointer text-left ${
                  isActive
                    ? 'bg-[var(--cv-primary)] text-white'
                    : 'text-neutral-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-2">
          <button
            type="button"
            onClick={onNavigatePublic}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-white/15 text-xs font-medium text-neutral-200 hover:text-white hover:border-white/30 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>{es ? 'Ver Sitio Público' : 'View Public Site'}</span>
          </button>

          <button
            type="button"
            onClick={() => setToken(null)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{es ? 'Cerrar Sesión Admin' : 'Lock Admin'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Top Bar */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-[#E5E7E4] px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label="Toggle CMS navigation"
              className="lg:hidden w-9 h-9 rounded-md border border-[#E5E7E4] flex items-center justify-center text-[#141815] cursor-pointer"
            >
              {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

            <div className="min-w-0">
              <p className="text-[11px] font-mono text-neutral-500 hidden sm:block">
                CMS / {activeNavLabel}
              </p>
              <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight truncate">
                {activeNavLabel}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {dirty && (
              <span className="hidden md:inline-block text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded">
                {es ? 'Cambios sin guardar' : 'Unsaved changes'}
              </span>
            )}

            <button
              type="button"
              onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
              className="px-2.5 py-1.5 text-xs font-semibold border border-[#E5E7E4] rounded-md hover:border-[#141815] cursor-pointer"
            >
              {language.toUpperCase()}
            </button>

            <button
              type="button"
              onClick={onNavigatePublic}
              className="lg:hidden inline-flex items-center gap-1.5 text-xs font-semibold border border-[#E5E7E4] px-2.5 py-2 rounded-md cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveCms()}
              className="inline-flex items-center gap-1.5 bg-[var(--cv-primary)] hover:bg-[var(--cv-primary-dark)] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold px-3.5 sm:px-4 py-2 rounded-md transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4 shrink-0" />
              <span>
                {saving
                  ? es
                    ? 'Guardando...'
                    : 'Saving...'
                  : es
                  ? 'Guardar y Publicar'
                  : 'Save & Publish'}
              </span>
            </button>
          </div>
        </header>

        {/* Mobile Nav Drawer */}
        {mobileNavOpen && (
          <div className="lg:hidden bg-[#141815] text-white border-b border-white/10 p-3 grid grid-cols-2 gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileNavOpen(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold text-left cursor-pointer ${
                    isActive ? 'bg-[var(--cv-primary)] text-white' : 'bg-white/5 text-neutral-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Toast Feedback */}
        {statusToast && (
          <div
            className={`px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-medium flex items-center justify-between gap-3 border-b ${
              statusToast.type === 'ok'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-red-50 text-red-900 border-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusToast.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusToast(null)}
              className="text-xs underline cursor-pointer"
            >
              OK
            </button>
          </div>
        )}

        {/* Active Tab Workspace */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-6">
          {/* ==================== TAB 1: OVERVIEW ==================== */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="bg-white border border-[#E5E7E4] rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-mono text-[var(--cv-primary)] font-semibold">
                    {es ? 'PLATAFORMA CMS + PLANTILLA MULTI-NEGOCIO' : 'CMS + MULTI-BUSINESS PLATFORM'}
                  </p>
                  <h2 className="font-display text-3xl font-bold text-[#141815]">
                    {draft.business.businessName}
                  </h2>
                  <p className="text-sm text-neutral-600">
                    {draft.business.cityState} · {draft.business.phone} · {draft.business.email}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('pricing')}
                    className="px-3.5 py-2 text-xs font-semibold rounded-md border border-[#E5E7E4] bg-[#F7F7F5] hover:border-[#141815] cursor-pointer"
                  >
                    {es ? 'Editar Precios' : 'Edit Pricing'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('template')}
                    className="px-3.5 py-2 text-xs font-semibold rounded-md bg-[#141815] text-white hover:bg-[var(--cv-primary)] cursor-pointer"
                  >
                    {es ? 'Clonar / Exportar Plantilla' : 'Clone / Export Template'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  {
                    label: es ? 'Tamaños de Lote' : 'Lot Size Tiers',
                    val: draft.pricing.lotSizes.length,
                    tab: 'pricing' as AdminTab,
                  },
                  {
                    label: es ? 'Tarifa Mínima' : 'Min Mobilization',
                    val: `$${draft.pricing.minimumMobilizationFee}`,
                    tab: 'pricing' as AdminTab,
                  },
                  {
                    label: es ? 'Servicios Activos' : 'Services Listed',
                    val: draft.services.length,
                    tab: 'services' as AdminTab,
                  },
                  {
                    label: es ? 'Fotos en Galería' : 'Work Photos',
                    val: draft.workPhotos.length,
                    tab: 'media' as AdminTab,
                  },
                  {
                    label: es ? 'Reseñas' : 'Google Reviews',
                    val: draft.reviews.length,
                    tab: 'social' as AdminTab,
                  },
                  {
                    label: es ? 'Preguntas FAQ' : 'FAQ Items',
                    val: draft.faqs.length,
                    tab: 'social' as AdminTab,
                  },
                  {
                    label: es ? 'Archivos Subidos' : 'Uploaded Assets',
                    val: media.length,
                    tab: 'media' as AdminTab,
                  },
                  {
                    label: es ? 'Descuento 5+ Acres' : 'Bulk Discount',
                    val: `${Math.round(draft.pricing.bulkDiscountRate * 100)}%`,
                    tab: 'pricing' as AdminTab,
                  },
                ].map((stat) => (
                  <button
                    key={stat.label}
                    type="button"
                    onClick={() => setActiveTab(stat.tab)}
                    className="bg-white border border-[#E5E7E4] hover:border-[var(--cv-primary)] rounded-xl p-4 text-left transition-colors cursor-pointer"
                  >
                    <p className="text-xs text-neutral-500">{stat.label}</p>
                    <p className="font-display text-3xl font-bold text-[#141815] tabular-nums mt-1">
                      {stat.val}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ==================== TAB 2: BRAND, COLORS & KEY IMAGES ==================== */}
          {activeTab === 'brand' && (
            <div className="space-y-6">
              {/* Business Identity */}
              <section className="bg-white border border-[#E5E7E4] rounded-xl p-5 sm:p-6 space-y-5">
                <h2 className="font-display text-2xl font-bold">
                  {es ? 'Identidad del Negocio y Contacto' : 'Business Identity & Contact'}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FieldInput
                    label={es ? 'Nombre Legal / Completo' : 'Full Business Name'}
                    value={draft.business.businessName}
                    onChange={(v) =>
                      updateDraft((p) => ({ ...p, business: { ...p.business, businessName: v } }))
                    }
                  />
                  <FieldInput
                    label={es ? 'Nombre Corto (Header y Asistente)' : 'Short Brand Name'}
                    value={draft.business.shortName}
                    onChange={(v) =>
                      updateDraft((p) => ({ ...p, business: { ...p.business, shortName: v } }))
                    }
                  />
                  <FieldInput
                    label={es ? 'Monograma (2-3 letras)' : 'Brand Monogram'}
                    value={draft.business.brandMonogram}
                    onChange={(v) =>
                      updateDraft((p) => ({ ...p, business: { ...p.business, brandMonogram: v } }))
                    }
                  />
                  <FieldInput
                    label={es ? 'Nombre del Propietario' : 'Owner Name'}
                    value={draft.business.ownerName}
                    onChange={(v) =>
                      updateDraft((p) => ({ ...p, business: { ...p.business, ownerName: v } }))
                    }
                  />
                  <FieldInput
                    label={es ? 'Nombre Asistente Virtual' : 'AI Assistant Name'}
                    value={draft.business.assistantName}
                    onChange={(v) =>
                      updateDraft((p) => ({ ...p, business: { ...p.business, assistantName: v } }))
                    }
                  />
                  <FieldInput
                    label={es ? 'PIN Herramienta Cotización PDF' : 'Contractor PDF Tool PIN'}
                    value={draft.business.contractorToolPin ?? ''}
                    onChange={(v) =>
                      updateDraft((p) => ({
                        ...p,
                        business: { ...p.business, contractorToolPin: v },
                      }))
                    }
                  />
                  <FieldInput
                    label={es ? 'Ciudad y Estado' : 'Primary City, State'}
                    value={draft.business.cityState}
                    onChange={(v) =>
                      updateDraft((p) => ({ ...p, business: { ...p.business, cityState: v } }))
                    }
                  />
                  <FieldInput
                    label={es ? 'Teléfono Visible' : 'Display Phone'}
                    value={draft.business.phone}
                    onChange={(v) =>
                      updateDraft((p) => ({
                        ...p,
                        business: {
                          ...p.business,
                          phone: v,
                          phoneHref: `tel:${v.replace(/[^\d+]/g, '')}`,
                        },
                      }))
                    }
                  />
                  <FieldInput
                    label={es ? 'Email de Contacto' : 'Contact Email'}
                    value={draft.business.email}
                    onChange={(v) =>
                      updateDraft((p) => ({ ...p, business: { ...p.business, email: v } }))
                    }
                  />
                  <div className="md:col-span-2">
                    <FieldInput
                      label={es ? 'Área de Servicio (texto completo)' : 'Service Area Coverage'}
                      value={draft.business.serviceArea}
                      onChange={(v) =>
                        updateDraft((p) => ({ ...p, business: { ...p.business, serviceArea: v } }))
                      }
                    />
                  </div>
                  <FieldInput
                    label={es ? 'Ciudades (separadas por coma)' : 'Cities (comma-separated)'}
                    value={draft.business.serviceCities.join(', ')}
                    onChange={(v) =>
                      updateDraft((p) => ({
                        ...p,
                        business: {
                          ...p.business,
                          serviceCities: v
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        },
                      }))
                    }
                  />
                  <FieldInput
                    label={es ? 'Horario (EN)' : 'Operating Hours (EN)'}
                    value={draft.business.operatingHours.en}
                    onChange={(v) =>
                      updateDraft((p) => ({
                        ...p,
                        business: {
                          ...p.business,
                          operatingHours: { ...p.business.operatingHours, en: v },
                        },
                      }))
                    }
                  />
                  <FieldInput
                    label={es ? 'Horario (ES)' : 'Operating Hours (ES)'}
                    value={draft.business.operatingHours.es}
                    onChange={(v) =>
                      updateDraft((p) => ({
                        ...p,
                        business: {
                          ...p.business,
                          operatingHours: { ...p.business.operatingHours, es: v },
                        },
                      }))
                    }
                  />
                  <FieldInput
                    label={es ? 'Etiqueta Google Rating (EN)' : 'Google Rating Label (EN)'}
                    value={draft.business.googleRatingLabel.en}
                    onChange={(v) =>
                      updateDraft((p) => ({
                        ...p,
                        business: {
                          ...p.business,
                          googleRatingLabel: { ...p.business.googleRatingLabel, en: v },
                        },
                      }))
                    }
                  />
                  <FieldInput
                    label={es ? 'Etiqueta Google Rating (ES)' : 'Google Rating Label (ES)'}
                    value={draft.business.googleRatingLabel.es}
                    onChange={(v) =>
                      updateDraft((p) => ({
                        ...p,
                        business: {
                          ...p.business,
                          googleRatingLabel: { ...p.business.googleRatingLabel, es: v },
                        },
                      }))
                    }
                  />
                </div>
              </section>

              {/* Brand Colors */}
              <section className="bg-white border border-[#E5E7E4] rounded-xl p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl font-bold">
                      {es ? 'Paleta de Colores de la Marca' : 'Brand Color Palette'}
                    </h2>
                    <p className="text-xs text-neutral-500">
                      {es
                        ? 'Cambia los colores principales y se actualizará toda la web automáticamente.'
                        : 'Adjust palette colors and the entire storefront updates automatically.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft((p) => ({
                        ...p,
                        theme: structuredClone(defaultSiteCms.theme),
                      }))
                    }
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border border-[#E5E7E4] hover:border-[#141815] cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{es ? 'Restaurar Colores' : 'Reset Colors'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(
                    [
                      ['primaryColor', es ? 'Color Principal (Botones/Iconos)' : 'Primary Brand Color'],
                      ['primaryDarkColor', es ? 'Principal Oscuro (Hover)' : 'Primary Hover Dark'],
                      ['accentColor', es ? 'Color Acento (Pergamino/Destacado)' : 'Accent Highlight (Parchment)'],
                      ['lightGreenColor', es ? 'Acento Claro (Iconos sobre oscuro)' : 'Light Accent (On Dark)'],
                      ['darkSurfaceColor', es ? 'Fondo Oscuro Principal' : 'Dark Surface Background'],
                      ['darkCardColor', es ? 'Tarjetas Oscuras' : 'Dark Card Surface'],
                    ] as const
                  ).map(([key, label]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border border-[#E5E7E4] bg-[#F7F7F5]"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#141815]">{label}</p>
                        <input
                          type="text"
                          value={draft.theme[key]}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              theme: { ...p.theme, [key]: e.target.value },
                            }))
                          }
                          className="mt-1 w-28 bg-white border border-[#E5E7E4] rounded px-2 py-1 text-xs font-mono"
                        />
                      </div>
                      <input
                        type="color"
                        aria-label={label}
                        value={/^#[0-9a-fA-F]{6}$/.test(draft.theme[key]) ? draft.theme[key] : '#2E5A27'}
                        onChange={(e) =>
                          updateDraft((p) => ({
                            ...p,
                            theme: { ...p.theme, [key]: e.target.value },
                          }))
                        }
                        className="w-11 h-10 rounded border border-[#E5E7E4] cursor-pointer bg-white"
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* Key Images: Logo, Hero, Assistant */}
              <section className="bg-white border border-[#E5E7E4] rounded-xl p-5 sm:p-6 space-y-5">
                <h2 className="font-display text-2xl font-bold">
                  {es ? 'Imágenes Principales (Logo, Portada y Asistente)' : 'Core Brand Images (Logo, Hero & Assistant)'}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {(
                    [
                      {
                        key: 'logoUrl',
                        label: es ? 'Logo de la Empresa' : 'Company Logo',
                        val: draft.business.logoUrl,
                        setter: (url: string) =>
                          updateDraft((p) => ({ ...p, business: { ...p.business, logoUrl: url } })),
                      },
                      {
                        key: 'heroImageUrl',
                        label: es ? 'Foto de Portada (Hero)' : 'Hero Background Photo',
                        val: draft.business.heroImageUrl,
                        setter: (url: string) =>
                          updateDraft((p) => ({
                            ...p,
                            business: { ...p.business, heroImageUrl: url },
                          })),
                      },
                      {
                        key: 'assistantAvatarUrl',
                        label: es ? 'Foto Asistente Virtual' : 'AI Assistant Avatar',
                        val: draft.business.assistantAvatarUrl,
                        setter: (url: string) =>
                          updateDraft((p) => ({
                            ...p,
                            business: { ...p.business, assistantAvatarUrl: url },
                          })),
                      },
                    ] as const
                  ).map((slot) => (
                    <div
                      key={slot.key}
                      className="border border-[#E5E7E4] rounded-xl p-4 bg-[#F7F7F5] space-y-3"
                    >
                      <p className="text-xs font-bold text-[#141815]">{slot.label}</p>
                      <div className="aspect-[16/10] rounded-lg bg-[#141815] overflow-hidden flex items-center justify-center border border-[#E5E7E4]">
                        {slot.val ? (
                          <img
                            src={slot.val}
                            alt={slot.label}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-neutral-400">
                            {es ? 'Sin imagen (usa monograma)' : 'No image (uses monogram)'}
                          </span>
                        )}
                      </div>

                      <input
                        type="text"
                        value={slot.val}
                        onChange={(e) => slot.setter(e.target.value)}
                        placeholder="/api/media/... or https://..."
                        className="w-full bg-white border border-[#E5E7E4] rounded px-2.5 py-1.5 text-xs font-mono"
                      />

                      <label className="w-full inline-flex items-center justify-center gap-2 bg-white hover:bg-neutral-100 border border-[#E5E7E4] text-xs font-semibold px-3 py-2 rounded-md cursor-pointer">
                        <Upload className="w-3.5 h-3.5 text-[var(--cv-primary)]" />
                        <span>
                          {uploadingTarget === slot.key
                            ? es
                              ? 'Subiendo...'
                              : 'Uploading...'
                            : es
                            ? 'Subir Imagen desde PC'
                            : 'Upload Image File'}
                        </span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (file) {
                              void handleUploadImageFile(file, slot.key, slot.setter);
                            }
                          }}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* ==================== TAB 3: PRICING & ESTIMATOR CRUD ==================== */}
          {activeTab === 'pricing' && (
            <div className="space-y-6">
              {/* Global Pricing Rules */}
              <section className="bg-white border border-[#E5E7E4] rounded-xl p-5 sm:p-6 space-y-4">
                <h2 className="font-display text-2xl font-bold">
                  {es ? 'Reglas Globales del Estimador' : 'Global Estimator Rules'}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {es ? 'Tarifa Mínima de Movilización ($ USD)' : 'Minimum Mobilization Fee ($ USD)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={25}
                      value={draft.pricing.minimumMobilizationFee}
                      onChange={(e) =>
                        updateDraft((p) => ({
                          ...p,
                          pricing: {
                            ...p.pricing,
                            minimumMobilizationFee: Math.max(0, Number(e.target.value) || 0),
                          },
                        }))
                      }
                      className="w-full bg-[#F7F7F5] border border-[#E5E7E4] rounded-md px-3 py-2 text-sm font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      {es ? 'Descuento por Volumen (%)' : 'Bulk Volume Discount (%)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={80}
                      step={1}
                      value={Math.round(draft.pricing.bulkDiscountRate * 100)}
                      onChange={(e) =>
                        updateDraft((p) => ({
                          ...p,
                          pricing: {
                            ...p.pricing,
                            bulkDiscountRate: Math.min(0.8, Math.max(0, (Number(e.target.value) || 0) / 100)),
                          },
                        }))
                      }
                      className="w-full bg-[#F7F7F5] border border-[#E5E7E4] rounded-md px-3 py-2 text-sm font-mono tabular-nums"
                    />
                  </div>
                </div>
              </section>

              {/* Lot Sizes CRUD */}
              <section className="bg-white border border-[#E5E7E4] rounded-xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl font-bold">
                      {es ? 'Paso 1 · Tamaños de Lote' : 'Step 1 · Lot Sizes'}
                    </h2>
                    <p className="text-xs text-neutral-500">
                      {es
                        ? 'Agrega, edita o elimina opciones de acres. El modo "Fijo" usa la tabla exacta por densidad; "Por Acre" multiplica los acres por la tarifa/acre.'
                        : 'Add, edit, or delete acreage options. "Fixed" uses exact matrix ranges; "Per Acre" multiplies acres by density per-acre rates.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newId = `lot-${Date.now().toString().slice(-4)}`;
                      const newLot: CmsLotSizeOption = {
                        id: newId,
                        acres: 4,
                        isFivePlus: false,
                        isBulkDiscountEligible: false,
                        pricingMode: 'perAcre',
                        labelEn: '4.00 Acres',
                        labelEs: '4.00 Acres',
                        subtitleEn: '4-Acre Parcel',
                        subtitleEs: 'Parcela de 4 Acres',
                      };
                      updateDraft((p) => ({
                        ...p,
                        pricing: { ...p.pricing, lotSizes: [...p.pricing.lotSizes, newLot] },
                      }));
                    }}
                    className="inline-flex items-center gap-1.5 bg-[var(--cv-primary)] text-white text-xs font-semibold px-3 py-2 rounded-md cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{es ? 'Agregar Lote' : 'Add Lot Size'}</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {draft.pricing.lotSizes.map((lot, idx) => (
                    <div
                      key={lot.id}
                      className="border border-[#E5E7E4] rounded-lg p-4 bg-[#F7F7F5] space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-[var(--cv-primary)]">
                          ID: {lot.id}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft((p) => ({
                                ...p,
                                pricing: {
                                  ...p.pricing,
                                  lotSizes: moveArrayItem(p.pricing.lotSizes, idx, -1),
                                },
                              }))
                            }
                            aria-label="Move up"
                            className="p-1.5 rounded border border-[#E5E7E4] bg-white hover:border-[#141815] cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft((p) => ({
                                ...p,
                                pricing: {
                                  ...p.pricing,
                                  lotSizes: moveArrayItem(p.pricing.lotSizes, idx, 1),
                                },
                              }))
                            }
                            aria-label="Move down"
                            className="p-1.5 rounded border border-[#E5E7E4] bg-white hover:border-[#141815] cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={draft.pricing.lotSizes.length <= 1}
                            onClick={() =>
                              updateDraft((p) => ({
                                ...p,
                                pricing: {
                                  ...p.pricing,
                                  lotSizes: p.pricing.lotSizes.filter((_, i) => i !== idx),
                                },
                              }))
                            }
                            aria-label="Delete lot"
                            className="p-1.5 rounded border border-[#E5E7E4] bg-white text-red-600 hover:bg-red-50 disabled:opacity-40 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                        <FieldInput
                          label={es ? 'Acres' : 'Acres'}
                          type="number"
                          value={String(lot.acres)}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              pricing: {
                                ...p.pricing,
                                lotSizes: p.pricing.lotSizes.map((item, i) =>
                                  i === idx ? { ...item, acres: Math.max(0.1, Number(v) || 0.25) } : item
                                ),
                              },
                            }))
                          }
                        />
                        <FieldInput
                          label="Label (EN)"
                          value={lot.labelEn}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              pricing: {
                                ...p.pricing,
                                lotSizes: p.pricing.lotSizes.map((item, i) =>
                                  i === idx ? { ...item, labelEn: v } : item
                                ),
                              },
                            }))
                          }
                        />
                        <FieldInput
                          label="Label (ES)"
                          value={lot.labelEs}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              pricing: {
                                ...p.pricing,
                                lotSizes: p.pricing.lotSizes.map((item, i) =>
                                  i === idx ? { ...item, labelEs: v } : item
                                ),
                              },
                            }))
                          }
                        />
                        <FieldInput
                          label="Subtitle (EN)"
                          value={lot.subtitleEn}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              pricing: {
                                ...p.pricing,
                                lotSizes: p.pricing.lotSizes.map((item, i) =>
                                  i === idx ? { ...item, subtitleEn: v } : item
                                ),
                              },
                            }))
                          }
                        />
                        <FieldInput
                          label="Subtitle (ES)"
                          value={lot.subtitleEs}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              pricing: {
                                ...p.pricing,
                                lotSizes: p.pricing.lotSizes.map((item, i) =>
                                  i === idx ? { ...item, subtitleEs: v } : item
                                ),
                              },
                            }))
                          }
                        />
                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                            {es ? 'Modo de Precio' : 'Pricing Mode'}
                          </label>
                          <select
                            value={lot.pricingMode}
                            onChange={(e) =>
                              updateDraft((p) => ({
                                ...p,
                                pricing: {
                                  ...p.pricing,
                                  lotSizes: p.pricing.lotSizes.map((item, i) =>
                                    i === idx
                                      ? {
                                          ...item,
                                          pricingMode:
                                            e.target.value === 'fixed' ? 'fixed' : 'perAcre',
                                        }
                                      : item
                                  ),
                                },
                              }))
                            }
                            className="w-full bg-white border border-[#E5E7E4] rounded px-2 py-1.5 text-xs"
                          >
                            <option value="fixed">{es ? 'Tarifa Fija (Tabla)' : 'Fixed Matrix'}</option>
                            <option value="perAcre">{es ? 'Por Acre' : 'Per-Acre Rate'}</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 text-xs pt-1">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={lot.isBulkDiscountEligible}
                            onChange={(e) =>
                              updateDraft((p) => ({
                                ...p,
                                pricing: {
                                  ...p.pricing,
                                  lotSizes: p.pricing.lotSizes.map((item, i) =>
                                    i === idx
                                      ? { ...item, isBulkDiscountEligible: e.target.checked }
                                      : item
                                  ),
                                },
                              }))
                            }
                          />
                          <span>{es ? 'Aplica Descuento por Volumen' : 'Bulk Discount Eligible'}</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={lot.isFivePlus}
                            onChange={(e) =>
                              updateDraft((p) => ({
                                ...p,
                                pricing: {
                                  ...p.pricing,
                                  lotSizes: p.pricing.lotSizes.map((item, i) =>
                                    i === idx ? { ...item, isFivePlus: e.target.checked } : item
                                  ),
                                },
                              }))
                            }
                          />
                          <span>{es ? 'Mostrar "+" en rango (5+)' : 'Show "+" suffix (5+)'}</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Vegetation Densities + Price Matrix CRUD */}
              <section className="bg-white border border-[#E5E7E4] rounded-xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl font-bold">
                      {es ? 'Paso 2 · Densidades y Matriz de Precios' : 'Step 2 · Vegetation Densities & Price Matrix'}
                    </h2>
                    <p className="text-xs text-neutral-500">
                      {es
                        ? 'Edita los precios exactos ($) mínimo y máximo para cada lote fijo y por acre.'
                        : 'Edit exact min & max ($) prices for every fixed lot tier and per-acre rate.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newDen: CmsDensityOption = {
                        id: `density-${Date.now().toString().slice(-4)}`,
                        icon: 'trees',
                        labelEn: 'Custom Density',
                        labelEs: 'Densidad Personalizada',
                        descriptionEn: 'Custom vegetation tier',
                        descriptionEs: 'Nivel de vegetación personalizado',
                        fixedRates: {},
                        perAcreRange: [2000, 2800],
                      };
                      updateDraft((p) => ({
                        ...p,
                        pricing: { ...p.pricing, densities: [...p.pricing.densities, newDen] },
                      }));
                    }}
                    className="inline-flex items-center gap-1.5 bg-[var(--cv-primary)] text-white text-xs font-semibold px-3 py-2 rounded-md cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{es ? 'Agregar Densidad' : 'Add Density'}</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {draft.pricing.densities.map((den, dIdx) => {
                    const fixedLots = draft.pricing.lotSizes.filter(
                      (l) => l.pricingMode === 'fixed'
                    );
                    return (
                      <div
                        key={den.id}
                        className="border border-[#E5E7E4] rounded-lg p-4 bg-[#F7F7F5] space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-[var(--cv-primary)]">
                            {den.labelEn} ({den.id})
                          </span>
                          <button
                            type="button"
                            disabled={draft.pricing.densities.length <= 1}
                            onClick={() =>
                              updateDraft((p) => ({
                                ...p,
                                pricing: {
                                  ...p.pricing,
                                  densities: p.pricing.densities.filter((_, i) => i !== dIdx),
                                },
                              }))
                            }
                            className="p-1.5 rounded border border-[#E5E7E4] bg-white text-red-600 hover:bg-red-50 disabled:opacity-40 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                              {es ? 'Ícono' : 'Icon'}
                            </label>
                            <select
                              value={den.icon}
                              onChange={(e) =>
                                updateDraft((p) => ({
                                  ...p,
                                  pricing: {
                                    ...p.pricing,
                                    densities: p.pricing.densities.map((item, i) =>
                                      i === dIdx
                                        ? { ...item, icon: e.target.value as CmsDensityIcon }
                                        : item
                                    ),
                                  },
                                }))
                              }
                              className="w-full bg-white border border-[#E5E7E4] rounded px-2 py-1.5 text-xs"
                            >
                              <option value="sprout">Sprout (Light)</option>
                              <option value="trees">Trees (Medium)</option>
                              <option value="treepine">Pine (Heavy)</option>
                            </select>
                          </div>
                          <FieldInput
                            label="Label (EN)"
                            value={den.labelEn}
                            onChange={(v) =>
                              updateDraft((p) => ({
                                ...p,
                                pricing: {
                                  ...p.pricing,
                                  densities: p.pricing.densities.map((item, i) =>
                                    i === dIdx ? { ...item, labelEn: v } : item
                                  ),
                                },
                              }))
                            }
                          />
                          <FieldInput
                            label="Label (ES)"
                            value={den.labelEs}
                            onChange={(v) =>
                              updateDraft((p) => ({
                                ...p,
                                pricing: {
                                  ...p.pricing,
                                  densities: p.pricing.densities.map((item, i) =>
                                    i === dIdx ? { ...item, labelEs: v } : item
                                  ),
                                },
                              }))
                            }
                          />
                          <FieldInput
                            label="Desc (EN)"
                            value={den.descriptionEn}
                            onChange={(v) =>
                              updateDraft((p) => ({
                                ...p,
                                pricing: {
                                  ...p.pricing,
                                  densities: p.pricing.densities.map((item, i) =>
                                    i === dIdx ? { ...item, descriptionEn: v } : item
                                  ),
                                },
                              }))
                            }
                          />
                          <FieldInput
                            label="Desc (ES)"
                            value={den.descriptionEs}
                            onChange={(v) =>
                              updateDraft((p) => ({
                                ...p,
                                pricing: {
                                  ...p.pricing,
                                  densities: p.pricing.densities.map((item, i) =>
                                    i === dIdx ? { ...item, descriptionEs: v } : item
                                  ),
                                },
                              }))
                            }
                          />
                        </div>

                        {/* Rate Matrix */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-[#E5E7E4]">
                          {fixedLots.map((lot) => {
                            const pair = den.fixedRates[lot.id] ?? [
                              Math.round(lot.acres * den.perAcreRange[0]),
                              Math.round(lot.acres * den.perAcreRange[1]),
                            ];
                            return (
                              <div
                                key={lot.id}
                                className="bg-white border border-[#E5E7E4] rounded p-2.5 space-y-1.5"
                              >
                                <p className="text-[11px] font-bold text-[#141815]">
                                  {lot.labelEn} ($ Min – Max)
                                </p>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <input
                                    type="number"
                                    value={pair[0]}
                                    onChange={(e) => {
                                      const minVal = Math.max(0, Number(e.target.value) || 0);
                                      updateDraft((p) => ({
                                        ...p,
                                        pricing: {
                                          ...p.pricing,
                                          densities: p.pricing.densities.map((item, i) =>
                                            i === dIdx
                                              ? {
                                                  ...item,
                                                  fixedRates: {
                                                    ...item.fixedRates,
                                                    [lot.id]: [minVal, Math.max(minVal, pair[1])],
                                                  },
                                                }
                                              : item
                                          ),
                                        },
                                      }));
                                    }}
                                    className="w-full bg-[#F7F7F5] border border-[#E5E7E4] rounded px-2 py-1 text-xs font-mono tabular-nums"
                                  />
                                  <input
                                    type="number"
                                    value={pair[1]}
                                    onChange={(e) => {
                                      const maxVal = Math.max(pair[0], Number(e.target.value) || 0);
                                      updateDraft((p) => ({
                                        ...p,
                                        pricing: {
                                          ...p.pricing,
                                          densities: p.pricing.densities.map((item, i) =>
                                            i === dIdx
                                              ? {
                                                  ...item,
                                                  fixedRates: {
                                                    ...item.fixedRates,
                                                    [lot.id]: [pair[0], maxVal],
                                                  },
                                                }
                                              : item
                                          ),
                                        },
                                      }));
                                    }}
                                    className="w-full bg-[#F7F7F5] border border-[#E5E7E4] rounded px-2 py-1 text-xs font-mono tabular-nums"
                                  />
                                </div>
                              </div>
                            );
                          })}

                          {/* Per-Acre Range */}
                          <div className="bg-emerald-50/70 border border-emerald-200 rounded p-2.5 space-y-1.5">
                            <p className="text-[11px] font-bold text-emerald-900">
                              {es ? 'Tarifa Por Acre ($ Min – Max)' : 'Per-Acre Rate ($ Min – Max)'}
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                              <input
                                type="number"
                                value={den.perAcreRange[0]}
                                onChange={(e) => {
                                  const minVal = Math.max(0, Number(e.target.value) || 0);
                                  updateDraft((p) => ({
                                    ...p,
                                    pricing: {
                                      ...p.pricing,
                                      densities: p.pricing.densities.map((item, i) =>
                                        i === dIdx
                                          ? {
                                              ...item,
                                              perAcreRange: [
                                                minVal,
                                                Math.max(minVal, item.perAcreRange[1]),
                                              ],
                                            }
                                          : item
                                      ),
                                    },
                                  }));
                                }}
                                className="w-full bg-white border border-emerald-200 rounded px-2 py-1 text-xs font-mono tabular-nums"
                              />
                              <input
                                type="number"
                                value={den.perAcreRange[1]}
                                onChange={(e) => {
                                  const maxVal = Math.max(
                                    den.perAcreRange[0],
                                    Number(e.target.value) || 0
                                  );
                                  updateDraft((p) => ({
                                    ...p,
                                    pricing: {
                                      ...p.pricing,
                                      densities: p.pricing.densities.map((item, i) =>
                                        i === dIdx
                                          ? { ...item, perAcreRange: [item.perAcreRange[0], maxVal] }
                                          : item
                                      ),
                                    },
                                  }));
                                }}
                                className="w-full bg-white border border-emerald-200 rounded px-2 py-1 text-xs font-mono tabular-nums"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Optional Add-Ons CRUD */}
              <section className="bg-white border border-[#E5E7E4] rounded-xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-2xl font-bold">
                    {es ? 'Paso 3 · Servicios Adicionales (Add-Ons)' : 'Step 3 · Optional Site Add-Ons'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      const newAddon: CmsAddonOption = {
                        id: `addon-${Date.now().toString().slice(-4)}`,
                        icon: 'wrench',
                        price: 350,
                        labelEn: 'New Site Add-On',
                        labelEs: 'Nuevo Adicional',
                        descriptionEn: 'Describe extra site service',
                        descriptionEs: 'Describe el servicio adicional',
                      };
                      updateDraft((p) => ({
                        ...p,
                        pricing: { ...p.pricing, addons: [...p.pricing.addons, newAddon] },
                      }));
                    }}
                    className="inline-flex items-center gap-1.5 bg-[var(--cv-primary)] text-white text-xs font-semibold px-3 py-2 rounded-md cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{es ? 'Agregar Adicional' : 'Add Add-On'}</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {draft.pricing.addons.map((addon, idx) => (
                    <div
                      key={addon.id}
                      className="border border-[#E5E7E4] rounded-lg p-4 bg-[#F7F7F5] space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-[var(--cv-primary)]">
                          {addon.id}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateDraft((p) => ({
                              ...p,
                              pricing: {
                                ...p.pricing,
                                addons: p.pricing.addons.filter((_, i) => i !== idx),
                              },
                            }))
                          }
                          className="p-1.5 rounded border border-[#E5E7E4] bg-white text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                            {es ? 'Ícono' : 'Icon'}
                          </label>
                          <select
                            value={addon.icon}
                            onChange={(e) =>
                              updateDraft((p) => ({
                                ...p,
                                pricing: {
                                  ...p.pricing,
                                  addons: p.pricing.addons.map((item, i) =>
                                    i === idx ? { ...item, icon: e.target.value as CmsAddonIcon } : item
                                  ),
                                },
                              }))
                            }
                            className="w-full bg-white border border-[#E5E7E4] rounded px-2 py-1.5 text-xs"
                          >
                            <option value="disc">Stump Disc</option>
                            <option value="truck">Haul Truck</option>
                            <option value="shovel">Grading Shovel</option>
                            <option value="wrench">General Tool</option>
                          </select>
                        </div>
                        <FieldInput
                          label={es ? 'Precio ($)' : 'Price ($)'}
                          type="number"
                          value={String(addon.price)}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              pricing: {
                                ...p.pricing,
                                addons: p.pricing.addons.map((item, i) =>
                                  i === idx ? { ...item, price: Math.max(0, Number(v) || 0) } : item
                                ),
                              },
                            }))
                          }
                        />
                        <FieldInput
                          label="Label (EN)"
                          value={addon.labelEn}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              pricing: {
                                ...p.pricing,
                                addons: p.pricing.addons.map((item, i) =>
                                  i === idx ? { ...item, labelEn: v } : item
                                ),
                              },
                            }))
                          }
                        />
                        <FieldInput
                          label="Label (ES)"
                          value={addon.labelEs}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              pricing: {
                                ...p.pricing,
                                addons: p.pricing.addons.map((item, i) =>
                                  i === idx ? { ...item, labelEs: v } : item
                                ),
                              },
                            }))
                          }
                        />
                        <FieldInput
                          label="Desc (EN)"
                          value={addon.descriptionEn}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              pricing: {
                                ...p.pricing,
                                addons: p.pricing.addons.map((item, i) =>
                                  i === idx ? { ...item, descriptionEn: v } : item
                                ),
                              },
                            }))
                          }
                        />
                        <FieldInput
                          label="Desc (ES)"
                          value={addon.descriptionEs}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              pricing: {
                                ...p.pricing,
                                addons: p.pricing.addons.map((item, i) =>
                                  i === idx ? { ...item, descriptionEs: v } : item
                                ),
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* ==================== TAB 4: TEXTS & ASSISTANT COPY ==================== */}
          {activeTab === 'copy' && (
            <div className="space-y-6">
              {/* Hero Copy */}
              <section className="bg-white border border-[#E5E7E4] rounded-xl p-5 sm:p-6 space-y-4">
                <h2 className="font-display text-2xl font-bold">
                  {es ? 'Portada (Hero Principal) — EN / ES' : 'Hero Section — EN / ES'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FieldInput
                    label="H1 Headline (EN)"
                    value={draft.business.primaryKeyword.en}
                    onChange={(v) =>
                      updateDraft((p) => ({
                        ...p,
                        business: {
                          ...p.business,
                          primaryKeyword: { ...p.business.primaryKeyword, en: v },
                        },
                      }))
                    }
                  />
                  <FieldInput
                    label="H1 Headline (ES)"
                    value={draft.business.primaryKeyword.es}
                    onChange={(v) =>
                      updateDraft((p) => ({
                        ...p,
                        business: {
                          ...p.business,
                          primaryKeyword: { ...p.business.primaryKeyword, es: v },
                        },
                      }))
                    }
                  />
                  <FieldTextarea
                    label="Hero Subheadline (EN)"
                    value={draft.sections.hero.subheadline.en}
                    onChange={(v) =>
                      updateDraft((p) => ({
                        ...p,
                        sections: {
                          ...p.sections,
                          hero: {
                            ...p.sections.hero,
                            subheadline: { ...p.sections.hero.subheadline, en: v },
                          },
                        },
                      }))
                    }
                  />
                  <FieldTextarea
                    label="Hero Subheadline (ES)"
                    value={draft.sections.hero.subheadline.es}
                    onChange={(v) =>
                      updateDraft((p) => ({
                        ...p,
                        sections: {
                          ...p.sections,
                          hero: {
                            ...p.sections.hero,
                            subheadline: { ...p.sections.hero.subheadline, es: v },
                          },
                        },
                      }))
                    }
                  />
                  <FieldInput
                    label="Licensed Badge (EN)"
                    value={draft.sections.hero.licensedLabel.en}
                    onChange={(v) =>
                      updateDraft((p) => ({
                        ...p,
                        sections: {
                          ...p.sections,
                          hero: {
                            ...p.sections.hero,
                            licensedLabel: { ...p.sections.hero.licensedLabel, en: v },
                          },
                        },
                      }))
                    }
                  />
                  <FieldInput
                    label="Licensed Badge (ES)"
                    value={draft.sections.hero.licensedLabel.es}
                    onChange={(v) =>
                      updateDraft((p) => ({
                        ...p,
                        sections: {
                          ...p.sections,
                          hero: {
                            ...p.sections.hero,
                            licensedLabel: { ...p.sections.hero.licensedLabel, es: v },
                          },
                        },
                      }))
                    }
                  />
                  <FieldInput
                    label="Form Title (EN)"
                    value={draft.sections.hero.formTitle.en}
                    onChange={(v) =>
                      updateDraft((p) => ({
                        ...p,
                        sections: {
                          ...p.sections,
                          hero: {
                            ...p.sections.hero,
                            formTitle: { ...p.sections.hero.formTitle, en: v },
                          },
                        },
                      }))
                    }
                  />
                  <FieldInput
                    label="Form Title (ES)"
                    value={draft.sections.hero.formTitle.es}
                    onChange={(v) =>
                      updateDraft((p) => ({
                        ...p,
                        sections: {
                          ...p.sections,
                          hero: {
                            ...p.sections.hero,
                            formTitle: { ...p.sections.hero.formTitle, es: v },
                          },
                        },
                      }))
                    }
                  />
                </div>
              </section>

              {/* Section Titles */}
              <section className="bg-white border border-[#E5E7E4] rounded-xl p-5 sm:p-6 space-y-4">
                <h2 className="font-display text-2xl font-bold">
                  {es ? 'Títulos y Subtítulos de Secciones' : 'Section Headings & Subtitles'}
                </h2>

                {(
                  [
                    ['estimator', es ? 'Estimador de Precios' : 'Lot Estimator'],
                    ['calendar', es ? 'Calendario en Línea' : 'Online Calendar'],
                    ['services', es ? 'Servicios' : 'Services Section'],
                    ['gallery', es ? 'Galería de Proyectos' : 'Work Gallery'],
                    ['reviews', es ? 'Reseñas de Google' : 'Reviews Section'],
                    ['faq', es ? 'Preguntas Frecuentes' : 'FAQ Section'],
                  ] as const
                ).map(([secKey, secTitle]) => {
                  const secObj = draft.sections[secKey];
                  return (
                    <div
                      key={secKey}
                      className="border border-[#E5E7E4] rounded-lg p-4 bg-[#F7F7F5] space-y-3"
                    >
                      <h3 className="text-sm font-bold text-[#141815]">{secTitle}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <FieldInput
                          label="Title (EN)"
                          value={secObj.title.en}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              sections: {
                                ...p.sections,
                                [secKey]: {
                                  ...p.sections[secKey],
                                  title: { ...p.sections[secKey].title, en: v },
                                },
                              },
                            }))
                          }
                        />
                        <FieldInput
                          label="Title (ES)"
                          value={secObj.title.es}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              sections: {
                                ...p.sections,
                                [secKey]: {
                                  ...p.sections[secKey],
                                  title: { ...p.sections[secKey].title, es: v },
                                },
                              },
                            }))
                          }
                        />
                        <FieldTextarea
                          label="Subtitle (EN)"
                          value={secObj.subtitle.en}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              sections: {
                                ...p.sections,
                                [secKey]: {
                                  ...p.sections[secKey],
                                  subtitle: { ...p.sections[secKey].subtitle, en: v },
                                },
                              },
                            }))
                          }
                        />
                        <FieldTextarea
                          label="Subtitle (ES)"
                          value={secObj.subtitle.es}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              sections: {
                                ...p.sections,
                                [secKey]: {
                                  ...p.sections[secKey],
                                  subtitle: { ...p.sections[secKey].subtitle, es: v },
                                },
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </section>

              {/* AI Virtual Assistant Copy & Prompt */}
              <section className="bg-white border border-[#E5E7E4] rounded-xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[var(--cv-primary)]" />
                  <h2 className="font-display text-2xl font-bold">
                    {es
                      ? `Textos e Instrucciones de ${draft.business.assistantName} (Asistente IA)`
                      : `${draft.business.assistantName} AI Assistant Welcome & Instructions`}
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FieldTextarea
                    label={es ? 'Saludo Inicial (EN)' : 'Welcome Message (EN)'}
                    value={draft.sections.assistant.welcomeEn}
                    onChange={(v) =>
                      updateDraft((p) => ({
                        ...p,
                        sections: {
                          ...p.sections,
                          assistant: { ...p.sections.assistant, welcomeEn: v },
                        },
                      }))
                    }
                  />
                  <FieldTextarea
                    label={es ? 'Saludo Inicial (ES)' : 'Welcome Message (ES)'}
                    value={draft.sections.assistant.welcomeEs}
                    onChange={(v) =>
                      updateDraft((p) => ({
                        ...p,
                        sections: {
                          ...p.sections,
                          assistant: { ...p.sections.assistant, welcomeEs: v },
                        },
                      }))
                    }
                  />
                </div>
                <FieldTextarea
                  label={
                    es
                      ? 'Reglas o Conocimiento Adicional para la IA (Opcional — se inyecta directo al cerebro de la asistente)'
                      : 'Extra AI Instructions / Business Policies (Optional — injected live into Gemini prompt)'
                  }
                  value={draft.sections.assistant.extraInstructions}
                  onChange={(v) =>
                    updateDraft((p) => ({
                      ...p,
                      sections: {
                        ...p.sections,
                        assistant: { ...p.sections.assistant, extraInstructions: v },
                      },
                    }))
                  }
                />
              </section>
            </div>
          )}

          {/* ==================== TAB 5: SERVICES CRUD ==================== */}
          {activeTab === 'services' && (
            <section className="bg-white border border-[#E5E7E4] rounded-xl p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-bold">
                    {es ? 'Catálogo de Servicios' : 'Services Catalog'}
                  </h2>
                  <p className="text-xs text-neutral-500">
                    {es
                      ? `Estos servicios aparecen en la web, el formulario, el calendario y el conocimiento de ${draft.business.assistantName || 'Jessica'}.`
                      : 'Synced live across the website cards, quote form, calendar, and AI assistant.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const nextNum = String(draft.services.length + 1).padStart(2, '0');
                    const newSvc: CmsServiceItem = {
                      id: `service-${Date.now().toString().slice(-4)}`,
                      number: nextNum,
                      icon: 'trees',
                      titleEn: 'New Clearing Service',
                      titleEs: 'Nuevo Servicio',
                      summaryEn: 'Describe equipment capability and landowner benefit.',
                      summaryEs: 'Describe el servicio y su beneficio para el cliente.',
                      highlightsEn: ['Fast turnaround', 'Clean ground finish'],
                      highlightsEs: ['Entrega rápida', 'Acabado limpio'],
                    };
                    updateDraft((p) => ({ ...p, services: [...p.services, newSvc] }));
                  }}
                  className="inline-flex items-center gap-1.5 bg-[var(--cv-primary)] text-white text-xs font-semibold px-3 py-2 rounded-md cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{es ? 'Nuevo Servicio' : 'Add Service'}</span>
                </button>
              </div>

              <div className="space-y-4">
                {draft.services.map((svc, idx) => (
                  <div
                    key={svc.id}
                    className="border border-[#E5E7E4] rounded-xl p-4 bg-[#F7F7F5] space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-[var(--cv-primary)]">
                        #{svc.number} · {svc.titleEn}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            updateDraft((p) => ({
                              ...p,
                              services: moveArrayItem(p.services, idx, -1),
                            }))
                          }
                          className="p-1.5 rounded border border-[#E5E7E4] bg-white cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateDraft((p) => ({
                              ...p,
                              services: moveArrayItem(p.services, idx, 1),
                            }))
                          }
                          className="p-1.5 rounded border border-[#E5E7E4] bg-white cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={draft.services.length <= 1}
                          onClick={() =>
                            updateDraft((p) => ({
                              ...p,
                              services: p.services.filter((_, i) => i !== idx),
                            }))
                          }
                          className="p-1.5 rounded border border-[#E5E7E4] bg-white text-red-600 disabled:opacity-40 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <FieldInput
                        label="Num (e.g. 01)"
                        value={svc.number}
                        onChange={(v) =>
                          updateDraft((p) => ({
                            ...p,
                            services: p.services.map((s, i) => (i === idx ? { ...s, number: v } : s)),
                          }))
                        }
                      />
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                          Icon
                        </label>
                        <select
                          value={svc.icon}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              services: p.services.map((s, i) =>
                                i === idx ? { ...s, icon: e.target.value as CmsServiceIcon } : s
                              ),
                            }))
                          }
                          className="w-full bg-white border border-[#E5E7E4] rounded px-2 py-1.5 text-xs"
                        >
                          <option value="trees">Trees / Mulching</option>
                          <option value="layers">Layers / Lot Clearing</option>
                          <option value="wheat">Brush / Palmetto</option>
                          <option value="disc">Stump Grinding</option>
                          <option value="shovel">Grading / Pad</option>
                          <option value="cloud-lightning">Storm Cleanup</option>
                          <option value="shield">Protection / Firebreak</option>
                          <option value="wrench">Equipment / Utility</option>
                        </select>
                      </div>
                      <FieldInput
                        label="Title (EN)"
                        value={svc.titleEn}
                        onChange={(v) =>
                          updateDraft((p) => ({
                            ...p,
                            services: p.services.map((s, i) => (i === idx ? { ...s, titleEn: v } : s)),
                          }))
                        }
                      />
                      <FieldInput
                        label="Title (ES)"
                        value={svc.titleEs}
                        onChange={(v) =>
                          updateDraft((p) => ({
                            ...p,
                            services: p.services.map((s, i) => (i === idx ? { ...s, titleEs: v } : s)),
                          }))
                        }
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <FieldTextarea
                        label="Summary (EN)"
                        value={svc.summaryEn}
                        onChange={(v) =>
                          updateDraft((p) => ({
                            ...p,
                            services: p.services.map((s, i) =>
                              i === idx ? { ...s, summaryEn: v } : s
                            ),
                          }))
                        }
                      />
                      <FieldTextarea
                        label="Summary (ES)"
                        value={svc.summaryEs}
                        onChange={(v) =>
                          updateDraft((p) => ({
                            ...p,
                            services: p.services.map((s, i) =>
                              i === idx ? { ...s, summaryEs: v } : s
                            ),
                          }))
                        }
                      />
                      <FieldInput
                        label="Highlights EN (comma-separated)"
                        value={svc.highlightsEn.join(', ')}
                        onChange={(v) =>
                          updateDraft((p) => ({
                            ...p,
                            services: p.services.map((s, i) =>
                              i === idx
                                ? {
                                    ...s,
                                    highlightsEn: v
                                      .split(',')
                                      .map((x) => x.trim())
                                      .filter(Boolean),
                                  }
                                : s
                            ),
                          }))
                        }
                      />
                      <FieldInput
                        label="Highlights ES (comma-separated)"
                        value={svc.highlightsEs.join(', ')}
                        onChange={(v) =>
                          updateDraft((p) => ({
                            ...p,
                            services: p.services.map((s, i) =>
                              i === idx
                                ? {
                                    ...s,
                                    highlightsEs: v
                                      .split(',')
                                      .map((x) => x.trim())
                                      .filter(Boolean),
                                  }
                                : s
                            ),
                          }))
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ==================== TAB 6: WORK GALLERY & MEDIA LIBRARY ==================== */}
          {activeTab === 'media' && (
            <div className="space-y-6">
              {/* Work Gallery CRUD */}
              <section className="bg-white border border-[#E5E7E4] rounded-xl p-5 sm:p-6 space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl font-bold">
                      {es ? 'Galería de Proyectos' : 'Work Gallery Projects'}
                    </h2>
                    <p className="text-xs text-neutral-500">
                      {es
                        ? 'Sube fotos reales desde tu computadora o pega URLs de Google/CDN.'
                        : 'Upload real job-site photos directly or paste image URLs.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newPhoto: CmsWorkPhoto = {
                        id: `work-${Date.now().toString().slice(-4)}`,
                        url: '',
                        titleEn: 'New Clearing Project',
                        titleEs: 'Nuevo Proyecto de Limpieza',
                        locationEn: draft.business.cityState,
                        locationEs: draft.business.cityState,
                        captionEn: 'Before-and-after forestry mulching transformation.',
                        captionEs: 'Transformación limpia mediante trituración forestal.',
                      };
                      updateDraft((p) => ({ ...p, workPhotos: [...p.workPhotos, newPhoto] }));
                    }}
                    className="inline-flex items-center gap-1.5 bg-[var(--cv-primary)] text-white text-xs font-semibold px-3 py-2 rounded-md cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{es ? 'Agregar Foto' : 'Add Photo Card'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {draft.workPhotos.map((photo, idx) => (
                    <div
                      key={photo.id}
                      className="border border-[#E5E7E4] rounded-xl p-4 bg-[#F7F7F5] space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-[var(--cv-primary)]">
                          0{idx + 1} · {photo.id}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft((p) => ({
                                ...p,
                                workPhotos: moveArrayItem(p.workPhotos, idx, -1),
                              }))
                            }
                            className="p-1.5 rounded border border-[#E5E7E4] bg-white cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft((p) => ({
                                ...p,
                                workPhotos: moveArrayItem(p.workPhotos, idx, 1),
                              }))
                            }
                            className="p-1.5 rounded border border-[#E5E7E4] bg-white cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft((p) => ({
                                ...p,
                                workPhotos: p.workPhotos.filter((_, i) => i !== idx),
                              }))
                            }
                            className="p-1.5 rounded border border-[#E5E7E4] bg-white text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="aspect-[16/9] rounded-lg bg-[#141815] overflow-hidden flex items-center justify-center border border-[#E5E7E4]">
                        {photo.url ? (
                          <img
                            src={photo.url}
                            alt={photo.titleEn}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-neutral-400">
                            {es ? 'Sube una imagen o pega URL' : 'Upload an image or paste URL'}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={photo.url}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              workPhotos: p.workPhotos.map((item, i) =>
                                i === idx ? { ...item, url: e.target.value } : item
                              ),
                            }))
                          }
                          placeholder="/api/media/... or https://..."
                          className="flex-1 bg-white border border-[#E5E7E4] rounded px-2.5 py-1.5 text-xs font-mono"
                        />

                        <label className="inline-flex items-center gap-1.5 bg-white hover:bg-neutral-100 border border-[#E5E7E4] text-xs font-semibold px-3 py-1.5 rounded cursor-pointer shrink-0">
                          <Upload className="w-3.5 h-3.5 text-[var(--cv-primary)]" />
                          <span>
                            {uploadingTarget === photo.id ? '...' : es ? 'Subir' : 'Upload'}
                          </span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            className="sr-only"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = '';
                              if (file) {
                                void handleUploadImageFile(file, photo.id, (url) =>
                                  updateDraft((p) => ({
                                    ...p,
                                    workPhotos: p.workPhotos.map((item, i) =>
                                      i === idx ? { ...item, url } : item
                                    ),
                                  }))
                                );
                              }
                            }}
                          />
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <FieldInput
                          label="Title (EN)"
                          value={photo.titleEn}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              workPhotos: p.workPhotos.map((item, i) =>
                                i === idx ? { ...item, titleEn: v } : item
                              ),
                            }))
                          }
                        />
                        <FieldInput
                          label="Title (ES)"
                          value={photo.titleEs}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              workPhotos: p.workPhotos.map((item, i) =>
                                i === idx ? { ...item, titleEs: v } : item
                              ),
                            }))
                          }
                        />
                        <FieldInput
                          label="Location (EN)"
                          value={photo.locationEn}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              workPhotos: p.workPhotos.map((item, i) =>
                                i === idx ? { ...item, locationEn: v } : item
                              ),
                            }))
                          }
                        />
                        <FieldInput
                          label="Location (ES)"
                          value={photo.locationEs}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              workPhotos: p.workPhotos.map((item, i) =>
                                i === idx ? { ...item, locationEs: v } : item
                              ),
                            }))
                          }
                        />
                      </div>

                      <FieldTextarea
                        label="Caption (EN)"
                        value={photo.captionEn}
                        onChange={(v) =>
                          updateDraft((p) => ({
                            ...p,
                            workPhotos: p.workPhotos.map((item, i) =>
                              i === idx ? { ...item, captionEn: v } : item
                            ),
                          }))
                        }
                      />
                      <FieldTextarea
                        label="Caption (ES)"
                        value={photo.captionEs}
                        onChange={(v) =>
                          updateDraft((p) => ({
                            ...p,
                            workPhotos: p.workPhotos.map((item, i) =>
                              i === idx ? { ...item, captionEs: v } : item
                            ),
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* Uploaded Media Library */}
              <section className="bg-white border border-[#E5E7E4] rounded-xl p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl font-bold">
                      {es ? 'Biblioteca de Archivos Subidos' : 'Uploaded Media Library'}
                    </h2>
                    <p className="text-xs text-neutral-500">
                      {es
                        ? 'Imágenes almacenadas directamente en el servidor (/api/media/*).'
                        : 'Images stored directly on your backend server (/api/media/*).'}
                    </p>
                  </div>

                  <label className="inline-flex items-center gap-1.5 bg-[#141815] text-white text-xs font-semibold px-3 py-2 rounded-md cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {uploadingTarget === 'library'
                        ? es
                          ? 'Subiendo...'
                          : 'Uploading...'
                        : es
                        ? 'Subir a Biblioteca'
                        : 'Upload to Library'}
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) {
                          void handleUploadImageFile(file, 'library', () => {
                            // Uploaded asset appears in media grid immediately
                          });
                        }
                      }}
                    />
                  </label>
                </div>

                {media.length === 0 ? (
                  <p className="text-xs text-neutral-500 py-4">
                    {es
                      ? 'Todavía no hay archivos subidos manualmente. Usa el botón de arriba para subir imágenes.'
                      : 'No uploaded files yet. Use the upload button above to store images.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {media.map((asset) => (
                      <div
                        key={asset.filename}
                        className="border border-[#E5E7E4] rounded-lg overflow-hidden bg-[#F7F7F5]"
                      >
                        <div className="aspect-[4/3] bg-[#141815]">
                          <img
                            src={asset.url}
                            alt={asset.filename}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-2.5 space-y-2">
                          <p className="font-mono text-[10px] text-neutral-500 truncate">
                            {formatBytes(asset.sizeBytes)} · {asset.filename}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                void navigator.clipboard?.writeText(asset.url);
                                notify('ok', es ? 'URL copiada.' : 'Asset URL copied.');
                              }}
                              className="flex-1 inline-flex items-center justify-center gap-1 bg-white border border-[#E5E7E4] text-[11px] font-semibold py-1 rounded cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              <span>URL</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteMediaAsset(asset.filename)}
                              aria-label="Delete media file"
                              className="p-1.5 rounded border border-[#E5E7E4] bg-white text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ==================== TAB 7: REVIEWS & FAQS CRUD ==================== */}
          {activeTab === 'social' && (
            <div className="space-y-6">
              {/* Reviews CRUD */}
              <section className="bg-white border border-[#E5E7E4] rounded-xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500" />
                    <h2 className="font-display text-2xl font-bold">
                      {es ? 'Reseñas de Clientes' : 'Customer Reviews'}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newRev: CmsGoogleReview = {
                        id: `review-${Date.now().toString().slice(-4)}`,
                        author: 'New Client',
                        location: draft.business.cityState,
                        rating: 5,
                        dateEn: 'Verified Google Review',
                        dateEs: 'Reseña Verificada de Google',
                        textEn: 'Great punctuality and clean forestry mulching result.',
                        textEs: 'Excelente puntualidad y terreno terminado súper limpio.',
                      };
                      updateDraft((p) => ({ ...p, reviews: [...p.reviews, newRev] }));
                    }}
                    className="inline-flex items-center gap-1.5 bg-[var(--cv-primary)] text-white text-xs font-semibold px-3 py-2 rounded-md cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{es ? 'Agregar Reseña' : 'Add Review'}</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {draft.reviews.map((rev, idx) => (
                    <div
                      key={rev.id}
                      className="border border-[#E5E7E4] rounded-lg p-4 bg-[#F7F7F5] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-[var(--cv-primary)]">
                          {rev.author} ({rev.rating}★)
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateDraft((p) => ({
                              ...p,
                              reviews: p.reviews.filter((_, i) => i !== idx),
                            }))
                          }
                          className="p-1.5 rounded border border-[#E5E7E4] bg-white text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <FieldInput
                          label="Author"
                          value={rev.author}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              reviews: p.reviews.map((r, i) => (i === idx ? { ...r, author: v } : r)),
                            }))
                          }
                        />
                        <FieldInput
                          label="Location"
                          value={rev.location}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              reviews: p.reviews.map((r, i) =>
                                i === idx ? { ...r, location: v } : r
                              ),
                            }))
                          }
                        />
                        <FieldInput
                          label="Rating (1-5)"
                          type="number"
                          value={String(rev.rating)}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              reviews: p.reviews.map((r, i) =>
                                i === idx
                                  ? { ...r, rating: Math.min(5, Math.max(1, Number(v) || 5)) }
                                  : r
                              ),
                            }))
                          }
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <FieldTextarea
                          label="Review Text (EN)"
                          value={rev.textEn}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              reviews: p.reviews.map((r, i) => (i === idx ? { ...r, textEn: v } : r)),
                            }))
                          }
                        />
                        <FieldTextarea
                          label="Review Text (ES)"
                          value={rev.textEs}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              reviews: p.reviews.map((r, i) => (i === idx ? { ...r, textEs: v } : r)),
                            }))
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* FAQs CRUD */}
              <section className="bg-white border border-[#E5E7E4] rounded-xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-[var(--cv-primary)]" />
                    <h2 className="font-display text-2xl font-bold">
                      {es ? 'Preguntas Frecuentes (FAQ)' : 'Frequently Asked Questions (FAQ)'}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newFaq: CmsFaqItem = {
                        id: `faq-${Date.now().toString().slice(-4)}`,
                        questionEn: 'New landowner question?',
                        questionEs: '¿Nueva pregunta frecuente?',
                        answerEn: 'Detailed answer here.',
                        answerEs: 'Respuesta detallada aquí.',
                      };
                      updateDraft((p) => ({ ...p, faqs: [...p.faqs, newFaq] }));
                    }}
                    className="inline-flex items-center gap-1.5 bg-[var(--cv-primary)] text-white text-xs font-semibold px-3 py-2 rounded-md cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{es ? 'Agregar FAQ' : 'Add FAQ'}</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {draft.faqs.map((faq, idx) => (
                    <div
                      key={faq.id}
                      className="border border-[#E5E7E4] rounded-lg p-4 bg-[#F7F7F5] space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-[var(--cv-primary)]">
                          0{idx + 1} · {faq.id}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft((p) => ({
                                ...p,
                                faqs: moveArrayItem(p.faqs, idx, -1),
                              }))
                            }
                            className="p-1.5 rounded border border-[#E5E7E4] bg-white cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft((p) => ({
                                ...p,
                                faqs: moveArrayItem(p.faqs, idx, 1),
                              }))
                            }
                            className="p-1.5 rounded border border-[#E5E7E4] bg-white cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft((p) => ({
                                ...p,
                                faqs: p.faqs.filter((_, i) => i !== idx),
                              }))
                            }
                            className="p-1.5 rounded border border-[#E5E7E4] bg-white text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <FieldInput
                          label="Question (EN)"
                          value={faq.questionEn}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              faqs: p.faqs.map((f, i) =>
                                i === idx ? { ...f, questionEn: v } : f
                              ),
                            }))
                          }
                        />
                        <FieldInput
                          label="Question (ES)"
                          value={faq.questionEs}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              faqs: p.faqs.map((f, i) =>
                                i === idx ? { ...f, questionEs: v } : f
                              ),
                            }))
                          }
                        />
                        <FieldTextarea
                          label="Answer (EN)"
                          value={faq.answerEn}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              faqs: p.faqs.map((f, i) => (i === idx ? { ...f, answerEn: v } : f)),
                            }))
                          }
                        />
                        <FieldTextarea
                          label="Answer (ES)"
                          value={faq.answerEs}
                          onChange={(v) =>
                            updateDraft((p) => ({
                              ...p,
                              faqs: p.faqs.map((f, i) => (i === idx ? { ...f, answerEs: v } : f)),
                            }))
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* ==================== TAB 8: MULTI-BUSINESS TEMPLATE CENTER ==================== */}
          {activeTab === 'template' && (
            <div className="space-y-6">
              <section className="bg-white border border-[#E5E7E4] rounded-xl p-5 sm:p-6 space-y-4">
                <h2 className="font-display text-2xl font-bold">
                  {es
                    ? 'Centro de Plantilla White-Label (Multi-Negocio)'
                    : 'White-Label Forestry Mulching Template Studio'}
                </h2>
                <p className="text-sm text-neutral-600 max-w-3xl leading-relaxed">
                  {es
                    ? 'Exporta toda la configuración de un cliente (marca, colores, precios, textos, galería, reseñas e instrucciones de IA) en un solo archivo JSON para clonarlo en otra empresa de Forestry Mulching en minutos, o carga la plantilla base limpia desde aquí.'
                    : 'Export any client configuration (brand, colors, pricing matrix, copy, gallery, reviews & AI instructions) as a portable JSON blueprint to clone across new Forestry Mulching businesses in minutes.'}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="border border-[#E5E7E4] rounded-xl p-5 bg-[#F7F7F5] space-y-3">
                    <h3 className="font-display text-xl font-bold">
                      {es ? 'Exportar / Importar Blueprint JSON' : 'Export / Import Blueprint JSON'}
                    </h3>
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      {es
                        ? 'Guarda una copia de respaldo completa o importa la configuración preparada de otro cliente.'
                        : 'Download a full JSON backup or import another client blueprint into this instance.'}
                    </p>
                    <div className="flex flex-wrap gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={handleExportBlueprint}
                        className="inline-flex items-center gap-1.5 bg-[#141815] text-white text-xs font-semibold px-3.5 py-2.5 rounded-md cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{es ? 'Exportar Blueprint (.json)' : 'Export Blueprint (.json)'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => importJsonRef.current?.click()}
                        className="inline-flex items-center gap-1.5 bg-white border border-[#E5E7E4] hover:border-[#141815] text-xs font-semibold px-3.5 py-2.5 rounded-md cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{es ? 'Importar Blueprint (.json)' : 'Import Blueprint (.json)'}</span>
                      </button>
                      <input
                        ref={importJsonRef}
                        type="file"
                        accept="application/json,.json"
                        className="sr-only"
                        onChange={(e) => void handleImportBlueprint(e)}
                      />
                    </div>
                  </div>

                  <div className="border border-[#E5E7E4] rounded-xl p-5 bg-[#F7F7F5] space-y-3">
                    <h3 className="font-display text-xl font-bold">
                      {es ? 'Presets de Inicio Rápido' : '1-Click Starter Presets'}
                    </h3>
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      {es
                        ? 'Cambia al instante entre la plantilla genérica lista para personalizar y la configuración original de Madison Land Clearing.'
                        : 'Switch immediately between a clean generic starter template for a new client or restore Madison Land Clearing defaults.'}
                    </p>
                    <div className="flex flex-wrap gap-2.5 pt-1">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleApplyPreset('starter-template')}
                        className="inline-flex items-center gap-1.5 bg-[var(--cv-primary)] hover:bg-[var(--cv-primary-dark)] text-white text-xs font-semibold px-3.5 py-2.5 rounded-md cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>
                          {es ? 'Cargar Plantilla Nuevo Negocio' : 'Load New Business Starter'}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleApplyPreset('clearview-default')}
                        className="inline-flex items-center gap-1.5 bg-white border border-[#E5E7E4] hover:border-[#141815] text-xs font-semibold px-3.5 py-2.5 rounded-md cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{es ? 'Restaurar Madison Land Clearing' : 'Restore Madison Defaults'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-white border border-[#E5E7E4] rounded-xl p-5 sm:p-6 space-y-3">
                <h3 className="font-display text-xl font-bold">
                  {es
                    ? 'Checklist para Desplegar a Otra Empresa de Forestry Mulching'
                    : 'Deployment Checklist for Cloning to a New Forestry Mulching Client'}
                </h3>
                <ol className="list-decimal pl-5 space-y-2 text-xs sm:text-sm text-neutral-700 leading-relaxed">
                  <li>
                    {es
                      ? 'Haz clic en "Cargar Plantilla Nuevo Negocio" (o duplica este proyecto en Cloud Run / hosting con nuevas claves).'
                      : 'Click "Load New Business Starter" (or deploy a fresh Cloud Run instance of this repo).'}
                  </li>
                  <li>
                    {es
                      ? 'Configura tus variables secretas en el nuevo proyecto: GEMINI_API_KEY, OWNER_PASSCODE (para la agenda del dueño) y ADMIN_PASSCODE (para /admin).'
                      : 'Set environment secrets on the new deployment: GEMINI_API_KEY, OWNER_PASSCODE, and ADMIN_PASSCODE.'}
                  </li>
                  <li>
                    {es
                      ? 'En "Marca y Colores", sube el logo del cliente, su foto de portada, ajusta su paleta de colores y cambia su PIN de propuestas PDF.'
                      : 'In "Brand & Colors", upload the client logo & hero photo, pick their brand palette, and set their Contractor PDF PIN.'}
                  </li>
                  <li>
                    {es
                      ? `En "Precios y Lotes" y "Galería", ajusta sus tarifas por acre/región y sube las fotos reales de sus trabajos. ${draft.business.assistantName || 'Jessica'} IA y el calendario se actualizan al instante.`
                      : `In "Pricing & Estimator" and "Gallery", enter their regional rates and job photos. ${draft.business.assistantName || 'Jessica'} AI and the booking calendar update automatically.`}
                  </li>
                </ol>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: 'text' | 'number';
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-neutral-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-[#E5E7E4] focus:border-[var(--cv-primary)] focus:outline-none rounded px-2.5 py-1.5 text-xs text-[#141815]"
      />
    </div>
  );
}

function FieldTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-neutral-600 mb-1">{label}</label>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-[#E5E7E4] focus:border-[var(--cv-primary)] focus:outline-none rounded px-2.5 py-1.5 text-xs text-[#141815] leading-relaxed"
      />
    </div>
  );
}
