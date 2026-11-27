import React, { useEffect, useState } from 'react';
import { CheckCircle2, MapPin, Phone, ShieldCheck, Star } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCallModal } from '../context/CallContext';
import { useCms } from '../context/CmsContext';

interface HeroSectionProps {
  selectedServiceId?: string;
}

export function HeroSection({ selectedServiceId }: HeroSectionProps) {
  const { language, t } = useLanguage();
  const { openCallModal } = useCallModal();
  const { cms } = useCms();
  const biz = cms.business;
  const heroCopy = cms.sections.hero;

  const [heroImgFailed, setHeroImgFailed] = useState(false);

  useEffect(() => {
    setHeroImgFailed(false);
  }, [biz.heroImageUrl]);

  const matchedService = selectedServiceId
    ? cms.services.find((item) => item.id === selectedServiceId)
    : undefined;
  const selectedServiceTitle = matchedService
    ? language === 'es'
      ? matchedService.titleEs
      : matchedService.titleEn
    : undefined;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [acreageIndex, setAcreageIndex] = useState(1);
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedData, setSubmittedData] = useState<{
    name: string;
    phone: string;
    location: string;
    acreageIndex: number;
    serviceId?: string;
  } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const digitsOnly = phone.replace(/\D/g, '');
    if (!name.trim() || digitsOnly.length < 7 || !location.trim()) {
      setErrorMsg(t.hero.validationError);
      return;
    }
    setErrorMsg('');
    setSubmittedData({
      name: name.trim(),
      phone: phone.trim(),
      location: location.trim(),
      acreageIndex,
      serviceId: selectedServiceId,
    });
  };

  const handleReset = () => {
    setSubmittedData(null);
    setName('');
    setPhone('');
    setLocation('');
    setErrorMsg('');
  };

  return (
    <section
      id="top"
      className="relative bg-[var(--cv-dark-surface)] text-white overflow-hidden border-b border-white/10"
    >
      {/* Hero Photography Backdrop with Measured Contrast Scrim */}
      <div className="absolute inset-0 pointer-events-none">
        {!heroImgFailed && biz.heroImageUrl ? (
          <img
            src={biz.heroImageUrl}
            alt={biz.primaryKeyword[language]}
            referrerPolicy="no-referrer"
            onError={() => setHeroImgFailed(true)}
            className="w-full h-full object-cover object-center opacity-45"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#312118] via-[var(--cv-dark-surface)] to-[#162212]" />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#231710]/95 via-[#231710]/85 to-[#1E3319]/75"
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          {/* Left Column: Primary Value Proposition & Trust */}
          <div className="lg:col-span-7 space-y-6">
            {/* Unboxed Metadata Line + Hablamos Español Marker */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs sm:text-sm font-medium text-neutral-300">
              <span className="inline-flex items-center gap-1.5 text-[var(--cv-light-green)]">
                <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                {heroCopy.licensedLabel[language]}
              </span>
              <span aria-hidden="true" className="text-neutral-500">
                ·
              </span>
              <span className="text-white font-semibold">{heroCopy.spanishBadge[language]}</span>
              <span aria-hidden="true" className="text-neutral-500">
                ·
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" aria-hidden="true" />
                {biz.cityState}
              </span>
            </div>

            {/* H1 Primary Keyword */}
            <h1
              className="font-display font-bold tracking-tight text-white leading-[1.03] max-w-2xl"
              style={{
                fontSize: 'clamp(2.4rem, 4.4vw, 3.9rem)',
                textWrap: 'balance',
              }}
            >
              {biz.primaryKeyword[language]}
            </h1>

            {/* Subheadline */}
            <p className="text-base sm:text-lg text-neutral-200 leading-relaxed max-w-2xl">
              {heroCopy.subheadline[language]}
            </p>

            {/* Google Rating Pill & Operating Hours */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <a
                href="#reviews"
                className="inline-flex items-center gap-2.5 bg-[#312118] hover:bg-[#3E2A1E] border border-[var(--cv-accent)]/35 px-3.5 py-2 rounded-full transition-colors duration-150"
              >
                <div className="flex items-center gap-0.5 text-[var(--cv-accent)]" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star key={idx} className="w-3.5 h-3.5 fill-current" />
                  ))}
                </div>
                <span className="text-xs sm:text-sm font-semibold text-white tabular-nums">
                  {biz.googleRatingLabel[language]}
                </span>
                <span className="text-xs text-neutral-400">· {t.hero.googleReviewsSuffix}</span>
              </a>

              <span className="text-xs sm:text-sm text-neutral-300 font-mono tabular-nums">
                {biz.operatingHours[language]}
              </span>
            </div>

            {/* Primary Call & Service Area Row */}
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <a
                href={biz.phoneHref}
                onClick={(e) => {
                  e.preventDefault();
                  openCallModal();
                }}
                className="inline-flex items-center gap-2.5 bg-[var(--cv-primary)] hover:bg-[var(--cv-primary-dark)] text-white font-semibold text-sm sm:text-base px-6 py-3 rounded-md transition-colors duration-150 whitespace-nowrap"
              >
                <Phone className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {heroCopy.ctaCall[language]}{' '}
                  <span className="font-mono tabular-nums">{biz.phone}</span>
                </span>
              </a>

              <a
                href="#estimator"
                className="inline-flex items-center justify-center border border-white/25 hover:border-[var(--cv-accent)] text-white hover:text-[var(--cv-accent)] font-medium text-sm sm:text-base px-5 py-3 rounded-md transition-colors duration-150 whitespace-nowrap"
              >
                {t.nav.estimator}
              </a>
            </div>

            <p className="text-xs sm:text-sm text-neutral-400 pt-1">
              <span className="text-neutral-300 font-medium">
                {heroCopy.serviceAreaPrefix[language]}:
              </span>{' '}
              {biz.serviceArea}
            </p>
          </div>

          {/* Right Column: Quick Site-Visit Request Form */}
          <div className="lg:col-span-5" id="site-visit-form">
            <div className="bg-[var(--cv-dark-card)] border border-white/15 rounded-xl p-6 sm:p-7 shadow-xl">
              {submittedData ? (
                <div className="space-y-4 py-4">
                  <div className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-[var(--cv-primary)]/25 text-[var(--cv-light-green)]">
                    <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <h2 className="font-display text-2xl font-bold text-white">
                    {t.hero.successTitle}
                  </h2>
                  <p className="text-sm text-neutral-300 leading-relaxed">
                    {t.hero.successMessage}
                  </p>
                  <div className="bg-[var(--cv-dark-surface)] border border-white/10 rounded-lg p-4 text-xs sm:text-sm space-y-1.5 text-neutral-200">
                    <div>
                      <span className="text-neutral-400">{t.hero.nameLabel}:</span>{' '}
                      <span className="font-medium text-white">{submittedData.name}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400">{t.hero.phoneLabel}:</span>{' '}
                      <span className="font-mono tabular-nums text-white">{submittedData.phone}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400">{t.hero.locationLabel}:</span>{' '}
                      <span className="text-white">{submittedData.location}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400">{t.hero.acreageLabel}:</span>{' '}
                      <span className="text-white">
                        {t.hero.acreageOptions[submittedData.acreageIndex]}
                      </span>
                    </div>
                    {submittedData.serviceId && (
                      <div>
                        <span className="text-neutral-400">{t.hero.serviceFocusLabel}:</span>{' '}
                        <span className="text-[var(--cv-accent)] font-medium">
                          {(() => {
                            const s = cms.services.find((item) => item.id === submittedData.serviceId);
                            return s ? (language === 'es' ? s.titleEs : s.titleEn) : '';
                          })()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <a
                      href={biz.phoneHref}
                      onClick={(e) => {
                        e.preventDefault();
                        openCallModal();
                      }}
                      className="inline-flex items-center gap-2 bg-[var(--cv-primary)] hover:bg-[var(--cv-primary-dark)] text-white font-semibold text-sm px-4 py-2.5 rounded-md transition-colors"
                    >
                      <Phone className="w-4 h-4" aria-hidden="true" />
                      <span className="font-mono tabular-nums">{biz.phone}</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-sm font-medium text-neutral-300 hover:text-white px-4 py-2.5 rounded-md border border-white/15 hover:border-white/30 transition-colors cursor-pointer"
                    >
                      {t.hero.successReset}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                  <div className="space-y-1">
                    <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                      {heroCopy.formTitle[language]}
                    </h2>
                    <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                      {heroCopy.formSubtitle[language]}
                    </p>
                  </div>

                  {selectedServiceTitle && (
                    <div className="text-xs text-[var(--cv-accent)] bg-[var(--cv-primary)]/20 border border-[var(--cv-light-green)]/40 rounded-md px-3 py-2">
                      {t.hero.serviceFocusLabel}:{' '}
                      <span className="font-semibold">{selectedServiceTitle}</span>
                    </div>
                  )}

                  <div className="space-y-3.5">
                    <div>
                      <label
                        htmlFor="lead-name"
                        className="block text-xs font-semibold text-neutral-200 mb-1.5"
                      >
                        {t.hero.nameLabel}
                      </label>
                      <input
                        id="lead-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t.hero.namePlaceholder}
                        className="w-full bg-[var(--cv-dark-surface)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="lead-phone"
                        className="block text-xs font-semibold text-neutral-200 mb-1.5"
                      >
                        {t.hero.phoneLabel}
                      </label>
                      <input
                        id="lead-phone"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder={t.hero.phonePlaceholder}
                        className="w-full bg-[var(--cv-dark-surface)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3.5 py-2.5 text-sm text-white font-mono placeholder:text-neutral-500"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="lead-location"
                        className="block text-xs font-semibold text-neutral-200 mb-1.5"
                      >
                        {t.hero.locationLabel}
                      </label>
                      <input
                        id="lead-location"
                        type="text"
                        required
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder={
                          biz.serviceCities.length > 0
                            ? `${language === 'es' ? 'Ej.' : 'e.g.'} ${biz.serviceCities.slice(0, 3).join(', ')}`
                            : t.hero.locationPlaceholder
                        }
                        className="w-full bg-[var(--cv-dark-surface)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="lead-acreage"
                        className="block text-xs font-semibold text-neutral-200 mb-1.5"
                      >
                        {t.hero.acreageLabel}
                      </label>
                      <select
                        id="lead-acreage"
                        value={acreageIndex}
                        onChange={(e) => setAcreageIndex(Number(e.target.value))}
                        className="w-full bg-[var(--cv-dark-surface)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3.5 py-2.5 text-sm text-white"
                      >
                        {t.hero.acreageOptions.map((opt, idx) => (
                          <option key={opt} value={idx} className="bg-[var(--cv-dark-surface)] text-white">
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {errorMsg && (
                    <p role="alert" className="text-xs text-[var(--cv-accent)] font-medium">
                      {errorMsg}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-[var(--cv-primary)] hover:bg-[var(--cv-primary-dark)] text-white font-semibold text-sm sm:text-base py-3 px-4 rounded-md transition-colors duration-150 cursor-pointer"
                  >
                    {t.hero.submitButton}
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
