import { useCallback, useEffect, useState } from 'react';
import { LanguageProvider } from './context/LanguageContext';
import { CmsProvider, useCms } from './context/CmsContext';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { LotEstimator } from './components/LotEstimator';
import { SiteVisitCalendar } from './components/SiteVisitCalendar';
import { ServicesSection } from './components/ServicesSection';
import { WorkGallery } from './components/WorkGallery';
import { ReviewsSection } from './components/ReviewsSection';
import { FaqSection } from './components/FaqSection';
import { Footer } from './components/Footer';
import { ContractorQuoteModal } from './components/ContractorQuoteModal';
import { OwnerDashboardModal } from './components/OwnerDashboardModal';
import { ProposalData, ProposalDocument } from './components/ProposalDocument';
import { AiReceptionistWidget } from './components/AiReceptionistWidget';
import { CallDispatchModal } from './components/CallDispatchModal';
import { AdminCmsDashboard } from './components/AdminCmsDashboard';
import { CallProvider } from './context/CallContext';

function createInitialProposalData(brandMonogram: string): ProposalData {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');

  return {
    quoteNumber: `${brandMonogram}-${y}-${m}${d}`,
    issueDate: now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    clientName: '',
    clientContact: '',
    propertyAddress: '',
    acreage: '2.00 Acres',
    scopeOfWork:
      '• Forestry Mulching: Grind standing underbrush, saplings, and scrub into uniform natural ground cover.',
    totalPrice: 2850,
    depositPercent: 30,
    validFor: '14 Days',
  };
}

function AppContent() {
  const { cms } = useCms();
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window === 'undefined') return '/';
    if (window.location.hash === '#/admin') return '/admin';
    return window.location.pathname;
  });
  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>(
    undefined
  );
  const [contractorToolOpen, setContractorToolOpen] = useState(false);
  const [ownerDashboardOpen, setOwnerDashboardOpen] = useState(false);
  const [proposalData, setProposalData] = useState<ProposalData>(() =>
    createInitialProposalData(cms.business.brandMonogram)
  );

  const navigateTo = useCallback((path: string) => {
    if (typeof window === 'undefined') return;
    const isSubpathOrStatic =
      window.location.hostname.endsWith('.github.io') ||
      (import.meta.env.BASE_URL === './' &&
        window.location.pathname !== '/' &&
        !window.location.pathname.startsWith('/admin'));

    if (isSubpathOrStatic) {
      window.location.hash = path === '/admin' ? '#/admin' : '';
      setCurrentPath(path);
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    const syncRoute = () => {
      if (window.location.hash === '#/admin') {
        setCurrentPath('/admin');
      } else {
        setCurrentPath(window.location.pathname);
      }
    };
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
    };
  }, []);

  const isAdminRoute =
    currentPath === '/admin' ||
    currentPath.startsWith('/admin/') ||
    currentPath.endsWith('/admin');

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = isAdminRoute
      ? `CMS Admin · ${cms.business.shortName}`
      : `${cms.business.businessName} | ${cms.business.primaryKeyword.en}`;
  }, [isAdminRoute, cms.business.businessName, cms.business.primaryKeyword.en, cms.business.shortName]);

  if (isAdminRoute) {
    return <AdminCmsDashboard onNavigatePublic={() => navigateTo('/')} />;
  }

  return (
    <>
      <div
        className={`min-h-screen flex flex-col overflow-x-clip bg-[#F4EFE6] text-[#231710] ${
          contractorToolOpen ? 'print:hidden' : ''
        }`}
      >
        <Header />
        <main className="flex-1">
          <HeroSection selectedServiceId={selectedServiceId} />
          <LotEstimator />
          <SiteVisitCalendar onOpenOwnerDashboard={() => setOwnerDashboardOpen(true)} />
          <ServicesSection onSelectService={setSelectedServiceId} />
          <WorkGallery />
          <ReviewsSection />
          <FaqSection />
        </main>
        <Footer
          onOpenContractorTool={() => setContractorToolOpen(true)}
          onOpenOwnerDashboard={() => setOwnerDashboardOpen(true)}
          onNavigateAdmin={() => navigateTo('/admin')}
        />

        <ContractorQuoteModal
          isOpen={contractorToolOpen}
          onClose={() => setContractorToolOpen(false)}
          proposalData={proposalData}
          onChangeProposalData={setProposalData}
        />

        <OwnerDashboardModal
          isOpen={ownerDashboardOpen}
          onClose={() => setOwnerDashboardOpen(false)}
        />

        <AiReceptionistWidget />
        <CallDispatchModal />
      </div>

      {/* Dedicated Single-Page Print Target for Contractor PDF Export */}
      {contractorToolOpen && (
        <div className="hidden print:block bg-white">
          <ProposalDocument data={proposalData} />
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <CmsProvider>
      <LanguageProvider>
        <CallProvider>
          <AppContent />
        </CallProvider>
      </LanguageProvider>
    </CmsProvider>
  );
}
