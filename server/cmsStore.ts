import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createStarterTemplateCms, defaultSiteCms } from '../src/data/defaultCms.ts';
import type { SiteCmsData } from '../src/types/cms.ts';

interface AdminCredential {
  salt: string;
  hash: string;
  claimedAt: string;
}

interface CmsStoreFile {
  cms: SiteCmsData;
  adminCredential: AdminCredential | null;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const CMS_STORE_PATH = path.resolve(DATA_DIR, 'cms-store.json');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const FALLBACK_ADMIN_SECRET = crypto.randomBytes(32).toString('hex');

let cmsWriteQueue: Promise<void> = Promise.resolve();

function getAdminSessionSecret(): string {
  const envSecret =
    process.env.ADMIN_SESSION_SECRET?.trim() || process.env.OWNER_SESSION_SECRET?.trim();
  return envSecret && envSecret.length >= 16 ? envSecret : FALLBACK_ADMIN_SECRET;
}

function sanitizeHexColor(val: unknown, fallback: string): string {
  if (typeof val === 'string' && /^#[0-9A-Fa-f]{6}$/.test(val.trim())) {
    return val.trim().toUpperCase();
  }
  return fallback;
}

export function sanitizeMediaUrl(val: unknown, fallback = ''): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed.slice(0, 1000);
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString().slice(0, 1000);
    }
  } catch {
    // invalid URL
  }
  return fallback;
}

function sanitizePhoneHref(phone: string, rawHref: unknown): string {
  if (typeof rawHref === 'string' && rawHref.trim().startsWith('tel:')) {
    const cleaned = rawHref.trim().slice(4).replace(/[^\d+]/g, '');
    if (cleaned.length >= 7) return `tel:${cleaned}`;
  }
  const digits = phone.replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : 'tel:+18509737179';
}

function sanitizeString(val: unknown, fallback: string, maxLen = 400): string {
  if (typeof val !== 'string') return fallback;
  return val.trim().slice(0, maxLen);
}

function sanitizeBilingual(
  val: unknown,
  fallback: { en: string; es: string },
  maxLen = 600
): { en: string; es: string } {
  const obj = (val && typeof val === 'object' ? val : {}) as Record<string, unknown>;
  return {
    en: sanitizeString(obj.en, fallback.en, maxLen),
    es: sanitizeString(obj.es, fallback.es, maxLen),
  };
}

