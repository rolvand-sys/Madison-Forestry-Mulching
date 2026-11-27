import type {
  CmsDensityOption,
  CmsLotSizeOption,
  CmsPricingConfig,
  DynamicLotEstimateResult,
  SiteCmsData,
} from '../types/cms';

export const defaultSiteCms: SiteCmsData = {
  templateVersion: 'madison-v1',
  updatedAt: '2026-04-01T12:00:00.000Z',
  theme: {
    primaryColor: '#2E5A27',
    primaryDarkColor: '#1F401A',
    accentColor: '#D9B382',
    lightGreenColor: '#72A350',
    darkSurfaceColor: '#231710',
    darkCardColor: '#312118',
  },
  business: {
    businessName: 'Madison Land Clearing & Brush Mulching',
    shortName: 'Madison Land Clearing',
    brandMonogram: 'MLC',
    ownerName: 'Paul Brown',
    assistantName: 'Jessica',
    primaryKeyword: {
      en: 'Forestry Mulching & Land Clearing',
      es: 'Triturado Forestal y Limpieza de Terrenos',
    },
    cityState: '1680 Duval Pond Rd, Madison, FL 32340',
    serviceArea:
      'Madison, Lee, Greenville, Monticello, Perry, Live Oak, Jasper, FL & Quitman, Valdosta, GA',
    serviceCities: [
      'Madison, FL',
      'Monticello, FL',
      'Perry, FL',
      'Live Oak, FL',
      'Greenville, FL',
      'Quitman, GA',
      'Valdosta, GA',
    ],
    phone: '(850) 973-7179',
    phoneHref: 'tel:+18509737179',
    email: 'estimates@madisonlandclearing.com',
    operatingHours: {
      en: 'Mon, Wed–Fri 9 AM–5 PM · Tue 12–5 PM · Sat–Sun Closed',
      es: 'Lun, Mié–Vie 9 AM–5 PM · Mar 12–5 PM · Sáb–Dom Cerrado',
    },
    googleRating: 5.0,
    googleReviewCount: 11,
    googleRatingLabel: {
      en: '5.0 ★ (11 Reviews)',
      es: '5.0 ★ (11 Reseñas)',
    },
    logoUrl: '/assets/aistudio/image_586e97f5.png',
    heroImageUrl: '/assets/madison/fb-5.jpg',
    assistantAvatarUrl: '/assets/aistudio/Sarah_ad20b330.jpg',
    contractorToolPin: '1234',
  },
  pricing: {
    minimumMobilizationFee: 1100,
    bulkDiscountRate: 0.12,
    lotSizes: [
      {
        id: '0.25',
        acres: 0.25,
        isFivePlus: false,
        isBulkDiscountEligible: false,
        pricingMode: 'fixed',
        labelEn: '1/4 Acre',
        labelEs: '1/4 Acre',
        subtitleEn: 'Small lot, driveway or stump job',
        subtitleEs: 'Lote pequeño, entrada o tocones',
      },
      {
        id: '0.50',
        acres: 0.5,
        isFivePlus: false,
        isBulkDiscountEligible: false,
        pricingMode: 'fixed',
        labelEn: '1/2 Acre',
        labelEs: '1/2 Acre',
        subtitleEn: 'Residential lot / yard opening',
        subtitleEs: 'Lote residencial o patio',
      },
      {
        id: '1.00',
        acres: 1.0,
        isFivePlus: false,
        isBulkDiscountEligible: false,
        pricingMode: 'fixed',
        labelEn: '1 Acre',
        labelEs: '1 Acre',
        subtitleEn: 'Full 1-acre brush & palmetto clearing',
        subtitleEs: 'Limpieza completa de 1 acre',
      },
      {
        id: '2.00',
        acres: 2.0,
        isFivePlus: false,
        isBulkDiscountEligible: false,
        pricingMode: 'fixed',
        labelEn: '2 Acres',
        labelEs: '2 Acres',
        subtitleEn: 'Homestead, paddock or fence lines',
        subtitleEs: 'Finca, potrero o líneas de cerca',
      },
      {
        id: '5.00',
        acres: 5.0,
        isFivePlus: true,
        isBulkDiscountEligible: true,
        pricingMode: 'perAcre',
        labelEn: '5+ Acres',
        labelEs: '5+ Acres',
        subtitleEn: '12% volume discount · Farm & perimeter clearing',
        subtitleEs: '12% descuento · Fincas y perímetros',
      },
    ],
    densities: [
      {
        id: 'light',
        icon: 'sprout',
        labelEn: 'Light Brush & Tall Weeds',
        labelEs: 'Maleza Ligera y Hierba Alta',
        descriptionEn: 'Overgrown grass, briars, small saplings & fence-line regrowth',
        descriptionEs: 'Pasto crecido, zarzas, brotes pequeños y cercas cubiertas',
        fixedRates: {
          '0.25': [1100, 1300],
          '0.50': [1250, 1550],
          '1.00': [1650, 2100],
          '2.00': [3000, 3800],
        },
        perAcreRange: [1450, 1850],
      },
      {
        id: 'medium',
        icon: 'trees',
        labelEn: 'Medium Palmetto & Understory',
        labelEs: 'Palmetto y Sotos Medios',
        descriptionEn: 'Saw palmetto, dense scrub, vines & trees up to 4"–5" trunk',
        descriptionEs: 'Palmetto, matorral espeso, enredaderas y árboles hasta 4"–5"',
        fixedRates: {
          '0.25': [1200, 1450],
          '0.50': [1450, 1850],
          '1.00': [2100, 2650],
          '2.00': [3900, 4900],
        },
        perAcreRange: [1850, 2350],
      },
      {
        id: 'heavy',
        icon: 'treepine',
        labelEn: 'Heavy Woods, Trees & Storm Debris',
        labelEs: 'Bosque Denso y Árboles Caídos',
        descriptionEn: 'Thick timber, 6"–8"+ hardwoods/pines, windfall & heavy stumps',
        descriptionEs: 'Arboleda cerrada, troncos de 6"–8"+ y daños por tormenta',
        fixedRates: {
          '0.25': [1350, 1650],
          '0.50': [1750, 2250],
          '1.00': [2650, 3400],
          '2.00': [5000, 6400],
        },
        perAcreRange: [2400, 3100],
      },
    ],
    addons: [
      {
        id: 'stumps',
        icon: 'disc',
        price: 450,
        labelEn: 'Stump Grinding & Root Leveling',
        labelEs: 'Triturado de Tocones y Raíces',
        descriptionEn: 'Grind exposed stumps flush with grade for safe tractor or lawn mowing',
        descriptionEs: 'Rebaje de tocones al ras del suelo para podadora o tractor',
      },
      {
        id: 'driveway',
        icon: 'truck',
        price: 550,
        labelEn: 'Driveway & Access Cut-In',
        labelEs: 'Apertura de Camino / Entrada',
        descriptionEn: 'Clear & widen property entrance lanes with overhead limb clearance',
        descriptionEs: 'Apertura y ensanche de camino de acceso y ramas altas',
      },
      {
        id: 'fence',
        icon: 'wrench',
        price: 400,
        labelEn: 'Perimeter & Fence Line Prep',
        labelEs: 'Limpieza de Perímetro y Cercas',
        descriptionEn: 'Clean 12–15 ft access corridor along boundary or pasture fencing',
        descriptionEs: 'Franja limpia de 12–15 pies junto a linderos o cercas',
      },
      {
        id: 'storm',
        icon: 'shovel',
        price: 650,
        labelEn: 'Storm / Hurricane Debris Mulching',
        labelEs: 'Limpieza de Daños por Tormenta',
        descriptionEn: 'Priority clearing of fallen trees, blocked driveways & windfall limbs',
        descriptionEs: 'Despeje prioritario de árboles caídos y accesos bloqueados',
      },
    ],
  },
  sections: {
    hero: {
      trustLine: {
        en: 'High-Flow ASV Skid Steer & Baumalight Mulching · Madison, FL & South GA',
        es: 'Maquinaria ASV de Alto Flujo & Baumalight · Madison, FL y Sur de GA',
      },
      licensedLabel: {
        en: 'Licensed & Insured · 5.0★ Local Rating',
        es: 'Licenciado y Asegurado · Calificación 5.0★',
      },
      spanishBadge: {
        en: 'Se Habla Español',
        es: 'Bilingual Service',
      },
      subheadline: {
        en: 'Fast, low-impact forestry mulching, thick brush removal, driveway cut-ins, and storm cleanup across Madison County, North Florida & Quitman/Valdosta, GA — leaving clean, walkable mulch without burning or hauling.',
        es: 'Triturado forestal rápido y de bajo impacto, desmonte de maleza densa, apertura de entradas y limpieza tras tormentas en Madison, Norte de Florida y Quitman/Valdosta, GA — sin quemas ni acarreo.',
      },
      ctaEstimate: {
        en: 'Calculate Lot Estimate',
        es: 'Calcular Estimado',
      },
      ctaCall: {
        en: 'Call Paul Brown',
        es: 'Llamar a Paul Brown',
      },
      serviceAreaPrefix: {
        en: 'Serving',
        es: 'Área de Servicio',
      },
      formTitle: {
        en: 'Get a Free Site Walkthrough',
        es: 'Solicita Tu Visita Gratis',
      },
      formSubtitle: {
        en: 'Tell us where your land is located and Paul Brown will follow up with scheduling & pricing.',
        es: 'Indícanos dónde está tu terreno y Paul Brown te contactará para coordinar visita y precio.',
      },
    },
    estimator: {
      kicker: {
        en: 'Transparent Instant Budgeting',
        es: 'Presupuesto Instantáneo Transparente',
      },
      title: {
        en: 'Madison Land Clearing & Mulching Estimator',
        es: 'Calculadora de Desmonte y Triturado',
      },
      subtitle: {
        en: 'Estimate single lots, farm acreage, fence perimeters, or driveway cut-ins in seconds.',
        es: 'Calcula lotes residenciales, acres de finca, perímetros de cerca o apertura de caminos en segundos.',
      },
      bulkDiscountBadge: {
        en: '5+ Acres Volume Discount',
        es: 'Descuento por Volumen 5+ Acres',
      },
      disclaimer: {
        en: 'Final pricing depends on hidden wire/metal, terrain slope, stump count, and timber density verified during your free on-site walkthrough.',
        es: 'El precio final depende de cercas enterradas, pendiente, cantidad de tocones y densidad verificada en la visita gratuita.',
      },
      lockFormTitle: {
        en: 'Lock In Your Estimate',
        es: 'Fija Tu Estimado',
      },
      lockFormSubtitle: {
        en: 'Save this range and have Paul Brown contact you to confirm availability.',
        es: 'Guarda este rango para que Paul Brown te confirme disponibilidad en sitio.',
      },
    },
    calendar: {
      kicker: {
        en: 'On-Site Walkthroughs',
        es: 'Inspecciones en Terreno',
      },
      title: {
        en: 'Schedule a Property Site Evaluation',
        es: 'Agenda Tu Evaluación en Sitio',
      },
      subtitle: {
        en: 'Pick a Mon–Fri window (Tue afternoons 12–5 PM) and Paul Brown will walk your property before mobilizing.',
        es: 'Elige un horario de lunes a viernes (martes de 12 a 5 PM) para recorrer tu terreno antes de iniciar.',
      },
    },
    services: {
      kicker: {
        en: 'Capabilities & Equipment',
        es: 'Servicios y Maquinaria',
      },
      title: {
        en: 'High-Output Mulching & Land Clearing Services',
        es: 'Servicios Profesionales de Triturado y Limpieza',
      },
      subtitle: {
        en: 'Powered by an ASV RT-135 tracked loader and Baumalight rotary mulching head — doing in 8 hours what conventional crews quote 60 hours to finish.',
        es: 'Equipados con cargador sobre orugas ASV RT-135 y cabezal triturador Baumalight para avanzar en horas lo que otros tardan días.',
      },
      requestAction: {
        en: 'Request Quote for This Service',
        es: 'Cotizar Este Servicio',
      },
    },
    gallery: {
      kicker: {
        en: 'Proven Local Results',
        es: 'Resultados Reales en la Zona',
      },
      title: {
        en: 'Recent Madison, North FL & South GA Projects',
        es: 'Proyectos Recientes en Madison, FL y Sur de GA',
      },
      subtitle: {
        en: 'Real overgrown lots, farm perimeters, driveways, and storm-damaged properties cleared by Madison Land Clearing & Brush Mulching.',
        es: 'Lotes enmontados, perímetros de fincas, accesos y terrenos dañados por tormentas limpiados por nuestro equipo.',
      },
    },
    reviews: {
      kicker: {
        en: 'Verified 5.0★ Reputation',
        es: 'Reputación Verificada 5.0★',
      },
      title: {
        en: 'What Property Owners Say About Paul Brown',
        es: 'Lo Que Dicen Nuestros Clientes Sobre Paul Brown',
      },
      subtitle: {
        en: '11 five-star Google reviews across Madison, Perry, Live Oak, Monticello & Quitman, GA.',
        es: '11 reseñas de cinco estrellas en Google en Madison, Perry, Live Oak, Monticello y Quitman, GA.',
      },
      leaveReviewNote: {
        en: 'Every review below is an authentic 5-star Google review from local landowners.',
        es: 'Cada reseña mostrada proviene de propietarios locales verificados en Google.',
      },
    },
    faq: {
      kicker: {
        en: 'Common Questions',
        es: 'Preguntas Frecuentes',
      },
      title: {
        en: 'Land Clearing & Mulching FAQ',
        es: 'Preguntas Frecuentes Sobre Triturado',
      },
      subtitle: {
        en: 'Answers about mulching vs. bulldozing, stump removal, hourly vs. project pricing, and service radius.',
        es: 'Respuestas sobre triturado vs. excavación, tocones, tarifas y zonas de cobertura.',
      },
    },
    footer: {
      tagline: {
        en: 'Madison Land Clearing & Brush Mulching — Fast, honest, low-impact forestry mulching in Madison, FL and South Georgia.',
        es: 'Madison Land Clearing & Brush Mulching — Triturado forestal rápido, honesto y de bajo impacto en Madison, FL y el sur de Georgia.',
      },
      rightsReserved: {
        en: 'All rights reserved.',
        es: 'Todos los derechos reservados.',
      },
    },
    assistant: {
      welcomeEn:
        "Hi! I'm Jessica with Madison Land Clearing & Brush Mulching (1680 Duval Pond Rd, Madison, FL). Ask me about pricing, our service areas in North FL & Quitman/Valdosta GA, or schedule a site walk with Paul Brown!",
      welcomeEs:
        '¡Hola! Soy Jessica de Madison Land Clearing & Brush Mulching (1680 Duval Pond Rd, Madison, FL). Pregúntame por precios, zonas de servicio en el Norte de Florida y Quitman/Valdosta, GA, o agenda una visita con Paul Brown.',
      extraInstructions:
        'You are Jessica, the friendly bilingual receptionist for Madison Land Clearing & Brush Mulching owned by Paul Brown. Location: 1680 Duval Pond Rd, Madison, FL 32340. Phone: (850) 973-7179. Hours: Mon, Wed, Thu, Fri 9 AM–5 PM; Tue 12 PM–5 PM; Sat–Sun Closed. Service Area: Madison, Lee, Greenville, Monticello, Perry, Live Oak, Jasper FL, plus Quitman & Valdosta GA. Equipment: ASV RT-135 high-flow track loader with Baumalight forestry mulcher (can do in ~8 hours what smaller crews quote 40-60 hours for, or flexible 8-hour day blocks). Minimum mobilization is $1,100; 1/4 acre ~$1,100–$1,650, 1/2 acre ~$1,250–$2,250, 1 acre ~$1,650–$3,400, 2 acres ~$3,000–$6,400, 5+ acres get a 12% bulk discount ($1,450–$3,100/acre before discount depending on brush/tree density). Always introduce yourself as Jessica and encourage booking a free walkthrough or calling Paul at (850) 973-7179.',
    },
  },
  services: [
    {
      id: 'forestry-mulching',
      number: '01',
      icon: 'trees',
      titleEn: 'Forestry Mulching & Underbrush Clearing',
      titleEs: 'Triturado Forestal y Desmonte de Maleza',
      summaryEn:
        'Single-pass mulching of thick palmetto, briars, scrub, and nuisance saplings into nutrient-rich ground cover—no burn piles or haul-off fees.',
      summaryEs:
        'Triturado en una sola pasada de palmetto, zarzas y matorral denso en abono natural sin quemas ni acarreo.',
      highlightsEn: [
        'Preserves mature oaks & topsoil stability',
        'High-flow ASV + Baumalight mulching head',
        'Ideal for 1/2-acre lots to 40+ acre tracts',
      ],
      highlightsEs: [
        'Protege robles maduros y evita erosión',
        'Cabezal Baumalight de alto rendimiento',
        'Ideal para lotes pequeños o fincas grandes',
      ],
    },
    {
      id: 'driveway-cutins',
      number: '02',
      icon: 'layers',
      titleEn: 'Driveway Cut-Ins & Access Trails',
      titleEs: 'Apertura de Entradas y Caminos',
      summaryEn:
        'Carve clean, passable driveways, hunting trails, and ranch access roads through heavy woods so trucks, trailers, and builders can reach your property.',
      summaryEs:
        'Apertura de entradas vehiculares, senderos de caza y caminos internos entre arboleda densa.',
      highlightsEn: [
        'Full overhead limb clearance for trucks',
        'Clean mulched base with minimal rutting',
        'Fast turnaround (often 1-day completion)',
      ],
      highlightsEs: [
        'Altura libre para camiones y remolques',
        'Base limpia sin zanjas profundas',
        'Entrega rápida frecuentemente en un día',
      ],
    },
    {
      id: 'fence-perimeter',
      number: '03',
      icon: 'shield',
      titleEn: 'Farm, Pasture & Perimeter Clearing',
      titleEs: 'Limpieza de Fincas, Potreros y Cercas',
      summaryEn:
        'Reclaim overgrown pasture edges, fence lines, and 40-acre perimeters for fencing crews, survey access, and livestock management.',
      summaryEs:
        'Recupera potreros, líneas de cerca y perímetros extensos para cercado, topografía y ganado.',
      highlightsEn: [
        'Clean 12–15 ft fence installation lanes',
        'Reclaims unusable farm acreage quickly',
        '12% bulk discount on 5+ acre tracts',
      ],
      highlightsEs: [
        'Franjas limpias de 12–15 pies para cercas',
        'Recupera acres productivos en su finca',
        '12% de descuento en 5+ acres',
      ],
    },
    {
      id: 'stump-grinding',
      number: '04',
      icon: 'disc',
      titleEn: 'Tree Stump & Root Crown Mulching',
      titleEs: 'Rebaje de Tocones y Raíces',
      summaryEn:
        'Eliminate 20+ surface stumps, palmetto clumps, and tripping hazards cleanly so you can finish-mow, bush-hog, or build without obstruction.',
      summaryEs:
        'Eliminamos decenas de tocones expuestos y cepas de palmetto al ras para poder podar o construir.',
      highlightsEn: [
        'Grinds stumps flush to ground level',
        'Leaves yard neat and mower-ready',
        'Can bundle with any acreage job',
      ],
      highlightsEs: [
        'Rebaje al ras del suelo para podadora',
        'Terreno limpio y parejo al instante',
        'Combinable con cualquier limpieza',
      ],
    },
    {
      id: 'storm-cleanup',
      number: '05',
      icon: 'cloud-lightning',
      titleEn: 'Hurricane & Storm Debris Clearing',
      titleEs: 'Emergencias por Huracanes y Tormentas',
      summaryEn:
        'Rapid response after hurricanes and severe storms—clearing downed pines, oaks, and blocked driveways across North Florida and South Georgia.',
      summaryEs:
        'Respuesta rápida tras huracanes para liberar entradas bloqueadas y triturar árboles caídos.',
      highlightsEn: [
        'Priority driveway & access reopening',
        'Turns downed limbs into clean mulch',
        'Trusted during Hurricane Helene recovery',
      ],
      highlightsEs: [
        'Apertura prioritaria de entradas bloqueadas',
        'Convierte ramas caídas en cobertura limpia',
        'Experiencia comprobada tras el huracán Helene',
      ],
    },
    {
      id: 'homesite-prep',
      number: '06',
      icon: 'wheat',
      titleEn: 'Homesite Prep & Lot Opening',
      titleEs: 'Preparación de Lotes para Construcción',
      summaryEn:
        'Open your buildable pad, septic clearing zone, and yard visibility while keeping desirable shade trees intact for your new home or barn.',
      summaryEs:
        'Despeja el área de construcción, fosa séptica y jardín conservando los árboles de sombra que desees.',
      highlightsEn: [
        'Selective clearing around keeper trees',
        'Ready for surveyors & site builders',
        'Zero smoke or debris-burning permits',
      ],
      highlightsEs: [
        'Limpieza selectiva preservando árboles clave',
        'Listo para topógrafos y constructores',
        'Sin permisos de quema ni humo',
      ],
    },
  ],
  workPhotos: [
    {
      id: 'madison-fb-5',
      url: '/assets/madison/fb-5.jpg',
      titleEn: 'Heavy Timber & Brush Mulching',
      titleEs: 'Triturado en Arboleda y Maleza Densa',
      locationEn: 'Madison, FL',
      locationEs: 'Madison, FL',
      captionEn: 'ASV track loader opening dense pine and hardwood understory cleanly.',
      captionEs: 'Cargador sobre orugas ASV abriendo paso limpio entre maleza densa y árboles.',
    },
    {
      id: 'madison-fb-1',
      url: '/assets/madison/fb-1.jpg',
      titleEn: 'Residential Acreage Opened Up',
      titleEs: 'Apertura de Terreno Residencial',
      locationEn: 'Madison County, FL',
      locationEs: 'Condado de Madison, FL',
      captionEn: 'Thick overgrown yard transformed into clean, usable park-like ground.',
      captionEs: 'Terreno cerrado transformado en espacio limpio, amplio y utilizable.',
    },
    {
      id: 'madison-fb-2',
      url: '/assets/madison/fb-2.jpg',
      titleEn: 'Driveway & Woodland Trail Clearing',
      titleEs: 'Apertura de Entrada y Sendero',
      locationEn: 'Lee / Madison, FL',
      locationEs: 'Lee / Madison, FL',
      captionEn: 'Clean vehicle access cut cleanly back into wooded acreage.',
      captionEs: 'Camino vehicular abierto con precisión hacia el interior del terreno.',
    },
    {
      id: 'madison-fb-3',
      url: '/assets/madison/fb-3.jpg',
      titleEn: 'Palmetto & Scrub Eradication',
      titleEs: 'Eliminación de Palmetto y Matorral',
      locationEn: 'Monticello, FL',
      locationEs: 'Monticello, FL',
      captionEn: 'Low-impact forestry mulching removing heavy palmetto while keeping shade oaks.',
      captionEs: 'Triturado de bajo impacto eliminando palmetto mientras se conservan robles.',
    },
    {
      id: 'madison-fb-4',
      url: '/assets/madison/fb-4.jpg',
      titleEn: 'Farm & Pasture Edge Clearing',
      titleEs: 'Limpieza de Borde de Finca y Potrero',
      locationEn: 'Quitman, GA',
      locationEs: 'Quitman, GA',
      captionEn: 'Reclaiming encroaching brush along pasture and boundary fence lines.',
      captionEs: 'Recuperación de pastizales y franjas de cerca invadidas por maleza.',
    },
    {
      id: 'madison-fb-6',
      url: '/assets/madison/fb-6.jpg',
      titleEn: 'Perimeter & Property Line Finish',
      titleEs: 'Acabado de Perímetro y Linderos',
      locationEn: 'Perry, FL',
      locationEs: 'Perry, FL',
      captionEn: 'Even, walkable wood-chip mulch layer with zero burn piles left behind.',
      captionEs: 'Capa uniforme de viruta natural sin montones de quema ni zanjas.',
    },
    {
      id: 'madison-maps-1',
      url: '/assets/madison/maps-1.jpg',
      titleEn: 'Before & After Lot Transformation',
      titleEs: 'Transformación Completa del Lote',
      locationEn: 'Madison, FL',
      locationEs: 'Madison, FL',
      captionEn: 'Thick tree and brush encroachment opened up within the same week of calling.',
      captionEs: 'Maleza y árboles cerrados despejados en la misma semana de contacto.',
    },
    {
      id: 'madison-maps-2',
      url: '/assets/madison/maps-2.jpg',
      titleEn: 'Stump & Palmetto Cleanout',
      titleEs: 'Limpieza de Tocones y Palmetto',
      locationEn: 'Live Oak, FL',
      locationEs: 'Live Oak, FL',
      captionEn: '20+ stumps and heavy palmetto ground flush for clean property maintenance.',
      captionEs: 'Más de 20 tocones y palmetto rebajados al ras para mantenimiento fácil.',
    },
    {
      id: 'madison-maps-3',
      url: '/assets/madison/maps-3.jpg',
      titleEn: 'Storm Damage & Access Recovery',
      titleEs: 'Recuperación de Acceso tras Tormenta',
      locationEn: 'Madison / Valdosta Area',
      locationEs: 'Área Madison / Valdosta',
      captionEn: 'Rapid clearing of fallen timber blocking driveways after severe storms.',
      captionEs: 'Despeje rápido de árboles caídos que bloqueaban el acceso tras tormentas.',
    },
  ],
  reviews: [
    {
      id: 'rev-franklin-hernandez',
      author: 'Franklin Hernandez',
      location: 'Madison, FL Area',
      rating: 5,
      dateEn: '1 year ago',
      dateEs: 'Hace 1 año',
      textEn:
        'Amazing work!! The work was done in the same week as we contacted them and they took care of us. My property now seems a lot bigger because of it. Attached are before and after pictures of when we had all the trees on our land. Thanks again and highly recommend!!',
      textEs:
        '¡Trabajo increíble! Lo realizaron en la misma semana en que los contactamos y nos atendieron excelente. Mi propiedad ahora se ve muchísimo más grande. Muy recomendados.',
    },
    {
      id: 'rev-joel-rodgers',
      author: 'Joel Rodgers',
      location: 'Madison, FL Area',
      rating: 5,
      dateEn: '3 years ago',
      dateEs: 'Hace 3 años',
      textEn:
        'Paul Brown is an excellent person to work with. Very professional and courteous. Paul helped me clear a driveway back to my property and mulched through some thick brush and trees. His machine is superior to anyone else’s in the area. Paul was able to get my entire job done and then some in 8 hours. Another local company quoted me 60 hours! The mulching head on his skid steer is amazing. I highly recommend him and his company.',
      textEs:
        'Paul Brown es excelente para trabajar, muy profesional y amable. Me abrió una entrada hacia mi propiedad y trituró maleza espesa y árboles. Terminó todo en 8 horas cuando otra empresa me cotizó 60 horas. Muy recomendado.',
    },
    {
      id: 'rev-e',
      author: 'E',
      location: 'Local Client',
      rating: 5,
      dateEn: '3 years ago',
      dateEs: 'Hace 3 años',
      textEn:
        'I recently had the pleasure of using Paul Brown Mulching Service for my property, and I must say, I’m thoroughly impressed! He showed up on time and was super easy to work with. All my neighbors have asked for his cards. I plan on hiring him for more.',
      textEs:
        'Recientemente contraté a Paul Brown para mi propiedad y quedé totalmente impresionado. Llegó puntual y fue muy fácil trabajar con él. Todos mis vecinos pidieron su tarjeta.',
    },
    {
      id: 'rev-gordon-wardell',
      author: 'Gordon Wardell',
      location: '40-Acre Parcel',
      rating: 5,
      dateEn: '2 years ago',
      dateEs: 'Hace 2 años',
      textEn:
        'Paul from Madison Land Clearing is amazing. I contacted him by phone and we scheduled a time to perform the work. He arrived early and was prepared for work. He cleared a heavily wooded area along the perimeter of the 40 acres. Impressive!',
      textEs:
        'Paul de Madison Land Clearing es increíble. Llegó temprano y preparado, y limpió un área muy boscosa a lo largo del perímetro de las 40 acres. ¡Impresionante!',
    },
    {
      id: 'rev-kathy-waterman',
      author: 'Kathy Waterman',
      location: 'Madison, FL Area',
      rating: 5,
      dateEn: '3 years ago',
      dateEs: 'Hace 3 años',
      textEn:
        'Paul is an honest, hard-working contractor, reasonable priced and worth every penny. I would highly recommend their services.',
      textEs:
        'Paul es un contratista honesto y trabajador, con precios razonables que valen cada centavo. Recomiendo ampliamente sus servicios.',
    },
    {
      id: 'rev-eric-v',
      author: 'Eric V',
      location: 'Hurricane Helene Recovery',
      rating: 5,
      dateEn: '2 years ago',
      dateEs: 'Hace 2 años',
      textEn:
        'My property suffered major damage during hurricane Helene, several trees down, my driveway was completely cut off. I called Paul, he came out the next day and had the driveway completely cleared again very quickly. I highly recommend Madison land Clearing & Brush mulching.',
      textEs:
        'Mi propiedad sufrió daños graves por el huracán Helene y mi entrada quedó totalmente bloqueada por árboles caídos. Llamé a Paul, vino al día siguiente y despejó la entrada rapidísimo. Los recomiendo mucho.',
    },
    {
      id: 'rev-arthur-chouinard',
      author: 'Arthur Chouinard',
      location: 'Local Farm',
      rating: 5,
      dateEn: '1 year ago',
      dateEs: 'Hace 1 año',
      textEn:
        'I recently had the pleasure of hiring Paul Brown of Madison Mulching to clear approximately 4 acres in different areas of our farm. He did an amazing job at a great price.',
      textEs:
        'Contraté a Paul Brown de Madison Mulching para limpiar aproximadamente 4 acres en distintas áreas de nuestra finca. Hizo un trabajo increíble a un excelente precio.',
    },
    {
      id: 'rev-dave-kern',
      author: 'Dave Kern',
      location: 'Madison, FL Area',
      rating: 5,
      dateEn: '1 year ago',
      dateEs: 'Hace 1 año',
      textEn:
        'Paul came out with his mulching machine and did 20+ tree stumps and some palmetto and brush. He did a very clean and professional job! Highly recommend using him.',
      textEs:
        'Paul vino con su trituradora e hizo más de 20 tocones, palmetto y maleza. Hizo un trabajo muy limpio y profesional. Muy recomendado.',
    },
    {
      id: 'rev-paul-gasner',
      author: 'Paul Gasner',
      location: 'Madison, FL Area',
      rating: 5,
      dateEn: '3 years ago',
      dateEs: 'Hace 3 años',
      textEn:
        'These guys cut in our driveway, they made quick work of the trees and shrubs in the way. Very happy!',
      textEs:
        'Abrieron nuestra entrada rápidamente, despejando los árboles y arbustos en el camino. ¡Muy contentos!',
    },
    {
      id: 'rev-latasha-johnson',
      author: 'Latasha Johnson',
      location: 'Quitman, GA',
      rating: 5,
      dateEn: '3 years ago',
      dateEs: 'Hace 3 años',
      textEn: 'We are in Quitman GA.. very good work.',
      textEs: 'Estamos en Quitman, GA... muy buen trabajo.',
    },
    {
      id: 'rev-haley',
      author: 'Haley',
      location: 'Madison, FL',
      rating: 5,
      dateEn: '3 years ago',
      dateEs: 'Hace 3 años',
      textEn: 'The best in town. Great work!',
      textEs: 'Los mejores del pueblo. ¡Excelente trabajo!',
    },
  ],
  faqs: [
    {
      id: 'faq-areas',
      questionEn: 'What areas do you serve around Madison, FL?',
      questionEs: '¿Qué zonas cubren alrededor de Madison, FL?',
      answerEn:
        'We are based at 1680 Duval Pond Rd, Madison, FL 32340 and serve Madison County, Lee, Greenville, Monticello, Perry, Live Oak, Jasper, and nearby South Georgia communities including Quitman and Valdosta.',
      answerEs:
        'Nuestra base está en 1680 Duval Pond Rd, Madison, FL 32340 y cubrimos todo el condado de Madison, Lee, Greenville, Monticello, Perry, Live Oak, Jasper y el sur de Georgia incluyendo Quitman y Valdosta.',
    },
    {
      id: 'faq-mulching',
      questionEn: 'Why forestry mulching instead of bulldozing and burning?',
      questionEs: '¿Por qué elegir triturado forestal en lugar de bulldozer y quema?',
      answerEn:
        'Forestry mulching grinds brush, palmetto, and small trees right in place into a clean organic mulch blanket. There are no giant burn piles, no costly dump truck haul-off fees, and your valuable topsoil stays intact without washouts.',
      answerEs:
        'El triturado forestal convierte la maleza y árboles pequeños en abono natural en el mismo sitio, sin montones para quemar, sin costos de acarreo y sin dañar la capa fértil del suelo.',
    },
    {
      id: 'faq-pricing',
      questionEn: 'How is pricing structured—by the job or in 8-hour day blocks?',
      questionEs: '¿Cómo cobran: por proyecto completo o por bloques de 8 horas?',
      answerEn:
        'We offer transparent fixed-project quotes after a free walkthrough as well as productive 8-hour machine blocks for large tracts. Because our high-flow ASV RT-135 & Baumalight head works fast, an 8-hour run regularly clears what smaller rigs quote 40–60 hours to do.',
      answerEs:
        'Ofrecemos precio fijo tras una visita gratuita o bloques de 8 horas para terrenos amplios. Nuestro equipo ASV RT-135 con cabezal Baumalight avanza en 8 horas lo que máquinas menores cotizan en 40–60 horas.',
    },
    {
      id: 'faq-stumps',
      questionEn: 'Can you grind existing tree stumps and clear storm damage?',
      questionEs: '¿Pueden rebajar tocones existentes y limpiar daños de tormenta?',
      answerEn:
        'Yes. We routinely mulch down exposed stumps flush to ground level, open blocked driveways after hurricanes or windstorms, and clear fence lines for farms and residential properties.',
      answerEs:
        'Sí. Rebajamos tocones al ras del suelo, abrimos entradas bloqueadas por huracanes o tormentas y limpiamos perímetros para cercas en fincas y residencias.',
    },
  ],
};

