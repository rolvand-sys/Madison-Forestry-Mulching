import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  type Content,
  type FunctionDeclaration,
  GoogleGenAI,
  type Part,
  ThinkingLevel,
  Type,
} from '@google/genai';
import {
  type Appointment,
  type AppointmentStatus,
  SITE_VISIT_SLOTS,
  buildIcsInvite,
  claimOwnerPasscode,
  createAppointment,
  deleteAppointment,
  getAppointmentById,
  getAvailabilityForRange,
  getFloridaTodayIso,
  getOwnerAuthStatus,
  getOwnerDashboardSnapshot,
  isValidDateIso,
  issueOwnerToken,
  markNotificationsRead,
  subscribeOwnerEvents,
  toggleBlockedDate,
  toggleBlockedSlot,
  updateAppointmentStatus,
  verifyOwnerPasscode,
  verifyOwnerToken,
} from './server/calendarStore.ts';
import {
  applyCmsTemplatePreset,
  claimAdminPasscode,
  deleteUploadedMedia,
  getAdminAuthStatus,
  getFullCmsForAdmin,
  getPublicCms,
  issueAdminToken,
  listUploadedMedia,
  resolveSafeMediaPath,
  saveUploadedImage,
  updateCmsData,
  verifyAdminPasscode,
  verifyAdminToken,
  verifyContractorToolPin,
} from './server/cmsStore.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const PRIMARY_MODEL = 'gemini-4-hydrogen';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';

interface ChatMessageInput {
  role: 'user' | 'model';
  text: string;
}

const checkAvailabilityDeclaration: FunctionDeclaration = {
  name: 'check_calendar_availability',
  description:
    'Check real-time open site-evaluation appointment dates and time slots in the backend calendar (Mon-Fri, Tue 12-5 PM only, Sat-Sun closed). Call this whenever a user asks for available dates/times or before confirming a booking.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      startDate: {
        type: Type.STRING,
        description:
          'Optional start date in YYYY-MM-DD (Eastern Time). Defaults to today if omitted.',
      },
      days: {
        type: Type.NUMBER,
        description: 'Number of days to inspect (1 to 21, default 10).',
      },
    },
  },
};

const bookSiteVisitDeclaration: FunctionDeclaration = {
  name: 'book_site_visit',
  description:
    'Book a real property site-evaluation appointment on the backend calendar. Only call AFTER confirming date, timeSlot, clientName, clientPhone, propertyAddress, and lotSize with the customer.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      date: {
        type: Type.STRING,
        description: 'Appointment date in YYYY-MM-DD format (Monday through Friday).',
      },
      timeSlot: {
        type: Type.STRING,
        description:
          'Exact time slot ID: "09:00" (9:00 AM - 10:30 AM), "11:00" (11:00 AM - 12:30 PM), "13:30" (1:30 PM - 3:00 PM), or "15:30" (3:30 PM - 5:00 PM). Note: Tuesdays only offer "13:30" and "15:30".',
      },
      clientName: {
        type: Type.STRING,
        description: 'Customer full name.',
      },
      clientPhone: {
        type: Type.STRING,
        description: 'Customer phone number.',
      },
      propertyAddress: {
        type: Type.STRING,
        description: 'Property street address, parcel ID, or city/county.',
      },
      lotSize: {
        type: Type.STRING,
        description: 'Approximate acreage or lot size (e.g. "1 acre", "2.5 acres").',
      },
      serviceType: {
        type: Type.STRING,
        description: 'Primary requested clearing scope (e.g. Forestry Mulching, Brush Clearing).',
      },
      notes: {
        type: Type.STRING,
        description: 'Optional notes about brush density, access gate, or goals.',
      },
    },
    required: [
      'date',
      'timeSlot',
      'clientName',
      'clientPhone',
      'propertyAddress',
      'lotSize',
    ],
  },
};