function sanitizeCmsPayload(raw: unknown, currentCms: SiteCmsData): SiteCmsData {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<SiteCmsData>;
  const def = defaultSiteCms;

  const rawTheme = (input.theme ?? {}) as Partial<SiteCmsData['theme']>;
  const theme: SiteCmsData['theme'] = {
    primaryColor: sanitizeHexColor(rawTheme.primaryColor, currentCms.theme.primaryColor),
    primaryDarkColor: sanitizeHexColor(
      rawTheme.primaryDarkColor,
      currentCms.theme.primaryDarkColor
    ),
    accentColor: sanitizeHexColor(rawTheme.accentColor, currentCms.theme.accentColor),
    lightGreenColor: sanitizeHexColor(rawTheme.lightGreenColor, currentCms.theme.lightGreenColor),
    darkSurfaceColor: sanitizeHexColor(
      rawTheme.darkSurfaceColor,
      currentCms.theme.darkSurfaceColor
    ),
    darkCardColor: sanitizeHexColor(rawTheme.darkCardColor, currentCms.theme.darkCardColor),
  };

  const rawBiz = (input.business ?? {}) as Partial<SiteCmsData['business']>;
  const phone = sanitizeString(rawBiz.phone, currentCms.business.phone, 40) || def.business.phone;
  const business: SiteCmsData['business'] = {
    businessName:
      sanitizeString(rawBiz.businessName, currentCms.business.businessName, 140) ||
      def.business.businessName,
    shortName:
      sanitizeString(rawBiz.shortName, currentCms.business.shortName, 80) ||
      def.business.shortName,
    brandMonogram:
      sanitizeString(rawBiz.brandMonogram, currentCms.business.brandMonogram, 6).toUpperCase() ||
      'ML',
    ownerName:
      sanitizeString(rawBiz.ownerName, currentCms.business.ownerName, 80) ||
      def.business.ownerName,
    assistantName:
      sanitizeString(rawBiz.assistantName, currentCms.business.assistantName, 40) || 'Jessica',
    primaryKeyword: sanitizeBilingual(
      rawBiz.primaryKeyword,
      currentCms.business.primaryKeyword,
      160
    ),
    cityState:
      sanitizeString(rawBiz.cityState, currentCms.business.cityState, 80) ||
      def.business.cityState,
    serviceArea: sanitizeString(rawBiz.serviceArea, currentCms.business.serviceArea, 240),
    serviceCities: Array.isArray(rawBiz.serviceCities)
      ? rawBiz.serviceCities
          .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
          .map((c) => c.trim().slice(0, 60))
          .slice(0, 20)
      : currentCms.business.serviceCities,
    phone,
    phoneHref: sanitizePhoneHref(phone, rawBiz.phoneHref),
    email: sanitizeString(rawBiz.email, currentCms.business.email, 160),
    operatingHours: sanitizeBilingual(
      rawBiz.operatingHours,
      currentCms.business.operatingHours,
      120
    ),
    googleRating: Math.min(
      5,
      Math.max(1, Number(rawBiz.googleRating ?? currentCms.business.googleRating) || 5)
    ),
    googleReviewCount: Math.max(
      0,
      Math.round(Number(rawBiz.googleReviewCount ?? currentCms.business.googleReviewCount) || 0)
    ),
    googleRatingLabel: sanitizeBilingual(
      rawBiz.googleRatingLabel,
      currentCms.business.googleRatingLabel,
      80
    ),
    logoUrl:
      rawBiz.logoUrl !== undefined
        ? sanitizeMediaUrl(rawBiz.logoUrl, currentCms.business.logoUrl)
        : currentCms.business.logoUrl,
    heroImageUrl:
      rawBiz.heroImageUrl !== undefined
        ? sanitizeMediaUrl(rawBiz.heroImageUrl, currentCms.business.heroImageUrl)
        : currentCms.business.heroImageUrl,
    assistantAvatarUrl:
      rawBiz.assistantAvatarUrl !== undefined
        ? sanitizeMediaUrl(rawBiz.assistantAvatarUrl, currentCms.business.assistantAvatarUrl)
        : currentCms.business.assistantAvatarUrl,
    contractorToolPin:
      typeof rawBiz.contractorToolPin === 'string' && rawBiz.contractorToolPin.trim().length >= 4
        ? rawBiz.contractorToolPin.trim().slice(0, 12)
        : currentCms.business.contractorToolPin || '1234',
  };

  // Pricing sanitization
  const rawPricing = (input.pricing ?? {}) as Partial<SiteCmsData['pricing']>;
  const lotSizes =
    Array.isArray(rawPricing.lotSizes) && rawPricing.lotSizes.length > 0
      ? rawPricing.lotSizes.slice(0, 20).map((lot, idx) => ({
          id:
            sanitizeString(lot?.id, `lot-${idx + 1}`, 32).replace(/[^a-zA-Z0-9._+-]/g, '') ||
            `lot-${idx + 1}`,
          acres: Math.max(0.05, Number(lot?.acres) || 1),
          isFivePlus: Boolean(lot?.isFivePlus),
          isBulkDiscountEligible: Boolean(lot?.isBulkDiscountEligible),
          pricingMode: (lot?.pricingMode === 'fixed' ? 'fixed' : 'perAcre') as 'fixed' | 'perAcre',
          labelEn: sanitizeString(lot?.labelEn, `${lot?.acres ?? 1} Acre`, 60),
          labelEs: sanitizeString(lot?.labelEs, `${lot?.acres ?? 1} Acre`, 60),
          subtitleEn: sanitizeString(lot?.subtitleEn, '', 80),
          subtitleEs: sanitizeString(lot?.subtitleEs, '', 80),
        }))
      : currentCms.pricing.lotSizes;

  const densities =
    Array.isArray(rawPricing.densities) && rawPricing.densities.length > 0
      ? rawPricing.densities.slice(0, 12).map((den, idx) => {
          const fixedRates: Record<string, [number, number]> = {};
          if (den?.fixedRates && typeof den.fixedRates === 'object') {
            for (const [k, pair] of Object.entries(den.fixedRates)) {
              if (Array.isArray(pair) && pair.length >= 2) {
                const minV = Math.max(0, Math.round(Number(pair[0]) || 0));
                const maxV = Math.max(minV, Math.round(Number(pair[1]) || minV));
                fixedRates[k] = [minV, maxV];
              }
            }
          }
          const perMin = Math.max(
            0,
            Math.round(Number(den?.perAcreRange?.[0] ?? 1500) || 0)
          );
          const perMax = Math.max(
            perMin,
            Math.round(Number(den?.perAcreRange?.[1] ?? perMin) || perMin)
          );
          const icon =
            den?.icon === 'sprout' || den?.icon === 'trees' || den?.icon === 'treepine'
              ? den.icon
              : 'trees';
          return {
            id:
              sanitizeString(den?.id, `density-${idx + 1}`, 32).replace(/[^a-zA-Z0-9._-]/g, '') ||
              `density-${idx + 1}`,
            icon,
            labelEn: sanitizeString(den?.labelEn, `Tier ${idx + 1}`, 60),
            labelEs: sanitizeString(den?.labelEs, `Nivel ${idx + 1}`, 60),
            descriptionEn: sanitizeString(den?.descriptionEn, '', 160),
            descriptionEs: sanitizeString(den?.descriptionEs, '', 160),
            fixedRates,
            perAcreRange: [perMin, perMax] as [number, number],
          };
        })
      : currentCms.pricing.densities;

  const addons = Array.isArray(rawPricing.addons)
    ? rawPricing.addons.slice(0, 20).map((addon, idx) => {
        const icon =
          addon?.icon === 'disc' ||
          addon?.icon === 'truck' ||
          addon?.icon === 'shovel' ||
          addon?.icon === 'wrench'
            ? addon.icon
            : 'disc';
        return {
          id:
            sanitizeString(addon?.id, `addon-${idx + 1}`, 32).replace(/[^a-zA-Z0-9._-]/g, '') ||
            `addon-${idx + 1}`,
          icon,
          price: Math.max(0, Math.round(Number(addon?.price) || 0)),
          labelEn: sanitizeString(addon?.labelEn, 'Optional Service', 80),
          labelEs: sanitizeString(addon?.labelEs, 'Servicio Opcional', 80),
          descriptionEn: sanitizeString(addon?.descriptionEn, '', 180),
          descriptionEs: sanitizeString(addon?.descriptionEs, '', 180),
        };
      })
    : currentCms.pricing.addons;

  const pricing: SiteCmsData['pricing'] = {
    minimumMobilizationFee: Math.max(
      0,
      Math.round(
        Number(
          rawPricing.minimumMobilizationFee ?? currentCms.pricing.minimumMobilizationFee
        ) || 0
      )
    ),
    bulkDiscountRate: Math.min(
      0.75,
      Math.max(
        0,
        Number(rawPricing.bulkDiscountRate ?? currentCms.pricing.bulkDiscountRate) || 0
      )
    ),
    lotSizes,
    densities,
    addons,
  };

  // Sections sanitization
  const rawSec = (input.sections ?? {}) as Partial<SiteCmsData['sections']>;
  const curSec = currentCms.sections;
  const sections: SiteCmsData['sections'] = {
    hero: {
      trustLine: sanitizeBilingual(rawSec.hero?.trustLine, curSec.hero.trustLine, 160),
      licensedLabel: sanitizeBilingual(rawSec.hero?.licensedLabel, curSec.hero.licensedLabel, 60),
      spanishBadge: sanitizeBilingual(rawSec.hero?.spanishBadge, curSec.hero.spanishBadge, 60),
      subheadline: sanitizeBilingual(rawSec.hero?.subheadline, curSec.hero.subheadline, 500),
      ctaEstimate: sanitizeBilingual(rawSec.hero?.ctaEstimate, curSec.hero.ctaEstimate, 60),
      ctaCall: sanitizeBilingual(rawSec.hero?.ctaCall, curSec.hero.ctaCall, 40),
      serviceAreaPrefix: sanitizeBilingual(
        rawSec.hero?.serviceAreaPrefix,
        curSec.hero.serviceAreaPrefix,
        40
      ),
      formTitle: sanitizeBilingual(rawSec.hero?.formTitle, curSec.hero.formTitle, 100),
      formSubtitle: sanitizeBilingual(rawSec.hero?.formSubtitle, curSec.hero.formSubtitle, 240),
    },
    estimator: {
      kicker: sanitizeBilingual(rawSec.estimator?.kicker, curSec.estimator.kicker, 80),
      title: sanitizeBilingual(rawSec.estimator?.title, curSec.estimator.title, 140),
      subtitle: sanitizeBilingual(rawSec.estimator?.subtitle, curSec.estimator.subtitle, 300),
      bulkDiscountBadge: sanitizeBilingual(
        rawSec.estimator?.bulkDiscountBadge,
        curSec.estimator.bulkDiscountBadge,
        80
      ),
      disclaimer: sanitizeBilingual(rawSec.estimator?.disclaimer, curSec.estimator.disclaimer, 300),
      lockFormTitle: sanitizeBilingual(
        rawSec.estimator?.lockFormTitle,
        curSec.estimator.lockFormTitle,
        120
      ),
      lockFormSubtitle: sanitizeBilingual(
        rawSec.estimator?.lockFormSubtitle,
        curSec.estimator.lockFormSubtitle,
        240
      ),
    },
    calendar: {
      kicker: sanitizeBilingual(rawSec.calendar?.kicker, curSec.calendar.kicker, 80),
      title: sanitizeBilingual(rawSec.calendar?.title, curSec.calendar.title, 140),
      subtitle: sanitizeBilingual(rawSec.calendar?.subtitle, curSec.calendar.subtitle, 300),
    },
    services: {
      kicker: sanitizeBilingual(rawSec.services?.kicker, curSec.services.kicker, 80),
      title: sanitizeBilingual(rawSec.services?.title, curSec.services.title, 140),
      subtitle: sanitizeBilingual(rawSec.services?.subtitle, curSec.services.subtitle, 300),
      requestAction: sanitizeBilingual(
        rawSec.services?.requestAction,
        curSec.services.requestAction,
        60
      ),
    },
    gallery: {
      kicker: sanitizeBilingual(rawSec.gallery?.kicker, curSec.gallery.kicker, 80),
      title: sanitizeBilingual(rawSec.gallery?.title, curSec.gallery.title, 140),
      subtitle: sanitizeBilingual(rawSec.gallery?.subtitle, curSec.gallery.subtitle, 300),
    },
    reviews: {
      kicker: sanitizeBilingual(rawSec.reviews?.kicker, curSec.reviews.kicker, 80),
      title: sanitizeBilingual(rawSec.reviews?.title, curSec.reviews.title, 140),
      subtitle: sanitizeBilingual(rawSec.reviews?.subtitle, curSec.reviews.subtitle, 300),
      leaveReviewNote: sanitizeBilingual(
        rawSec.reviews?.leaveReviewNote,
        curSec.reviews.leaveReviewNote,
        160
      ),
    },
    faq: {
      kicker: sanitizeBilingual(rawSec.faq?.kicker, curSec.faq.kicker, 80),
      title: sanitizeBilingual(rawSec.faq?.title, curSec.faq.title, 140),
      subtitle: sanitizeBilingual(rawSec.faq?.subtitle, curSec.faq.subtitle, 300),
    },
    footer: {
      tagline: sanitizeBilingual(rawSec.footer?.tagline, curSec.footer.tagline, 300),
      rightsReserved: sanitizeBilingual(
        rawSec.footer?.rightsReserved,
        curSec.footer.rightsReserved,
        80
      ),
    },
    assistant: {
      welcomeEn: sanitizeString(rawSec.assistant?.welcomeEn, curSec.assistant.welcomeEn, 600),
      welcomeEs: sanitizeString(rawSec.assistant?.welcomeEs, curSec.assistant.welcomeEs, 600),
      extraInstructions: sanitizeString(
        rawSec.assistant?.extraInstructions,
        curSec.assistant.extraInstructions,
        1500
      ),
    },
  };

  const validServiceIcons = new Set([
    'trees',
    'layers',
    'wheat',
    'disc',
    'shovel',
    'cloud-lightning',
    'shield',
    'wrench',
  ]);
  const services = Array.isArray(input.services)
    ? input.services.slice(0, 24).map((svc, idx) => ({
        id:
          sanitizeString(svc?.id, `service-${idx + 1}`, 48).replace(/[^a-zA-Z0-9._-]/g, '') ||
          `service-${idx + 1}`,
        number: sanitizeString(svc?.number, String(idx + 1).padStart(2, '0'), 6),
        icon: (validServiceIcons.has(String(svc?.icon)) ? svc.icon : 'trees') as SiteCmsData['services'][number]['icon'],
        titleEn: sanitizeString(svc?.titleEn, 'Land Clearing Service', 100),
        titleEs: sanitizeString(svc?.titleEs, 'Servicio de Limpieza', 100),
        summaryEn: sanitizeString(svc?.summaryEn, '', 400),
        summaryEs: sanitizeString(svc?.summaryEs, '', 400),
        highlightsEn: Array.isArray(svc?.highlightsEn)
          ? svc.highlightsEn
              .filter((h): h is string => typeof h === 'string' && h.trim().length > 0)
              .map((h) => h.trim().slice(0, 120))
              .slice(0, 8)
          : [],
        highlightsEs: Array.isArray(svc?.highlightsEs)
          ? svc.highlightsEs
              .filter((h): h is string => typeof h === 'string' && h.trim().length > 0)
              .map((h) => h.trim().slice(0, 120))
              .slice(0, 8)
          : [],
      }))
    : currentCms.services;

  const workPhotos = Array.isArray(input.workPhotos)
    ? input.workPhotos.slice(0, 40).map((photo, idx) => ({
        id:
          sanitizeString(photo?.id, `work-${idx + 1}`, 48).replace(/[^a-zA-Z0-9._-]/g, '') ||
          `work-${idx + 1}`,
        url: sanitizeMediaUrl(photo?.url, ''),
        titleEn: sanitizeString(photo?.titleEn, `Project ${idx + 1}`, 100),
        titleEs: sanitizeString(photo?.titleEs, `Proyecto ${idx + 1}`, 100),
        locationEn: sanitizeString(photo?.locationEn, '', 80),
        locationEs: sanitizeString(photo?.locationEs, '', 80),
        captionEn: sanitizeString(photo?.captionEn, '', 320),
        captionEs: sanitizeString(photo?.captionEs, '', 320),
      }))
    : currentCms.workPhotos;

  const reviews = Array.isArray(input.reviews)
    ? input.reviews.slice(0, 30).map((rev, idx) => ({
        id:
          sanitizeString(rev?.id, `review-${idx + 1}`, 48).replace(/[^a-zA-Z0-9._-]/g, '') ||
          `review-${idx + 1}`,
        author: sanitizeString(rev?.author, 'Verified Client', 80),
        location: sanitizeString(rev?.location, '', 80),
        rating: Math.min(5, Math.max(1, Math.round(Number(rev?.rating) || 5))),
        dateEn: sanitizeString(rev?.dateEn, 'Verified Google Review', 60),
        dateEs: sanitizeString(rev?.dateEs, 'Reseña Verificada de Google', 60),
        textEn: sanitizeString(rev?.textEn, '', 2000),
        textEs: sanitizeString(rev?.textEs, '', 2000),
      }))
    : currentCms.reviews;

  const faqs = Array.isArray(input.faqs)
    ? input.faqs.slice(0, 30).map((faq, idx) => ({
        id:
          sanitizeString(faq?.id, `faq-${idx + 1}`, 48).replace(/[^a-zA-Z0-9._-]/g, '') ||
          `faq-${idx + 1}`,
        questionEn: sanitizeString(faq?.questionEn, 'Question', 240),
        questionEs: sanitizeString(faq?.questionEs, 'Pregunta', 240),
        answerEn: sanitizeString(faq?.answerEn, '', 1500),
        answerEs: sanitizeString(faq?.answerEs, '', 1500),
      }))
    : currentCms.faqs;

  return {
    templateVersion: '1.0',
    updatedAt: new Date().toISOString(),
    theme,
    business,
    pricing,
    sections,
    services,
    workPhotos,
    reviews,
    faqs,
  };
}

