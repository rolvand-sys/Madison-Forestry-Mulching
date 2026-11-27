import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { defaultSiteCms } from '../data/defaultCms';
import type { SiteCmsData } from '../types/cms';

interface CmsContextValue {
  cms: SiteCmsData;
  loading: boolean;
  refreshCms: () => Promise<void>;
  setCmsLocal: (next: SiteCmsData) => void;
}

const CmsContext = createContext<CmsContextValue | undefined>(undefined);

function applyThemeCssVariables(cms: SiteCmsData) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--cv-primary', cms.theme.primaryColor || '#2E5A27');
  root.style.setProperty('--cv-primary-dark', cms.theme.primaryDarkColor || '#1F401A');
  root.style.setProperty('--cv-accent', cms.theme.accentColor || '#D9B382');
  root.style.setProperty('--cv-light-green', cms.theme.lightGreenColor || '#72A350');
  root.style.setProperty('--cv-dark-surface', cms.theme.darkSurfaceColor || '#231710');
  root.style.setProperty('--cv-dark-card', cms.theme.darkCardColor || '#312118');
}

function syncDocumentMetadata(cms: SiteCmsData) {
  if (typeof document === 'undefined') return;
  const isAdmin = window.location.pathname.startsWith('/admin');
  document.title = isAdmin
    ? `CMS Admin · ${cms.business.shortName}`
    : `${cms.business.businessName} | ${cms.business.primaryKeyword.en}`;

  const desc = cms.sections.hero.subheadline.en;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', desc);
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', `${cms.business.businessName}`);
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', desc);
}

export function CmsProvider({ children }: { children: React.ReactNode }) {
  const [cms, setCms] = useState<SiteCmsData>(defaultSiteCms);
  const [loading, setLoading] = useState(true);

  const refreshCms = useCallback(async () => {
    try {
      const res = await fetch('/api/cms', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { cms?: SiteCmsData };
      if (data?.cms) {
        setCms(data.cms);
      }
    } catch {
      // keep fallback CMS on offline/transient error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCms();
    const handleCmsUpdated = () => {
      void refreshCms();
    };
    window.addEventListener('clearview:cms-updated', handleCmsUpdated);
    return () => window.removeEventListener('clearview:cms-updated', handleCmsUpdated);
  }, [refreshCms]);

  useEffect(() => {
    applyThemeCssVariables(cms);
    syncDocumentMetadata(cms);
  }, [cms]);

  return (
    <CmsContext.Provider
      value={{
        cms,
        loading,
        refreshCms,
        setCmsLocal: setCms,
      }}
    >
      {children}
    </CmsContext.Provider>
  );
}

export function useCms(): CmsContextValue {
  const ctx = useContext(CmsContext);
  if (!ctx) {
    throw new Error('useCms must be used within a CmsProvider');
  }
  return ctx;
}