function buildSystemInstruction(uiLanguage: 'en' | 'es'): string {
  const cms = getPublicCms();
  const biz = cms.business;
  const pricing = cms.pricing;
  const todayIso = getFloridaTodayIso();
  const slotSummary = SITE_VISIT_SLOTS.map((s) => `${s.id} (${s.labelEn})`).join(', ');

  const discountFactor = 1 - pricing.bulkDiscountRate;
  const densityLines = pricing.densities.map((den) => {
    const fixedParts = pricing.lotSizes
      .filter((l) => l.pricingMode === 'fixed' && den.fixedRates[l.id])
      .map((l) => `${l.labelEn}: $${den.fixedRates[l.id][0]}–$${den.fixedRates[l.id][1]}`);
    const discountedMin = Math.round(den.perAcreRange[0] * discountFactor);
    const discountedMax = Math.round(den.perAcreRange[1] * discountFactor);
    const perAcreStr = `Per-acre base (under 5 acres): $${den.perAcreRange[0]}–$${den.perAcreRange[1]}/acre | 5+ Acres with ${Math.round(
      pricing.bulkDiscountRate * 100
    )}% bulk discount: $${discountedMin}–$${discountedMax}/acre`;
    return `- ${den.labelEn} / ${den.labelEs} (${den.descriptionEn}): ${[
      ...fixedParts,
      perAcreStr,
    ].join(' | ')}`;
  });

  const addonLines = pricing.addons.map(
    (a) => `  * ${a.labelEn} / ${a.labelEs}: +$${a.price} (${a.descriptionEn})`
  );

  const serviceLines = cms.services.map(
    (s, idx) =>
      `${idx + 1}. ${s.titleEn} (${s.titleEs}): ${s.summaryEn}${
        s.highlightsEn.length > 0 ? ` [${s.highlightsEn.join('; ')}]` : ''
      }`
  );

  const faqLines = cms.faqs.map((f) => `- Q: ${f.questionEn}\n  A: ${f.answerEn}`);

  const ownerLine =
    biz.ownerName && biz.ownerName.toLowerCase() !== biz.businessName.toLowerCase()
      ? `- Owner / Lead Operator: ${biz.ownerName}`
      : '';

  const assistantName = biz.assistantName || 'Jessica';

  return [
    `IDENTITY & PERSONA: You are ${assistantName}, the bilingual Virtual Assistant & Land Clearing Estimator for ${biz.businessName}.`,
    `- Always introduce yourself by name as ${assistantName} on your VERY FIRST reply only (or if directly asked who you are). NEVER repeat "Hi, I'm Jessica" / "¡Hola! Soy Jessica" or re-introduce yourself in later turns of the same conversation.`,
    `- Never refer to yourself by any other name and never mention any other business name or unrelated city.`,
    `Active Website UI Language: ${uiLanguage === 'es' ? 'Spanish (Español)' : 'English (US)'}.`,
    `Current Local Date (Eastern Time): ${todayIso}.`,
    `LANGUAGE RULE: Always reply in the exact language the customer uses in their latest message (English or natural Spanish). If unclear, match the active conversation language or ${uiLanguage === 'es' ? 'Spanish' : 'English'}.`,
    '',
    'BUSINESS PROFILE & CONTACT DETAILS (LIVE GROUND TRUTH):',
    `- Business Name: ${biz.businessName} (Short: ${biz.shortName})`,
    '- Category: Forestry service / Land Clearing & Brush Mulching.',
    ownerLine,
    `- Street Address & Headquarters: ${biz.cityState} (Plus Code: GHWW+VF Madison, Florida)`,
    '- Google Maps Link: https://maps.app.goo.gl/jxx9k4PnS1odePzy6',
    `- Direct Phone / Dispatch: ${biz.phone}`,
    `- Email: ${biz.email}`,
    `- Operating Hours: ${biz.operatingHours.en} (Monday, Wednesday, Thursday, Friday: 9:00 AM–5:00 PM; Tuesday: 12:00 PM–5:00 PM; Saturday & Sunday: Closed)`,
    `- Google Rating: ${biz.googleRatingLabel.en} — praised for rapid turnaround, transparent pricing, driveway clearing, farm/perimeter clearing, storm cleanup, and stump mulching.`,
    `- Service Locations Served: ${biz.serviceArea}. Specifically cover Madison, Monticello, Perry, Live Oak, Lee, Greenville, Lake City (FL), and Quitman (GA), plus surrounding Madison County, North Florida, and South Georgia rural tracts.`,
    `- Credentials & Equipment: ${cms.sections.hero.trustLine.en}; ASV RT-135 Posi-Track Forestry tracked skid steer with high-flow Baumalight forestry drum mulcher head, serrated heavy-duty brush & timber grapple, and dedicated heavy-haul trailer.`,
    '- Key Advantages: Single-pass selective clearing, zero burn piles or smoke permits, leaves protective organic mulch to prevent erosion, preserves marked mature live oaks and pines, fast post-storm & driveway clearing.',
    '',
    'CORE SERVICES:',
    ...serviceLines,
    '',
    'LIVE PRICING RULES (USE THESE EXACT NUMBERS WHEN QUOTING):',
    `- Minimum Mobilization Fee (Tarifa mínima de movilización): $${pricing.minimumMobilizationFee} (NEVER quote a job below $${pricing.minimumMobilizationFee}).`,
    `- Bulk Acreage Discount (Descuento por volumen): ${Math.round(pricing.bulkDiscountRate * 100)}% off base clearing on tracts of 5+ acres (automatically included in the 5+ acre rates below).`,
    ...densityLines,
    '- Optional Add-Ons (Servicios adicionales):',
    ...addonLines,
    '- Always remind customers that any price range shared in chat is a preliminary ballpark estimate, and final fixed pricing is confirmed free of charge via satellite review or an on-site property evaluation.',
    '',
    'COMMON QUESTIONS & ANSWERS:',
    ...faqLines,
    '',
    'LIVE CALENDAR & SITE VISIT SCHEDULING PROTOCOL (IMPORTANT):',
    `- Standard Site Visit Slots (Mon–Fri, Sat–Sun Closed; Tuesdays 12–5 PM only): ${slotSummary}.`,
    '- You have real calendar tools (`check_calendar_availability` and `book_site_visit`) connected directly to the live backend calendar and owner agenda.',
    '- Whenever a customer asks about open dates/times OR expresses interest in scheduling a property evaluation, call `check_calendar_availability` FIRST to inspect genuine open dates and times.',
    '- To finalize a booking via `book_site_visit`, collect these 6 details from the customer (ask naturally for whichever ones are still missing):',
    '  1. Date (`YYYY-MM-DD`, Mon–Fri)',
    '  2. Time Slot (`09:00`, `11:00`, `13:30`, or `15:30` — Tue afternoon only `13:30` or `15:30`)',
    '  3. Full Name',
    '  4. Phone Number',
    '  5. Property Address / Parcel or City/County (e.g., Madison, Monticello, Perry, Live Oak, Quitman GA)',
    '  6. Approximate Lot Size / Acreage',
    '- NEVER tell a customer their visit is scheduled unless `book_site_visit` returns `{ ok: true }`. If a requested slot is full, present the open alternative slots returned by the tool.',
    `- Once \`book_site_visit\` succeeds, share their Reference ID and let them know they can download the calendar reminder (.ics) directly from the confirmation card below your message (or call ${biz.phone} if urgent).`,
    cms.sections.assistant.extraInstructions
      ? `\nEXTRA BUSINESS INSTRUCTIONS FROM ADMIN:\n${cms.sections.assistant.extraInstructions}`
      : '',
    '',
    'RESPONSE STYLE (LIVE CHAT RULES — CRITICAL):',
    `- Remember this is a LIVE CHAT widget, NOT an email or brochure. Keep replies brief, warm, and conversational as ${assistantName} from ${biz.shortName}.`,
    '- NEVER write one long paragraph or wall of text. Keep each individual message short (1–2 crisp sentences max).',
    '- Break your answer into 2 or 3 short chat bubbles separated by exact delimiter `|||` (for example: quick answer ||| brief pricing/detail note ||| short next-step question).',
    '- Stay completely in context of the ongoing conversation: if the customer already shared their acreage or just finished booking a visit and replies "Gracias" / "Thanks", respond warmly referencing their booking/context instead of resetting or re-asking what you already discussed.',
    '- Only share the specific info the user asked for instead of listing every add-on or city at once.',
  ]
    .filter(Boolean)
    .join('\n');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientHighDemandError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  return (
    raw.includes('503') ||
    raw.includes('429') ||
    raw.includes('UNAVAILABLE') ||
    raw.includes('RESOURCE_EXHAUSTED') ||
    raw.toLowerCase().includes('high demand') ||
    raw.toLowerCase().includes('temporarily unavailable') ||
    raw.toLowerCase().includes('overloaded')
  );
}

