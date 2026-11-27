import type React from 'react';
import {
  ArrowUpRight,
  Check,
  CloudLightning,
  Disc,
  Layers,
  Shield,
  Shovel,
  Trees,
  Wheat,
  Wrench,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCms } from '../context/CmsContext';
import type { CmsServiceIcon } from '../types/cms';

interface ServicesSectionProps {
  onSelectService: (serviceId: string) => void;
}

const serviceIconMap: Record<CmsServiceIcon, React.ComponentType<{ className?: string }>> = {
  trees: Trees,
  layers: Layers,
  wheat: Wheat,
  disc: Disc,
  shovel: Shovel,
  'cloud-lightning': CloudLightning,
  shield: Shield,
  wrench: Wrench,
};

export function ServicesSection({ onSelectService }: ServicesSectionProps) {
  const { language } = useLanguage();
  const { cms } = useCms();
  const sec = cms.sections.services;

  const handleRequestQuote = (serviceId: string) => {
    onSelectService(serviceId);
    const formEl = document.getElementById('site-visit-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <section id="services" className="bg-white py-16 sm:py-22 border-b border-[#DDD1C0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="max-w-2xl space-y-3">
          <p className="text-xs sm:text-sm font-semibold text-[var(--cv-primary)]">
            {sec.kicker[language]}
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cms.services.map((service) => {
            const Icon = serviceIconMap[service.icon] ?? Trees;
            const title = language === 'es' ? service.titleEs : service.titleEn;
            const summary = language === 'es' ? service.summaryEs : service.summaryEn;
            const highlights = language === 'es' ? service.highlightsEs : service.highlightsEn;

            return (
              <article
                key={service.id}
                className="group flex flex-col justify-between bg-[#F4EFE6] border border-[#DDD1C0] hover:border-[#231710]/30 rounded-xl p-6 transition-colors duration-150"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-neutral-500 tabular-nums">
                      {service.number}
                    </span>
                    <div className="w-9 h-9 rounded-lg bg-[var(--cv-primary)] text-[var(--cv-accent)] flex items-center justify-center">
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </div>
                  </div>

                  <h3 className="font-display text-2xl font-bold tracking-tight text-[#231710]">
                    {title}
                  </h3>

                  <p className="text-sm text-neutral-600 leading-relaxed">{summary}</p>

                  {highlights.length > 0 && (
                    <ul className="space-y-1.5 pt-2 border-t border-[#DDD1C0]">
                      {highlights.map((item) => (
                        <li
                          key={item}
                          className="text-xs font-medium text-neutral-700 flex items-center gap-2"
                        >
                          <Check
                            className="w-3.5 h-3.5 text-[var(--cv-primary)] shrink-0"
                            aria-hidden="true"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="pt-6 mt-2">
                  <button
                    type="button"
                    onClick={() => handleRequestQuote(service.id)}
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[var(--cv-primary)] hover:text-[var(--cv-primary-dark)] transition-colors cursor-pointer"
                  >
                    <span>{sec.requestAction[language]}</span>
                    <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
