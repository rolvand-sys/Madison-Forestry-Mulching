export type Language = 'en' | 'es';

export interface ScopeChip {
  label: string;
  line: string;
}

export interface StandardTermItem {
  title: string;
  body: string;
}

export interface TranslationSchema {
  nav: {
    estimator: string;
    schedule: string;
    services: string;
    ourWork: string;
    reviews: string;
    faq: string;
    callNow: string;
    openMenu: string;
    closeMenu: string;
  };
  hero: {
    googleReviewsSuffix: string;
    serviceFocusLabel: string;
    nameLabel: string;
    namePlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    locationLabel: string;
    locationPlaceholder: string;
    acreageLabel: string;
    acreageOptions: string[];
    submitButton: string;
    validationError: string;
    successTitle: string;
    successMessage: string;
    successReset: string;
  };
  estimator: {
    step1Title: string;
    step2Title: string;
    step3Title: string;
    step3Optional: string;
    outputTitle: string;
    baseClearingLabel: string;
    addonsRowLabel: string;
    perAcreSuffix: string;
    mobileAddonsShort: string;
    mobileJumpToSummary: string;
    nameLabel: string;
    namePlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    addressLabel: string;
    addressPlaceholder: string;
    timelineLabel: string;
    timelineOptions: string[];
    lockSubmitButton: string;
    validationError: string;
    confirmedTitle: string;
    confirmedSubtitle: string;
    summaryAcreage: string;
    summaryDensity: string;
    summaryAddons: string;
    noAddonsSelected: string;
    summaryEstimate: string;
    summaryContact: string;
    summaryTimeline: string;
    adjustEstimateAction: string;
  };
  gallery: {
    zoomLabel: string;
    fallbackLabel: string;
    closeLightbox: string;
    prevPhoto: string;
    nextPhoto: string;
  };
  reviews: {
    googleBadge: string;
  };
  footer: {
    contactTitle: string;
    hoursTitle: string;
    serviceAreaTitle: string;
    navigationTitle: string;
    ownerAgendaButton: string;
    contractorToolButton: string;
  };
  contractorTool: {
    pinModalTitle: string;
    pinModalSubtitle: string;
    closePinModal: string;
    pinLabel: string;
    pinError: string;
    unlockButton: string;
    generatorTitle: string;
    fieldQuoteLabel: string;
    downloadPdfButton: string;
    lockButton: string;
    closeGenerator: string;
    tabEdit: string;
    tabPreview: string;
    clientNameLabel: string;
    clientNamePlaceholder: string;
    clientNameFallback: string;
    clientContactLabel: string;
    clientContactPlaceholder: string;
    clientContactFallback: string;
    propertyAddressLabel: string;
    propertyAddressPlaceholder: string;
    propertyAddressFallback: string;
    parcelLocationLabel: string;
    acreageLabel: string;
    acreagePlaceholder: string;
    estimatedAreaPrefix: string;
    tbdLabel: string;
    validForLabel: string;
    validForPlaceholder: string;
    validForPrefix: string;
    validPrefix: string;
    scopeLabel: string;
    tapChipsHint: string;
    scopeChips: ScopeChip[];
    scopePlaceholder: string;
    scopeFallback: string;
    detailedScopeHeading: string;
    totalPriceLabel: string;
    depositPercentLabel: string;
    depositDueLabel: string;
    balanceDueLabel: string;
    termsIncludedNote: string;
    serviceAreaPrefix: string;
    proposalHeading: string;
    quoteNumberPrefix: string;
    issuedLabel: string;
    preparedForLabel: string;
    quoteSummaryHeading: string;
    totalQuotedPriceLabel: string;
    depositDuePrefix: string;
    balanceUponCompletionLabel: string;
    standardTermsHeading: string;
    standardTerms: StandardTermItem[];
    clientSignatureLabel: string;
    dateLabel: string;
    preparedByPrefix: string;
    licensedContractorNote: string;
    authorizedContractorLabel: string;
  };
}