function formatReadableGeminiError(err: unknown, uiLanguage: 'en' | 'es'): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const phone = getPublicCms().business.phone;

  if (isTransientHighDemandError(err)) {
    return uiLanguage === 'es'
      ? `El asistente de IA está experimentando alta demanda temporal en este momento. Intenta de nuevo en unos segundos o llámanos directo al ${phone}.`
      : `The AI assistant is experiencing temporary high demand right now. Please try again in a few seconds or call us directly at ${phone}.`;
  }

  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED')) {
    return uiLanguage === 'es'
      ? 'La clave de API de Gemini no es válida o no tiene permisos. Verifica Settings > Secrets.'
      : 'The Gemini API key is invalid or lacks permissions. Please check Settings > Secrets.';
  }

  try {
    const outer = JSON.parse(raw) as { error?: { message?: string }; message?: string };
    const innerText = outer?.error?.message ?? outer?.message;
    if (typeof innerText === 'string') {
      try {
        const inner = JSON.parse(innerText) as { error?: { message?: string } };
        if (inner?.error?.message) return inner.error.message;
      } catch {
        return innerText;
      }
    }
  } catch {
    // fall through
  }

  return (
    raw ||
    (uiLanguage === 'es'
      ? 'No se pudo conectar con el asistente.'
      : 'Unable to reach Gemini service.')
  );
}

