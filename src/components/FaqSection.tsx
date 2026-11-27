import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCms } from '../context/CmsContext';

export function FaqSection() {
  const { language } = useLanguage();
  const { cms } = useCms();
  const sec = cms.sections.faq;
  const faqs = cms.faqs;

  const [openId, setOpenId] = useState<string>(faqs[0]?.id ?? '');

  useEffect(() => {
    if (faqs.length > 0 && !faqs.some((f) => f.id === openId)) {
      setOpenId(faqs[0].id);
    }
  }, [faqs, openId]);

  const toggleItem = (id: string) => {
    setOpenId((prev) => (prev === id ? '' : id));
  };

  return (
    <section id="faq" className="bg-[#F4EFE6] py-16 sm:py-22">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="space-y-3">
          <p className="text-xs sm:text-sm font-semibold text-[var(--cv-primary)]">
            {sec.kicker[language]}
          </p>
          <h2
            className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#231710]"
            style={{ textWrap: 'balance' }}
          >
            {sec.title[language]}
          </h2>
          <p className="text-sm sm:text-base text-neutral-600 leading-relaxed max-w-2xl">
            {sec.subtitle[language]}
          </p>
        </div>

        <div className="bg-white border border-[#DDD1C0] rounded-xl divide-y divide-[#DDD1C0]">
          {faqs.map((item, idx) => {
            const isOpen = openId === item.id;
            const panelId = `faq-panel-${item.id}`;
            const buttonId = `faq-btn-${item.id}`;
            const question = language === 'es' ? item.questionEs : item.questionEn;
            const answer = language === 'es' ? item.answerEs : item.answerEn;

            return (
              <div key={item.id}>
                <h3>
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggleItem(item.id)}
                    className="w-full px-5 sm:px-6 py-5 flex items-center justify-between gap-4 text-left hover:bg-neutral-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--cv-primary)]"
                  >
                    <span className="flex items-baseline gap-3">
                      <span className="font-mono text-xs font-semibold text-[var(--cv-primary)] tabular-nums shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-sm sm:text-base font-semibold text-[#231710]">
                        {question}
                      </span>
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-neutral-500 shrink-0 transition-transform duration-150 ${
                        isOpen ? 'rotate-180 text-[var(--cv-primary)]' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                </h3>

                {isOpen && (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className="px-5 sm:px-6 pb-5 pl-12 sm:pl-14 text-sm text-neutral-600 leading-relaxed"
                  >
                    {answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