export function createStarterTemplateCms(): SiteCmsData {
  const clone = structuredClone(defaultSiteCms);
  clone.updatedAt = new Date().toISOString();
  return clone;
}

export function getDensityPreviewForLot(
  density: CmsDensityOption,
  lot?: CmsLotSizeOption
): { min: number; max: number; isPerAcre: boolean } {
  if (!lot || lot.pricingMode === 'perAcre') {
    return {
      min: density.perAcreRange[0],
      max: density.perAcreRange[1],
      isPerAcre: true,
    };
  }

  const fixed = density.fixedRates[lot.id];
  if (fixed) {
    return {
      min: fixed[0],
      max: fixed[1],
      isPerAcre: false,
    };
  }

  return {
    min: Math.round(density.perAcreRange[0] * lot.acres),
    max: Math.round(density.perAcreRange[1] * lot.acres),
    isPerAcre: false,
  };
}

export function calculateDynamicLotEstimate(
  pricing: CmsPricingConfig,
  lotSizeId: string,
  densityId: string,
  selectedAddonIds: string[]
): DynamicLotEstimateResult {
  const lot =
    pricing.lotSizes.find((item) => item.id === lotSizeId) ?? pricing.lotSizes[0];
  const density =
    pricing.densities.find((item) => item.id === densityId) ?? pricing.densities[0];

  if (!lot || !density) {
    const minFee = pricing.minimumMobilizationFee || 1100;
    return {
      baseMin: minFee,
      baseMax: minFee,
      discountMin: 0,
      discountMax: 0,
      clearingMin: minFee,
      clearingMax: minFee,
      addonsTotal: 0,
      totalMin: minFee,
      totalMax: minFee,
      hasBulkDiscount: false,
      isFivePlus: false,
      isPerAcreRate: false,
      perAcreRange: [minFee, minFee],
    };
  }

  const isPerAcreRate = lot.pricingMode === 'perAcre';
  const fixed = density.fixedRates[lot.id];
  const rawBaseMin = isPerAcreRate || !fixed
    ? Math.round(density.perAcreRange[0] * lot.acres)
    : fixed[0];
  const rawBaseMax = isPerAcreRate || !fixed
    ? Math.round(density.perAcreRange[1] * lot.acres)
    : fixed[1];

  const baseMin = Math.max(pricing.minimumMobilizationFee, rawBaseMin);
  const baseMax = Math.max(baseMin, rawBaseMax);

  const hasBulkDiscount = Boolean(lot.isBulkDiscountEligible && pricing.bulkDiscountRate > 0);
  const discountMin = hasBulkDiscount ? Math.round(baseMin * pricing.bulkDiscountRate) : 0;
  const discountMax = hasBulkDiscount ? Math.round(baseMax * pricing.bulkDiscountRate) : 0;

  const clearingMin = Math.max(pricing.minimumMobilizationFee, baseMin - discountMin);
  const clearingMax = Math.max(clearingMin, baseMax - discountMax);

  const addonsTotal = selectedAddonIds.reduce((sum, id) => {
    const addon = pricing.addons.find((item) => item.id === id);
    return sum + (addon ? addon.price : 0);
  }, 0);

  return {
    baseMin,
    baseMax,
    discountMin,
    discountMax,
    clearingMin,
    clearingMax,
    addonsTotal,
    totalMin: clearingMin + addonsTotal,
    totalMax: clearingMax + addonsTotal,
    hasBulkDiscount,
    isFivePlus: Boolean(lot.isFivePlus),
    isPerAcreRate,
    perAcreRange: density.perAcreRange,
  };
}
