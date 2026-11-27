import { useState } from 'react';
import { Menu, Phone, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCallModal } from '../context/CallContext';
import { useCms } from '../context/CmsContext';
import { resolveAssetUrl } from '../utils/assetUrl';

export function Header() {
  const { language, setLanguage, t } = useLanguage();
  const { openCallModal } = useCallModal();
  const { cms } = useCms();
  const biz = cms.business;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '#estimator', label: t.nav.estimator },
    { href: '#schedule', label: t.nav.schedule },
    { href: '#services', label: t.nav.services },
    { href: '#our-work', label: t.nav.ourWork },
    { href: '#reviews', label: t.nav.reviews },
    { href: '#faq', label: t.nav.faq },
  ];

  const handleLinkClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[var(--cv-dark-surface)]/95 backdrop-blur-md border-b border-white/10 text-white">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 min-h-[88px] sm:min-h-[104px] py-2 flex items-center justify-between gap-2 sm:gap-4">
        {/* Zone 1: Brand Logo / Rugged Typographic Wordmark (yields width gracefully on narrow phones) */}
        <a
          href="#top"
          className="flex flex-1 min-w-0 items-center gap-2.5 sm:gap-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cv-accent)] rounded-md xl:flex-initial"
        >
          {biz.logoUrl ? (
            <img
              src={resolveAssetUrl(biz.logoUrl)}
              alt={biz.businessName}
              referrerPolicy="no-referrer"
              className="h-[72px] w-[72px] sm:h-[84px] sm:w-[84px] rounded-lg object-cover bg-[#2C1E14] border-2 border-[var(--cv-accent)]/70 shadow-md shrink-0"
            />
          ) : (
            <span className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded bg-[var(--cv-primary)] text-white font-display font-bold text-xl sm:text-2xl tracking-tight shrink-0">
              {biz.brandMonogram}
            </span>
          )}
          <div className="min-w-0">
            <span className="block font-display text-base sm:text-xl lg:text-2xl font-bold tracking-tight text-white truncate">
              {biz.shortName}
            </span>
            <span className="hidden sm:block text-[11px] font-mono text-[var(--cv-accent)] truncate">
              {biz.cityState}
            </span>
          </div>
        </a>

        {/* Zone 2: Smooth Anchor Links (Desktop >= 1280px) */}
        <nav
          aria-label="Primary"
          className="hidden xl:flex items-center gap-6 text-sm font-medium text-neutral-300"
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="hover:text-[var(--cv-accent)] transition-colors duration-150 whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[var(--cv-accent)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cv-accent)] rounded-sm"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: Language Toggle (EN | ES), Click-to-Call & Always-Visible Hamburger */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <div
            role="group"
            aria-label="Language selector"
            className="inline-flex items-center bg-[#312118] border border-[var(--cv-accent)]/25 rounded-md p-0.5 shrink-0"
          >
            <button
              type="button"
              onClick={() => setLanguage('en')}
              aria-pressed={language === 'en'}
              className={`px-1.5 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                language === 'en'
                  ? 'bg-[var(--cv-accent)] text-[var(--cv-dark-surface)]'
                  : 'text-neutral-300 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage('es')}
              aria-pressed={language === 'es'}
              className={`px-1.5 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                language === 'es'
                  ? 'bg-[var(--cv-accent)] text-[var(--cv-dark-surface)]'
                  : 'text-neutral-300 hover:text-white'
              }`}
            >
              ES
            </button>
          </div>

          <a
            href={biz.phoneHref}
            onClick={(e) => {
              e.preventDefault();
              openCallModal();
            }}
            aria-label={`${t.nav.callNow}: ${biz.phone}`}
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-[var(--cv-primary)] hover:bg-[var(--cv-primary-dark)] text-white font-semibold text-xs sm:text-sm h-9 px-2.5 sm:px-4 rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cv-accent)]"
          >
            <Phone className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline font-mono tabular-nums">{biz.phone}</span>
            <span className="hidden min-[430px]:inline sm:hidden">{t.nav.callNow}</span>
          </a>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? t.nav.closeMenu : t.nav.openMenu}
            className="xl:hidden inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-md border border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/35 transition-colors shrink-0 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile / Tablet Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-[var(--cv-dark-surface)] border-t border-white/10 px-4 py-4 space-y-1 shadow-xl">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={handleLinkClick}
              className="block px-3 py-2.5 rounded-md text-base font-medium text-neutral-200 hover:bg-white/5 hover:text-[var(--cv-accent)] transition-colors"
            >
              {link.label}
            </a>
          ))}
          <div className="pt-2 mt-2 border-t border-white/10 sm:hidden">
            <a
              href={biz.phoneHref}
              onClick={(e) => {
                e.preventDefault();
                setMobileMenuOpen(false);
                openCallModal();
              }}
              className="flex items-center justify-center gap-2 w-full rounded-md bg-[var(--cv-primary)] hover:bg-[var(--cv-primary-dark)] text-white font-semibold py-2.5 text-sm"
            >
              <Phone className="w-4 h-4" aria-hidden="true" />
              <span className="font-mono tabular-nums">{biz.phone}</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
