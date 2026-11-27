import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  BadgePercent,
  Calculator,
  Check,
  CheckCircle2,
  Disc,
  Phone,
  Shovel,
  Sprout,
  TreePine,
  Trees,
  Truck,
  Wrench,
} from 'lucide-react';
import { formatUsd } from '../data/pricingConfig';
import {
  calculateDynamicLotEstimate,
  getDensityPreviewForLot,
} from '../data/defaultCms';
import { useLanguage } from '../context/LanguageContext';
import { useCallModal } from '../context/CallContext';
import { useCms } from '../context/CmsContext';
import type { CmsAddonIcon, CmsDensityIcon } from '../types/cms';

interface LockedEstimateSummary {
  name: string;
  phone: string;
  address: string;
  timelineIndex: number;
  lotLabel: string;
  densityLabel: string;
  addonLabels: string[];
  totalMin: number;
  totalMax: number;
  hasBulkDiscount: boolean;
  isFivePlus: boolean;
}

const densityIconMap: Record<CmsDensityIcon, React.ComponentType<{ className?: string }>> = {
  sprout: Sprout,
  trees: Trees,
  treepine: TreePine,
};

const addonIconMap: Record<CmsAddonIcon, React.ComponentType<{ className?: string }>> = {
  disc: Disc,
  truck: Truck,
  shovel: Shovel,
  wrench: Wrench,
};

