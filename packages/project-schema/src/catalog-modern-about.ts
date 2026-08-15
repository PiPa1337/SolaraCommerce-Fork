import type { AssetId, StoreSection } from "./index";

export const aboutDefaultHistoryParagraphs = [
  {
    id: "about-history-1",
    body: "Nació de una idea simple: elegir mejor, sin llenar de ruido el camino.",
  },
  {
    id: "about-history-2",
    body: "Recorremos marcas, materiales y detalles para encontrar piezas que se usan, se disfrutan y permanecen.",
  },
  {
    id: "about-history-3",
    body: "Compartimos una selección pequeña para que comprar se sienta claro, directo y personal.",
  },
] as const;

export const aboutDefaultPrinciples = [
  {
    id: "about-principle-selection",
    number: "01",
    icon: "spark",
    title: "Selección",
    body: "Elegimos productos que realmente sumaríamos a nuestro día a día.",
  },
  {
    id: "about-principle-quality",
    number: "02",
    icon: "shield",
    title: "Calidad",
    body: "Priorizamos materiales, terminaciones y durabilidad.",
  },
  {
    id: "about-principle-simplicity",
    number: "03",
    icon: "minus",
    title: "Simplicidad",
    body: "Una experiencia de compra directa y sin complicaciones.",
  },
  {
    id: "about-principle-attention",
    number: "04",
    icon: "chat",
    title: "Atención",
    body: "Hablás directamente con nosotros cuando lo necesitás.",
  },
] as const;

export const aboutDefaultProcess = [
  {
    id: "about-process-discover",
    number: "01",
    title: "Descubrimos",
    body: "Buscamos marcas, materiales e ideas con algo para decir.",
    href: "",
  },
  {
    id: "about-process-evaluate",
    number: "02",
    title: "Evaluamos",
    body: "Probamos, comparamos y miramos cada detalle.",
    href: "",
  },
  {
    id: "about-process-select",
    number: "03",
    title: "Seleccionamos",
    body: "Nos quedamos con lo que cumple y merece un lugar.",
    href: "",
  },
  {
    id: "about-process-share",
    number: "04",
    title: "Compartimos",
    body: "Lo acercamos a vos con información clara.",
    href: "/buscar/",
  },
] as const;

export const aboutDefaultExperience = [
  {
    id: "about-experience-direct",
    icon: "bag",
    title: "Compra directa",
    body: "Elegís sin vueltas y coordinás con nosotros.",
  },
  {
    id: "about-experience-attention",
    icon: "user",
    title: "Atención personalizada",
    body: "Respondemos cada consulta de forma cercana.",
  },
  {
    id: "about-experience-shipping",
    icon: "truck",
    title: "Envíos",
    body: "Coordinamos entregas a todo el país.",
  },
  {
    id: "about-experience-clear",
    icon: "eye",
    title: "Información clara",
    body: "Sabés qué estás eligiendo antes de comprar.",
  },
] as const;

export const aboutDefaultStats = [
  {
    id: "about-stat-products",
    icon: "spark",
    title: "Productos seleccionados",
    body: "Una curaduría con intención.",
  },
  {
    id: "about-stat-shipping",
    icon: "truck",
    title: "Envíos a todo el país",
    body: "Coordinamos cada entrega.",
  },
  {
    id: "about-stat-direct",
    icon: "chat",
    title: "Compra directa",
    body: "Sin intermediarios innecesarios.",
  },
  {
    id: "about-stat-attention",
    icon: "user",
    title: "Atención personalizada",
    body: "Estamos para ayudarte.",
  },
] as const;

export const aboutDefaultTeam = [
  {
    id: "about-team-sofia",
    imageAssetId: "asset-about-team-sofia",
    name: "Sofía",
    role: "Selección",
    body: "Recorro marcas y materiales para encontrar piezas que tengan sentido.",
  },
  {
    id: "about-team-martin",
    imageAssetId: "asset-about-team-martin",
    name: "Martín",
    role: "Atención y envíos",
    body: "Estoy del otro lado para responder consultas y coordinar cada entrega.",
  },
] as const;

