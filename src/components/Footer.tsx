import { Clock, MapPin, Navigation, Phone, Mail } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCallModal } from '../context/CallContext';
import { useCms } from '../context/CmsContext';

interface FooterProps {
  onOpenContractorTool: () => void;
  onOpenOwnerDashboard: () => void;
  onNavigateAdmin: () => void;
}

const GOOGLE_MAPS_URL = 'https://maps.app.goo.gl/jxx9k4PnS1odePzy6';
const STREET_ADDRESS = '1680 Duval Pond Rd';
const PLUS_CODE = 'GHWW+VF Madison, Florida';

export function Footer({
  onOpenContractorTool,
  onOpenOwnerDashboard,
  onNavigateAdmin,
}: FooterProps) {
  const { language, t } = useLanguage();
  const { openCallModal } = useCallModal();
  const { cms } = useCms();
  const biz = cms.business;
  const heroCopy = cms.sections.hero;
  const footerCopy = cms.sections.footer;

  const mapLocationQuery = `${STREET_ADDRESS}, ${biz.cityState?.trim() || 'Madison, FL 32340'}`;

  const weeklyHours =
    language === 'es'
      ? [
          { day: 'Lun, Mié, Jue, Vie', hours: '9:00 AM – 5:00 PM' },
          { day: 'Martes', hours: '12:00 PM – 5:00 PM' },
          { day: 'Sábado y Domingo', hours: 'Cerrado' },
        ]
      : [
          { day: 'Mon, Wed, Thu, Fri', hours: '9:00 AM – 5:00 PM' },
          { day: 'Tuesday', hours: '12:00 PM – 5:00 PM' },
          { day: 'Saturday & Sunday', hours: 'Closed' },
        ];

  return (
    <footer className="wood-grain-band text-neutral-300 border-t-2 border-[var(--cv-accent)]/35">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-16 pb-24 sm:pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-10 border-b border-[var(--cv-accent)]/20">
          {/* Business Identity */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center gap-4">
              {biz.logoUrl ? (
                <img
                  src={biz.logoUrl}
                  alt={biz.businessName}
                  referrerPolicy="no-referrer"
                  className="h-24 w-24 rounded-lg object-cover bg-[#2C1E14] border-2 border-[var(--cv-accent)]/60 shadow-lg shrink-0"
                />
              ) : (
                <span className="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-[var(--cv-primary)] text-white font-display font-bold text-2xl shrink-0">
                  {biz.brandMonogram}
                </span>
              )}
              <span className="font-display text-xl font-bold text-white leading-tight">
                {biz.businessName}
              </span>
            </div>
            <p className="text-sm text-neutral-300/85 leading-relaxed max-w-sm">
              {footerCopy.tagline[language]}
            </p>
            <p className="text-xs font-semibold text-[var(--cv-accent)]">
              {heroCopy.licensedLabel[language]} · {heroCopy.spanishBadge[language]}
            </p>
          </div>

          {/* NAP & Contact */}
          <div className="lg:col-span-3 space-y-3">
            <h3 className="text-xs font-semibold tracking-wide text-[var(--cv-accent)] uppercase">
              {t.footer.contactTitle}
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin
                  className="w-4 h-4 text-[var(--cv-light-green)] shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-white font-medium">{STREET_ADDRESS}</p>
                  <p className="text-neutral-300">{biz.cityState || 'Madison, FL 32340'}</p>
                  <p className="text-xs font-mono text-[var(--cv-accent)]/90 mt-0.5">{PLUS_CODE}</p>
                </div>
              </li>
              <li>
                <a
                  href={biz.phoneHref}
                  onClick={(e) => {
                    e.preventDefault();
                    openCallModal();
                  }}
                  className="inline-flex items-center gap-2.5 text-white hover:text-[var(--cv-accent)] font-mono tabular-nums transition-colors"
                >
                  <Phone className="w-4 h-4 text-[var(--cv-light-green)] shrink-0" aria-hidden="true" />
                  <span>{biz.phone}</span>
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${biz.email}`}
                  className="inline-flex items-center gap-2.5 hover:text-[var(--cv-accent)] transition-colors break-all"
                >
                  <Mail className="w-4 h-4 text-[var(--cv-light-green)] shrink-0" aria-hidden="true" />
                  <span>{biz.email}</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Operating Hours & Service Areas */}
          <div className="lg:col-span-3 space-y-5">
            <div className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide text-[var(--cv-accent)] uppercase">
                {t.footer.hoursTitle}
              </h3>
              <div className="space-y-1 text-xs font-mono text-neutral-300">
                {weeklyHours.map((row) => (
                  <div key={row.day} className="flex items-center justify-between gap-2">
                    <span className="text-neutral-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[var(--cv-light-green)] shrink-0" aria-hidden="true" />
                      {row.day}:
                    </span>
                    <span className="text-white font-medium">{row.hours}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold tracking-wide text-[var(--cv-accent)] uppercase">
                {t.footer.serviceAreaTitle}
              </h3>
              <p className="text-sm text-neutral-300/85 leading-relaxed">
                {STREET_ADDRESS}, {biz.cityState} · {biz.serviceArea}
              </p>
            </div>
          </div>

          {/* Navigation */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-xs font-semibold tracking-wide text-[var(--cv-accent)] uppercase">
              {t.footer.navigationTitle}
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#estimator" className="hover:text-[var(--cv-accent)] transition-colors">
                  {t.nav.estimator}
                </a>
              </li>
              <li>
                <a href="#schedule" className="hover:text-[var(--cv-accent)] transition-colors">
                  {t.nav.schedule}
                </a>
              </li>
              <li>
                <a href="#services" className="hover:text-[var(--cv-accent)] transition-colors">
                  {t.nav.services}
                </a>
              </li>
              <li>
                <a href="#our-work" className="hover:text-[var(--cv-accent)] transition-colors">
                  {t.nav.ourWork}
                </a>
              </li>
              <li>
                <a href="#reviews" className="hover:text-[var(--cv-accent)] transition-colors">
                  {t.nav.reviews}
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-[var(--cv-accent)] transition-colors">
                  {t.nav.faq}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Service Location Map & Directions Bar */}
        <div className="py-8 border-b border-[var(--cv-accent)]/20">
          <div className="rounded-xl overflow-hidden border border-[var(--cv-accent)]/25 bg-[var(--cv-dark-card)]">
            <div className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-[var(--cv-accent)] shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {language === 'es'
                      ? `Ubicación Base: ${mapLocationQuery}`
                      : `Service Base: ${mapLocationQuery}`}
                  </p>
                  <p className="text-xs text-neutral-300/80">
                    {PLUS_CODE} · {biz.serviceCities.join(' · ')}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={GOOGLE_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--cv-primary)] hover:bg-[var(--cv-primary-dark)] text-white px-3.5 py-2 text-xs font-semibold transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{language === 'es' ? 'Ver en Google Maps' : 'Open in Google Maps'}</span>
                </a>
              </div>
            </div>

            <div className="px-4 sm:px-5 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#2D1F16] via-[#261A12] to-[#1D2818]">
              <div className="space-y-1 max-w-2xl">
                <p className="text-sm font-medium text-neutral-100">
                  {language === 'es'
                    ? `Cobertura móvil desde ${mapLocationQuery} hacia Madison, Monticello, Perry, Live Oak y Lake City.`
                    : `Mobile dispatch operating out of ${mapLocationQuery} across Madison, Monticello, Perry, Live Oak, and Lake City.`}
                </p>
                <p className="text-xs text-neutral-400">
                  {language === 'es'
                    ? 'Haz clic en "Ver en Google Maps" para explorar la ubicación exacta o abrir rutas.'
                    : 'Select "Open in Google Maps" to view our Madison location and get driving directions.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 shrink-0">
                {biz.serviceCities.slice(0, 6).map((city) => (
                  <span
                    key={city}
                    className="rounded bg-[#231710]/80 border border-[var(--cv-accent)]/30 px-2.5 py-1 text-xs font-medium text-[var(--cv-accent)]"
                  >
                    {city}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-neutral-400">
          <p>
            © {new Date().getFullYear()} {biz.businessName}. {footerCopy.rightsReserved[language]}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onOpenOwnerDashboard}
              className="text-[var(--cv-accent)] hover:text-white underline underline-offset-4 transition-colors cursor-pointer font-semibold"
            >
              {t.footer.ownerAgendaButton}
            </button>
            <button
              type="button"
              onClick={onOpenContractorTool}
              className="text-neutral-300 hover:text-[var(--cv-accent)] underline underline-offset-4 transition-colors cursor-pointer"
            >
              {t.footer.contractorToolButton}
            </button>
            <a
              href="/admin"
              onClick={(e) => {
                e.preventDefault();
                onNavigateAdmin();
              }}
              className="text-neutral-400 hover:text-[var(--cv-accent)] underline underline-offset-4 transition-colors cursor-pointer"
            >
              Admin CMS
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
