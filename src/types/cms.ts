export type CmsServiceIcon =
  | 'trees'
  | 'layers'
  | 'wheat'
  | 'disc'
  | 'shovel'
  | 'cloud-lightning'
  | 'shield'
  | 'wrench';

export type CmsDensityIcon = 'sprout' | 'trees' | 'treepine';
export type CmsAddonIcon = 'disc' | 'truck' | 'shovel' | 'wrench';

export interface BilingualText {
  en: string;
  es: string;
}

export interface CmsThemeConfig {
  primaryColor: string;
  primaryDarkColor: string;
  accentColor: string;
  lightGreenColor: string;
  darkSurfaceColor: string;
  darkCardColor: string;
}

export interface CmsWorkPhoto {
  id: string;
  url: string;
  titleEn: string;
  titleEs: string;
  locationEn: string;
  locationEs: string;
  captionEn: string;
  captionEs: string;
}

export interface CmsGoogleReview {
  id: string;
  author: string;
  location: string;
  rating: number;
  dateEn: string;
  dateEs: string;
  textEn: string;
  textEs: string;
}

export interface CmsServiceItem {
  id: string;
  number: string;
  icon: CmsServiceIcon;
  titleEn: string;
  titleEs: string;
  summaryEn: string;
  summaryEs: string;
  highlightsEn: string[];
  highlightsEs: string[];
}

export interface CmsFaqItem {
  id: string;
  questionEn: string;
  questionEs: string;
  answerEn: string;
  answerEs: string;
}

export interface CmsLotSizeOption {
  id: string;
  acres: number;
  isFivePlus: boolean;
  isBulkDiscountEligible: boolean;
  pricingMode: 'fixed' | 'perAcre';
  labelEn: string;
  labelEs: string;
  subtitleEn: string;
  subtitleEs: string;
}

export interface CmsDensityOption {
  id: string;
  icon: CmsDensityIcon;
  labelEn: string;
  labelEs: string;
  descriptionEn: string;
  descriptionEs: string;
  fixedRates: Record<string, [number, number]>;
  perAcreRange: [number, number];
}

export interface CmsAddonOption {
  id: string;
  icon: CmsAddonIcon;
  price: number;
  labelEn: string;
  labelEs: string;
  descriptionEn: string;
  descriptionEs: string;
}

export interface CmsPricingConfig {
  minimumMobilizationFee: number;
  bulkDiscountRate: number;
  lotSizes: CmsLotSizeOption[];
  densities: CmsDensityOption[];
  addons: CmsAddonOption[];
}

export interface CmsBusinessProfile {
  businessName: string;
  shortName: string;
  brandMonogram: string;
  ownerName: string;
  assistantName: string;
  primaryKeyword: BilingualText;
  cityState: string;
  serviceArea: string;
  serviceCities: string[];
  phone: string;
  phoneHref: string;
  email: string;
  operatingHours: BilingualText;
  googleRating: number;
  googleReviewCount: number;
  googleRatingLabel: BilingualText;
  logoUrl: string;
  heroImageUrl: string;
  assistantAvatarUrl: string;
  contractorToolPin?: string;
}

export interface CmsSectionCopy {
  hero: {
    trustLine: BilingualText;
    licensedLabel: BilingualText;
    spanishBadge: BilingualText;
    subheadline: BilingualText;
    ctaEstimate: BilingualText;
    ctaCall: BilingualText;
    serviceAreaPrefix: BilingualText;
    formTitle: BilingualText;
    formSubtitle: BilingualText;
  };
  estimator: {
    kicker: BilingualText;
    title: BilingualText;
    subtitle: BilingualText;
    bulkDiscountBadge: BilingualText;
    disclaimer: BilingualText;
    lockFormTitle: BilingualText;
    lockFormSubtitle: BilingualText;
  };
  calendar: {
    kicker: BilingualText;
    title: BilingualText;
    subtitle: BilingualText;
  };
  services: {
    kicker: BilingualText;
    title: BilingualText;
    subtitle: BilingualText;
    requestAction: BilingualText;
  };
  gallery: {
    kicker: BilingualText;
    title: BilingualText;
    subtitle: BilingualText;
  };
  reviews: {
    kicker: BilingualText;
    title: BilingualText;
    subtitle: BilingualText;
    leaveReviewNote: BilingualText;
  };
  faq: {
    kicker: BilingualText;
    title: BilingualText;
    subtitle: BilingualText;
  };
  footer: {
    tagline: BilingualText;
    rightsReserved: BilingualText;
  };
  assistant: {
    welcomeEn: string;
    welcomeEs: string;
    extraInstructions: string;
  };
}

export interface SiteCmsData {
  templateVersion: string;
  updatedAt: string;
  theme: CmsThemeConfig;
  business: CmsBusinessProfile;
  pricing: CmsPricingConfig;
  sections: CmsSectionCopy;
  services: CmsServiceItem[];
  workPhotos: CmsWorkPhoto[];
  reviews: CmsGoogleReview[];
  faqs: CmsFaqItem[];
}

export interface DynamicLotEstimateResult {
  baseMin: number;
  baseMax: number;
  discountMin: number;
  discountMax: number;
  clearingMin: number;
  clearingMax: number;
  addonsTotal: number;
  totalMin: number;
  totalMax: number;
  hasBulkDiscount: boolean;
  isFivePlus: boolean;
  isPerAcreRate: boolean;
  perAcreRange: [number, number];
}