export const catalogModernV2EditorialAssets = [
  {
    kind: "image" as const,
    id: "asset-about-hero" as AssetId,
    name: "Retrato editorial de la marca",
    alt: "Retrato editorial de una mujer con una campera clara",
    mimeType: "image/jpeg",
    source:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=1200&h=1800&q=85",
    width: 1200,
    height: 1800,
    hash: "remote-unsplash-about-hero",
  },
  {
    kind: "image" as const,
    id: "asset-about-editorial" as AssetId,
    name: "Texturas de la selección",
    alt: "Prendas de textura natural ordenadas en una selección editorial",
    mimeType: "image/jpeg",
    source:
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&h=1000&q=85",
    width: 1600,
    height: 1000,
    hash: "remote-unsplash-about-editorial",
  },
  {
    kind: "image" as const,
    id: "asset-about-team-sofia" as AssetId,
    name: "Sofía",
    alt: "Retrato editorial de Sofía",
    mimeType: "image/jpeg",
    source:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&h=1000&q=85",
    width: 800,
    height: 1000,
    hash: "remote-unsplash-about-team-sofia",
  },
  {
    kind: "image" as const,
    id: "asset-about-team-martin" as AssetId,
    name: "Martín",
    alt: "Retrato editorial de Martín",
    mimeType: "image/jpeg",
    source:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&h=1000&q=85",
    width: 800,
    height: 1000,
    hash: "remote-unsplash-about-team-martin",
  },
  {
    kind: "image" as const,
    id: "asset-contact-hero" as AssetId,
    name: "Atención cercana",
    alt: "Personas conversando en un espacio de trabajo luminoso",
    mimeType: "image/jpeg",
    source:
      "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&h=1800&q=85",
    width: 1200,
    height: 1800,
    hash: "remote-unsplash-contact-hero",
  },
] as const;

const defaultAboutMotion: StoreSection["motion"] = {
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
  motion: { ...defaultAboutMotion },
});

export function defaultAboutV2Sections(): StoreSection[] {
  return [
    section("about-section-hero", "about-hero", {
      eyebrow: "NUESTRA MIRADA",
      title: "Una selección pensada para moverte.",
      body: "Elegimos piezas con intención para acompañar tu forma de vivir.",
      actionLabel: "Explorar selección",
      actionHref: "/buscar/",
      imageAssetId: "asset-about-hero",
    }),
    section("about-section-history", "about-history", {
      title: "Cómo empezó todo",
      paragraphs: structuredClone(aboutDefaultHistoryParagraphs),
      year: "DESDE 2026",
      city: "BUENOS AIRES",
      country: "ARGENTINA",
    }),
    section("about-section-principles", "about-principles", {
      title: "Lo que nos guía",
      items: structuredClone(aboutDefaultPrinciples),
    }),
    section("about-section-editorial-image", "about-editorial-image", {
      enabled: true,
      eyebrow: "NUESTRA FORMA DE ELEGIR",
      title: "Menos ruido. Mejores elecciones.",
      body: "Buscamos piezas que tengan sentido, se usen de verdad y puedan quedarse con vos.",
      imageAssetId: "asset-about-editorial",
    }),
    section("about-section-process", "about-process", {
      title: "Cómo seleccionamos",
      items: structuredClone(aboutDefaultProcess),
    }),
    section("about-section-manifesto", "about-manifesto", {
      quote: "No buscamos tener de todo. Buscamos tener lo que vale la pena.",
      accentLabel: "Nuestra manera de hacer las cosas",
    }),
    section("about-section-experience", "about-experience", {
      title: "La experiencia",
      items: structuredClone(aboutDefaultExperience),
    }),
    section("about-section-team", "about-team", {
      enabled: true,
      title: "Detrás de la tienda",
      items: structuredClone(aboutDefaultTeam),
    }),
    section("about-section-stats", "about-stats", {
      items: structuredClone(aboutDefaultStats),
    }),
    section("about-section-products-cta", "about-products-cta", {
      title: "Conocé nuestra selección.",
      body: "Encontrá piezas elegidas para acompañarte todos los días.",
      actionLabel: "Explorar productos",
      actionHref: "/buscar/",
    }),
  ];
}
