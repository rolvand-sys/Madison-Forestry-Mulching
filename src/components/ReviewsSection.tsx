import { useState } from 'react';
import { Star } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCms } from '../context/CmsContext';

function GoogleGMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.56-5.15 3.56-8.65z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3a7.17 7.17 0 0 1-10.67-3.77H1.4v3.09A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.39 14.32a7.2 7.2 0 0 1 0-4.64V6.59H1.4a12 12 0 0 0 0 10.82l3.99-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.94 1.19 15.23 0 12 0 7.31 0 3.26 2.69 1.4 6.59l3.99 3.09A7.16 7.16 0 0 1 12 4.75z"
      />
    </svg>
  );
}

const PREVIEW_CHAR_LIMIT = 300;

export function ReviewsSection() {
  const { language, t } = useLanguage();
  const { cms } = useCms();
  const sec = cms.sections.reviews;
  const biz = cms.business;
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section id="reviews" className="bg-white py-16 sm:py-22 border-b border-[#DDD1C0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
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

          <div className="bg-[#F4EFE6] border border-[#DDD1C0] rounded-xl px-5 py-4 flex items-center gap-4 shrink-0">
            <GoogleGMark />
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 text-[#EAB308]" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star key={idx} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <span className="text-sm font-bold text-[#231710] tabular-nums">
                  {biz.googleRatingLabel[language]}
                </span>
              </div>
              <p className="text-xs text-neutral-500">{sec.leaveReviewNote[language]}</p>
            </div>
          </div>
        </div>

        <div className="columns-1 md:columns-2 lg:columns-3 gap-6">
          {cms.reviews.map((review) => {
            const text = language === 'en' ? review.textEn : review.textEs;
            const dateLabel = language === 'en' ? review.dateEn : review.dateEs;
            const isLong = text.length > PREVIEW_CHAR_LIMIT;
            const isExpanded = Boolean(expandedIds[review.id]);
            const displayText =
              isLong && !isExpanded
                ? `${text.slice(0, PREVIEW_CHAR_LIMIT).trimEnd()}…`
                : text;

            return (
              <article
                key={review.id}
                className="break-inside-avoid mb-6 bg-[#F4EFE6] border border-[#DDD1C0] rounded-xl p-6 flex flex-col justify-between gap-5"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className="flex items-center gap-0.5 text-[#EAB308]"
                      aria-label={`${review.rating} out of 5 stars`}
                    >
                      {Array.from({ length: Math.min(5, Math.max(1, review.rating)) }).map(
                        (_, idx) => (
                          <Star key={idx} className="w-4 h-4 fill-current" aria-hidden="true" />
                        )
                      )}
                    </div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                      <GoogleGMark />
                      <span>{t.reviews.googleBadge}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <blockquote className="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">
                      “{displayText}”
                    </blockquote>
                    {isLong && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(review.id)}
                        className="text-xs font-semibold text-[var(--cv-primary)] hover:underline cursor-pointer"
                      >
                        {isExpanded
                          ? language === 'es'
                            ? 'Ver menos'
                            : 'Show less'
                          : language === 'es'
                          ? 'Leer reseña completa'
                          : 'Read full review'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#DDD1C0] flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#231710]">{review.author}</p>
                    <p className="text-xs text-neutral-500">
                      {review.location} · {dateLabel}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
