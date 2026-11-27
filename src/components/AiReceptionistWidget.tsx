import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarCheck2,
  CalendarPlus,
  CheckCircle2,
  Download,
  MessageSquare,
  Mic,
  MicOff,
  Phone,
  RotateCcw,
  Send,
  Square,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCallModal } from '../context/CallContext';
import { useCms } from '../context/CmsContext';
import {
  Appointment,
  buildGoogleCalendarUrl,
  formatDateHuman,
  getIcsDownloadUrl,
  isStaticPagesHost,
  playNotificationChime,
} from '../utils/calendarClient';
import { resolveAssetUrl } from '../utils/assetUrl';
import { calculateDynamicLotEstimate } from '../data/defaultCms';
import type { SiteCmsData } from '../types/cms';

interface CapturedSiteVisit {
  name: string;
  phone: string;
  address: string;
  lotSize: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isStreaming?: boolean;
  bookedAppointment?: Appointment;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

function parseAssistantOutput(rawText: string): {
  displayText: string;
  capturedVisit: CapturedSiteVisit | null;
} {
  const fullTagRegex = /\[\[SITE_VISIT_CAPTURED:(\{[\s\S]*?\})\]\]/;
  const match = rawText.match(fullTagRegex);

  if (match) {
    let parsed: CapturedSiteVisit | null = null;
    try {
      const candidate = JSON.parse(match[1]) as Partial<CapturedSiteVisit>;
      if (
        typeof candidate.name === 'string' &&
        typeof candidate.phone === 'string' &&
        typeof candidate.address === 'string' &&
        typeof candidate.lotSize === 'string'
      ) {
        parsed = {
          name: candidate.name,
          phone: candidate.phone,
          address: candidate.address,
          lotSize: candidate.lotSize,
        };
      }
    } catch {
      parsed = null;
    }

    return {
      displayText: rawText.replace(fullTagRegex, '').trim(),
      capturedVisit: parsed,
    };
  }

  const partialIndex = rawText.indexOf('[[SITE_VISIT_CAPTURED');
  if (partialIndex !== -1) {
    return {
      displayText: rawText.slice(0, partialIndex).trim(),
      capturedVisit: null,
    };
  }

  return {
    displayText: rawText,
    capturedVisit: null,
  };
}

function detectSpanishReply(text: string, fallbackLang: 'en' | 'es'): 'en-US' | 'es-US' {
  if (/[áéíóúñ¿¡]/i.test(text)) return 'es-US';
  if (
    /\b(hola|terreno|limpieza|limpiar|necesito|propiedad|reserva|agendar|cita|evaluacion|horario|horarios|donde|como|cuanto|trituracion|precio|precios|visita|palma|maleza|gracias|buenos|buenas|para|una|con|que)\b/i.test(
      text
    )
  ) {
    return 'es-US';
  }
  if (/\b(hello|clearing|mulching|acre|estimate|palmetto|schedule|visit|thanks|how|where|price|book)\b/i.test(text)) {
    return 'en-US';
  }
  return fallbackLang === 'es' ? 'es-US' : 'en-US';
}

function buildOfflineJessicaReply(
  userText: string,
  cms: SiteCmsData,
  fallbackLang: 'en' | 'es',
  isFirstTurn: boolean
): string {
  const q = userText.toLowerCase().trim();
  const isEs = detectSpanishReply(userText, fallbackLang) === 'es-US';
  const biz = cms.business;
  const pricing = cms.pricing;
  const discountPct = Math.round(pricing.bulkDiscountRate * 100);

  const isPureGreeting =
    /^(hola|hi|hello|hey|buenos d[ií]as|buenas tardes|buenas noches|good morning|good afternoon|qu[eé] tal)[!.\s]*$/i.test(
      q
    );

  const asksSchedule =
    /(book|schedul|visit|date|calendar|reserv|appoint|walk[\s-]*through|evalua|agend|cita|visita|fecha|calendario|programar|apartar|disponib)/i.test(
      q
    );

  const asksPrice =
    /(price|cost|quote|estimat|how much|acre|palmetto|brush|stump|driveway|cu[aá]nto|precio|cotiz|estimar|palma|maleza|toc[oó]n|tocon|descuento|limpiar|desmont)/i.test(
      q
    );

  const asksHoursOrAddress =
    /(hour|open|close|address|where|location|map|phone|call|horario|hora|abre|cierra|direcci[oó]n|ubicaci[oó]n|tel[eé]fono|llamar|zona|ciudad|area|serve|cubr|donde|d[oó]nde)/i.test(
      q
    );

  const introEs = isFirstTurn
    ? `¡Hola! Soy ${biz.assistantName} de ${biz.businessName}. `
    : '';
  const introEn = isFirstTurn
    ? `Hi! I'm ${biz.assistantName} with ${biz.businessName}. `
    : '';

  if (isPureGreeting) {
    return isEs
      ? `¡Hola! Soy ${biz.assistantName} de ${biz.businessName} (${biz.cityState}). Puedo darte un estimado preliminar según tus acres, explicarte nuestros servicios en el Norte de Florida y Quitman/Valdosta, GA, o indicarte cómo agendar una evaluación gratuita con ${biz.ownerName}. ¿En qué te ayudo hoy?`
      : `Hi there! I'm ${biz.assistantName} with ${biz.businessName} (${biz.cityState}). I can give you a preliminary acreage estimate, share details on our North Florida & Quitman/Valdosta, GA services, or help you schedule a free site walk with ${biz.ownerName}. How can I help today?`;
  }

  if (asksSchedule) {
    return isEs
      ? `${introEs}Para reservar tu evaluación gratuita en sitio con ${biz.ownerName}, tienes dos opciones fáciles:\n\n1. En esta misma página: baja a la sección "Agenda Tu Evaluación en Sitio" (o toca "Agendar Visita" en el menú superior), elige un día disponible de lunes a viernes y un bloque horario (martes de 12:00 PM a 5:00 PM), completa tus datos y confirma.\n2. Por teléfono: llámanos directamente al ${biz.phone}.\n\nAl confirmar podrás guardar el recordatorio en tu calendario (.ics o Google Calendar).`
      : `${introEn}You can book your free on-site evaluation with ${biz.ownerName} in two easy ways:\n\n1. Right on this page: click "Site Visit" in the top menu (or scroll to "Schedule a Property Site Evaluation"), select an open Mon–Fri date and arrival window (Tuesdays 12:00 PM–5:00 PM), enter your property details, and confirm.\n2. By phone: call us directly at ${biz.phone}.\n\nOnce confirmed, you can save the appointment straight to Google Calendar or download an .ics invite.`;
  }

  if (asksPrice) {
    let customAcres: number | null = null;
    if (/(1\/4|0\.25|quarter|cuarto)/.test(q)) customAcres = 0.25;
    else if (/(1\/2|0\.5\b|half|medio)/.test(q)) customAcres = 0.5;
    else {
      const acreMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:acres?|ac\b)/i);
      if (acreMatch) {
        const parsed = Number(acreMatch[1]);
        if (Number.isFinite(parsed) && parsed > 0) {
          customAcres = parsed;
        }
      } else if (/(5\+|bulk|volumen|finca|40\b)/.test(q)) {
        customAcres = 5;
      }
    }

