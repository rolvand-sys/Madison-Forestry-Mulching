import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  MessageSquareText,
  Phone,
  PhoneCall,
  X,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCallModal } from '../context/CallContext';
import { useCms } from '../context/CmsContext';

export function CallDispatchModal() {
  const { language } = useLanguage();
  const { isCallModalOpen, closeCallModal } = useCallModal();
  const { cms } = useCms();
  const biz = cms.business;

  const [copied, setCopied] = useState(false);
  const [callerName, setCallerName] = useState('');
  const [callerPhone, setCallerPhone] = useState('');
  const [callbackError, setCallbackError] = useState('');
  const [callbackSent, setCallbackSent] = useState(false);

  useEffect(() => {
    if (!isCallModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCallModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isCallModalOpen, closeCallModal]);

  if (!isCallModalOpen) return null;

  const copy =
    language === 'es'
      ? {
          title: 'Llamada Directa y Despacho',
          subtitle: `Hable directo con ${biz.ownerName} (${biz.shortName})`,
          dialNow: `Marcar ${biz.phone}`,
          copyNumber: 'Copiar Número',
          copiedNumber: '¡Número Copiado!',
          sendSms: 'Enviar SMS',
          orDivider: 'O solicite que le llamemos de inmediato',
          nameLabel: 'Su Nombre',
          namePlaceholder: 'Ej. Carlos Méndez',
          phoneLabel: 'Su Teléfono',
          phonePlaceholder: '(850) 555-0199',
          requestCallback: 'Solicitar Llamada Ahora',
          validationError: 'Ingrese su nombre y un número de teléfono válido.',
          confirmedTitle: 'Solicitud de Llamada Recibida',
          confirmedBody: `Gracias, ${callerName || 'cliente'}. Nuestro equipo devolverá la llamada al ${callerPhone} dentro de nuestro horario de atención (${biz.operatingHours.es}).`,
          sendAnother: 'Enviar otro número',
          closeLabel: 'Cerrar ventana de llamada',
        }
      : {
          title: 'Direct Call & Dispatch',
          subtitle: `Speak directly with ${biz.ownerName} (${biz.shortName})`,
          dialNow: `Call ${biz.phone}`,
          copyNumber: 'Copy Number',
          copiedNumber: 'Number Copied!',
          sendSms: 'Send Text (SMS)',
          orDivider: 'Or request an immediate callback',
          nameLabel: 'Your Name',
          namePlaceholder: 'e.g. John Davis',
          phoneLabel: 'Your Phone Number',
          phonePlaceholder: '(850) 555-0199',
          requestCallback: 'Request Immediate Callback',
          validationError: 'Please enter your name and a valid phone number.',
          confirmedTitle: 'Callback Request Logged',
          confirmedBody: `Thank you, ${callerName || 'there'}. Our crew will call you back at ${callerPhone} during operating hours (${biz.operatingHours.en}).`,
          sendAnother: 'Request another callback',
          closeLabel: 'Close call window',
        };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(biz.phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const handleCallbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = callerPhone.replace(/\D/g, '');
    if (!callerName.trim() || digits.length < 7) {
      setCallbackError(copy.validationError);
      return;
    }
    setCallbackError('');
    setCallbackSent(true);
  };

  const smsHref = `sms:${biz.phoneHref.replace('tel:', '')}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="call-dispatch-modal-title"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={closeCallModal}
    >
      <div
        className="max-w-md w-full bg-[var(--cv-dark-card)] border border-white/15 rounded-xl p-6 text-white shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[var(--cv-primary)] text-[var(--cv-accent)] flex items-center justify-center shrink-0">
              <PhoneCall className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id="call-dispatch-modal-title"
                className="font-display text-2xl font-bold leading-none truncate"
              >
                {copy.title}
              </h2>
              <p className="text-xs text-neutral-300 mt-1 truncate">{copy.subtitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeCallModal}
            aria-label={copy.closeLabel}
            className="text-neutral-400 hover:text-white cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Phone Card & Direct Actions */}
        <div className="bg-[var(--cv-dark-surface)] border border-white/10 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-xl sm:text-2xl font-bold text-[var(--cv-accent)] tabular-nums">
              {biz.phone}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded transition-colors cursor-pointer shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[var(--cv-light-green)]" aria-hidden="true" />
                  <span className="text-[var(--cv-light-green)]">{copy.copiedNumber}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{copy.copyNumber}</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <Clock className="w-3.5 h-3.5 text-[var(--cv-light-green)] shrink-0" aria-hidden="true" />
            <span>{biz.operatingHours[language]}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <a
              href={biz.phoneHref}
              className="inline-flex items-center justify-center gap-2 bg-[var(--cv-primary)] hover:bg-[var(--cv-primary-dark)] text-white font-semibold text-xs sm:text-sm px-3.5 py-2.5 rounded-md transition-colors whitespace-nowrap"
            >
              <Phone className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{copy.dialNow}</span>
            </a>

            <a
              href={smsHref}
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-xs sm:text-sm px-3.5 py-2.5 rounded-md transition-colors whitespace-nowrap"
            >
              <MessageSquareText
                className="w-4 h-4 text-[var(--cv-accent)] shrink-0"
                aria-hidden="true"
              />
              <span>{copy.sendSms}</span>
            </a>
          </div>
        </div>

        {/* Instant Callback Form */}
        <div className="pt-1 border-t border-white/10">
          {callbackSent ? (
            <div className="bg-[var(--cv-dark-surface)] border border-[var(--cv-light-green)]/40 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-[var(--cv-light-green)]">
                <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                <h3 className="font-display text-lg font-bold text-white">
                  {copy.confirmedTitle}
                </h3>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">{copy.confirmedBody}</p>
              <button
                type="button"
                onClick={() => {
                  setCallbackSent(false);
                  setCallerName('');
                  setCallerPhone('');
                }}
                className="text-xs font-semibold text-[var(--cv-accent)] hover:underline cursor-pointer"
              >
                {copy.sendAnother}
              </button>
            </div>
          ) : (
            <form onSubmit={handleCallbackSubmit} noValidate className="space-y-3">
              <p className="text-xs font-semibold text-neutral-300">{copy.orDivider}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="cb-name" className="block text-[11px] text-neutral-300 mb-1">
                    {copy.nameLabel}
                  </label>
                  <input
                    id="cb-name"
                    type="text"
                    value={callerName}
                    onChange={(e) => setCallerName(e.target.value)}
                    placeholder={copy.namePlaceholder}
                    className="w-full bg-[var(--cv-dark-surface)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3 py-2 text-xs text-white placeholder:text-neutral-500"
                  />
                </div>
                <div>
                  <label htmlFor="cb-phone" className="block text-[11px] text-neutral-300 mb-1">
                    {copy.phoneLabel}
                  </label>
                  <input
                    id="cb-phone"
                    type="tel"
                    value={callerPhone}
                    onChange={(e) => setCallerPhone(e.target.value)}
                    placeholder={copy.phonePlaceholder}
                    className="w-full bg-[var(--cv-dark-surface)] border border-white/15 focus:border-[var(--cv-light-green)] focus:outline-none rounded-md px-3 py-2 text-xs text-white font-mono placeholder:text-neutral-500"
                  />
                </div>
              </div>

              {callbackError && (
                <p role="alert" className="text-xs text-[var(--cv-accent)] font-medium">
                  {callbackError}
                </p>
              )}

              <button
                type="submit"
                className="w-full bg-[var(--cv-accent)] hover:opacity-90 text-[var(--cv-dark-surface)] font-bold text-xs sm:text-sm py-2.5 px-4 rounded-md transition-opacity cursor-pointer"
              >
                {copy.requestCallback}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