function defaultCmsStoreFile(): CmsStoreFile {
  return {
    cms: structuredClone(defaultSiteCms),
    adminCredential: null,
  };
}

function readCmsStoreSync(): CmsStoreFile {
  try {
    if (!fs.existsSync(CMS_STORE_PATH)) {
      return defaultCmsStoreFile();
    }
    const raw = fs.readFileSync(CMS_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<CmsStoreFile>;
    const base = defaultCmsStoreFile();
    return {
      cms: parsed.cms ? sanitizeCmsPayload(parsed.cms, base.cms) : base.cms,
      adminCredential: parsed.adminCredential ?? null,
    };
  } catch {
    return defaultCmsStoreFile();
  }
}

async function writeCmsStoreAtomic(data: CmsStoreFile): Promise<void> {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = path.resolve(DATA_DIR, `cms-store.${process.pid}.${Date.now()}.tmp`);
  if (!tmpPath.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid CMS store path resolution');
  }
  await fs.promises.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  await fs.promises.rename(tmpPath, CMS_STORE_PATH);
}

function enqueueCmsMutation<T>(fn: (store: CmsStoreFile) => T | Promise<T>): Promise<T> {
  const run = cmsWriteQueue.then(async () => {
    const store = readCmsStoreSync();
    const result = await fn(store);
    await writeCmsStoreAtomic(store);
    return result;
  });
  cmsWriteQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export function getPublicCms(): SiteCmsData {
  const store = readCmsStoreSync();
  const clone = structuredClone(store.cms);
  delete clone.business.contractorToolPin;
  return clone;
}

export function getFullCmsForAdmin(): SiteCmsData {
  return readCmsStoreSync().cms;
}

export function verifyContractorToolPin(pin: string): boolean {
  const cms = readCmsStoreSync().cms;
  const expected = (cms.business.contractorToolPin || '1234').trim();
  const candidate = pin.trim();
  if (!candidate || candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(candidate, 'utf8'), Buffer.from(expected, 'utf8'));
}

export async function updateCmsData(payload: unknown): Promise<SiteCmsData> {
  return enqueueCmsMutation((store) => {
    const updated = sanitizeCmsPayload(payload, store.cms);
    store.cms = updated;
    return updated;
  });
}

export async function applyCmsTemplatePreset(
  preset: 'clearview-default' | 'starter-template'
): Promise<SiteCmsData> {
  return enqueueCmsMutation((store) => {
    store.cms =
      preset === 'starter-template'
        ? createStarterTemplateCms()
        : { ...structuredClone(defaultSiteCms), updatedAt: new Date().toISOString() };
    return store.cms;
  });
}

// --- Media Uploads & Library (strict binary magic-byte validation + path confinement) ---

function detectImageExtension(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return 'png';
  }
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'jpg';
  }
  // GIF: GIF8
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return 'gif';
  }
  // WEBP: RIFF....WEBP
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  // AVIF: ....ftypavif or ftypavis
  const ftyp = buf.subarray(4, 12).toString('ascii');
  if (ftyp === 'ftypavif' || ftyp === 'ftypavis') {
    return 'avif';
  }
  return null;
}

