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
  STATIC_SITE_VISIT_SLOTS,
  buildGoogleCalendarUrl,
  buildStaticAvailability,
  createStaticAppointment,
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

function normalizeAsciiText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function detectSpanishReply(
  text: string,
  fallbackLang: 'en' | 'es',
  activeConvLang?: 'en' | 'es'
): 'en-US' | 'es-US' {
  if (/[áéíóúñ¿¡]/i.test(text)) return 'es-US';

  const norm = normalizeAsciiText(text);
  const esMatches =
    norm.match(
      /\b(hola|buen|buenos|buenas|dias|tardes|noches|que|tal|si|claro|gracias|muchas|por|favor|perdon|disculpa|el|la|los|las|un|una|unos|unas|de|del|en|para|con|mi|tu|su|es|son|esta|estoy|tengo|quiero|necesito|puedo|podemos|cuando|donde|como|cuanto|cuesta|precio|precios|cotiz\w*|estimad\w*|terreno|propiedad|lote|finca|limpiar|limpieza|desmont\w*|tritura\w*|maleza|palma|tocones|arbol\w*|camino|entrada|cerca|tormenta|huracan|lunes|martes|miercoles|jueves|viernes|sabado|domingo|manana|tarde|hoy|ahora|luego|cita|reserva\w*|agend\w*|evalua\w*|visita|fecha|fechas|horario|horarios|disponib\w*|numero|telefono|tel|cel|celular|direccion|nombre|llamo|soy|vivo|calle|ciudad|zona|listo|perfecto|genial|excelente)\b/g
    )?.length ?? 0;

  const enMatches =
    norm.match(
      /\b(hello|hi|hey|good|morning|afternoon|clearing|mulching|brush|stump|estimate|quote|price|cost|book|schedule|appoint\w*|visit|date|time|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|my|name|phone|number|address|adress|property|lot|thanks|thank|please|yes|sure|great|where|when|how|what)\b/g
    )?.length ?? 0;

  if (esMatches > enMatches) return 'es-US';
  if (enMatches > esMatches) return 'en-US';
  if (activeConvLang) return activeConvLang === 'es' ? 'es-US' : 'en-US';
  return fallbackLang === 'es' ? 'es-US' : 'en-US';
}

function waitChatPause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calcTypingDelayMs(bubbleText: string, isFirstBubble: boolean): number {
  const base = isFirstBubble ? 1150 : 1050;
  const perChar = Math.min(650, bubbleText.length * 8);
  return base + perChar;
}

const INTER_BUBBLE_BEAT_MS = 380;

function splitIntoChatBubbles(rawText: string): string[] {
  const clean = rawText.trim();
  if (!clean) return [];

  if (clean.includes('|||')) {
    const parts = clean
      .split('|||')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts;
  }

  const paragraphs = clean
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length > 1) {
    return paragraphs;
  }

  return [clean];
}

interface BookingDraftState {
  active: boolean;
  date?: string;
  timeSlot?: string;
  clientName?: string;
  clientPhone?: string;
  propertyAddress?: string;
  lotSize?: string;
  awaitingField?: 'date_time' | 'name' | 'phone' | 'address' | 'lotSize' | 'details';
  activeLang?: 'en' | 'es';
  lastBooked?: {
    id: string;
    dateHumanEs: string;
    dateHumanEn: string;
    slotHuman: string;
    clientName: string;
  };
}

function formatSlotShort(slotId: string): string {
  const map: Record<string, string> = {
    '09:00': '9:00 AM',
    '11:00': '11:00 AM',
    '13:30': '1:30 PM',
    '15:30': '3:30 PM',
  };
  return map[slotId] ?? slotId;
}

function extractAcresLabel(q: string): string | undefined {
  if (/(1\/4|0\.25\b|quarter|cuarto\s+de\s+acre)/.test(q)) return '1/4 Acre';
  if (/(1\/2|0\.5\b|half\s+acre|medio\s+acre)/.test(q)) return '1/2 Acre';
  const match = q.match(/(\d+(?:\.\d+)?)\s*(?:acres?|ac\b)/i);
  if (match) {
    const val = Number(match[1]);
    if (Number.isFinite(val) && val > 0) {
      return `${Number.isInteger(val) ? val : val.toString()} Acres`;
    }
  }
  return undefined;
}

const NON_NAME_TOKENS = new Set([
  'si',
  'no',
  'ok',
  'okay',
  'vale',
  'claro',
  'bueno',
  'perfecto',
  'excelente',
  'genial',
  'super',
  'dale',
  'listo',
  'gracias',
  'muchas',
  'hola',
  'hi',
  'hello',
  'hey',
  'quiero',
  'necesito',
  'puedo',
  'podemos',
  'quisiera',
  'gustaria',
  'agendar',
  'reservar',
  'programar',
  'apartar',
  'cita',
  'visita',
  'evaluacion',
  'terreno',
  'propiedad',
  'lote',
  'finca',
  'acre',
  'acres',
  'cuando',
  'donde',
  'como',
  'cuanto',
  'horario',
  'horarios',
  'fecha',
  'fechas',
  'disponible',
  'disponibles',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'manana',
  'tomorrow',
  'tarde',
  'morning',
  'afternoon',
  'book',
  'schedule',
  'visit',
  'yes',
  'sure',
  'please',
  'por',
  'favor',
  'para',
  'una',
  'uno',
  'con',
  'mi',
  'tu',
  'su',
  'telefono',
  'phone',
  'numero',
  'number',
  'direccion',
  'address',
  'adress',
  'y',
  'and',
  'es',
  'is',
  'my',
  'el',
  'la',
  'las',
  'los',
  'de',
  'del',
  'en',
  'que',
  'esta',
  'bien',
  'thanks',
  'thank',
  'you',
]);

