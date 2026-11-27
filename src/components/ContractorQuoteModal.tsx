import React, { useEffect, useState } from 'react';
import { FileText, Lock, Plus, Printer, ShieldCheck, Unlock, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCms } from '../context/CmsContext';
import { formatCurrencyExact, ProposalData, ProposalDocument } from './ProposalDocument';

interface ContractorQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposalData: ProposalData;
  onChangeProposalData: React.Dispatch<React.SetStateAction<ProposalData>>;
}

export function ContractorQuoteModal({
  isOpen,
  onClose,
  proposalData,
  onChangeProposalData,
}: ContractorQuoteModalProps) {
  const { language, t } = useLanguage();
  const { cms } = useCms();
  const biz = cms.business;
  const c = t.contractorTool;

  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const safeTotal = Math.max(0, Number(proposalData.totalPrice) || 0);
  const safeDepositPct = Math.min(100, Math.max(0, Number(proposalData.depositPercent) || 0));
  const depositDue = Math.round(safeTotal * (safeDepositPct / 100) * 100) / 100;
  const balanceDue = Math.max(0, Math.round((safeTotal - depositDue) * 100) / 100);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim() || pinBusy) return;
    setPinBusy(true);
    setPinError('');

    try {
      const res = await fetch('/api/contractor/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput.trim() }),
      });

      if (res.ok) {
        setUnlocked(true);
        setPinInput('');
      } else {
        setPinError(c.pinError);
      }
    } catch {
      setPinError(c.pinError);
    } finally {
      setPinBusy(false);
    }
  };

  const handleInsertChip = (line: string) => {
    onChangeProposalData((prev) => {
      const current = prev.scopeOfWork.trim();
      if (current.includes(line)) return prev;
      return {
        ...prev,
        scopeOfWork: current ? `${current}\n${line}` : line,
      };
    });
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="contractor-proposal-modal-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      {!unlocked ? (
        /* 1. PIN Security Modal */
        <div
          className="max-w-sm w-full bg-[var(--cv-dark-card)] border border-white/15 rounded-xl p-6 sm:p-7 text-white shadow-2xl space-y-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--cv-primary)]/25 text-[var(--cv-light-green)] flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="contractor-proposal-modal-title"
                  className="font-display text-2xl font-bold leading-none"
                >
                  {c.pinModalTitle}
                </h2>
                <p className="text-xs text-neutral-400 mt-1">{c.pinModalSubtitle}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={c.closePinModal}
              className="text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="contractor-pin"
                className="block text-xs font-semibold text-neutral-200 mb-1.5"
              >
                {c.pinLabel}
              </label>
              <input
                id="contractor-pin"
                type="password"
                inputMode="numeric"
                maxLength={8}
                autoFocus
                value={pinInput}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
                  setPinInput(digits);
                  if (pinError) setPinError('');
                }}
                placeholder="••••"
                className="w-full bg-[var(--cv-dark-surface)] border border-white/20 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-white placeholder:text-neutral-600"
              />
              <p className="text-[11px] text-neutral-400 mt-2 text-center">
                {language === 'es'
                  ? 'Configurable desde el panel CMS (/admin).'
                  : 'Configurable inside the /admin CMS dashboard.'}
              </p>
            </div>

            {pinError && (
              <p role="alert" className="text-xs text-[var(--cv-accent)] text-center font-medium">
                {pinError}
              </p>
            )}

            <button
              type="submit"
              disabled={pinBusy}
              className="w-full inline-flex items-center justify-center gap-2 bg-[var(--cv-primary)] hover:bg-[var(--cv-primary-dark)] disabled:opacity-50 text-white font-semibold text-sm py-3 px-4 rounded-md transition-colors cursor-pointer"
            >
              <Unlock className="w-4 h-4" aria-hidden="true" />
              <span>{c.unlockButton}</span>
            </button>
          </form>
        </div>
      ) : (
        /* 2. Quick Proposal Builder + Live Branded Preview */
        <div
          className="max-w-7xl w-full max-h-[92vh] bg-[var(--cv-dark-surface)] border border-white/15 rounded-xl overflow-hidden flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Top Bar */}
          <div className="px-4 sm:px-6 py-3.5 bg-[var(--cv-dark-card)] border-b border-white/10 flex flex-wrap items-center justify-between gap-3 text-white shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded bg-[var(--cv-primary)] text-[var(--cv-accent)] flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2
                  id="contractor-proposal-modal-title"
                  className="font-display text-xl sm:text-2xl font-bold leading-none truncate"
                >
                  {c.generatorTitle}
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5 truncate">
                  {biz.shortName} · {c.fieldQuoteLabel} #{proposalData.quoteNumber}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handlePrintPdf}
                className="inline-flex items-center gap-2 bg-[var(--cv-primary)] hover:bg-[var(--cv-primary-dark)] text-white font-semibold text-xs sm:text-sm px-3.5 sm:px-4 py-2 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{c.downloadPdfButton}</span>
              </button>

              <button
                type="button"
                onClick={() => setUnlocked(false)}
                title={c.lockButton}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-300 hover:text-white border border-white/15 hover:border-white/30 px-3 py-2 rounded-md transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{c.lockButton}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label={c.closeGenerator}
                className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-white/15 text-neutral-300 hover:text-white hover:border-white/30 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Mobile Tabs (< lg) */}
          <div className="lg:hidden grid grid-cols-2 border-b border-white/10 bg-[var(--cv-dark-surface)] shrink-0">
            <button
              type="button"
              onClick={() => setMobileTab('edit')}
              className={`py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                mobileTab === 'edit'
                  ? 'bg-[var(--cv-dark-card)] text-[var(--cv-accent)] border-b-2 border-[var(--cv-accent)]'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {c.tabEdit}
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('preview')}
              className={`py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                mobileTab === 'preview'
                  ? 'bg-[var(--cv-dark-card)] text-[var(--cv-accent)] border-b-2 border-[var(--cv-accent)]'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {c.tabPreview}
            </button>
          </div>

          {/* Split-Screen Content */}
          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
            {/* Left Pane: Field Inputs */}
            <div
              className={`lg:col-span-5 overflow-y-auto p-5 sm:p-6 bg-[var(--cv-dark-card)] border-r border-white/10 space-y-4 text-white ${
                mobileTab === 'edit' ? 'block' : 'hidden lg:block'
              }`}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="prop-client-name"
                    className="block text-xs font-semibold text-neutral-200 mb-1"
                  >
                    {c.clientNameLabel}
                  </label>
                  <input
                    id="prop-client-name"
                    type="text"
                    value={proposalData.clientName}
                    onChange={(e) =>
                      onChangeProposalData((prev) => ({ ...prev, clientName: e.target.value }))
                    }
                    placeholder={c.clientNamePlaceholder}
                    className="w-full bg-[var(--cv-dark-surface)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3 py-2 text-sm text-white placeholder:text-neutral-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="prop-client-contact"
                    className="block text-xs font-semibold text-neutral-200 mb-1"
                  >
                    {c.clientContactLabel}
                  </label>
                  <input
                    id="prop-client-contact"
                    type="text"
                    value={proposalData.clientContact}
                    onChange={(e) =>
                      onChangeProposalData((prev) => ({ ...prev, clientContact: e.target.value }))
                    }
                    placeholder={c.clientContactPlaceholder}
                    className="w-full bg-[var(--cv-dark-surface)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3 py-2 text-sm text-white placeholder:text-neutral-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="prop-address"
                    className="block text-xs font-semibold text-neutral-200 mb-1"
                  >
                    {c.propertyAddressLabel}
                  </label>
                  <input
                    id="prop-address"
                    type="text"
                    value={proposalData.propertyAddress}
                    onChange={(e) =>
                      onChangeProposalData((prev) => ({
                        ...prev,
                        propertyAddress: e.target.value,
                      }))
                    }
                    placeholder={c.propertyAddressPlaceholder}
                    className="w-full bg-[var(--cv-dark-surface)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3 py-2 text-sm text-white placeholder:text-neutral-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="prop-acreage"
                    className="block text-xs font-semibold text-neutral-200 mb-1"
                  >
                    {c.acreageLabel}
                  </label>
                  <input
                    id="prop-acreage"
                    type="text"
                    value={proposalData.acreage}
                    onChange={(e) =>
                      onChangeProposalData((prev) => ({ ...prev, acreage: e.target.value }))
                    }
                    placeholder={c.acreagePlaceholder}
                    className="w-full bg-[var(--cv-dark-surface)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3 py-2 text-sm text-white placeholder:text-neutral-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="prop-valid"
                    className="block text-xs font-semibold text-neutral-200 mb-1"
                  >
                    {c.validForLabel}
                  </label>
                  <input
                    id="prop-valid"
                    type="text"
                    value={proposalData.validFor}
                    onChange={(e) =>
                      onChangeProposalData((prev) => ({ ...prev, validFor: e.target.value }))
                    }
                    placeholder={c.validForPlaceholder}
                    className="w-full bg-[var(--cv-dark-surface)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3 py-2 text-sm text-white placeholder:text-neutral-500"
                  />
                </div>
              </div>

              {/* Scope of Work + Quick-Insert Chips */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="prop-scope" className="block text-xs font-semibold text-neutral-200">
                    {c.scopeLabel}
                  </label>
                  <span className="text-[11px] text-neutral-400">{c.tapChipsHint}</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {c.scopeChips.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => handleInsertChip(chip.line)}
                      className="inline-flex items-center gap-1 text-xs font-medium bg-[var(--cv-dark-surface)] hover:bg-[var(--cv-primary)] text-neutral-200 hover:text-white border border-white/15 hover:border-[var(--cv-light-green)] px-2.5 py-1 rounded transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span>{chip.label}</span>
                    </button>
                  ))}
                </div>

                <textarea
                  id="prop-scope"
                  rows={4}
                  value={proposalData.scopeOfWork}
                  onChange={(e) =>
                    onChangeProposalData((prev) => ({ ...prev, scopeOfWork: e.target.value }))
                  }
                  placeholder={c.scopePlaceholder}
                  className="w-full bg-[var(--cv-dark-surface)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3 py-2 text-sm text-white placeholder:text-neutral-500 leading-relaxed"
                />
              </div>

              {/* Pricing & Auto Deposit Math */}
              <div className="grid grid-cols-2 gap-3.5 pt-1">
                <div>
                  <label
                    htmlFor="prop-total"
                    className="block text-xs font-semibold text-neutral-200 mb-1"
                  >
                    {c.totalPriceLabel}
                  </label>
                  <input
                    id="prop-total"
                    type="number"
                    min={0}
                    step={50}
                    value={proposalData.totalPrice}
                    onChange={(e) =>
                      onChangeProposalData((prev) => ({
                        ...prev,
                        totalPrice: Number(e.target.value),
                      }))
                    }
                    className="w-full bg-[var(--cv-dark-surface)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3 py-2 text-sm font-mono tabular-nums text-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="prop-deposit"
                    className="block text-xs font-semibold text-neutral-200 mb-1"
                  >
                    {c.depositPercentLabel}
                  </label>
                  <input
                    id="prop-deposit"
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    value={proposalData.depositPercent}
                    onChange={(e) =>
                      onChangeProposalData((prev) => ({
                        ...prev,
                        depositPercent: Number(e.target.value),
                      }))
                    }
                    className="w-full bg-[var(--cv-dark-surface)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3 py-2 text-sm font-mono tabular-nums text-white"
                  />
                </div>
              </div>

              {/* Live Auto-Calculated Deposit & Balance Readout */}
              <div className="bg-[var(--cv-dark-surface)] border border-white/10 rounded-lg p-3.5 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-neutral-400">
                    {c.depositDueLabel} ({safeDepositPct}%):
                  </span>
                  <p className="font-mono text-base font-bold text-[var(--cv-accent)] tabular-nums mt-0.5">
                    {formatCurrencyExact(depositDue)}
                  </p>
                </div>
                <div>
                  <span className="text-neutral-400">{c.balanceDueLabel}:</span>
                  <p className="font-mono text-base font-bold text-white tabular-nums mt-0.5">
                    {formatCurrencyExact(balanceDue)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-neutral-400 pt-1">
                <ShieldCheck
                  className="w-4 h-4 text-[var(--cv-light-green)] shrink-0"
                  aria-hidden="true"
                />
                <span>{c.termsIncludedNote}</span>
              </div>
            </div>

            {/* Right Pane: Live Branded Proposal Preview */}
            <div
              className={`lg:col-span-7 overflow-y-auto p-4 sm:p-6 bg-[#E5E7E4] ${
                mobileTab === 'preview' ? 'block' : 'hidden lg:block'
              }`}
            >
              <div className="shadow-lg">
                <ProposalDocument data={proposalData} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