export async function saveUploadedImage(dataUrl: string): Promise<{
  ok: true;
  filename: string;
  url: string;
  bytes: number;
} | {
  ok: false;
  statusCode: number;
  error: string;
}> {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif|avif));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Only base64 PNG, JPG, WEBP, GIF, or AVIF images are allowed.',
    };
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Image size must be between 1 byte and 5 MB.',
    };
  }

  const verifiedExt = detectImageExtension(buffer);
  if (!verifiedExt) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Uploaded file does not match a valid image signature.',
    };
  }

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const filename = `img-${crypto.randomUUID()}.${verifiedExt}`;
  const targetPath = path.resolve(UPLOADS_DIR, filename);
  if (!targetPath.startsWith(UPLOADS_DIR + path.sep)) {
    return { ok: false, statusCode: 400, error: 'Invalid target upload path.' };
  }

  await fs.promises.writeFile(targetPath, buffer);
  return {
    ok: true,
    filename,
    url: `/api/media/${filename}`,
    bytes: buffer.length,
  };
}

export function resolveSafeMediaPath(filename: string): string | null {
  if (!/^img-[a-f0-9-]+\.(png|jpg|webp|gif|avif)$/i.test(filename)) {
    return null;
  }
  const target = path.resolve(UPLOADS_DIR, filename);
  if (!target.startsWith(UPLOADS_DIR + path.sep)) {
    return null;
  }
  if (!fs.existsSync(target)) {
    return null;
  }
  return target;
}

