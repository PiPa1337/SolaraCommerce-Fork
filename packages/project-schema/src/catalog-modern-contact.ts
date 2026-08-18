import type { StoreSection } from "./index";

export const contactDefaultQuickLinks = [
  {
    id: "contact-quick-whatsapp",
    icon: "chat",
    title: "Respondemos por WhatsApp",
    body: "La forma más rápida de obtener ayuda.",
    href: "#contact-form",
    actionLabel: "Consultar",
  },
  {
    id: "contact-quick-general",
    icon: "question",
    title: "Consultas generales",
    body: "Respondemos tus dudas por email.",
    href: "#contact-channels",
    actionLabel: "Consultar",
  },
  {
    id: "contact-quick-order",
    icon: "truck",
    title: "Seguimiento de pedidos",
    body: "Consultá el estado de tu compra.",
    href: "#contact-form",
    actionLabel: "Consultar",
  },
  {
    id: "contact-quick-changes",
    icon: "change",
    title: "Cambios y devoluciones",
    body: "Te guiamos en cada paso del proceso.",
    href: "#contact-faq",
    actionLabel: "Consultar",
  },
] as const;

export const contactDefaultReasons = [
  { id: "contact-reason-product", value: "Consulta de producto" },
  { id: "contact-reason-order", value: "Estado de pedido" },
  { id: "contact-reason-change", value: "Cambios y devoluciones" },
  { id: "contact-reason-other", value: "Otra consulta" },
] as const;

export const contactDefaultHelpItems = [
  {
    id: "contact-help-product",
    icon: "bag",
    title: "Comprar un producto",
    body: "Consultá sobre talles, stock, medios de pago y más.",
    href: "#contact-form",
    actionLabel: "Más información",
  },
  {
    id: "contact-help-order",
    icon: "box",
    title: "Mi pedido",
    body: "Estado, seguimiento y detalles de tu compra.",
    href: "#contact-form",
    actionLabel: "Más información",
  },
  {
    id: "contact-help-changes",
    icon: "change",
    title: "Cambios y devoluciones",
    body: "Políticas, plazos y pasos para gestionar tu cambio.",
    href: "#contact-faq",
    actionLabel: "Más información",
  },
  {
    id: "contact-help-other",
    icon: "chat",
    title: "Otra consulta",
    body: "Otro tema o consulta no listada aquí.",
    href: "#contact-form",
    actionLabel: "Más información",
  },
] as const;

export const contactDefaultPurchaseItems = [
  {
    id: "contact-purchase-shipping",
    icon: "truck",
    title: "Envíos",
    body: "Realizamos envíos a todo el país. Conocé costos y tiempos.",
    href: "#contact-form",
    actionLabel: "Más información",
  },
  {
    id: "contact-purchase-payment",
    icon: "box",
    title: "Pagos",
    body: "Aceptamos tarjetas, transferencias y otros medios de pago.",
    href: "#contact-form",
    actionLabel: "Más información",
  },
  {
    id: "contact-purchase-changes",
    icon: "change",
    title: "Cambios",
    body: "Tenés 30 días para cambios. Conocé nuestras políticas.",
    href: "#contact-faq",
    actionLabel: "Más información",
  },
] as const;

export const contactDefaultFaqItems = [
  {
    id: "contact-faq-buy",
    question: "¿Cómo realizo una compra?",
    answer: "Escribinos por WhatsApp, elegí tus productos y coordinamos el pedido con vos.",
    enabled: true,
  },
  {
    id: "contact-faq-order",
    question: "¿Cómo consulto el estado de mi pedido?",
    answer: "Enviános tu número de pedido por WhatsApp y te contamos en qué estado se encuentra.",
    enabled: true,
  },
  {
    id: "contact-faq-shipping",
    question: "¿Hacen envíos?",
    answer: "Coordinamos envíos a todo el país y confirmamos el costo antes de finalizar.",
    enabled: true,
  },
  {
    id: "contact-faq-change",
    question: "¿Cómo solicito un cambio?",
    answer: "Escribinos dentro del plazo indicado y te guiamos con los pasos necesarios.",
    enabled: true,
  },
  {
    id: "contact-faq-stock",
    question: "¿Puedo consultar disponibilidad antes de comprar?",
    answer: "Sí, podés consultarnos por talle, color y stock antes de confirmar.",
    enabled: true,
  },
  {
    id: "contact-faq-whatsapp",
    question: "¿Cómo me comunico por WhatsApp?",
    answer: "Usá cualquier botón de WhatsApp de esta página para iniciar una conversación.",
    enabled: true,
  },
] as const;

