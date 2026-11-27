import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Trees, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCms } from '../context/CmsContext';
import type { CmsWorkPhoto } from '../types/cms';
import { resolveAssetUrl } from '../utils/assetUrl';

export function WorkGallery() {
  const { language, t } = useLanguage();
  const { cms } = useCms();
  const sec = cms.sections.gallery;
  const photos = cms.workPhotos;

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [failedIds, setFailedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setFailedIds({});
  }, [photos]);

  const activePhoto: CmsWorkPhoto | null =
    selectedIndex !== null ? photos[selectedIndex] ?? null : null;

  useEffect(() => {
    if (selectedIndex === null || photos.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedIndex(null);
      } else if (e.key === 'ArrowRight') {
        setSelectedIndex((prev) =>
          prev === null ? null : (prev + 1) % photos.length
        );
      } else if (e.key === 'ArrowLeft') {
        setSelectedIndex((prev) =>
          prev === null ? null : (prev - 1 + photos.length) % photos.length
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, photos.length]);

  const markFailed = (id: string) => {
    setFailedIds((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <section id="our-work" className="bg-[#F4EFE6] py-16 sm:py-22 border-b border-[#DDD1C0]">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {photos.map((photo, index) => {
            const title = language === 'en' ? photo.titleEn : photo.titleEs;
            const location = language === 'en' ? photo.locationEn : photo.locationEs;
            const caption = language === 'en' ? photo.captionEn : photo.captionEs;
            const isFailed = Boolean(failedIds[photo.id]) || !photo.url;

            return (
              <figure
                key={photo.id}
                className="group bg-white border border-[#DDD1C0] rounded-xl overflow-hidden flex flex-col"
              >
                <button
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  aria-label={`${t.gallery.zoomLabel}: ${title}`}
                  className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--cv-dark-surface)] text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cv-primary)]"
                >
                  {!isFailed ? (
                    <img
                      src={resolveAssetUrl(photo.url)}
                      alt={`${title} — ${location}`}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      onError={() => markFailed(photo.id)}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#312118] to-[var(--cv-dark-surface)] flex flex-col items-center justify-center p-6 text-center text-neutral-300">
                      <Trees
                        className="w-9 h-9 text-[var(--cv-accent)] mb-2"
                        aria-hidden="true"
                      />
                      <span className="text-xs font-mono text-neutral-400">
                        {t.gallery.fallbackLabel} · 0{index + 1}
                      </span>
                      <span className="text-sm font-semibold text-white mt-1">{title}</span>
                    </div>
                  )}

                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent opacity-80 group-hover:opacity-95 transition-opacity"
                  />

                  <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-mono text-[var(--cv-accent)]">{location}</p>
                      <p className="font-display text-xl font-bold text-white leading-tight">
                        {title}
                      </p>
                    </div>
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-black/55 border border-white/20 text-white shrink-0">
                      <Maximize2 className="w-4 h-4" aria-hidden="true" />
                    </span>
                  </div>
                </button>

                <figcaption className="p-4 text-xs sm:text-sm text-neutral-600 leading-relaxed">
                  {caption}
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>

      {/* Lightbox Modal */}
      {activePhoto && selectedIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={language === 'en' ? activePhoto.titleEn : activePhoto.titleEs}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          onClick={() => setSelectedIndex(null)}
        >
          <div
            className="relative max-w-5xl w-full bg-[var(--cv-dark-surface)] border border-white/15 rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
              <div className="min-w-0">
                <p className="text-xs font-mono text-[var(--cv-accent)]">
                  {language === 'en' ? activePhoto.locationEn : activePhoto.locationEs}
                </p>
                <h3 className="font-display text-xl sm:text-2xl font-bold text-white truncate">
                  {language === 'en' ? activePhoto.titleEn : activePhoto.titleEs}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedIndex(null)}
                aria-label={t.gallery.closeLightbox}
                className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-white/15 text-neutral-300 hover:text-white hover:border-white/40 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative bg-black aspect-[16/10] max-h-[70vh] w-full flex items-center justify-center">
              {!failedIds[activePhoto.id] && activePhoto.url ? (
                <img
                  src={resolveAssetUrl(activePhoto.url)}
                  alt={language === 'en' ? activePhoto.titleEn : activePhoto.titleEs}
                  referrerPolicy="no-referrer"
                  onError={() => markFailed(activePhoto.id)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-neutral-300 p-8 text-center">
                  <Trees className="w-12 h-12 text-[var(--cv-accent)] mb-3" aria-hidden="true" />
                  <p className="text-base font-semibold text-white">
                    {language === 'en' ? activePhoto.titleEn : activePhoto.titleEs}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() =>
                  setSelectedIndex((selectedIndex - 1 + photos.length) % photos.length)
                }
                aria-label={t.gallery.prevPhoto}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/70 hover:bg-[var(--cv-primary)] text-white border border-white/20 flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => setSelectedIndex((selectedIndex + 1) % photos.length)}
                aria-label={t.gallery.nextPhoto}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/70 hover:bg-[var(--cv-primary)] text-white border border-white/20 flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm text-neutral-300">
              <p>{language === 'en' ? activePhoto.captionEn : activePhoto.captionEs}</p>
              <span className="font-mono text-neutral-400 tabular-nums shrink-0">
                {selectedIndex + 1} / {photos.length}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
