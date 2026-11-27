import { useLanguage } from '../context/LanguageContext';
import { useCms } from '../context/CmsContext';
import { resolveAssetUrl } from '../utils/assetUrl';

export interface ProposalData {
  quoteNumber: string;
  issueDate: string;
  clientName: string;
  clientContact: string;
  propertyAddress: string;
  acreage: string;
  scopeOfWork: string;
  totalPrice: number;
  depositPercent: number;
  validFor: string;
}

export function formatCurrencyExact(amount: number): string {
  const safe = Number.isFinite(amount) && amount >= 0 ? amount : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: safe % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

interface ProposalDocumentProps {
  data: ProposalData;
}

export function ProposalDocument({ data }: ProposalDocumentProps) {
  const { language, t } = useLanguage();
  const { cms } = useCms();
  const biz = cms.business;
  const c = t.contractorTool;

  const safeTotal = Math.max(0, Number(data.totalPrice) || 0);
  const safeDepositPct = Math.min(100, Math.max(0, Number(data.depositPercent) || 0));
  const depositDue = Math.round(safeTotal * (safeDepositPct / 100) * 100) / 100;
  const balanceDue = Math.max(0, Math.round((safeTotal - depositDue) * 100) / 100);
  const validDisplay = data.validFor.trim() || c.validForPlaceholder;

  const acceptanceNote =
    language === 'es'
      ? `La firma autoriza a ${biz.businessName} a programar el trabajo bajo los términos anteriores.`
      : `Acceptance authorizes ${biz.businessName} to schedule work under the terms above.`;

  return (
    <article className="bg-white text-[#231710] w-full max-w-[8.5in] mx-auto p-6 sm:p-8 border border-[#DDD1C0] print:border-0 print:p-0 print:max-w-none font-sans">
      {/* Brand Header Band */}
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-[#231710]">
        <div className="flex items-start gap-3">
          {biz.logoUrl ? (
            <img
              src={resolveAssetUrl(biz.logoUrl)}
              alt={biz.businessName}
              referrerPolicy="no-referrer"
              className="h-24 w-24 rounded-md object-cover bg-[#2C1E14] border border-[#231710]/30 shrink-0"
            />
          ) : (
            <div className="w-24 h-24 rounded-md bg-[var(--cv-primary)] text-[var(--cv-accent)] font-display font-bold text-3xl flex items-center justify-center shrink-0">
              {biz.brandMonogram}
            </div>
          )}
          <div className="space-y-0.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-[#231710] leading-none">
              {biz.businessName}
            </h1>
            <p className="text-xs text-neutral-600">
              {biz.cityState} · {biz.phone} · {biz.email}
            </p>
            <p className="text-[11px] text-neutral-500">
              {c.serviceAreaPrefix}: {biz.serviceArea}
            </p>
          </div>
        </div>

        <div className="sm:text-right shrink-0 space-y-0.5">
          <p className="font-display text-xl font-bold tracking-wide text-[var(--cv-primary)] uppercase leading-none">
            {c.proposalHeading}
          </p>
          <p className="text-xs font-mono font-semibold text-[#231710] tabular-nums">
            {c.quoteNumberPrefix}
            {data.quoteNumber}
          </p>
          <p className="text-[11px] text-neutral-600 tabular-nums">
            {c.issuedLabel}: {data.issueDate} · {c.validForPrefix}: {validDisplay}
          </p>
        </div>
      </header>

      {/* Client & Property Details */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-b border-[#DDD1C0]">
        <div className="bg-[#F4EFE6] border border-[#DDD1C0] rounded-md p-3.5 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            {c.preparedForLabel}
          </p>
          <p className="text-sm font-bold text-[#231710]">
            {data.clientName.trim() || c.clientNameFallback}
          </p>
          <p className="text-xs text-neutral-700">
            {data.clientContact.trim() || c.clientContactFallback}
          </p>
        </div>

        <div className="bg-[#F4EFE6] border border-[#DDD1C0] rounded-md p-3.5 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            {c.parcelLocationLabel}
          </p>
          <p className="text-sm font-bold text-[#231710]">
            {data.propertyAddress.trim() || c.propertyAddressFallback}
          </p>
          <p className="text-xs font-mono text-neutral-700 tabular-nums">
            {c.estimatedAreaPrefix}: {data.acreage.trim() || c.tbdLabel}
          </p>
        </div>
      </section>

      {/* Scope of Work */}
      <section className="py-4 border-b border-[#DDD1C0] space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-[#231710]">
          {c.detailedScopeHeading}
        </h2>
        <div className="bg-[#F4EFE6] border border-[#DDD1C0] rounded-md p-3.5 text-xs sm:text-[13px] text-neutral-800 leading-relaxed whitespace-pre-line min-h-[84px]">
          {data.scopeOfWork.trim() || c.scopeFallback}
        </div>
      </section>

      {/* Pricing & Payment Schedule */}
      <section className="py-4 border-b border-[#DDD1C0]">
        <h2 className="text-xs font-bold uppercase tracking-wide text-[#231710] mb-2.5">
          {c.quoteSummaryHeading}
        </h2>

        <div className="border border-[#DDD1C0] rounded-md overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-[#DDD1C0] bg-[#F4EFE6]">
            <div className="p-3.5">
              <p className="text-[11px] font-semibold text-neutral-500">
                {c.totalQuotedPriceLabel}
              </p>
              <p className="font-display text-2xl font-bold text-[#231710] tabular-nums mt-0.5">
                {formatCurrencyExact(safeTotal)}
              </p>
            </div>

            <div className="p-3.5">
              <p className="text-[11px] font-semibold text-neutral-500">
                {c.depositDuePrefix} ({safeDepositPct}%)
              </p>
              <p className="font-display text-2xl font-bold text-[var(--cv-primary)] tabular-nums mt-0.5">
                {formatCurrencyExact(depositDue)}
              </p>
            </div>

            <div className="p-3.5">
              <p className="text-[11px] font-semibold text-neutral-500">
                {c.balanceUponCompletionLabel}
              </p>
              <p className="font-display text-2xl font-bold text-[#231710] tabular-nums mt-0.5">
                {formatCurrencyExact(balanceDue)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Land Clearing Standard Terms */}
      <section className="py-4 border-b border-[#DDD1C0] space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-[#231710]">
          {c.standardTermsHeading}
        </h2>
        <ol className="space-y-1.5 text-[11px] text-neutral-700 leading-snug list-decimal pl-4">
          {c.standardTerms.map((term) => (
            <li key={term.title}>
              <strong className="text-[#231710]">{term.title}</strong> {term.body}
            </li>
          ))}
        </ol>
      </section>

      {/* Acceptance Signatures */}
      <footer className="pt-5 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
        <div className="space-y-5">
          <p className="text-[11px] text-neutral-600">{acceptanceNote}</p>
          <div className="pt-4 border-t border-neutral-400 flex justify-between text-[11px] text-neutral-600">
            <span>{c.clientSignatureLabel}</span>
            <span>{c.dateLabel}</span>
          </div>
        </div>

        <div className="space-y-5">
          <p className="text-[11px] text-neutral-600">
            {c.preparedByPrefix} {biz.ownerName} · {c.licensedContractorNote}
          </p>
          <div className="pt-4 border-t border-neutral-400 flex justify-between text-[11px] text-neutral-600">
            <span>{c.authorizedContractorLabel}</span>
            <span>
              {c.validPrefix} {validDisplay}
            </span>
          </div>
        </div>
      </footer>
    </article>
  );
}