    let densityId = 'medium';
    if (/(heavy|timber|storm|hurricane|tormenta|hurac[aá]n|denso|cerrad|bosque)/.test(q)) {
      densityId = 'heavy';
    } else if (/(light|weed|liger|pasto|hierba)/.test(q)) {
      densityId = 'light';
    }

    const denObj = pricing.densities.find((d) => d.id === densityId) ?? pricing.densities[1] ?? pricing.densities[0];

    let areaLabelEs = '1 Acre';
    let areaLabelEn = '1 Acre';
    let estMin = 0;
    let estMax = 0;
    let hasBulk = false;

    const matchingLot =
      customAcres !== null
        ? pricing.lotSizes.find((l) => !l.isFivePlus && Math.abs(l.acres - customAcres!) < 0.01)
        : pricing.lotSizes.find((l) => l.id === '1.00') ?? pricing.lotSizes[0];

    if (matchingLot && (customAcres === null || customAcres < 5)) {
      const est = calculateDynamicLotEstimate(pricing, matchingLot.id, densityId, []);
      areaLabelEs = matchingLot.labelEs;
      areaLabelEn = matchingLot.labelEn;
      estMin = est.totalMin;
      estMax = est.totalMax;
      hasBulk = est.hasBulkDiscount;
    } else if (customAcres !== null) {
      const rawMin = Math.round(denObj.perAcreRange[0] * customAcres);
      const rawMax = Math.round(denObj.perAcreRange[1] * customAcres);
      hasBulk = customAcres >= 5 && pricing.bulkDiscountRate > 0;
      const factor = hasBulk ? 1 - pricing.bulkDiscountRate : 1;
      estMin = Math.max(pricing.minimumMobilizationFee, Math.round(rawMin * factor));
      estMax = Math.max(estMin, Math.round(rawMax * factor));
      const formattedAcres = Number.isInteger(customAcres) ? String(customAcres) : customAcres.toString();
      areaLabelEs = `${formattedAcres} Acres`;
      areaLabelEn = `${formattedAcres} Acres`;
    } else {
      const est = calculateDynamicLotEstimate(pricing, '1.00', densityId, []);
      estMin = est.totalMin;
      estMax = est.totalMax;
      hasBulk = est.hasBulkDiscount;
    }