async function generateWithResilience(
  ai: GoogleGenAI,
  contents: Content[],
  systemInstruction: string
) {
  const modelAttempts: { model: string; delayMs: number }[] = [
    { model: PRIMARY_MODEL, delayMs: 0 },
    { model: PRIMARY_MODEL, delayMs: 650 },
    { model: FALLBACK_MODEL, delayMs: 400 },
    { model: FALLBACK_MODEL, delayMs: 1000 },
  ];

  let lastErr: unknown = null;

  for (let i = 0; i < modelAttempts.length; i++) {
    const attempt = modelAttempts[i];
    if (attempt.delayMs > 0) {
      await sleep(attempt.delayMs);
    }

    try {
      return await ai.models.generateContent({
        model: attempt.model,
        contents,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          tools: [
            {
              functionDeclarations: [checkAvailabilityDeclaration, bookSiteVisitDeclaration],
            },
          ],
        },
      });
    } catch (err) {
      lastErr = err;
      console.warn(
        `Gemini attempt ${i + 1} (${attempt.model}) failed:`,
        err instanceof Error ? err.message : err
      );
      if (!isTransientHighDemandError(err)) {
        throw err;
      }
    }
  }

  throw lastErr ?? new Error('Gemini service unavailable.');
}

// --- Sliding-Window Auth Rate Limiters (Owner & Admin) ---

const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_FAILURES = 10;

function createRateLimiter() {
  const failures = new Map<string, number[]>();
  return {
    isLimited(ip: string): boolean {
      const cutoff = Date.now() - AUTH_WINDOW_MS;
      const recent = (failures.get(ip) ?? []).filter((ts) => ts > cutoff);
      if (recent.length === 0) {
        failures.delete(ip);
        return false;
      }
      failures.set(ip, recent);
      return recent.length >= AUTH_MAX_FAILURES;
    },
    recordFailure(ip: string): void {
      const cutoff = Date.now() - AUTH_WINDOW_MS;
      const recent = (failures.get(ip) ?? []).filter((ts) => ts > cutoff);
      recent.push(Date.now());
      failures.set(ip, recent);
    },
    clear(ip: string): void {
      failures.delete(ip);
    },
  };
}

const ownerLimiter = createRateLimiter();
const adminLimiter = createRateLimiter();