export const translations: Record<Language, TranslationSchema> = {
  en: {
    nav: {
      estimator: 'Lot Estimator',
      schedule: 'Site Visit',
      services: 'Services',
      ourWork: 'Our Work',
      reviews: 'Reviews',
      faq: 'FAQ',
      callNow: 'Call',
      openMenu: 'Open navigation menu',
      closeMenu: 'Close navigation menu',
    },
    hero: {
      googleReviewsSuffix: 'Verified Google Reviews',
      serviceFocusLabel: 'Requested Service',
      nameLabel: 'Your Name',
      namePlaceholder: 'e.g. Franklin Hernandez',
      phoneLabel: 'Phone Number',
      phonePlaceholder: '(850) 555-0199',
      locationLabel: 'Property Address or City',
      locationPlaceholder: 'e.g. Madison, FL or Quitman, GA',
      acreageLabel: 'Estimated Acreage',
      acreageOptions: [
        'Under 1/2 Acre',
        '1/2 – 1 Acre',
        '1 – 2.5 Acres',
        '2.5 – 5 Acres',
        '5+ Acres / Farm / Perimeter',
      ],
      submitButton: 'Request Free On-Site Estimate',
      validationError: 'Please enter your name, a valid phone number, and property location.',
      successTitle: 'Site-Visit Request Received',
      successMessage:
        'Paul Brown will call you shortly to confirm your walkthrough and acreage estimate.',
      successReset: 'Submit another property',
    },
    estimator: {
      step1Title: '1. Select Lot Size / Acreage',
      step2Title: '2. Select Vegetation & Brush Density',
      step3Title: '3. Optional Add-Ons',
      step3Optional: 'Optional',
      outputTitle: 'Estimated Project Investment',
      baseClearingLabel: 'Forestry Mulching',
      addonsRowLabel: 'Selected Add-Ons',
      perAcreSuffix: '/ acre',
      mobileAddonsShort: 'add-ons',
      mobileJumpToSummary: 'View Summary',
      nameLabel: 'Full Name',
      namePlaceholder: 'e.g. Joel Rodgers',
      phoneLabel: 'Phone Number',
      phonePlaceholder: '(850) 555-0142',
      addressLabel: 'Property Address / Parcel ID',
      addressPlaceholder: '1680 Duval Pond Rd, Madison, FL',
      timelineLabel: 'Preferred Timeline',
      timelineOptions: [
        'As soon as possible (This week)',
        'Within 2 – 4 weeks',
        'Planning / Future project (1–3 months)',
      ],
      lockSubmitButton: 'Lock In Estimate & Request Site Visit',
      validationError: 'Please enter your name, a valid 7+ digit phone number, and property address.',
      confirmedTitle: 'Estimate Locked & Logged',
      confirmedSubtitle:
        'Paul Brown’s team will review your parcel details and follow up to schedule your site walk.',
      summaryAcreage: 'Acreage',
      summaryDensity: 'Density',
      summaryAddons: 'Add-Ons',
      noAddonsSelected: 'None selected',
      summaryEstimate: 'Estimated Range',
      summaryContact: 'Contact Details',
      summaryTimeline: 'Timeline',
      adjustEstimateAction: 'Adjust Estimate Parameters',
    },
    gallery: {
      zoomLabel: 'Enlarge project photo',
      fallbackLabel: 'Madison Project',
      closeLightbox: 'Close photo viewer',
      prevPhoto: 'Previous photo',
      nextPhoto: 'Next photo',
    },
    reviews: {
      googleBadge: 'Google Review',
    },
    footer: {
      contactTitle: 'Contact & Yard',
      hoursTitle: 'Operating Hours',
      serviceAreaTitle: 'Service Area',
      navigationTitle: 'Quick Links',
      ownerAgendaButton: 'Owner Agenda',
      contractorToolButton: 'Field Quote PDF',
    },
    contractorTool: {
      pinModalTitle: 'Contractor Field Quote Access',
      pinModalSubtitle: 'Enter your 4-digit contractor PIN to create or print a client proposal PDF.',
      closePinModal: 'Close PIN dialog',
      pinLabel: 'Contractor PIN',
      pinError: 'Invalid contractor PIN. Please verify and try again.',
      unlockButton: 'Unlock Field Quote Tool',
      generatorTitle: 'Field Quote & Proposal Builder',
      fieldQuoteLabel: 'Field Quote',
      downloadPdfButton: 'Print / Save PDF',
      lockButton: 'Lock Tool',
      closeGenerator: 'Close quote builder',
      tabEdit: 'Edit Details',
      tabPreview: 'Proposal Preview',
      clientNameLabel: 'Client Name',
      clientNamePlaceholder: 'e.g. Gordon Wardell',
      clientNameFallback: 'Property Owner',
      clientContactLabel: 'Client Phone / Email',
      clientContactPlaceholder: '(850) 555-0188',
      clientContactFallback: 'Phone / Email on file',
      propertyAddressLabel: 'Property Address / Parcel',
      propertyAddressPlaceholder: 'Madison County / Quitman, GA',
      propertyAddressFallback: 'Property location TBD',
      parcelLocationLabel: 'Project Site',
      acreageLabel: 'Acreage / Scope Size',
      acreagePlaceholder: 'e.g. 4.00 Acres',
      estimatedAreaPrefix: 'Cleared Area',
      tbdLabel: 'TBD',
      validForLabel: 'Quote Valid For',
      validForPlaceholder: '14 Days',
      validForPrefix: 'Valid for',
      validPrefix: 'Valid',
      scopeLabel: 'Scope of Work',
      tapChipsHint: 'Tap chips to insert',
      scopeChips: [
        {
          label: 'Forestry Mulching',
          line: '• High-flow forestry mulching of thick underbrush, palmetto, briars & saplings up to 6"–8" DBH.',
        },
        {
          label: 'Driveway / Access',
          line: '• Clear and widen driveway/access lane and overhead canopy for vehicle and equipment entry.',
        },
        {
          label: 'Fence & Perimeter',
          line: '• Clear fence lines and property boundary perimeter cleanly without disturbing soil grade.',
        },
        {
          label: 'Storm Cleanup',
          line: '• Cut, clear, and mulch storm-downed trees, limbs, and windfall debris.',
        },
        {
          label: 'Stump Grinding',
          line: '• Surface-grind exposed stumps and root crowns flush for mowing and pasture prep.',
        },
      ],
      scopePlaceholder: 'Describe trees, brush density, trails, fence lines, and finish expectations...',
      scopeFallback: 'Forestry mulching and brush clearing per on-site walkthrough.',
      detailedScopeHeading: 'Detailed Scope of Work',
      totalPriceLabel: 'Total Quoted Price ($)',
      depositPercentLabel: 'Deposit (%)',
      depositDueLabel: 'Deposit Due',
      balanceDueLabel: 'Balance Upon Completion',
      termsIncludedNote: 'Standard North FL / South GA land clearing terms included automatically.',
      serviceAreaPrefix: 'Service Area',
      proposalHeading: 'Written Estimate & Proposal',
      quoteNumberPrefix: 'Quote #',
      issuedLabel: 'Issued',
      preparedForLabel: 'Prepared For',
      quoteSummaryHeading: 'Investment Summary',
      totalQuotedPriceLabel: 'Total Quoted Investment',
      depositDuePrefix: 'Deposit Due to Schedule',
      balanceUponCompletionLabel: 'Balance Due Upon Completion',
      standardTermsHeading: 'Standard Land Clearing Terms & Conditions',
      standardTerms: [
        {
          title: 'Underground & Boundary Marking:',
          body: 'Client is responsible for marking property corners, septic tanks, drainfields, well heads, irrigation lines, and private utilities prior to mobilization.',
        },
        {
          title: 'Low-Impact Mulching Finish:',
          body: 'Forestry mulching leaves a protective layer of organic wood mulch on grade without burning, hauling, or topsoil stripping unless otherwise specified.',
        },
        {
          title: 'Hidden Metal / Wire:',
          body: 'Buried fencing, concrete, or scrap metal discovered in dense brush may require work-around or adjustment to protect carbide mulching teeth.',
        },
        {
          title: 'Weather & Payment Terms:',
          body: 'Scheduling is weather-dependent for ground stability. Final balance is due immediately upon walkthrough and completion of work.',
        },
      ],
      clientSignatureLabel: 'Client Signature',
      dateLabel: 'Date',
      preparedByPrefix: 'Prepared by',
      licensedContractorNote: 'Licensed & Insured Forestry Mulching',
      authorizedContractorLabel: 'Authorized Contractor',
    },
  },
  es: {
    nav: {
      estimator: 'Cotizador',
      schedule: 'Agendar Visita',
      services: 'Servicios',
      ourWork: 'Trabajos',
      reviews: 'Reseñas',
      faq: 'Preguntas',
      callNow: 'Llamar',
      openMenu: 'Abrir menú de navegación',
      closeMenu: 'Cerrar menú de navegación',
    },
    hero: {
      googleReviewsSuffix: 'Reseñas Verificadas en Google',
      serviceFocusLabel: 'Servicio Solicitado',
      nameLabel: 'Tu Nombre',
      namePlaceholder: 'Ej. Franklin Hernandez',
      phoneLabel: 'Número de Teléfono',
      phonePlaceholder: '(850) 555-0199',
      locationLabel: 'Dirección o Ciudad del Terreno',
      locationPlaceholder: 'Ej. Madison, FL o Quitman, GA',
      acreageLabel: 'Tamaño Aproximado',
      acreageOptions: [
        'Menos de 1/2 Acre',
        '1/2 – 1 Acre',
        '1 – 2.5 Acres',
        '2.5 – 5 Acres',
        '5+ Acres / Finca / Perímetro',
      ],
      submitButton: 'Solicitar Presupuesto Gratis en Sitio',
      validationError: 'Por favor ingresa tu nombre, un teléfono válido y la ubicación del terreno.',
      successTitle: 'Solicitud Recibida',
      successMessage:
        'Paul Brown te llamará pronto para confirmar tu inspección y cotización exacta.',
      successReset: 'Enviar otro terreno',
    },
    estimator: {
      step1Title: '1. Selecciona el Tamaño del Terreno',
      step2Title: '2. Densidad de Maleza y Vegetación',
      step3Title: '3. Servicios Adicionales',
      step3Optional: 'Opcional',
      outputTitle: 'Inversión Estimada del Proyecto',
      baseClearingLabel: 'Desmonte y Triturado',
      addonsRowLabel: 'Adicionales Seleccionados',
      perAcreSuffix: '/ acre',
      mobileAddonsShort: 'extras',
      mobileJumpToSummary: 'Ver Resumen',
      nameLabel: 'Nombre Completo',
      namePlaceholder: 'Ej. Joel Rodgers',
      phoneLabel: 'Número de Teléfono',
      phonePlaceholder: '(850) 555-0142',
      addressLabel: 'Dirección o Parcela del Terreno',
      addressPlaceholder: '1680 Duval Pond Rd, Madison, FL',
      timelineLabel: 'Fecha Deseada',
      timelineOptions: [
        'Lo antes posible (Esta semana)',
        'En 2 – 4 semanas',
        'Planeación / Proyecto futuro (1–3 meses)',
      ],
      lockSubmitButton: 'Fijar Estimado y Solicitar Visita',
      validationError: 'Ingresa tu nombre, teléfono válido de 7+ dígitos y dirección del terreno.',
      confirmedTitle: 'Estimado Registrado',
      confirmedSubtitle:
        'El equipo de Paul Brown revisará los datos de tu parcela y te contactará para coordinar la visita.',
      summaryAcreage: 'Superficie',
      summaryDensity: 'Densidad',
      summaryAddons: 'Adicionales',
      noAddonsSelected: 'Ninguno seleccionado',
      summaryEstimate: 'Rango Estimado',
      summaryContact: 'Datos de Contacto',
      summaryTimeline: 'Plazo',
      adjustEstimateAction: 'Ajustar Parámetros del Estimado',
    },
    gallery: {
      zoomLabel: 'Ampliar foto del proyecto',
      fallbackLabel: 'Proyecto Madison',
      closeLightbox: 'Cerrar visor de fotos',
      prevPhoto: 'Foto anterior',
      nextPhoto: 'Foto siguiente',
    },
    reviews: {
      googleBadge: 'Reseña Google',
    },
    footer: {
      contactTitle: 'Contacto y Base',
      hoursTitle: 'Horario de Atención',
      serviceAreaTitle: 'Área de Servicio',
      navigationTitle: 'Navegación',
      ownerAgendaButton: 'Agenda Dueño',
      contractorToolButton: 'PDF Cotización',
    },
    contractorTool: {
      pinModalTitle: 'Acceso para Contratista',
      pinModalSubtitle: 'Ingresa tu PIN de 4 dígitos para generar e imprimir una propuesta en PDF.',
      closePinModal: 'Cerrar ventana de PIN',
      pinLabel: 'PIN de Contratista',
      pinError: 'PIN incorrecto. Verifica e intenta de nuevo.',
      unlockButton: 'Desbloquear Generador PDF',
      generatorTitle: 'Generador de Propuesta en Campo',
      fieldQuoteLabel: 'Cotización',
      downloadPdfButton: 'Imprimir / Guardar PDF',
      lockButton: 'Bloquear',
      closeGenerator: 'Cerrar generador',
      tabEdit: 'Editar Datos',
      tabPreview: 'Vista Previa PDF',
      clientNameLabel: 'Nombre del Cliente',
      clientNamePlaceholder: 'Ej. Gordon Wardell',
      clientNameFallback: 'Propietario del Terreno',
      clientContactLabel: 'Teléfono / Correo del Cliente',
      clientContactPlaceholder: '(850) 555-0188',
      clientContactFallback: 'Contacto en archivo',
      propertyAddressLabel: 'Dirección / Parcela',
      propertyAddressPlaceholder: 'Condado Madison / Quitman, GA',
      propertyAddressFallback: 'Ubicación por confirmar',
      parcelLocationLabel: 'Sitio del Proyecto',
      acreageLabel: 'Acres / Superficie',
      acreagePlaceholder: 'Ej. 4.00 Acres',
      estimatedAreaPrefix: 'Área a Limpiar',
      tbdLabel: 'Por definir',
      validForLabel: 'Validez de Cotización',
      validForPlaceholder: '14 Días',
      validForPrefix: 'Válida por',
      validPrefix: 'Válida',
      scopeLabel: 'Alcance del Trabajo',
      tapChipsHint: 'Toca para agregar',
      scopeChips: [
        {
          label: 'Triturado Forestal',
          line: '• Triturado forestal de maleza densa, palmetto, zarzas y árboles pequeños hasta 6"–8" DBH.',
        },
        {
          label: 'Acceso / Entrada',
          line: '• Apertura y ensanche de camino de acceso y despeje de ramas altas para vehículos.',
        },
        {
          label: 'Cercas y Perímetro',
          line: '• Limpieza limpia de líneas de cerca y perímetro sin alterar la nivelación del suelo.',
        },
        {
          label: 'Daños por Tormenta',
          line: '• Corte, retiro y triturado de árboles caídos y escombros de huracán o tormenta.',
        },
        {
          label: 'Destoconado',
          line: '• Triturado superficial de tocones expuestos al ras para facilitar corte de césped.',
        },
      ],
      scopePlaceholder: 'Describe árboles, maleza, accesos, cercas y acabado esperado...',
      scopeFallback: 'Triturado forestal y limpieza de maleza según inspección en sitio.',
      detailedScopeHeading: 'Alcance Detallado del Trabajo',
      totalPriceLabel: 'Precio Total Cotizado ($)',
      depositPercentLabel: 'Anticipo (%)',
      depositDueLabel: 'Anticipo Requerido',
      balanceDueLabel: 'Saldo al Finalizar',
      termsIncludedNote: 'Incluye términos estándar de desmonte para Norte de FL / Sur de GA.',
      serviceAreaPrefix: 'Área de Servicio',
      proposalHeading: 'Estimado y Propuesta Escrita',
      quoteNumberPrefix: 'Cotización #',
      issuedLabel: 'Emitida',
      preparedForLabel: 'Preparado Para',
      quoteSummaryHeading: 'Resumen de Inversión',
      totalQuotedPriceLabel: 'Inversión Total Cotizada',
      depositDuePrefix: 'Anticipo para Agendar',
      balanceUponCompletionLabel: 'Saldo al Completar el Trabajo',
      standardTermsHeading: 'Términos y Condiciones Estándar',
      standardTerms: [
        {
          title: 'Marcado de Servicios y Linderos:',
          body: 'El cliente es responsable de señalar esquinas de parcela, fosas sépticas, pozos, líneas de riego y servicios subterráneos privados antes de iniciar.',
        },
        {
          title: 'Acabado de Bajo Impacto:',
          body: 'El triturado forestal deja una capa orgánica protectora sobre el terreno sin quemas, acarreo ni remoción de tierra fértil salvo indicación contraria.',
        },
        {
          title: 'Metales o Alambres Ocultos:',
          body: 'Cercas enterradas, concreto o chatarra ocultos entre la maleza pueden requerir rodeo o ajuste para proteger los dientes de carburo.',
        },
        {
          title: 'Clima y Pago:',
          body: 'La programación depende de condiciones estables del suelo. El saldo final se liquida al concluir e inspeccionar el trabajo.',
        },
      ],
      clientSignatureLabel: 'Firma del Cliente',
      dateLabel: 'Fecha',
      preparedByPrefix: 'Preparado por',
      licensedContractorNote: 'Contratista Licenciado y Asegurado',
      authorizedContractorLabel: 'Contratista Autorizado',
    },
  },
};