    const addonsListEs = pricing.addons
      .map((a) => `${a.labelEs} (+$${a.price.toLocaleString()})`)
      .join(', ');
    const addonsListEn = pricing.addons
      .map((a) => `${a.labelEn} (+$${a.price.toLocaleString()})`)
      .join(', ');

    const bulkNoteEs = hasBulk
      ? ` (incluye ${discountPct}% de descuento por volumen en 5+ acres)`
      : ` (tarifa mínima de movilización $${pricing.minimumMobilizationFee.toLocaleString()}, y lotes de 5+ acres reciben ${discountPct}% de descuento)`;
    const bulkNoteEn = hasBulk
      ? ` (includes ${discountPct}% bulk discount for 5+ acres)`
      : ` ($${pricing.minimumMobilizationFee.toLocaleString()} minimum mobilization applies, and 5+ acres get ${discountPct}% off)`;

    return isEs
      ? `${introEs}Para ${areaLabelEs} con ${denObj.labelEs}, el estimado preliminar es de $${estMin.toLocaleString()} – $${estMax.toLocaleString()} USD${bulkNoteEs}.\n\nOpcionales: ${addonsListEs}.\nTambién puedes ajustar estos valores en el Cotizador de la página o llamarnos al ${biz.phone} para confirmar sin costo en sitio.`
      : `${introEn}For ${areaLabelEn} of ${denObj.labelEn}, a preliminary estimate is $${estMin.toLocaleString()} – $${estMax.toLocaleString()} USD${bulkNoteEn}.\n\nOptional add-ons: ${addonsListEn}.\nYou can also fine-tune this in our on-page Lot Estimator or call ${biz.phone} for a free on-site walkthrough.`;
  }

  if (asksHoursOrAddress) {
    return isEs
      ? `${introEs}Operamos desde ${biz.cityState} bajo la dirección de ${biz.ownerName} (Tel: ${biz.phone}).\nHorario: ${biz.operatingHours.es}.\nÁrea de servicio: ${biz.serviceArea}.`
      : `${introEn}We are based at ${biz.cityState}, led by ${biz.ownerName} (Phone: ${biz.phone}).\nHours: ${biz.operatingHours.en}.\nService area: ${biz.serviceArea}.`;
  }

  return isEs
    ? `${introEs}Estamos en ${biz.cityState} (${biz.phone}) y cubrimos ${biz.serviceArea}. Trabajamos con tarifa mínima de $${pricing.minimumMobilizationFee.toLocaleString()} y ${discountPct}% de descuento en 5+ acres. Pregúntame por el tamaño de tu terreno (ej. "2.5 acres"), servicios, horarios o cómo agendar tu evaluación gratuita.`
    : `${introEn}We're located at ${biz.cityState} (${biz.phone}) serving ${biz.serviceArea}. Our minimum mobilization is $${pricing.minimumMobilizationFee.toLocaleString()} with ${discountPct}% off 5+ acres. Ask me about pricing for your acreage (e.g. "2.5 acres"), services, hours, or how to book a free site visit!`;
}