const defaultContactMotion: StoreSection["motion"] = {
  preset: "fade-up",
  intensity: 4,
  direction: "up",
  distance: 18,
  duration: 0.45,
  delay: 0,
  stagger: 0.08,
  easing: "cubic-bezier(.16,1,.3,1)",
  entryPoint: 0.2,
  once: true,
};

const section = (
  id: string,
  moduleId: string,
  settings: Record<string, unknown>,
  enabled = true,
): StoreSection => ({
  id: id as StoreSection["id"],
  slot: "content",
  moduleId,
  enabled,
  settings,
  motion: { ...defaultContactMotion },
});

export function defaultContactV2Sections(): StoreSection[] {
  return [
    section("contact-section-hero", "contact-hero", {
      eyebrow: "HABLEMOS",
      title: "Estamos para ayudarte.",
      body: "Respondemos consultas, disponibilidad y detalles de entrega por canales directos.",
      actionLabel: "Escribinos",
      actionHref: "#contact-form",
      imageAssetId: "asset-contact-hero",
      quickLinks: [],
    }),
    section("contact-section-form", "contact-form", {
      title: "Escribinos",
      body: "Completá el formulario y nuestro equipo te responderá a la brevedad.",
      showPhone: true,
      showOrderNumber: true,
      nameLabel: "Nombre",
      emailLabel: "Email",
      phoneLabel: "Teléfono",
      reasonLabel: "Motivo de consulta",
      orderNumberLabel: "Número de pedido (opcional)",
      messageLabel: "Mensaje",
      submitLabel: "Enviar consulta",
      reasons: [...contactDefaultReasons],
    }),
    section("contact-section-channels", "contact-channels", {
      title: "Nuestros canales",
      body: "Elegí el canal que prefieras para comunicarte con nosotros.",
      showWhatsapp: true,
      showEmail: true,
      showPhone: true,
      showAddress: true,
      showHours: true,
      hoursText: "Lunes a viernes de 9 a 18 hs.\nSábados de 10 a 14 hs.",
      whatsappActionLabel: "Escribir ahora",
      emailActionLabel: "Enviar email",
      phoneActionLabel: "Llamar ahora",
      addressActionLabel: "Ver en mapa",
      hoursActionLabel: "Ver horarios",
    }),
    section("contact-section-whatsapp", "contact-whatsapp-cta", {
      title: "¿Preferís hablar directamente?",
      body: "Consultanos por WhatsApp y coordinamos tu compra de forma personalizada.",
      actionLabel: "Iniciar conversación",
    }),
    section("contact-section-purchase", "contact-purchase-info", {
      items: structuredClone(contactDefaultPurchaseItems),
    }),
    section("contact-section-faq", "contact-faq", {
      title: "Preguntas frecuentes",
      body: "Respondemos las dudas más comunes.",
      items: structuredClone(contactDefaultFaqItems),
    }),
    section(
      "contact-section-location",
      "contact-location",
      {
        enabled: false,
        title: "Visitanos",
        body: "Conocé nuestro espacio y probá lo que te representa.",
        address: "",
        hoursText: "",
        imageAssetId: "",
        mapHref: "",
        mapImageAssetId: "",
      },
      false,
    ),
  ];
}

/**
 * Home V2 termina con los mismos módulos de contacto que la página dedicada,
 * pero con ids propios para que el Constructor pueda editarlos sin mezclar
 * ambas superficies.
 */
export function defaultHomeContactSections(): StoreSection[] {
  return [
    section("home-section-contact-form", "contact-form", {
      title: "Escribinos",
      body: "Completá el formulario y nuestro equipo te responderá a la brevedad.",
      showPhone: true,
      showOrderNumber: true,
      nameLabel: "Nombre",
      emailLabel: "Email",
      phoneLabel: "Teléfono",
      reasonLabel: "Motivo de consulta",
      orderNumberLabel: "Número de pedido (opcional)",
      messageLabel: "Mensaje",
      submitLabel: "Enviar consulta",
      reasons: [...contactDefaultReasons],
    }),
    section("home-section-contact-channels", "contact-channels", {
      title: "Nuestros canales",
      body: "Elegí el canal que prefieras para comunicarte con nosotros.",
      showWhatsapp: true,
      showEmail: true,
      showPhone: true,
      showAddress: true,
      showHours: true,
      hoursText: "Lunes a viernes de 9 a 18 hs.\nSábados de 10 a 14 hs.",
      whatsappActionLabel: "Escribir ahora",
      emailActionLabel: "Enviar email",
      phoneActionLabel: "Llamar ahora",
      addressActionLabel: "Ver en mapa",
      hoursActionLabel: "Ver horarios",
    }),
  ];
}