function resolveOfflineJessicaResponse(
  userText: string,
  cms: SiteCmsData,
  fallbackLang: 'en' | 'es',
  isFirstTurn: boolean,
  draft: BookingDraftState
): {
  bubbles: string[];
  nextDraft: BookingDraftState;
  bookedAppointment?: Appointment;
} {
  const raw = userText.trim();
  const q = normalizeAsciiText(raw);
  const detectedLang = detectSpanishReply(raw, fallbackLang, draft.activeLang) === 'es-US' ? 'es' : 'en';
  const isEs = detectedLang === 'es';
  const biz = cms.business;
  const pricing = cms.pricing;
  const discountPct = Math.round(pricing.bulkDiscountRate * 100);

  const detectedLot = extractAcresLabel(q);
  const workingDraft: BookingDraftState = {
    ...draft,
    activeLang: detectedLang,
    lotSize: detectedLot ?? draft.lotSize,
  };

  const isCancelBooking =
    workingDraft.active &&
    /\b(cancelar\s+reserva|cancel\s+booking|no\s+quiero\s+agendar|olvidalo|mejor\s+luego)\b/i.test(
      q
    );
  if (isCancelBooking) {
    return {
      bubbles: isEs
        ? ['Sin problema, cancelamos el borrador de la cita. Aquí sigo por si necesitas precios o información.']
        : ['No problem—cancelled the booking draft. Let me know if you need pricing or anything else!'],
      nextDraft: { active: false, lotSize: workingDraft.lotSize, activeLang: detectedLang },
    };
  }

  const isPureGreeting =
    /^(hola|hi|hello|hey|buenos dias|buenas tardes|buenas noches|good morning|good afternoon|que tal)[!.,\s]*$/i.test(
      q
    );

  const isThankYouOrAck =
    /^(?:muchas\s+)?(?:gracias|thank\s+you|thanks|ty|ok\s*gracias|vale\s*gracias|listo\s*gracias|perfecto|excelente|genial|super|muy\s+bien|entendido|ok|okay|vale|nos\s+vemos|adios|hasta\s+luego|bye|sounds\s+good|got\s+it|awesome|great)[!.,\s]*$/i.test(
      q
    );

  const asksSchedule =
    /(book|schedul|visit|date|calendar|reserv|appoint|walk[\s-]*through|evalua|agend|cita|visita|fecha|calendario|programar|apartar|disponib|horarios?\s+libres|dias?\s+libres|cuando\s+puede)/i.test(
      q
    );

  const asksPrice =
    /(price|cost|quote|estimat|how much|cuanto|precio|cotiz|estimar|descuento|limpiar\s+mi|desmont)/i.test(
      q
    ) || (!workingDraft.active && /\b(acre|acres|palmetto|palma|maleza)\b/i.test(q));

  const asksEquipmentOrServices =
    /(service|servicio|equip|machine|skid|asv|baumalight|maquina|storm|hurricane|tormenta|huracan|cerca|fence|camino|trail|grind|rebaj|tocon)/i.test(
      q
    );

  const asksHoursOrAddress =
    /(hour|open|close|address|where|location|map|phone|call|horario|hora|abre|cierra|direccion|ubicacion|telefono|llamar|zona|ciudad|area|serve|cubr|donde)/i.test(
      q
    );

  // Detect date / slot clues in message
  const availability = buildStaticAvailability(21);
  const openDays = availability.days.filter((d) => d.openSlots.length > 0);

  let parsedDate: string | undefined;
  let weekendRequested = false;

  if (/(s[aá]bado|sabado|domingo|saturday|sunday)/i.test(q)) {
    weekendRequested = true;
  }

  const isoMatch = q.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    parsedDate = isoMatch[1];
  } else if (/\b(pasado\s+ma[ñn]ana|day\s+after\s+tomorrow)\b/i.test(q)) {
    const [y, m, d] = availability.todayIso.split('-').map(Number);
    parsedDate = new Date(Date.UTC(y, m - 1, d + 2, 12, 0, 0)).toISOString().slice(0, 10);
  } else if (/\b(ma[ñn]ana|tomorrow)\b/i.test(q) && !/de\s+la\s+ma[ñn]ana|en\s+la\s+ma[ñn]ana/i.test(q)) {
    const [y, m, d] = availability.todayIso.split('-').map(Number);
    parsedDate = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0)).toISOString().slice(0, 10);
  } else {
    const weekdayTargets: Array<{ regex: RegExp; dow: number }> = [
      { regex: /\b(lunes|monday|mon)\b/i, dow: 1 },
      { regex: /\b(martes|tuesday|tue)\b/i, dow: 2 },
      { regex: /\b(mi[eé]rcoles|miercoles|wednesday|wed)\b/i, dow: 3 },
      { regex: /\b(jueves|thursday|thu)\b/i, dow: 4 },
      { regex: /\b(viernes|friday|fri)\b/i, dow: 5 },
    ];
    const matchedDow = weekdayTargets.find((w) => w.regex.test(q));
    if (matchedDow) {
      const candidate =
        openDays.find((d) => d.dayOfWeek === matchedDow.dow) ??
        availability.days.find((d) => d.date > availability.todayIso && d.dayOfWeek === matchedDow.dow);
      if (candidate) parsedDate = candidate.date;
    } else {
      const dayNumMatch = q.match(
        /(?:\bel\s+|\bd[ií]a\s+|\bnov\.?\s+|\bdic\.?\s+|\bdec\.?\s+|\bene\.?\s+|\bjan\.?\s+)(\d{1,2})\b/i
      );
      if (dayNumMatch) {
        const targetDayNum = Number(dayNumMatch[1]);
        const foundDay = availability.days.find(
          (d) => d.date > availability.todayIso && Number(d.date.slice(8, 10)) === targetDayNum
        );
        if (foundDay) parsedDate = foundDay.date;
      }
    }
  }

  let parsedSlot: string | undefined;
  if (/\b(?:0?9:00|9\s*(?:am|a\.m\.|hrs?|horas?|de\s+la\s+ma[ñn]ana))\b/i.test(q) || /(?:a\s+las?|at)\s+0?9\b/i.test(q)) {
    parsedSlot = '09:00';
  } else if (/\b(?:11:00|11\s*(?:am|a\.m\.|hrs?|horas?|de\s+la\s+ma[ñn]ana))\b/i.test(q) || /(?:a\s+las?|at)\s+11\b/i.test(q)) {
    parsedSlot = '11:00';
  } else if (
    /\b(?:13:30|1:30|13:00|1\s*(?:pm|p\.m\.|de\s+la\s+tarde)|2\s*(?:pm|p\.m\.))\b/i.test(q) ||
    /(?:a\s+la|at)\s+1(?::30)?\b/i.test(q)
  ) {
    parsedSlot = '13:30';
  } else if (
    /\b(?:15:30|3:30|15:00|3\s*(?:pm|p\.m\.|de\s+la\s+tarde)|4\s*(?:pm|p\.m\.))\b/i.test(q) ||
    /(?:a\s+las?|at)\s+3(?::30)?\b/i.test(q)
  ) {
    parsedSlot = '15:30';
  }

  const hasBookingSignals = Boolean(parsedDate || parsedSlot || weekendRequested);

  // Handle pure non-booking questions when NOT inside an active booking flow
  if (!workingDraft.active && !asksSchedule && !hasBookingSignals) {
    if (isThankYouOrAck) {
      if (workingDraft.lastBooked) {
        const b = workingDraft.lastBooked;
        return {
          bubbles: isEs
            ? [
                `¡Con mucho gusto, ${b.clientName}! Tu visita para el ${b.dateHumanEs} a las ${b.slotHuman} ya quedó registrada (Ref: ${b.id}).`,
                `Si necesitas cambiar algo o tienes otra duda, aquí estoy o llámanos al ${biz.phone}. ¡Excelente día!`,
              ]
            : [
                `You're very welcome, ${b.clientName}! Your evaluation on ${b.dateHumanEn} at ${b.slotHuman} is all saved (Ref: ${b.id}).`,
                `Let me know if you need any changes or call us at ${biz.phone}. Have a great day!`,
              ],
          nextDraft: workingDraft,
        };
      }

      return {
        bubbles: isEs
          ? [`¡Con mucho gusto! Aquí sigo por si quieres revisar fechas libres para una evaluación gratis o tienes otra pregunta.`]
          : [`You're welcome! I'm right here if you'd like to check open dates for a free site walk or have another question.`],
        nextDraft: workingDraft,
      };
    }

    if (isPureGreeting) {
      if (!isFirstTurn) {
        return {
          bubbles: isEs
            ? [`¡Hola de nuevo! ¿En qué más te puedo ayudar hoy?`]
            : [`Hi again! What else can I help you with today?`],
          nextDraft: workingDraft,
        };
      }
      return {
        bubbles: isEs
          ? [
              `¡Hola! Soy ${biz.assistantName} de ${biz.businessName}.`,
              `¿En qué te puedo ayudar hoy? Puedo darte un estimado por acres o revisar horarios disponibles para una evaluación gratis con ${biz.ownerName}.`,
            ]
          : [
              `Hi there! I'm ${biz.assistantName} with ${biz.businessName}.`,
              `How can I help today? I can share an acreage estimate or check open slots for a free site evaluation with ${biz.ownerName}.`,
            ],
        nextDraft: workingDraft,
      };
    }

    if (asksPrice) {
      let customAcres: number | null = null;
      if (/(1\/4|0\.25|quarter|cuarto)/.test(q)) customAcres = 0.25;
      else if (/(1\/2|0\.5\b|half|medio)/.test(q)) customAcres = 0.5;
      else {
        const acreMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:acres?|ac\b)/i);
        if (acreMatch) {
          const parsed = Number(acreMatch[1]);
          if (Number.isFinite(parsed) && parsed > 0) customAcres = parsed;
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

      const denObj =
        pricing.densities.find((d) => d.id === densityId) ??
        pricing.densities[1] ??
        pricing.densities[0];

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
        const formattedAcres = Number.isInteger(customAcres)
          ? String(customAcres)
          : customAcres.toString();
        areaLabelEs = `${formattedAcres} Acres`;
        areaLabelEn = `${formattedAcres} Acres`;
      } else {
        const est = calculateDynamicLotEstimate(pricing, '1.00', densityId, []);
        estMin = est.totalMin;
        estMax = est.totalMax;
        hasBulk = est.hasBulkDiscount;
      }

      const firstPrefixEs = isFirstTurn ? `¡Hola! Soy ${biz.assistantName}. ` : '';
      const firstPrefixEn = isFirstTurn ? `Hi! I'm ${biz.assistantName}. ` : '';
      const stumpAddon = pricing.addons.find((a) => a.id === 'stumps');
      const drivewayAddon = pricing.addons.find((a) => a.id === 'driveway');

      return {
        bubbles: [
          isEs
            ? `${firstPrefixEs}Para ${areaLabelEs} (${denObj.labelEs}), el estimado preliminar ronda los $${estMin.toLocaleString()} – $${estMax.toLocaleString()} USD.`
            : `${firstPrefixEn}For ${areaLabelEn} (${denObj.labelEn}), a preliminary ballpark estimate is $${estMin.toLocaleString()} – $${estMax.toLocaleString()} USD.`,
          isEs
            ? hasBulk
              ? `Ya incluye nuestro ${discountPct}% de descuento por 5+ acres (mínimo $${pricing.minimumMobilizationFee.toLocaleString()}).`
              : `La tarifa mínima es $${pricing.minimumMobilizationFee.toLocaleString()} (5+ acres tienen ${discountPct}% de descuento)${stumpAddon && drivewayAddon ? `, y extras como tocones (+$${stumpAddon.price}) o entrada (+$${drivewayAddon.price}) son opcionales.` : '.'}`
            : hasBulk
            ? `That already includes our ${discountPct}% bulk discount for 5+ acres ($${pricing.minimumMobilizationFee.toLocaleString()} minimum).`
            : `Our $${pricing.minimumMobilizationFee.toLocaleString()} minimum applies (5+ acres get ${discountPct}% off)${stumpAddon && drivewayAddon ? `, and extras like stumps (+$${stumpAddon.price}) or driveway cut-ins (+$${drivewayAddon.price}) are optional.` : '.'}`,
          isEs
            ? `¿Te gustaría que revisemos fechas libres aquí mismo para agendar una evaluación gratis en sitio?`
            : `Would you like me to check our open dates right here to book a free on-site evaluation?`,
        ],
        nextDraft: workingDraft,
      };
    }

    if (asksEquipmentOrServices) {
      return {
        bubbles: isEs
          ? [
              `Usamos un cargador sobre orugas ASV RT-135 con cabezal Baumalight: trituramos maleza, palmetto, cercas, tocones y árboles caídos sin quemas.`,
              `¿Qué trabajo necesitas hacer y cuántos acres tiene tu propiedad?`,
            ]
          : [
              `We run a high-flow ASV RT-135 track loader with a Baumalight mulcher—clearing brush, palmetto, fence lines, stumps & storm debris with no burning.`,
              `What kind of clearing do you need, and roughly how many acres?`,
            ],
        nextDraft: workingDraft,
      };
    }

    if (asksHoursOrAddress) {
      return {
        bubbles: isEs
          ? [
              `Estamos en ${biz.cityState} (Tel: ${biz.phone}). Atendemos Lun, Mié–Vie 9 AM–5 PM y Mar 12–5 PM.`,
              `Cubrimos ${biz.serviceArea}. ¿En qué zona está tu terreno?`,
            ]
          : [
              `We're based at ${biz.cityState} (Phone: ${biz.phone}), open Mon, Wed–Fri 9 AM–5 PM & Tue 12–5 PM.`,
              `We cover ${biz.serviceArea}. Where is your property located?`,
            ],
        nextDraft: workingDraft,
      };
    }

    return {
      bubbles: isEs
        ? [
            `Puedo darte un estimado por acres o consultar nuestra agenda en vivo para reservarte una evaluación gratis.`,
            `¿Cuántos acres tiene tu terreno o qué día te gustaría que lo visitemos?`,
          ]
        : [
            `I can share an acreage estimate or check our live calendar to book a free site visit for you.`,
            `How many acres is your property, or which day would you like us to come out?`,
          ],
      nextDraft: workingDraft,
    };
  }

  // --- INTERACTIVE AGENDA & BOOKING FLOW ---
  workingDraft.active = true;

  const formatUpcomingOptions = (limit = 4) =>
    openDays
      .slice(0, limit)
      .map((d) => {
        const label = formatDateHuman(d.date, isEs ? 'es' : 'en');
        const times = d.openSlots.map(formatSlotShort).join(', ');
        return `• ${label}: ${times}`;
      })
      .join('\n');

  if (weekendRequested && !parsedDate) {
    return {
      bubbles: isEs
        ? [
            `Los sábados y domingos permanecemos cerrados.`,
            `Estos son los próximos días libres en nuestra agenda:\n${formatUpcomingOptions(3)}`,
            `¿Cuál día y horario te queda mejor?`,
          ]
        : [
            `We're closed on Saturdays and Sundays.`,
            `Here are our next open Mon–Fri dates:\n${formatUpcomingOptions(3)}`,
            `Which day and time window works best for you?`,
          ],
      nextDraft: { ...workingDraft, awaitingField: 'date_time' },
    };
  }

  // Validate / assign date if provided
  if (parsedDate) {
    const dayInfo = availability.days.find((d) => d.date === parsedDate);
    if (!dayInfo || dayInfo.openSlots.length === 0) {
      return {
        bubbles: isEs
          ? [
              `El ${formatDateHuman(parsedDate, 'es')} no tiene horarios disponibles.`,
              `Próximas fechas libres:\n${formatUpcomingOptions(3)}`,
              `¿Cuál prefieres?`,
            ]
          : [
              `${formatDateHuman(parsedDate, 'en')} doesn't have any open slots.`,
              `Here are the next open days:\n${formatUpcomingOptions(3)}`,
              `Which one works for you?`,
            ],
        nextDraft: { ...workingDraft, date: undefined, timeSlot: undefined, awaitingField: 'date_time' },
      };
    }
    workingDraft.date = parsedDate;
  }

  // Validate / assign timeSlot if provided
  if (parsedSlot) {
    if (workingDraft.date) {
      const dayInfo = availability.days.find((d) => d.date === workingDraft.date);
      if (dayInfo && !dayInfo.openSlots.includes(parsedSlot)) {
        const altSlots = dayInfo.openSlots.map(formatSlotShort).join(', ');
        return {
          bubbles: isEs
            ? [
                `Ese horario (${formatSlotShort(parsedSlot)}) ya no está libre el ${formatDateHuman(workingDraft.date, 'es')}.`,
                `Ese día aún quedan disponibles: ${altSlots}. ¿Cuál prefieres?`,
              ]
            : [
                `${formatSlotShort(parsedSlot)} isn't open on ${formatDateHuman(workingDraft.date, 'en')}.`,
                `Still open that day: ${altSlots}. Which time would you like?`,
              ],
          nextDraft: { ...workingDraft, timeSlot: undefined, awaitingField: 'date_time' },
        };
      }
    }
    workingDraft.timeSlot = parsedSlot;
  } else if (workingDraft.date && !workingDraft.timeSlot) {
    const dayInfo = availability.days.find((d) => d.date === workingDraft.date);
    if (dayInfo && /\b(ma[ñn]ana|morning)\b/i.test(q)) {
      const amSlot = dayInfo.openSlots.find((s) => s === '09:00' || s === '11:00');
      if (amSlot) workingDraft.timeSlot = amSlot;
    } else if (dayInfo && /\b(tarde|afternoon)\b/i.test(q)) {
      const pmSlot = dayInfo.openSlots.find((s) => s === '13:30' || s === '15:30');
      if (pmSlot) workingDraft.timeSlot = pmSlot;
    }
  }

  // Extract phone number (avoid colliding with ISO date)
  const withoutDates = raw.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ');
  const phoneMatch = withoutDates.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) {
    workingDraft.clientPhone = phoneMatch[0].trim();
  } else {
    const plainDigitsMatch = withoutDates.match(/\b\d{7,11}\b/);
    if (plainDigitsMatch) {
      workingDraft.clientPhone = plainDigitsMatch[0].trim();
    }
  }

  const prevDate = draft.date;
  const prevSlot = draft.timeSlot;
  const prevName = draft.clientName;
  const prevPhone = draft.clientPhone;
  const prevAddr = draft.propertyAddress;
  const prevLot = draft.lotSize;

  // Strip phone labels & numbers cleanly before inspecting name / address
  const cleanContactText = raw
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(
      /(?:(?:mi|my)\s+)?(?:tel[eé]f[oó][nm]o|phone(?:\s+number)?|cel(?:ular)?|n[uú]mero)(?:\s+(?:es|is|:))?\s*(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/gi,
      ' '
    )
    .replace(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, ' ')
    .replace(/^\s*(?:y|and)\s+/i, '')
    .trim();

  // Extract explicit name
  const explicitNameMatch = cleanContactText.match(
    /(?:me\s+llamo|mi\s+nombre\s+es|a\s+nombre\s+de|nombre\s*(?:es|:)|soy|my\s+name\s+is|i['’]?m|name\s*(?:is|:))\s*([A-Za-zÁÉÍÓÚÑáéíóúñ'\s]{2,45}?)(?=[,.;\n]|$|\b(?:y\s+|and\s+)?(?:mi\s+|my\s+)?(?:tel|tel[eé]fono|phone|vivo|en\s+\d|direcci[oó]n|add?ress)\b)/i
  );
  if (explicitNameMatch?.[1]) {
    const candidate = explicitNameMatch[1].trim();
    const candidateTokens = normalizeAsciiText(candidate).split(/\s+/).filter(Boolean);
    if (
      candidateTokens.length >= 1 &&
      candidateTokens.length <= 4 &&
      !candidateTokens.every((t) => NON_NAME_TOKENS.has(t))
    ) {
      workingDraft.clientName = candidate;
    }
  }

  // Extract explicit address (keeping "Street, City, ST ZIP" intact)
  const explicitAddrMatch = cleanContactText.match(
    /(?:(?:mi\s+)?direcci[oó]n(?:\s+es|\s*:)|(?:my\s+)?add?ress(?:\s+is|\s*:)|ubicaci[oó]n(?:\s+es|\s*:)|parcela(?:\s+es|\s*:)|terreno\s+en|propiedad\s+en|vivo\s+en)\s*([^\n;|]{4,110})/i
  );
  if (explicitAddrMatch?.[1]) {
    const cleanedAddr = explicitAddrMatch[1]
      .replace(
        /(?:\s+(?:y|and))?\s*(?:(?:mi|my)\s+)?(?:nombre|name|tel[eé]f[oó][nm]o|phone|acres?)(?:\s+(?:es|is|:)).*$/i,
        ''
      )
      .replace(/^[,\s:.-]+|[,\s;.-]+$/g, '')
      .trim();
    if (cleanedAddr.length >= 4) {
      workingDraft.propertyAddress = cleanedAddr;
    }
  }

  const looksLikeAddress = (s: string) =>
    /\d+\s+[A-Za-z]/.test(s) ||
    /\b(rd|road|st|street|ave|avenue|ln|lane|dr|drive|hwy|blvd|ct|way|calle|av|camino|parcel|lot|madison|quitman|perry|monticello|live\s+oak|valdosta|lee|greenville|jasper|fl|ga)\b/i.test(
      normalizeAsciiText(s)
    );

  const looksLikePersonName = (s: string) => {
    const trimmed = s.trim();
    if (!trimmed || /\d/.test(trimmed) || looksLikeAddress(trimmed)) return false;
    const normTokens = normalizeAsciiText(trimmed)
      .replace(/[^a-z\s']/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    if (normTokens.length === 0 || normTokens.length > 4) return false;
    if (normTokens.some((t) => NON_NAME_TOKENS.has(t))) return false;
    return normTokens.every((t) => t.length >= 2);
  };

  // Fallback address/name from clean segments when not explicitly labeled
  if (!workingDraft.propertyAddress || !workingDraft.clientName) {
    const strippedForParts = cleanContactText
      .replace(
        /(?:(?:mi\s+)?direcci[oó]n(?:\s+es|\s*:)|(?:my\s+)?add?ress(?:\s+is|\s*:)|ubicaci[oó]n(?:\s+es|\s*:)|parcela(?:\s+es|\s*:))\s*[^\n;|]*/gi,
        ''
      )
      .replace(/\b\d+(?:\.\d+)?\s*(?:acres?|ac\b)/gi, '')
      .replace(/\b(?:a\s+las?|at)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?/gi, '')
      .replace(/\b\d{1,2}:\d{2}\s*(?:am|pm|a\.m\.|p\.m\.)?/gi, '')
      .replace(
        /\b(?:lunes|martes|miercoles|jueves|viernes|monday|tuesday|wednesday|thursday|friday|manana|tomorrow)\b/gi,
        ''
      );

    // If the whole remaining phrase looks like "1828 Pullman Rd, Madison, FL 32349", preserve it as one address
    if (!workingDraft.propertyAddress && /\d+\s+[A-Za-z].*,/.test(cleanContactText)) {
      const candidateAddr = cleanContactText
        .replace(/^(?:y|and)\s+/i, '')
        .replace(/[,\s;.-]+$/g, '')
        .trim();
      if (looksLikeAddress(candidateAddr)) {
        workingDraft.propertyAddress = candidateAddr;
      }
    }

    const chunks = strippedForParts
      .split(/[,;\n|]+/)
      .map((c) => c.trim())
      .filter((c) => c.length >= 2);

    const allowNameGuess =
      workingDraft.awaitingField === 'name' ||
      (!asksSchedule && Boolean(workingDraft.date && workingDraft.timeSlot));

    for (const chunk of chunks) {
      if (!workingDraft.propertyAddress && looksLikeAddress(chunk)) {
        workingDraft.propertyAddress = chunk;
      } else if (!workingDraft.clientName && allowNameGuess && looksLikePersonName(chunk)) {
        workingDraft.clientName = chunk;
      }
    }

    if (
      workingDraft.awaitingField === 'name' &&
      !workingDraft.clientName &&
      chunks[0] &&
      looksLikePersonName(chunks[0])
    ) {
      workingDraft.clientName = chunks[0];
    } else if (
      workingDraft.awaitingField === 'address' &&
      !workingDraft.propertyAddress &&
      cleanContactText.length >= 4
    ) {
      workingDraft.propertyAddress = cleanContactText;
    }
  }

  // Step 1: If just asked to schedule without choosing date yet, show REAL availability from the calendar!
  if (!workingDraft.date) {
    if (openDays.length === 0) {
      return {
        bubbles: isEs
          ? [`En este momento no hay espacios abiertos en las próximas semanas. Por favor llámanos directo al ${biz.phone}.`]
          : [`Our calendar is currently full for the upcoming weeks. Please call ${biz.phone} directly!`],
        nextDraft: { active: false, lotSize: workingDraft.lotSize },
      };
    }

    const intro = isFirstTurn
      ? isEs
        ? `¡Hola! Soy ${biz.assistantName}. Con gusto te ayudo a agendar la evaluación gratis.`
        : `Hi! I'm ${biz.assistantName}. I'd love to book your free site walk.`
      : isEs
      ? `¡Con gusto! Puedo agendarte la evaluación gratis aquí mismo.`
      : `Sure thing! I can book your free evaluation right here.`;

    return {
      bubbles: [
        intro,
        isEs
          ? `Revisé nuestra agenda y estos son los próximos espacios libres:\n${formatUpcomingOptions(3)}`
          : `I checked our live calendar—here are our next open windows:\n${formatUpcomingOptions(3)}`,
        isEs
          ? `¿Qué día y hora prefieres?`
          : `Which day and time slot works best for you?`,
      ],
      nextDraft: { ...workingDraft, awaitingField: 'date_time' },
    };
  }

  // Step 2: Date chosen, need timeSlot
  if (workingDraft.date && !workingDraft.timeSlot) {
    const dayInfo = availability.days.find((d) => d.date === workingDraft.date);
    const openLabels = (dayInfo?.openSlots ?? []).map(formatSlotShort).join(', ');
    return {
      bubbles: isEs
        ? [
            `¡Perfecto! El ${formatDateHuman(workingDraft.date, 'es')} tenemos disponibles: ${openLabels}.`,
            `¿A qué hora te queda bien, y cuál es tu nombre, teléfono y dirección del terreno?`,
          ]
        : [
            `Great! On ${formatDateHuman(workingDraft.date, 'en')} we have: ${openLabels}.`,
            `Which time do you prefer, along with your name, phone number, and property address?`,
          ],
      nextDraft: { ...workingDraft, awaitingField: 'date_time' },
    };
  }

  // Step 3: Date + Time chosen — check if contact & property details are still missing
  const missingEs: string[] = [];
  const missingEn: string[] = [];
  if (!workingDraft.clientName) {
    missingEs.push('nombre completo');
    missingEn.push('full name');
  }
  if (!workingDraft.clientPhone) {
    missingEs.push('teléfono');
    missingEn.push('phone number');
  }
  if (!workingDraft.propertyAddress) {
    missingEs.push('dirección o ciudad del terreno');
    missingEn.push('property address or city');
  }
  if (!workingDraft.lotSize) {
    missingEs.push('tamaño aproximado (acres)');
    missingEn.push('approximate acreage');
  }

  if (missingEs.length > 0) {
    const dateHuman = formatDateHuman(workingDraft.date, isEs ? 'es' : 'en');
    const slotHuman = formatSlotShort(workingDraft.timeSlot!);
    const nextAwait: BookingDraftState['awaitingField'] = !workingDraft.clientName
      ? 'name'
      : !workingDraft.clientPhone
      ? 'phone'
      : !workingDraft.propertyAddress
      ? 'address'
      : 'lotSize';

    const newlyAddedSlot = (!prevDate || !prevSlot) && Boolean(workingDraft.date && workingDraft.timeSlot);
    const newlyAddedName = !prevName && Boolean(workingDraft.clientName);
    const newlyAddedPhone = !prevPhone && Boolean(workingDraft.clientPhone);
    const newlyAddedAddr = !prevAddr && Boolean(workingDraft.propertyAddress);
    const newlyAddedLot = !prevLot && Boolean(workingDraft.lotSize);
    const newFieldCount = [newlyAddedName, newlyAddedPhone, newlyAddedAddr, newlyAddedLot].filter(Boolean).length;

    const formatJoinedEs = (items: string[]) =>
      items.length <= 1 ? items[0] ?? '' : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
    const formatJoinedEn = (items: string[]) =>
      items.length <= 1 ? items[0] ?? '' : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

    let ackBubble: string;
    if (newlyAddedSlot) {
      ackBubble = isEs
        ? `Anotado: ${dateHuman} a las ${slotHuman}.`
        : `Got it: ${dateHuman} at ${slotHuman}.`;
    } else if (newFieldCount > 1) {
      ackBubble = isEs
        ? `¡Perfecto${workingDraft.clientName ? `, ${workingDraft.clientName}` : ''}, ya anoté esos datos!`
        : `Perfect${workingDraft.clientName ? `, ${workingDraft.clientName}` : ''}, got those details!`;
    } else if (newlyAddedName) {
      ackBubble = isEs
        ? `¡Gracias, ${workingDraft.clientName}!`
        : `Thanks, ${workingDraft.clientName}!`;
    } else if (newlyAddedPhone) {
      ackBubble = isEs ? `¡Perfecto, teléfono anotado!` : `Got your phone number, thanks!`;
    } else if (newlyAddedAddr) {
      ackBubble = isEs ? `¡Genial, dirección anotada!` : `Great, got your property address!`;
    } else if (newlyAddedLot) {
      ackBubble = isEs
        ? `Anotado: ${workingDraft.lotSize}.`
        : `Got it: ${workingDraft.lotSize}.`;
    } else {
      ackBubble = isEs
        ? `Para dejar lista tu visita del ${dateHuman} a las ${slotHuman}:`
        : `To finish booking ${dateHuman} at ${slotHuman}:`;
    }

    let askBubble: string;
    if (missingEs.length === 1) {
      askBubble = isEs
        ? `Por último, ¿cuál es tu ${missingEs[0]}?`
        : `Lastly, what's your ${missingEn[0]}?`;
    } else if (!newlyAddedSlot && prevDate && prevSlot) {
      askBubble = isEs
        ? `Ahora solo dime tu ${formatJoinedEs(missingEs)}.`
        : `Now I just need your ${formatJoinedEn(missingEn)}.`;
    } else {
      askBubble = isEs
        ? `Para dejar la cita registrada en la agenda de ${biz.ownerName}, solo dime tu ${formatJoinedEs(missingEs)}.`
        : `To save this in ${biz.ownerName}'s agenda, please share your ${formatJoinedEn(missingEn)}.`;
    }

    return {
      bubbles: [ackBubble, askBubble],
      nextDraft: { ...workingDraft, awaitingField: nextAwait },
    };
  }

  // Step 4: All required info present — BOOK IT IN THE SHARED CALENDAR STORE!
  const created = createStaticAppointment({
    date: workingDraft.date!,
    timeSlot: workingDraft.timeSlot!,
    clientName: workingDraft.clientName!,
    clientPhone: workingDraft.clientPhone!,
    propertyAddress: workingDraft.propertyAddress!,
    lotSize: workingDraft.lotSize!,
    source: 'sarah',
  });

  if (!created.ok) {
    const alts = created.availableSlots.map(formatSlotShort).join(', ');
    return {
      bubbles: isEs
        ? [
            `Ese espacio se acaba de ocupar. Horarios aún disponibles ese día: ${alts || 'ninguno'}.`,
            `¿Qué otro horario o día te gustaría elegir?`,
          ]
        : [
            `That window was just taken. Open slots left that day: ${alts || 'none'}.`,
            `Which other time or day works for you?`,
          ],
      nextDraft: { ...workingDraft, timeSlot: undefined, awaitingField: 'date_time' },
    };
  }

  playNotificationChime();

  return {
    bubbles: isEs
      ? [
          `¡Listo, ${created.appointment.clientName}! Tu visita quedó registrada en la agenda (Ref: ${created.appointment.id}) como pendiente de confirmación por ${biz.ownerName}.`,
          `Puedes descargar tu recordatorio o agregarlo a Google Calendar desde la tarjeta aquí abajo.`,
        ]
      : [
          `All set, ${created.appointment.clientName}! Your evaluation is saved in our live agenda (Ref: ${created.appointment.id}) for ${biz.ownerName} to confirm.`,
          `You can download your .ics reminder or add it to Google Calendar below.`,
        ],
    nextDraft: {
      active: false,
      activeLang: detectedLang,
      lastBooked: {
        id: created.appointment.id,
        dateHumanEs: formatDateHuman(created.appointment.date, 'es'),
        dateHumanEn: formatDateHuman(created.appointment.date, 'en'),
        slotHuman: formatSlotShort(created.appointment.timeSlot),
        clientName: created.appointment.clientName,
      },
    },
    bookedAppointment: created.appointment,
  };
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
  const [isTyping, setIsTyping] = useState(false);
  const [errorBanner, setErrorBanner] = useState('');

  const [voiceMuted, setVoiceMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const chatSessionRef = useRef(0);
  const deliveryTokenRef = useRef(0);
  const bookingDraftRef = useRef<BookingDraftState>({ active: false });
  const messagesRef = useRef<ChatMessage[]>([]);
  const pendingBatchRef = useRef<Array<{ text: string; speak: boolean }>>([]);
  const batchTimerRef = useRef<number | null>(null);
  const batchCreatedAtRef = useRef<number>(0);
  const lastTypingActivityRef = useRef<number>(0);
  const inputValueRef = useRef<string>('');
  const isListeningRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);

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
    messagesRef.current = messages;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, isTyping, interimTranscript]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    return () => {
      chatSessionRef.current += 1;
      deliveryTokenRef.current += 1;
      if (batchTimerRef.current !== null) {
        window.clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
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

  const deliverSequencedBubbles = async (
    bubbles: string[],
    sessionId: number,
    deliveryToken: number,
    speakResponse: boolean,
    bookedAppointment?: Appointment
  ) => {
    for (let i = 0; i < bubbles.length; i++) {
      if (chatSessionRef.current !== sessionId || deliveryTokenRef.current !== deliveryToken) return;
      if (i > 0) {
        await waitChatPause(INTER_BUBBLE_BEAT_MS);
        if (chatSessionRef.current !== sessionId || deliveryTokenRef.current !== deliveryToken) return;
      }
      setIsTyping(true);
      await waitChatPause(calcTypingDelayMs(bubbles[i], i === 0));
      if (chatSessionRef.current !== sessionId || deliveryTokenRef.current !== deliveryToken) return;
      setIsTyping(false);
      const isLast = i === bubbles.length - 1;
      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}-${i}`,
          role: 'model',
          text: bubbles[i],
          isStreaming: false,
          bookedAppointment: isLast ? bookedAppointment : undefined,
        },
      ]);
    }

    if (
      speakResponse &&
      bubbles.length > 0 &&
      chatSessionRef.current === sessionId &&
      deliveryTokenRef.current === deliveryToken
    ) {
      speakText(bubbles.join(' '));
    }
  };

  const processPendingBatch = async () => {
    const batch = pendingBatchRef.current.splice(0);
    if (batch.length === 0) return;

    const combinedText = batch.map((b) => b.text).join('\n');
    const speakResponse = batch.some((b) => b.speak);
    const sessionId = chatSessionRef.current;
    const deliveryToken = ++deliveryTokenRef.current;
    const currentMsgs = messagesRef.current;
    const isFirstTurn = !currentMsgs.some((m) => m.role === 'model');

    const historyForApi = currentMsgs.map((m) => ({
      role: m.role,
      text: m.text,
    }));

    isProcessingRef.current = true;
    setIsSending(true);
    setIsTyping(true);

    let activeModelMsgId: string | null = null;

    try {
      if (isStaticPagesHost()) {
        const offline = resolveOfflineJessicaResponse(
          combinedText,
          cms,
          language,
          isFirstTurn,
          bookingDraftRef.current
        );
        bookingDraftRef.current = offline.nextDraft;
        await deliverSequencedBubbles(
          offline.bubbles,
          sessionId,
          deliveryToken,
          speakResponse,
          offline.bookedAppointment
        );
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
      if (
        !response.ok &&
        (response.status === 404 ||
          (!contentType.includes('application/json') && !contentType.includes('text/event-stream')))
      ) {
        const offline = resolveOfflineJessicaResponse(
          combinedText,
          cms,
          language,
          isFirstTurn,
          bookingDraftRef.current
        );
        bookingDraftRef.current = offline.nextDraft;
        await deliverSequencedBubbles(
          offline.bubbles,
          sessionId,
          deliveryToken,
          speakResponse,
          offline.bookedAppointment
        );
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

      const modelMsgId = `m-${Date.now() + 1}`;
      activeModelMsgId = modelMsgId;
      let modelBubbleAdded = false;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      let bookedApt: Appointment | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (chatSessionRef.current !== sessionId || deliveryTokenRef.current !== deliveryToken) return;

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
          if (parsed.error) throw new Error(parsed.error);

          if (parsed.text) {
            accumulatedText += parsed.text;
            const firstPart = accumulatedText.split('|||')[0].replace(/\|{1,2}$/, '');
            if (!modelBubbleAdded) {
              modelBubbleAdded = true;
              setIsTyping(false);
              setMessages((prev) => [
                ...prev,
                {
                  id: modelMsgId,
                  role: 'model',
                  text: firstPart,
                  isStreaming: true,
                },
              ]);
            } else {
              setMessages((prev) =>
                prev.map((m) => (m.id === modelMsgId ? { ...m, text: firstPart } : m))
              );
            }
          }

          if (parsed.bookedAppointment) {
            bookedApt = parsed.bookedAppointment;
            playNotificationChime();
            window.dispatchEvent(new CustomEvent('clearview:calendar-updated'));
          }
        }
      }

      const bubbles = splitIntoChatBubbles(accumulatedText);
      const firstBubble = bubbles[0] ?? '';

      if (modelBubbleAdded) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === modelMsgId
              ? {
                  ...m,
                  text: firstBubble,
                  isStreaming: false,
                  bookedAppointment: bubbles.length <= 1 ? bookedApt : undefined,
                }
              : m
          )
        );
      } else if (firstBubble || bookedApt) {
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: modelMsgId,
            role: 'model',
            text: firstBubble,
            isStreaming: false,
            bookedAppointment: bubbles.length <= 1 ? bookedApt : undefined,
          },
        ]);
      }

      for (let i = 1; i < bubbles.length; i++) {
        if (chatSessionRef.current !== sessionId || deliveryTokenRef.current !== deliveryToken) return;
        await waitChatPause(INTER_BUBBLE_BEAT_MS);
        if (chatSessionRef.current !== sessionId || deliveryTokenRef.current !== deliveryToken) return;
        setIsTyping(true);
        await waitChatPause(calcTypingDelayMs(bubbles[i], false));
        if (chatSessionRef.current !== sessionId || deliveryTokenRef.current !== deliveryToken) return;
        setIsTyping(false);
        const isLast = i === bubbles.length - 1;
        setMessages((prev) => [
          ...prev,
          {
            id: `m-${Date.now()}-${i}`,
            role: 'model',
            text: bubbles[i],
            isStreaming: false,
            bookedAppointment: isLast ? bookedApt : undefined,
          },
        ]);
      }

      if (
        speakResponse &&
        bubbles.length > 0 &&
        chatSessionRef.current === sessionId &&
        deliveryTokenRef.current === deliveryToken
      ) {
        speakText(bubbles.join(' '));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to reach assistant.';
      setErrorBanner(msg);
      if (activeModelMsgId) {
        setMessages((prev) => prev.filter((m) => m.id !== activeModelMsgId));
      }
    } finally {
      if (chatSessionRef.current === sessionId && deliveryTokenRef.current === deliveryToken) {
        isProcessingRef.current = false;
        setIsTyping(false);
        setIsSending(false);
      }
      if (pendingBatchRef.current.length > 0 && chatSessionRef.current === sessionId) {
        scheduleBatchFlush(700);
      }
    }
  };

  const scheduleBatchFlush = (waitMs = 1500) => {
    if (batchTimerRef.current !== null) {
      window.clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    const sessionId = chatSessionRef.current;
    batchTimerRef.current = window.setTimeout(() => {
      batchTimerRef.current = null;
      if (chatSessionRef.current !== sessionId) return;
      if (pendingBatchRef.current.length === 0) return;

      const elapsed = Date.now() - batchCreatedAtRef.current;
      const msSinceKeystroke = Date.now() - lastTypingActivityRef.current;
      const isActivelyTypingNext =
        inputValueRef.current.trim().length > 0 && msSinceKeystroke < 2100 && elapsed < 12000;

      if (isListeningRef.current || isActivelyTypingNext || isProcessingRef.current) {
        scheduleBatchFlush(750);
        return;
      }

      void processPendingBatch();
    }, waitMs);
  };

  const enqueueUserMessage = (textToSend: string, speakResponse = false, immediate = false) => {
    const trimmed = textToSend.trim();
    if (!trimmed) return;

    // Cancel any pending follow-up bubbles from a previous turn if user jumped back in
    deliveryTokenRef.current += 1;
    isProcessingRef.current = false;
    setIsTyping(false);
    setIsSending(false);
    setErrorBanner('');
    stopSpeaking();

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      text: trimmed,
    };

    const nextMessages = [...messagesRef.current, userMsg];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);

    inputValueRef.current = '';
    setInputText('');

    if (pendingBatchRef.current.length === 0) {
      batchCreatedAtRef.current = Date.now();
    }
    pendingBatchRef.current.push({ text: trimmed, speak: speakResponse });

    scheduleBatchFlush(immediate ? 350 : 1500);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    enqueueUserMessage(inputText, false, false);
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
        enqueueUserMessage(spoken, true, false);
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
    chatSessionRef.current += 1;
    deliveryTokenRef.current += 1;
    if (batchTimerRef.current !== null) {
      window.clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    pendingBatchRef.current = [];
    isProcessingRef.current = false;
    bookingDraftRef.current = { active: false };
    stopSpeaking();
    setIsTyping(false);
    setIsSending(false);
    messagesRef.current = [];
    setMessages([]);
    setErrorBanner('');
    inputValueRef.current = '';
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
                    onClick={() => enqueueUserMessage(chip, false, true)}
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

            {isTyping && (
              <div className="flex justify-start">
                <div
                  aria-live="polite"
                  className="inline-flex items-center gap-2 bg-white border border-[#DDD1C0] rounded-xl rounded-tl-sm px-3.5 py-2.5 text-xs text-neutral-600"
                >
                  <span>
                    {language === 'es'
                      ? `${biz.assistantName} está escribiendo`
                      : `${biz.assistantName} is typing`}
                  </span>
                  <span className="inline-flex items-center gap-1" aria-hidden="true">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--cv-primary)] animate-bounce [animation-delay:-0.25s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--cv-primary)] animate-bounce [animation-delay:-0.12s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--cv-primary)] animate-bounce" />
                  </span>
                </div>
              </div>
            )}

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
              onChange={(e) => {
                const nextVal = e.target.value;
                inputValueRef.current = nextVal;
                if (nextVal.trim().length > 0) {
                  lastTypingActivityRef.current = Date.now();
                }
                setInputText(nextVal);
              }}
              placeholder={uiCopy.placeholder}
              className="flex-1 min-w-0 bg-[#F4EFE6] border border-[#DDD1C0] focus:border-[var(--cv-primary)] focus:outline-none rounded-md px-3 py-2 text-sm text-[#231710] placeholder:text-neutral-500"
            />

            <button
              type="submit"
              disabled={!inputText.trim()}
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