export function AiReceptionistWidget() {
  const { language } = useLanguage();
  const { openCallModal } = useCallModal();
  const { cms } = useCms();
  const biz = cms.business;
  const assistantCopy = cms.sections.assistant;

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorBanner, setErrorBanner] = useState('');

  const [voiceMuted, setVoiceMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const uiCopy = useMemo(
    () =>
      language === 'es'
        ? {
            launcher: `${biz.assistantName} · Asistente Virtual`,
            title: `${biz.assistantName} · Asistente Virtual`,
            subtitle: `${biz.shortName} · EN / ES`,
            welcome:
              assistantCopy.welcomeEs ||
              `¡Hola! Soy ${biz.assistantName}, la Asistente Virtual de ${biz.shortName} en ${biz.cityState}. Puedo darte un estimado rápido según tus acres y densidad de maleza, responder dudas de trituración forestal o agendar una visita al terreno.`,
            chips: [
              'Estimar 1 acre de palma enana',
              'Precios, horarios y zonas de servicio',
              'Ver fechas libres y agendar visita',
            ],
            placeholder: 'Escriba su pregunta o use el micrófono...',
            sendLabel: 'Enviar mensaje',
            voiceStart: 'Hablar por micrófono',
            voiceStop: 'Detener micrófono',
            listeningLabel: 'Escuchando en español...',
            speakingLabel: 'Hablando respuesta...',
            stopSpeaking: 'Silenciar',
            muteVoice: 'Silenciar voz',
            unmuteVoice: 'Activar voz',
            resetChat: 'Reiniciar conversación',
            closeChat: 'Cerrar asistente',
            capturedTitle: 'Solicitud de Visita Registrada',
            bookedCalendarTitle: 'Cita Confirmada en Agenda',
            bookedDateLabel: 'Fecha',
            bookedSlotLabel: 'Horario',
            downloadIcsLabel: 'Recordatorio (.ics)',
            googleCalLabel: 'Google Calendar',
            capturedName: 'Nombre',
            capturedPhone: 'Teléfono',
            capturedAddress: 'Terreno',
            capturedLot: 'Tamaño',
            callButton: 'Llamar Ahora',
            noSpeechSupport:
              'Su navegador no admite reconocimiento de voz. Puede escribir su consulta aquí.',
            voiceBlocked:
              'El micrófono está bloqueado en el navegador o vista previa. Habilite el permiso de micrófono en la configuración del sitio o escriba su pregunta aquí abajo.',
            noMicDevice:
              'No se detectó ningún micrófono conectado. Conecte uno o escriba su consulta aquí abajo.',
            voiceNetworkError:
              'No se pudo conectar el servicio de reconocimiento de voz. Intente de nuevo o escriba su mensaje.',
          }
        : {
            launcher: `${biz.assistantName} · Virtual Assistant`,
            title: `${biz.assistantName} · Virtual Assistant`,
            subtitle: `${biz.shortName} · EN / ES`,
            welcome:
              assistantCopy.welcomeEn ||
              `Hi! I'm ${biz.assistantName}, the Virtual Assistant for ${biz.shortName} in ${biz.cityState}. Ask me for an instant North Florida & South Georgia land clearing estimate, service details, or help booking a free on-site walk-through.`,
            chips: [
              'Estimate 1 acre of palmettos',
              'Pricing, hours & service areas',
              'Check open dates & book a visit',
            ],
            placeholder: 'Ask a question or tap the mic...',
            sendLabel: 'Send message',
            voiceStart: 'Start voice input',
            voiceStop: 'Stop listening',
            listeningLabel: 'Listening (English)...',
            speakingLabel: 'Speaking reply...',
            stopSpeaking: 'Stop',
            muteVoice: 'Mute voice replies',
            unmuteVoice: 'Unmute voice replies',
            resetChat: 'Reset conversation',
            closeChat: 'Close assistant',
            capturedTitle: 'Site Visit Request Captured',
            bookedCalendarTitle: 'Calendar Visit Confirmed',
            bookedDateLabel: 'Date',
            bookedSlotLabel: 'Window',
            downloadIcsLabel: 'Save Reminder (.ics)',
            googleCalLabel: 'Google Calendar',
            capturedName: 'Name',
            capturedPhone: 'Phone',
            capturedAddress: 'Parcel',
            capturedLot: 'Lot Size',
            callButton: 'Call Dispatch',
            noSpeechSupport:
              'Voice input is not supported in this browser. Please type your message below.',
            voiceBlocked:
              'Microphone access is blocked in your browser or preview frame. Allow microphone permission in site settings or type your question below.',
            noMicDevice:
              'No microphone was detected on this device. Connect a mic or type your message below.',
            voiceNetworkError:
              'Speech recognition network error. Please try again or type your message.',
          },
    [language, biz, assistantCopy]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, interimTranscript]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const speakText = (rawReply: string) => {
    if (voiceMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    const { displayText } = parseAssistantOutput(rawReply);
    if (!displayText) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(displayText);
    const targetLang = detectSpanishReply(displayText, language);
    utterance.lang = targetLang;
    utterance.rate = 1.02;

    const voices = window.speechSynthesis.getVoices();
    const langPrefix = targetLang.slice(0, 2).toLowerCase();
    const preferredVoice =
      voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix) && v.localService) ??
      voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const sendMessage = async (textToSend: string, speakResponse = false) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isSending) return;

    setErrorBanner('');
    stopSpeaking();

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };
    const modelMsgId = `m-${Date.now() + 1}`;
    const placeholderModelMsg: ChatMessage = {
      id: modelMsgId,
      role: 'model',
      text: '',
      isStreaming: true,
    };

    const historyForApi = [...messages, userMsg].map((m) => ({
      role: m.role,
      text: m.text,
    }));

    setMessages((prev) => [...prev, userMsg, placeholderModelMsg]);
    setInputText('');
    setIsSending(true);

    try {
      if (isStaticPagesHost()) {
        const offlineReply = buildOfflineJessicaReply(trimmed, cms, language, messages.length === 0);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === modelMsgId
              ? { ...m, text: offlineReply, isStreaming: false }
              : m
          )
        );
        if (speakResponse) {
          speakText(offlineReply);
        }
        return;
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyForApi,
          language,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (!response.ok && (response.status === 404 || !contentType.includes('application/json') && !contentType.includes('text/event-stream'))) {
        const offlineReply = buildOfflineJessicaReply(trimmed, cms, language, messages.length === 0);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === modelMsgId
              ? { ...m, text: offlineReply, isStreaming: false }
              : m
          )
        );
        if (speakResponse) {
          speakText(offlineReply);
        }
        return;
      }

      if (!response.ok) {
        let serverError = `Request failed (${response.status})`;
        try {
          const errJson = (await response.json()) as { error?: string };
          if (errJson.error) serverError = errJson.error;
        } catch {
          // keep status text
        }
        throw new Error(serverError);
      }

      if (!response.body) {
        throw new Error('Streaming response body unavailable.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const eventChunk of events) {
          const line = eventChunk.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;

          const payloadStr = line.slice(6).trim();
          if (!payloadStr) continue;

          let parsed: {
            text?: string;
            bookedAppointment?: Appointment;
            error?: string;
            done?: boolean;
          } | null = null;
          try {
            parsed = JSON.parse(payloadStr) as {
              text?: string;
              bookedAppointment?: Appointment;
              error?: string;
              done?: boolean;
            };
          } catch {
            parsed = null;
          }

          if (!parsed) continue;

          if (parsed.error) {
            throw new Error(parsed.error);
          }

          if (parsed.text) {
            accumulatedText += parsed.text;
            setMessages((prev) =>
              prev.map((m) => (m.id === modelMsgId ? { ...m, text: accumulatedText } : m))
            );
          }

          if (parsed.bookedAppointment) {
            const booked = parsed.bookedAppointment;
            setMessages((prev) =>
              prev.map((m) => (m.id === modelMsgId ? { ...m, bookedAppointment: booked } : m))
            );
            playNotificationChime();
            window.dispatchEvent(new CustomEvent('clearview:calendar-updated'));
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === modelMsgId ? { ...m, isStreaming: false } : m))
      );

      if (speakResponse && accumulatedText) {
        speakText(accumulatedText);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to reach assistant.';
      setErrorBanner(msg);
      setMessages((prev) => prev.filter((m) => m.id !== modelMsgId));
    } finally {
      setIsSending(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(inputText, false);
  };

  const handleToggleVoice = async () => {
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      setInterimTranscript('');
      return;
    }

    const SpeechRecCtor = getSpeechRecognitionCtor();
    if (!SpeechRecCtor) {
      setErrorBanner(uiCopy.noSpeechSupport);
      return;
    }

    setErrorBanner('');
    stopSpeaking();

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (err) {
        const errName = err instanceof DOMException ? err.name : '';
        if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
          setErrorBanner(uiCopy.noMicDevice);
        } else {
          setErrorBanner(uiCopy.voiceBlocked);
        }
        return;
      }
    }

    const recognition = new SpeechRecCtor();
    recognition.lang = language === 'es' ? 'es-US' : 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;

    let finalTranscript = '';

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalTranscript += `${transcript} `;
        } else {
          interim += transcript;
        }
      }
      setInterimTranscript((finalTranscript + interim).trim());
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      setIsListening(false);
      setInterimTranscript('');
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setErrorBanner(uiCopy.voiceBlocked);
      } else if (event.error === 'audio-capture') {
        setErrorBanner(uiCopy.noMicDevice);
      } else if (event.error === 'network') {
        setErrorBanner(uiCopy.voiceNetworkError);
      } else {
        setErrorBanner(uiCopy.voiceBlocked);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      const spoken = finalTranscript.trim();
      setInterimTranscript('');
      if (spoken) {
        void sendMessage(spoken, true);
      }
    };

    recognitionRef.current = recognition;
    try {
      setIsListening(true);
      recognition.start();
    } catch {
      setIsListening(false);
      setErrorBanner(uiCopy.voiceBlocked);
    }
  };

  const handleReset = () => {
    stopSpeaking();
    setMessages([]);
    setErrorBanner('');
    setInputText('');
  };

  return (
    <div className="fixed bottom-3 right-3 sm:bottom-6 sm:right-6 z-50 print:hidden">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2.5 bg-[var(--cv-primary)] hover:bg-[var(--cv-primary-dark)] text-white border border-[var(--cv-accent)]/70 shadow-2xl pl-2 pr-4 py-1.5 sm:py-2 rounded-full transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cv-accent)]"
        >
          {biz.assistantAvatarUrl ? (
            <img
              src={resolveAssetUrl(biz.assistantAvatarUrl)}
              alt={biz.assistantName}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-full object-cover object-top border-2 border-[var(--cv-accent)] shrink-0 bg-white"
            />
          ) : (
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--cv-accent)] text-[var(--cv-dark-surface)] shrink-0">
              <MessageSquare className="w-4 h-4" aria-hidden="true" />
            </span>
          )}
          <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">
            {uiCopy.launcher}
          </span>
        </button>
      ) : (
        <section
          aria-label={uiCopy.title}
          className="w-[calc(100vw-1.5rem)] sm:w-[400px] h-[min(560px,calc(100dvh-5.5rem))] bg-white border border-[#231710]/20 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Widget Header */}
          <header className="bg-[var(--cv-dark-surface)] text-white px-4 py-3 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              {biz.assistantAvatarUrl ? (
                <img
                  src={resolveAssetUrl(biz.assistantAvatarUrl)}
                  alt={biz.assistantName}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover object-top border-2 border-[var(--cv-accent)] shrink-0 bg-white"
                />
              ) : (
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[var(--cv-primary)] text-[var(--cv-accent)] font-display font-bold text-base shrink-0">
                  {biz.brandMonogram}
                </span>
              )}
              <div className="min-w-0">
                <h2 className="font-display text-lg font-bold leading-none truncate">
                  {uiCopy.title}
                </h2>
                <p className="text-[11px] text-neutral-400 mt-0.5 truncate">{uiCopy.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (!voiceMuted) stopSpeaking();
                  setVoiceMuted((prev) => !prev);
                }}
                aria-label={voiceMuted ? uiCopy.unmuteVoice : uiCopy.muteVoice}
                title={voiceMuted ? uiCopy.unmuteVoice : uiCopy.muteVoice}
                className="w-8 h-8 rounded-md flex items-center justify-center text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                {voiceMuted ? (
                  <VolumeX className="w-4 h-4 text-neutral-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-[var(--cv-accent)]" />
                )}
              </button>

              <button
                type="button"
                onClick={handleReset}
                aria-label={uiCopy.resetChat}
                title={uiCopy.resetChat}
                className="w-8 h-8 rounded-md flex items-center justify-center text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  stopSpeaking();
                  setIsOpen(false);
                }}
                aria-label={uiCopy.closeChat}
                className="w-8 h-8 rounded-md flex items-center justify-center text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Voice Active Waveform Banner */}
          {(isListening || isSpeaking) && (
            <div className="bg-[var(--cv-dark-card)] text-white px-4 py-2.5 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center gap-0.5 h-5" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((bar) => (
                    <span
                      key={bar}
                      className="w-1 h-4 rounded-full bg-[var(--cv-accent)] origin-center"
                      style={{
                        animation: 'voiceBar 0.75s ease-in-out infinite',
                        animationDelay: `${bar * 120}ms`,
                      }}
                    />
                  ))}
                </div>
                <p className="text-xs font-medium text-neutral-200 truncate">
                  {isListening ? interimTranscript || uiCopy.listeningLabel : uiCopy.speakingLabel}
                </p>
              </div>

              {isSpeaking && (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white/10 hover:bg-[var(--cv-primary)] px-2.5 py-1 rounded transition-colors cursor-pointer shrink-0"
                >
                  <Square className="w-3 h-3 fill-current" aria-hidden="true" />
                  <span>{uiCopy.stopSpeaking}</span>
                </button>
              )}
            </div>
          )}

          {/* Chat Message Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#F4EFE6]">
            <div className="flex justify-start">
              <div className="max-w-[88%] bg-white border border-[#DDD1C0] rounded-xl rounded-tl-sm px-3.5 py-2.5 text-xs sm:text-sm text-[#231710] leading-relaxed">
                {uiCopy.welcome}
              </div>
            </div>

            {messages.length === 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {uiCopy.chips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => void sendMessage(chip, false)}
                    className="text-xs font-medium bg-white hover:bg-[var(--cv-primary)] text-[#231710] hover:text-white border border-[#DDD1C0] hover:border-[var(--cv-primary)] px-3 py-1.5 rounded-md transition-colors cursor-pointer text-left"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {messages.map((msg) => {
              if (msg.role === 'user') {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[85%] bg-[var(--cv-dark-surface)] text-white rounded-xl rounded-tr-sm px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed">
                      {msg.text}
                    </div>
                  </div>
                );
              }

              const { displayText, capturedVisit } = parseAssistantOutput(msg.text);

              return (
                <div key={msg.id} className="flex flex-col items-start gap-2">
                  <div className="max-w-[88%] bg-white border border-[#DDD1C0] rounded-xl rounded-tl-sm px-3.5 py-2.5 text-xs sm:text-sm text-[#231710] leading-relaxed whitespace-pre-line">
                    {displayText || (msg.isStreaming ? '...' : '')}
                  </div>

                  {msg.bookedAppointment && (
                    <div className="w-[94%] bg-[var(--cv-dark-surface)] text-white border border-[var(--cv-light-green)]/60 rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between gap-2 text-[var(--cv-accent)]">
                        <span className="inline-flex items-center gap-1.5 font-display text-base font-bold tracking-wide">
                          <CalendarCheck2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>{uiCopy.bookedCalendarTitle}</span>
                        </span>
                        <span className="font-mono text-[11px] bg-[var(--cv-primary)] text-white px-2 py-0.5 rounded">
                          {msg.bookedAppointment.id}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-1 text-xs text-neutral-200 border-t border-white/10 pt-2">
                        <div>
                          <span className="text-neutral-400">{uiCopy.bookedDateLabel}:</span>{' '}
                          <span className="font-semibold text-white">
                            {formatDateHuman(msg.bookedAppointment.date, language)}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400">{uiCopy.bookedSlotLabel}:</span>{' '}
                          <span className="font-mono text-[var(--cv-accent)]">
                            {msg.bookedAppointment.timeSlotLabel}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400">{uiCopy.capturedAddress}:</span>{' '}
                          <span className="text-white">{msg.bookedAppointment.propertyAddress}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400">{uiCopy.capturedLot}:</span>{' '}
                          <span className="text-white">{msg.bookedAppointment.lotSize}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <a
                          href={getIcsDownloadUrl(msg.bookedAppointment.id, msg.bookedAppointment, biz)}
                          download={`site-visit-${msg.bookedAppointment.id}.ics`}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-[var(--cv-primary)] hover:bg-[var(--cv-primary-dark)] text-white px-2.5 py-1.5 rounded transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{uiCopy.downloadIcsLabel}</span>
                        </a>

                        <a
                          href={buildGoogleCalendarUrl(msg.bookedAppointment, biz)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded transition-colors"
                        >
                          <CalendarPlus
                            className="w-3.5 h-3.5 text-[var(--cv-accent)]"
                            aria-hidden="true"
                          />
                          <span>{uiCopy.googleCalLabel}</span>
                        </a>

                        <a
                          href={biz.phoneHref}
                          onClick={(e) => {
                            e.preventDefault();
                            openCallModal();
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded transition-colors"
                        >
                          <Phone
                            className="w-3.5 h-3.5 text-[var(--cv-light-green)]"
                            aria-hidden="true"
                          />
                          <span>{uiCopy.callButton}</span>
                        </a>
                      </div>
                    </div>
                  )}

                  {capturedVisit && (
                    <div className="w-[92%] bg-[var(--cv-dark-surface)] text-white border border-[var(--cv-light-green)]/50 rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center gap-2 text-[var(--cv-accent)]">
                        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span className="font-display text-base font-bold tracking-wide">
                          {uiCopy.capturedTitle}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-1 text-xs text-neutral-200 border-t border-white/10 pt-2">
                        <div>
                          <span className="text-neutral-400">{uiCopy.capturedName}:</span>{' '}
                          <span className="font-semibold text-white">{capturedVisit.name}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400">{uiCopy.capturedPhone}:</span>{' '}
                          <span className="font-mono tabular-nums text-white">
                            {capturedVisit.phone}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400">{uiCopy.capturedAddress}:</span>{' '}
                          <span className="text-white">{capturedVisit.address}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400">{uiCopy.capturedLot}:</span>{' '}
                          <span className="text-[var(--cv-accent)] font-semibold">
                            {capturedVisit.lotSize}
                          </span>
                        </div>
                      </div>
                      <a
                        href={biz.phoneHref}
                        onClick={(e) => {
                          e.preventDefault();
                          openCallModal();
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[var(--cv-primary)] hover:bg-[var(--cv-primary-dark)] text-white px-3 py-1.5 rounded transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{uiCopy.callButton}</span>
                      </a>
                    </div>
                  )}
                </div>
              );
            })}

            {errorBanner && (
              <div
                role="alert"
                className="bg-[#FEFCE8] border border-[#EAB308] text-[#231710] rounded-lg px-3 py-2 text-xs leading-relaxed"
              >
                {errorBanner}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar with Mic & Send */}
          <form
            onSubmit={handleFormSubmit}
            className="p-3 bg-white border-t border-[#DDD1C0] flex items-center gap-2 shrink-0"
          >
            <button
              type="button"
              onClick={handleToggleVoice}
              disabled={isSending}
              aria-label={isListening ? uiCopy.voiceStop : uiCopy.voiceStart}
              title={isListening ? uiCopy.voiceStop : uiCopy.voiceStart}
              className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                isListening
                  ? 'bg-[var(--cv-primary)] text-white'
                  : 'bg-[#F4EFE6] hover:bg-[var(--cv-primary)] text-[#231710] hover:text-white border border-[#DDD1C0]'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={uiCopy.placeholder}
              disabled={isSending}
              className="flex-1 min-w-0 bg-[#F4EFE6] border border-[#DDD1C0] focus:border-[var(--cv-primary)] focus:outline-none rounded-md px-3 py-2 text-sm text-[#231710] placeholder:text-neutral-500"
            />

            <button
              type="submit"
              disabled={isSending || !inputText.trim()}
              aria-label={uiCopy.sendLabel}
              className="w-10 h-10 rounded-md bg-[var(--cv-primary)] hover:bg-[var(--cv-primary-dark)] disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