export function LotEstimator() {
  const { language, t } = useLanguage();
  const { openCallModal } = useCallModal();
  const { cms } = useCms();
  const pricing = cms.pricing;
  const biz = cms.business;
  const sec = cms.sections.estimator;

  const [lotSizeId, setLotSizeId] = useState<string>(
    pricing.lotSizes[2]?.id ?? pricing.lotSizes[0]?.id ?? '1.00'
  );
  const [densityId, setDensityId] = useState<string>(
    pricing.densities[1]?.id ?? pricing.densities[0]?.id ?? 'medium'
  );
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [lockedSummary, setLockedSummary] = useState<LockedEstimateSummary | null>(null);

  useEffect(() => {
    if (pricing.lotSizes.length > 0 && !pricing.lotSizes.some((l) => l.id === lotSizeId)) {
      setLotSizeId(pricing.lotSizes[0].id);
    }
    if (pricing.densities.length > 0 && !pricing.densities.some((d) => d.id === densityId)) {
      setDensityId(pricing.densities[0].id);
    }
    setSelectedAddons((prev) =>
      prev.filter((id) => pricing.addons.some((addon) => addon.id === id))
    );
  }, [pricing, lotSizeId, densityId]);

  const activeLot = useMemo(
    () => pricing.lotSizes.find((l) => l.id === lotSizeId) ?? pricing.lotSizes[0],
    [pricing.lotSizes, lotSizeId]
  );

  const activeDensity = useMemo(
    () => pricing.densities.find((d) => d.id === densityId) ?? pricing.densities[0],
    [pricing.densities, densityId]
  );

  const estimate = useMemo(
    () => calculateDynamicLotEstimate(pricing, lotSizeId, densityId, selectedAddons),
    [pricing, lotSizeId, densityId, selectedAddons]
  );

  const discountPct = Math.round(pricing.bulkDiscountRate * 100);

  const toggleAddon = (id: string) => {
    setSelectedAddons((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const getDensityPreviewLabel = (densityItem: typeof pricing.densities[number]): string => {
    const preview = getDensityPreviewForLot(densityItem, activeLot);
    if (!preview.isPerAcre) {
      return `${formatUsd(preview.min)} – ${formatUsd(preview.max)}`;
    }
    return `${formatUsd(preview.min)} – ${formatUsd(preview.max)} ${t.estimator.perAcreSuffix}`;
  };

  const activeLotLabel = activeLot
    ? language === 'es'
      ? activeLot.labelEs
      : activeLot.labelEn
    : lotSizeId;

  const activeDensityLabel = activeDensity
    ? language === 'es'
      ? activeDensity.labelEs
      : activeDensity.labelEn
    : densityId;

  const handleLockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const digitsOnly = phone.replace(/\D/g, '');
    if (!name.trim() || digitsOnly.length < 7 || !address.trim()) {
      setErrorMsg(t.estimator.validationError);
      return;
    }
    setErrorMsg('');
    const addonLabels = selectedAddons
      .map((id) => {
        const item = pricing.addons.find((a) => a.id === id);
        return item ? (language === 'es' ? item.labelEs : item.labelEn) : '';
      })
      .filter(Boolean);

    setLockedSummary({
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      timelineIndex,
      lotLabel: activeLotLabel,
      densityLabel: activeDensityLabel,
      addonLabels,
      totalMin: estimate.totalMin,
      totalMax: estimate.totalMax,
      hasBulkDiscount: estimate.hasBulkDiscount,
      isFivePlus: estimate.isFivePlus,
    });
  };

  return (
    <section id="estimator" className="bg-[#F4EFE6] py-16 sm:py-22 border-b border-[#DDD1C0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Section Header */}
        <div className="max-w-2xl space-y-3">
          <p className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[var(--cv-primary)]">
            <Calculator className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{sec.kicker[language]}</span>
          </p>
          <h2
            className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#231710]"
            style={{ textWrap: 'balance' }}
          >
            {sec.title[language]}
          </h2>
          <p className="text-sm sm:text-base text-neutral-600 leading-relaxed">
            {sec.subtitle[language]}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: 3-Step Configuration */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8">
            {/* Mobile Sticky Live Estimate Board */}
            <div className="lg:hidden sticky top-[68px] z-30">
              <div className="bg-[var(--cv-dark-surface)]/95 backdrop-blur-md text-white border border-[var(--cv-light-green)]/45 rounded-xl px-3.5 py-2.5 shadow-xl flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-300 truncate">
                    {t.estimator.outputTitle}
                  </p>
                  <p className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--cv-accent)] tabular-nums leading-tight">
                    {formatUsd(estimate.totalMin)} – {formatUsd(estimate.totalMax)}
                    {estimate.isFivePlus ? '+' : ''}
                  </p>
                  <p className="text-[11px] text-neutral-300 truncate mt-0.5">
                    {activeLotLabel} · {activeDensityLabel}
                    {selectedAddons.length > 0
                      ? ` · +${selectedAddons.length} ${t.estimator.mobileAddonsShort}`
                      : ''}
                    {estimate.hasBulkDiscount ? ` · -${discountPct}%` : ''}
                  </p>
                </div>

                <a
                  href="#estimator-summary"
                  className="inline-flex items-center gap-1.5 bg-[var(--cv-primary)] hover:bg-[var(--cv-primary-dark)] text-white font-semibold text-xs px-3 py-2 rounded-md transition-colors shrink-0 whitespace-nowrap"
                >
                  <span>{t.estimator.mobileJumpToSummary}</span>
                  <ArrowDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                </a>
              </div>
            </div>

            {/* Step 1: Lot Size */}
            <div className="bg-white border border-[#DDD1C0] rounded-xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-xl sm:text-2xl font-bold text-[#231710]">
                  {t.estimator.step1Title}
                </h3>
                {activeLot?.isBulkDiscountEligible && (
                  <span className="inline-flex items-center gap-1.5 bg-[var(--cv-accent)] text-[var(--cv-dark-surface)] text-xs font-bold px-2.5 py-1 rounded">
                    <BadgePercent className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{sec.bulkDiscountBadge[language]}</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {pricing.lotSizes.map((lot) => {
                  const isSelected = lotSizeId === lot.id;
                  const label = language === 'es' ? lot.labelEs : lot.labelEn;
                  const subtitle = language === 'es' ? lot.subtitleEs : lot.subtitleEn;

                  return (
                    <button
                      key={lot.id}
                      type="button"
                      onClick={() => setLotSizeId(lot.id)}
                      aria-pressed={isSelected}
                      className={`relative text-left p-3.5 rounded-lg border transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cv-primary)] ${
                        isSelected
                          ? 'bg-[var(--cv-primary)] border-[var(--cv-primary)] text-white'
                          : 'bg-[#F4EFE6] border-[#DDD1C0] text-[#231710] hover:border-[var(--cv-primary)]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-xl font-bold tabular-nums leading-none">
                          {label}
                        </span>
                        {isSelected && (
                          <Check className="w-4 h-4 text-[var(--cv-accent)] shrink-0" aria-hidden="true" />
                        )}
                      </div>
                      <p
                        className={`text-xs mt-1.5 leading-snug ${
                          isSelected ? 'text-white/85' : 'text-neutral-600'
                        }`}
                      >
                        {subtitle}
                      </p>
                      {lot.isBulkDiscountEligible && (
                        <p
                          className={`text-[11px] font-semibold mt-2 ${
                            isSelected ? 'text-[var(--cv-accent)]' : 'text-[var(--cv-primary)]'
                          }`}
                        >
                          {sec.bulkDiscountBadge[language]}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Vegetation Density */}
            <div className="bg-white border border-[#DDD1C0] rounded-xl p-5 sm:p-6 space-y-4">
              <h3 className="font-display text-xl sm:text-2xl font-bold text-[#231710]">
                {t.estimator.step2Title}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {pricing.densities.map((den) => {
                  const isSelected = densityId === den.id;
                  const label = language === 'es' ? den.labelEs : den.labelEn;
                  const description = language === 'es' ? den.descriptionEs : den.descriptionEn;
                  const Icon = densityIconMap[den.icon] ?? Trees;

                  return (
                    <button
                      key={den.id}
                      type="button"
                      onClick={() => setDensityId(den.id)}
                      aria-pressed={isSelected}
                      className={`flex flex-col justify-between text-left p-4 rounded-lg border transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cv-primary)] ${
                        isSelected
                          ? 'bg-[var(--cv-primary)] border-[var(--cv-primary)] text-white'
                          : 'bg-[#F4EFE6] border-[#DDD1C0] text-[#231710] hover:border-[var(--cv-primary)]/50'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`w-8 h-8 rounded-md flex items-center justify-center ${
                              isSelected
                                ? 'bg-[var(--cv-accent)] text-[var(--cv-dark-surface)]'
                                : 'bg-white border border-[#DDD1C0] text-[var(--cv-primary)]'
                            }`}
                          >
                            <Icon className="w-4 h-4" aria-hidden="true" />
                          </span>
                          {isSelected && (
                            <Check className="w-4 h-4 text-[var(--cv-accent)] shrink-0" aria-hidden="true" />
                          )}
                        </div>

                        <div>
                          <p className="font-display text-xl font-bold leading-tight">{label}</p>
                          <p
                            className={`text-xs mt-1 leading-relaxed ${
                              isSelected ? 'text-white/85' : 'text-neutral-600'
                            }`}
                          >
                            {description}
                          </p>
                        </div>
                      </div>

                      <p
                        className={`font-mono text-xs font-semibold tabular-nums pt-3 mt-3 border-t ${
                          isSelected
                            ? 'border-white/20 text-[var(--cv-accent)]'
                            : 'border-[#DDD1C0] text-[#231710]'
                        }`}
                      >
                        {getDensityPreviewLabel(den)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Optional Add-Ons */}
            {pricing.addons.length > 0 && (
              <div className="bg-white border border-[#DDD1C0] rounded-xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-[#231710]">
                    {t.estimator.step3Title}
                  </h3>
                  <span className="text-xs font-medium text-neutral-500">
                    {t.estimator.step3Optional}
                  </span>
                </div>

                <div className="space-y-3">
                  {pricing.addons.map((addon) => {
                    const isChecked = selectedAddons.includes(addon.id);
                    const label = language === 'es' ? addon.labelEs : addon.labelEn;
                    const description = language === 'es' ? addon.descriptionEs : addon.descriptionEn;
                    const Icon = addonIconMap[addon.icon] ?? Wrench;

                    return (
                      <button
                        key={addon.id}
                        type="button"
                        role="switch"
                        aria-checked={isChecked}
                        onClick={() => toggleAddon(addon.id)}
                        className={`w-full flex items-center justify-between gap-4 p-4 rounded-lg border text-left transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cv-primary)] ${
                          isChecked
                            ? 'bg-[var(--cv-primary)] border-[var(--cv-primary)] text-white'
                            : 'bg-[#F4EFE6] border-[#DDD1C0] text-[#231710] hover:border-[var(--cv-primary)]/50'
                        }`}
                      >
                        <div className="flex items-start gap-3.5 min-w-0">
                          <span
                            className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              isChecked
                                ? 'bg-[var(--cv-accent)] border-[var(--cv-accent)] text-[var(--cv-dark-surface)]'
                                : 'bg-white border-neutral-300 text-transparent'
                            }`}
                            aria-hidden="true"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </span>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Icon
                                className={`w-4 h-4 shrink-0 ${
                                  isChecked ? 'text-[var(--cv-accent)]' : 'text-[var(--cv-primary)]'
                                }`}
                                aria-hidden="true"
                              />
                              <span className="text-sm sm:text-base font-semibold">{label}</span>
                            </div>
                            <p
                              className={`text-xs mt-0.5 ${
                                isChecked ? 'text-white/85' : 'text-neutral-600'
                              }`}
                            >
                              {description}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`font-mono text-sm font-bold tabular-nums shrink-0 ${
                            isChecked ? 'text-[var(--cv-accent)]' : 'text-[#231710]'
                          }`}
                        >
                          +{formatUsd(addon.price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Calculated Estimate & Lock-In Lead Capture */}
          <div id="estimator-summary" className="lg:col-span-5 lg:sticky lg:top-24 scroll-mt-20">
            <div className="bg-[var(--cv-dark-surface)] border border-[var(--cv-dark-surface)] rounded-xl overflow-hidden text-white shadow-xl">
              {/* Estimate Readout Header */}
              <div className="p-6 sm:p-7 border-b border-white/10 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold tracking-wide text-neutral-300">
                    {t.estimator.outputTitle}
                  </p>
                  <span className="text-[11px] font-mono text-neutral-400 tabular-nums">
                    {language === 'es'
                      ? `Tarifa mínima de movilización: ${formatUsd(pricing.minimumMobilizationFee)}`
                      : `Minimum mobilization fee: ${formatUsd(pricing.minimumMobilizationFee)}`}
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-[var(--cv-accent)] tabular-nums leading-none">
                    {formatUsd(estimate.totalMin)} – {formatUsd(estimate.totalMax)}
                    {estimate.isFivePlus ? '+' : ''}
                  </p>
                  {estimate.hasBulkDiscount && (
                    <p className="text-xs font-medium text-[var(--cv-light-green)] pt-1">
                      {language === 'es'
                        ? `Base desde ${activeLot?.acres ?? 5} acres · ${discountPct}% de descuento aplicado`
                        : `Starting at ${activeLot?.acres ?? 5} acres · ${discountPct}% bulk discount applied`}
                    </p>
                  )}
                </div>

                {/* Line-Item Math Breakdown */}
                <div className="pt-3 border-t border-white/10 space-y-2 text-xs sm:text-sm">
                  <div className="flex items-center justify-between gap-3 text-neutral-300">
                    <span>
                      {t.estimator.baseClearingLabel} ({activeLotLabel} · {activeDensityLabel})
                    </span>
                    <span className="font-mono tabular-nums text-white shrink-0">
                      {formatUsd(estimate.baseMin)} – {formatUsd(estimate.baseMax)}
                    </span>
                  </div>

                  {estimate.hasBulkDiscount && (
                    <div className="flex items-center justify-between gap-3 text-[var(--cv-accent)]">
                      <span>
                        {language === 'es'
                          ? `${discountPct}% Descuento por Volumen`
                          : `${discountPct}% Bulk Acreage Discount`}
                      </span>
                      <span className="font-mono tabular-nums shrink-0">
                        -{formatUsd(estimate.discountMin)} – -{formatUsd(estimate.discountMax)}
                      </span>
                    </div>
                  )}

                  {estimate.addonsTotal > 0 && (
                    <div className="flex items-center justify-between gap-3 text-neutral-300">
                      <span>
                        {t.estimator.addonsRowLabel} ({selectedAddons.length})
                      </span>
                      <span className="font-mono tabular-nums text-white shrink-0">
                        +{formatUsd(estimate.addonsTotal)}
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-neutral-400 leading-relaxed pt-1">
                  {sec.disclaimer[language]}
                </p>
              </div>

              {/* Lead Capture Form / Confirmation Card */}
              <div className="p-6 sm:p-7 bg-[var(--cv-dark-card)]">
                {lockedSummary ? (
                  <div className="space-y-4">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--cv-primary)]/25 text-[var(--cv-light-green)]">
                      <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                    </div>

                    <div className="space-y-1">
                      <h3 className="font-display text-2xl font-bold text-white">
                        {t.estimator.confirmedTitle}
                      </h3>
                      <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                        {t.estimator.confirmedSubtitle}
                      </p>
                    </div>

                    <div className="bg-[var(--cv-dark-surface)] border border-white/10 rounded-lg p-4 space-y-2 text-xs sm:text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-neutral-400">{t.estimator.summaryAcreage}:</span>
                        <span className="font-semibold text-white text-right">
                          {lockedSummary.lotLabel}
                          {lockedSummary.hasBulkDiscount ? ` (${sec.bulkDiscountBadge[language]})` : ''}
                        </span>
                      </div>

                      <div className="flex justify-between gap-3">
                        <span className="text-neutral-400">{t.estimator.summaryDensity}:</span>
                        <span className="font-semibold text-white text-right">
                          {lockedSummary.densityLabel}
                        </span>
                      </div>

                      <div className="flex justify-between gap-3">
                        <span className="text-neutral-400">{t.estimator.summaryAddons}:</span>
                        <span className="text-white text-right">
                          {lockedSummary.addonLabels.length > 0
                            ? lockedSummary.addonLabels.join(', ')
                            : t.estimator.noAddonsSelected}
                        </span>
                      </div>

                      <div className="flex justify-between gap-3 pt-2 border-t border-white/10">
                        <span className="text-neutral-400">{t.estimator.summaryEstimate}:</span>
                        <span className="font-mono font-bold text-[var(--cv-accent)] tabular-nums text-right">
                          {formatUsd(lockedSummary.totalMin)} – {formatUsd(lockedSummary.totalMax)}
                          {lockedSummary.isFivePlus ? '+' : ''}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-white/10 space-y-1">
                        <p className="text-neutral-400 text-xs">{t.estimator.summaryContact}:</p>
                        <p className="text-white font-medium">
                          {lockedSummary.name} ·{' '}
                          <span className="font-mono tabular-nums">{lockedSummary.phone}</span>
                        </p>
                        <p className="text-neutral-300 text-xs">{lockedSummary.address}</p>
                        <p className="text-neutral-400 text-xs">
                          {t.estimator.summaryTimeline}:{' '}
                          <span className="text-white">
                            {t.estimator.timelineOptions[lockedSummary.timelineIndex]}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-1">
                      <a
                        href={biz.phoneHref}
                        onClick={(e) => {
                          e.preventDefault();
                          openCallModal();
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-[var(--cv-primary)] hover:bg-[var(--cv-primary-dark)] text-white font-semibold text-sm px-4 py-2.5 rounded-md transition-colors whitespace-nowrap"
                      >
                        <Phone className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>
                          {language === 'es'
                            ? `Llamar a ${biz.shortName}`
                            : `Call ${biz.shortName}`}
                        </span>
                      </a>
                      <button
                        type="button"
                        onClick={() => setLockedSummary(null)}
                        className="text-xs sm:text-sm font-medium text-neutral-300 hover:text-white px-4 py-2.5 rounded-md border border-white/15 hover:border-white/30 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {t.estimator.adjustEstimateAction}
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleLockSubmit} noValidate className="space-y-3.5">
                    <div className="space-y-1">
                      <h3 className="font-display text-2xl font-bold text-white leading-tight">
                        {sec.lockFormTitle[language]}
                      </h3>
                      <p className="text-xs text-neutral-300 leading-relaxed">
                        {sec.lockFormSubtitle[language]}
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="est-name"
                        className="block text-xs font-semibold text-neutral-200 mb-1"
                      >
                        {t.estimator.nameLabel}
                      </label>
                      <input
                        id="est-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t.estimator.namePlaceholder}
                        className="w-full bg-[var(--cv-dark-surface)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="est-phone"
                        className="block text-xs font-semibold text-neutral-200 mb-1"
                      >
                        {t.estimator.phoneLabel}
                      </label>
                      <input
                        id="est-phone"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder={t.estimator.phonePlaceholder}
                        className="w-full bg-[var(--cv-dark-surface)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3.5 py-2.5 text-sm text-white font-mono placeholder:text-neutral-500"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="est-address"
                        className="block text-xs font-semibold text-neutral-200 mb-1"
                      >
                        {t.estimator.addressLabel}
                      </label>
                      <input
                        id="est-address"
                        type="text"
                        required
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder={t.estimator.addressPlaceholder}
                        className="w-full bg-[var(--cv-dark-surface)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="est-timeline"
                        className="block text-xs font-semibold text-neutral-200 mb-1"
                      >
                        {t.estimator.timelineLabel}
                      </label>
                      <select
                        id="est-timeline"
                        value={timelineIndex}
                        onChange={(e) => setTimelineIndex(Number(e.target.value))}
                        className="w-full bg-[var(--cv-dark-surface)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3.5 py-2.5 text-sm text-white"
                      >
                        {t.estimator.timelineOptions.map((option, idx) => (
                          <option
                            key={option}
                            value={idx}
                            className="bg-[var(--cv-dark-surface)] text-white"
                          >
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    {errorMsg && (
                      <p role="alert" className="text-xs text-[var(--cv-accent)] font-medium">
                        {errorMsg}
                      </p>
                    )}

                    <button
                      type="submit"
                      className="w-full bg-[var(--cv-primary)] hover:bg-[var(--cv-primary-dark)] text-white font-semibold text-sm py-3 px-4 rounded-md transition-colors duration-150 cursor-pointer"
                    >
                      {t.estimator.lockSubmitButton}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