export function listUploadedMedia(): { filename: string; url: string; bytes: number; createdAt: string }[] {
  if (!fs.existsSync(UPLOADS_DIR)) return [];
  const entries = fs.readdirSync(UPLOADS_DIR);
  const results: { filename: string; url: string; bytes: number; createdAt: string }[] = [];

  for (const name of entries) {
    const safe = resolveSafeMediaPath(name);
    if (!safe) continue;
    const stat = fs.statSync(safe);
    results.push({
      filename: name,
      url: `/api/media/${name}`,
      bytes: stat.size,
      createdAt: stat.mtime.toISOString(),
    });
  }

  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteUploadedMedia(filename: string): Promise<boolean> {
  const safe = resolveSafeMediaPath(filename);
  if (!safe) return false;
  await fs.promises.unlink(safe);
  return true;
}

// --- Server-Side Admin CMS Auth (Separate from Owner Agenda) ---

export function getAdminAuthStatus(): { configuredViaEnv: boolean; claimed: boolean } {
  const envPass = process.env.ADMIN_PASSCODE?.trim();
  const store = readCmsStoreSync();
  return {
    configuredViaEnv: Boolean(envPass),
    claimed: Boolean(store.adminCredential?.hash),
  };
}

export async function claimAdminPasscode(
  passcode: string
): Promise<{ ok: true; token: string } | { ok: false; statusCode: number; error: string }> {
  const trimmed = passcode.trim();
  if (trimmed.length < 6 || trimmed.length > 64) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Admin passcode must be between 6 and 64 characters.',
    };
  }

  return enqueueCmsMutation((store) => {
    const envPass = process.env.ADMIN_PASSCODE?.trim();
    if (envPass || store.adminCredential?.hash) {
      return {
        ok: false as const,
        statusCode: 409,
        error: 'Admin passcode has already been configured.',
      };
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(trimmed, salt, 64).toString('hex');
    store.adminCredential = {
      salt,
      hash,
      claimedAt: new Date().toISOString(),
    };

    return {
      ok: true as const,
      token: issueAdminToken(),
    };
  });
}

export function verifyAdminPasscode(passcode: string): boolean {
  const candidate = passcode.trim();
  if (!candidate) return false;

  const envPass = process.env.ADMIN_PASSCODE?.trim();
  if (envPass) {
    const a = Buffer.from(candidate, 'utf8');
    const b = Buffer.from(envPass, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  const store = readCmsStoreSync();
  if (!store.adminCredential?.salt || !store.adminCredential?.hash) {
    return false;
  }

  const derived = crypto.scryptSync(candidate, store.adminCredential.salt, 64);
  const expected = Buffer.from(store.adminCredential.hash, 'hex');
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

export function issueAdminToken(): string {
  const payload = Buffer.from(
    JSON.stringify({
      role: 'admin',
      exp: Date.now() + 1000 * 60 * 60 * 12,
      nonce: crypto.randomBytes(8).toString('hex'),
    })
  ).toString('base64url');

  const sig = crypto
    .createHmac('sha256', getAdminSessionSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyAdminToken(authHeader?: string): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [payloadB64, sigB64] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getAdminSessionSecret())
    .update(payloadB64)
    .digest('base64url');

  const a = Buffer.from(sigB64, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      role?: string;
      exp?: number;
    };
    return parsed.role === 'admin' && typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}