function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function requireOwnerAuth(req: Request, res: Response, next: NextFunction) {
  if (!verifyOwnerToken(req.headers.authorization)) {
    res.status(401).json({ error: 'Unauthorized. Owner sign-in required.' });
    return;
  }
  next();
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  if (!verifyAdminToken(req.headers.authorization)) {
    res.status(401).json({ error: 'Unauthorized. Admin sign-in required.' });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '8mb' }));

  // =========================================================
  // 1. PUBLIC CMS, MEDIA & CONTRACTOR PIN ROUTES
  // =========================================================

  app.get('/api/cms', (_req: Request, res: Response) => {
    res.json({ cms: getPublicCms() });
  });

  app.post('/api/contractor/verify-pin', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (ownerLimiter.isLimited(ip)) {
      res.status(429).json({ error: 'Too many PIN attempts. Try again later.' });
      return;
    }
    const body = req.body as { pin?: unknown };
    const pin = typeof body?.pin === 'string' ? body.pin : '';
    if (!verifyContractorToolPin(pin)) {
      ownerLimiter.recordFailure(ip);
      res.status(401).json({ error: 'Invalid PIN.' });
      return;
    }
    ownerLimiter.clear(ip);
    res.json({ ok: true });
  });

  app.get('/api/media/:filename', (req: Request, res: Response) => {
    const filename = typeof req.params.filename === 'string' ? req.params.filename : '';
    const filePath = resolveSafeMediaPath(filename);
    if (!filePath) {
      res.status(404).json({ error: 'Media asset not found.' });
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(filePath);
  });

  // =========================================================
  // 2. ADMIN CMS ROUTES (/admin PORTAL, TEMPLATE CLONING & MEDIA)
  // =========================================================

  app.get('/api/admin/auth-status', (_req: Request, res: Response) => {
    res.json(getAdminAuthStatus());
  });

  app.post('/api/admin/claim', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (adminLimiter.isLimited(ip)) {
      res.status(429).json({ error: 'Too many attempts. Please wait 15 minutes.' });
      return;
    }
    const body = req.body as { passcode?: unknown };
    const passcode = typeof body?.passcode === 'string' ? body.passcode : '';
    const result = await claimAdminPasscode(passcode);
    if (!result.ok) {
      adminLimiter.recordFailure(ip);
      res.status(result.statusCode).json({ error: result.error });
      return;
    }
    adminLimiter.clear(ip);
    res.status(201).json({ token: result.token });
  });

  app.post('/api/admin/login', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (adminLimiter.isLimited(ip)) {
      res.status(429).json({ error: 'Too many login attempts. Please wait 15 minutes.' });
      return;
    }
    const body = req.body as { passcode?: unknown };
    const passcode = typeof body?.passcode === 'string' ? body.passcode : '';
    const status = getAdminAuthStatus();

    if (!status.configuredViaEnv && !status.claimed) {
      res.status(409).json({
        error: 'Admin passcode is not configured yet. Complete initial setup first.',
      });
      return;
    }

    if (!verifyAdminPasscode(passcode)) {
      adminLimiter.recordFailure(ip);
      res.status(401).json({ error: 'Invalid admin passcode.' });
      return;
    }

    adminLimiter.clear(ip);
    res.json({ token: issueAdminToken() });
  });

  app.get('/api/admin/cms', requireAdminAuth, (_req: Request, res: Response) => {
    res.json({
      cms: getFullCmsForAdmin(),
      media: listUploadedMedia(),
    });
  });

  app.put('/api/admin/cms', requireAdminAuth, async (req: Request, res: Response) => {
    const body = req.body as { cms?: unknown };
    const payload = body?.cms ?? body;
    const saved = await updateCmsData(payload);
    res.json({ cms: saved });
  });

  app.post('/api/admin/template/preset', requireAdminAuth, async (req: Request, res: Response) => {
    const body = req.body as { preset?: unknown };
    const preset =
      body?.preset === 'starter-template' ? 'starter-template' : 'clearview-default';
    const saved = await applyCmsTemplatePreset(preset);
    res.json({ cms: saved });
  });

  app.post('/api/admin/upload', requireAdminAuth, async (req: Request, res: Response) => {
    const body = req.body as { dataUrl?: unknown };
    const dataUrl = typeof body?.dataUrl === 'string' ? body.dataUrl : '';
    const saved = await saveUploadedImage(dataUrl);
    if (!saved.ok) {
      res.status(saved.statusCode).json({ error: saved.error });
      return;
    }
    res.status(201).json(saved);
  });

  app.get('/api/admin/media', requireAdminAuth, (_req: Request, res: Response) => {
    res.json({ media: listUploadedMedia() });
  });

  app.delete(
    '/api/admin/media/:filename',
    requireAdminAuth,
    async (req: Request, res: Response) => {
      const filename = typeof req.params.filename === 'string' ? req.params.filename : '';
      const deleted = await deleteUploadedMedia(filename);
      if (!deleted) {
        res.status(404).json({ error: 'Media asset not found.' });
        return;
      }
      res.json({ deleted: true });
    }
  );

  // =========================================================
  // 3. PUBLIC CALENDAR & APPOINTMENT ROUTES (NO PII LEAKAGE)
  // =========================================================

  app.get('/api/calendar/availability', (req: Request, res: Response) => {
    const startParam = typeof req.query.start === 'string' ? req.query.start : undefined;
    const daysParam = Number(req.query.days) || 35;

    const days = getAvailabilityForRange(startParam, daysParam);
    res.json({
      todayIso: getFloridaTodayIso(),
      slots: SITE_VISIT_SLOTS,
      days,
    });
  });

  app.post('/api/appointments', async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const result = await createAppointment({
      date: typeof body?.date === 'string' ? body.date : '',
      timeSlot: typeof body?.timeSlot === 'string' ? body.timeSlot : '',
      clientName: typeof body?.clientName === 'string' ? body.clientName : '',
      clientPhone: typeof body?.clientPhone === 'string' ? body.clientPhone : '',
      clientEmail: typeof body?.clientEmail === 'string' ? body.clientEmail : undefined,
      propertyAddress:
        typeof body?.propertyAddress === 'string' ? body.propertyAddress : '',
      lotSize: typeof body?.lotSize === 'string' ? body.lotSize : '',
      serviceType: typeof body?.serviceType === 'string' ? body.serviceType : undefined,
      notes: typeof body?.notes === 'string' ? body.notes : undefined,
      source: 'web',
    });

    if (!result.ok) {
      res.status(result.statusCode).json({
        error: result.error,
        availableSlots: result.availableSlots,
      });
      return;
    }

    res.status(201).json({
      appointment: result.appointment,
      icsUrl: `/api/appointments/${encodeURIComponent(result.appointment.id)}/invite.ics`,
    });
  });

  app.get('/api/appointments/:id/invite.ics', (req: Request, res: Response) => {
    const rawId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!/^(?:ML|LF|CV)-APT-[A-Z0-9]+$/i.test(rawId)) {
      res.status(400).json({ error: 'Invalid appointment ID.' });
      return;
    }
    const appointment = getAppointmentById(rawId.toUpperCase());
    if (!appointment) {
      res.status(404).json({ error: 'Appointment not found.' });
      return;
    }

    const icsContent = buildIcsInvite(appointment);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="site-visit-${appointment.id}.ics"`
    );
    res.send(icsContent);
  });

  // =========================================================
  // 4. OWNER AUTH & REAL-TIME AGENDA DASHBOARD ROUTES
  // =========================================================

  app.get('/api/owner/auth-status', (_req: Request, res: Response) => {
    res.json(getOwnerAuthStatus());
  });

  app.post('/api/owner/claim', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (ownerLimiter.isLimited(ip)) {
      res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' });
      return;
    }
    const body = req.body as { passcode?: unknown };
    const passcode = typeof body?.passcode === 'string' ? body.passcode : '';
    const result = await claimOwnerPasscode(passcode);
    if (!result.ok) {
      ownerLimiter.recordFailure(ip);
      res.status(result.statusCode).json({ error: result.error });
      return;
    }
    ownerLimiter.clear(ip);
    res.status(201).json({ token: result.token });
  });

  app.post('/api/owner/login', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (ownerLimiter.isLimited(ip)) {
      res.status(429).json({ error: 'Too many login attempts. Please wait 15 minutes and try again.' });
      return;
    }
    const body = req.body as { passcode?: unknown };
    const passcode = typeof body?.passcode === 'string' ? body.passcode : '';
    const status = getOwnerAuthStatus();

    if (!status.configuredViaEnv && !status.claimed) {
      res.status(409).json({
        error: 'Owner passcode is not set yet. Complete initial setup first.',
      });
      return;
    }

    if (!verifyOwnerPasscode(passcode)) {
      ownerLimiter.recordFailure(ip);
      res.status(401).json({ error: 'Invalid owner passcode.' });
      return;
    }

    ownerLimiter.clear(ip);
    res.json({ token: issueOwnerToken() });
  });

  app.get('/api/owner/dashboard', requireOwnerAuth, (_req: Request, res: Response) => {
    res.json(getOwnerDashboardSnapshot());
  });

  app.patch(
    '/api/owner/appointments/:id',
    requireOwnerAuth,
    async (req: Request, res: Response) => {
      const id = typeof req.params.id === 'string' ? req.params.id.trim().toUpperCase() : '';
      const body = req.body as { status?: unknown };
      const status = body?.status;

      if (
        status !== 'pending' &&
        status !== 'confirmed' &&
        status !== 'completed' &&
        status !== 'cancelled'
      ) {
        res.status(400).json({ error: 'Invalid status value.' });
        return;
      }

      const updated = await updateAppointmentStatus(id, status as AppointmentStatus);
      if (!updated) {
        res.status(404).json({ error: 'Appointment not found.' });
        return;
      }

      res.json({ appointment: updated });
    }
  );

  app.delete(
    '/api/owner/appointments/:id',
    requireOwnerAuth,
    async (req: Request, res: Response) => {
      const id = typeof req.params.id === 'string' ? req.params.id.trim().toUpperCase() : '';
      const removed = await deleteAppointment(id);
      if (!removed) {
        res.status(404).json({ error: 'Appointment not found.' });
        return;
      }
      res.json({ deleted: true });
    }
  );

  app.post('/api/owner/blocks/date', requireOwnerAuth, async (req: Request, res: Response) => {
    const body = req.body as { date?: unknown };
    const date = typeof body?.date === 'string' ? body.date.trim() : '';
    if (!isValidDateIso(date)) {
      res.status(400).json({ error: 'Invalid date format (YYYY-MM-DD).' });
      return;
    }
    const blockedDates = await toggleBlockedDate(date);
    res.json({ blockedDates });
  });

  app.post('/api/owner/blocks/slot', requireOwnerAuth, async (req: Request, res: Response) => {
    const body = req.body as { date?: unknown; timeSlot?: unknown };
    const date = typeof body?.date === 'string' ? body.date.trim() : '';
    const timeSlot = typeof body?.timeSlot === 'string' ? body.timeSlot.trim() : '';
    if (!isValidDateIso(date) || !SITE_VISIT_SLOTS.some((s) => s.id === timeSlot)) {
      res.status(400).json({ error: 'Invalid date or time slot.' });
      return;
    }
    const dayBlockedSlots = await toggleBlockedSlot(date, timeSlot);
    res.json({ date, blockedSlots: dayBlockedSlots });
  });

  app.post(
    '/api/owner/notifications/read',
    requireOwnerAuth,
    async (req: Request, res: Response) => {
      const body = req.body as { notificationId?: unknown };
      const notificationId =
        typeof body?.notificationId === 'string' ? body.notificationId.trim() : undefined;
      const unreadCount = await markNotificationsRead(notificationId);
      res.json({ unreadCount });
    }
  );

  app.get('/api/owner/events', requireOwnerAuth, (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    res.write(`data: ${JSON.stringify({ event: 'connected', ts: Date.now() })}\n\n`);

    const unsubscribe = subscribeOwnerEvents((eventName, payload) => {
      res.write(`data: ${JSON.stringify({ event: eventName, payload })}\n\n`);
    });

    const keepAlive = setInterval(() => {
      res.write(`: ping ${Date.now()}\n\n`);
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
      unsubscribe();
    });
  });

  // =========================================================
  // 5. VIRTUAL ASSISTANT AI CHAT WITH LIVE CMS & CALENDAR TOOLS
  // =========================================================

  app.post('/api/chat', async (req: Request, res: Response) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error:
          'Gemini API key is not configured on the server. Please configure GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    const body = req.body as {
      messages?: ChatMessageInput[];
      language?: 'en' | 'es';
    };

    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const uiLanguage = body?.language === 'es' ? 'es' : 'en';

    if (messages.length === 0) {
      res.status(400).json({ error: 'At least one message is required.' });
      return;
    }

    const sanitizedContents: Content[] = messages
      .filter(
        (m): m is ChatMessageInput =>
          (m.role === 'user' || m.role === 'model') &&
          typeof m.text === 'string' &&
          m.text.trim().length > 0
      )
      .slice(-20)
      .map((m) => ({
        role: m.role,
        parts: [{ text: m.text.trim() }],
      }));

    if (sanitizedContents.length === 0) {
      res.status(400).json({ error: 'Valid message content is required.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = buildSystemInstruction(uiLanguage);
    const conversationContents: Content[] = [...sanitizedContents];
    let bookedAppointment: Appointment | null = null;

    try {
      let response = await generateWithResilience(
        ai,
        conversationContents,
        systemInstruction
      );

      for (let round = 0; round < 4; round++) {
        const calls = response.functionCalls;
        if (!calls || calls.length === 0) break;

        const modelContent = response.candidates?.[0]?.content;
        if (modelContent) {
          conversationContents.push(modelContent);
        }

        const functionResponseParts: Part[] = [];

        for (const call of calls) {
          const args = (call.args ?? {}) as Record<string, unknown>;
          let toolResult: Record<string, unknown>;

          if (call.name === 'check_calendar_availability') {
            const startDate =
              typeof args.startDate === 'string' ? args.startDate : undefined;
            const days =
              typeof args.days === 'number'
                ? Math.min(21, Math.max(1, args.days))
                : 10;
            const availability = getAvailabilityForRange(startDate, days);
            toolResult = {
              todayIso: getFloridaTodayIso(),
              timeSlotsReference: SITE_VISIT_SLOTS.map((s) => ({
                id: s.id,
                label: s.labelEn,
              })),
              days: availability.map((d) => ({
                date: d.date,
                isClosedDay: d.isClosedDay,
                isBlockedDate: d.isBlockedDate,
                openSlots: d.openSlots,
              })),
            };
          } else if (call.name === 'book_site_visit') {
            const created = await createAppointment({
              date: typeof args.date === 'string' ? args.date : '',
              timeSlot: typeof args.timeSlot === 'string' ? args.timeSlot : '',
              clientName: typeof args.clientName === 'string' ? args.clientName : '',
              clientPhone: typeof args.clientPhone === 'string' ? args.clientPhone : '',
              propertyAddress:
                typeof args.propertyAddress === 'string' ? args.propertyAddress : '',
              lotSize: typeof args.lotSize === 'string' ? args.lotSize : '',
              serviceType:
                typeof args.serviceType === 'string' ? args.serviceType : undefined,
              notes: typeof args.notes === 'string' ? args.notes : undefined,
              source: 'sarah',
            });

            if (created.ok) {
              bookedAppointment = created.appointment;
              toolResult = {
                ok: true,
                appointment: created.appointment,
                icsDownloadPath: `/api/appointments/${created.appointment.id}/invite.ics`,
              };
            } else {
              toolResult = {
                ok: false,
                error: created.error,
                availableSlots: created.availableSlots,
              };
            }
          } else {
            toolResult = { ok: false, error: `Unknown function: ${call.name}` };
          }

          functionResponseParts.push({
            functionResponse: {
              id: call.id,
              name: call.name,
              response: toolResult,
            },
          });
        }

        conversationContents.push({
          role: 'user',
          parts: functionResponseParts,
        });

        response = await generateWithResilience(
          ai,
          conversationContents,
          systemInstruction
        );
      }

      const finalText = response.text?.trim() ?? '';
      if (finalText) {
        res.write(`data: ${JSON.stringify({ text: finalText })}\n\n`);
      }

      if (bookedAppointment) {
        res.write(`data: ${JSON.stringify({ bookedAppointment })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err) {
      const cleanError = formatReadableGeminiError(err, uiLanguage);
      console.error('Gemini chat stream failed after retries:', cleanError);
      res.write(`data: ${JSON.stringify({ error: cleanError })}\n\n`);
      res.end();
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
