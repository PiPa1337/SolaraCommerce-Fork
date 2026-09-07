import type { StoreSection } from "./index";

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

/** Sección de contacto que vive únicamente dentro de Home. */
export function defaultHomeContactSections(): StoreSection[] {
  return [
    section("home-section-contact-form", "contact-form", {
      title: "Escribinos",
      body: "Completá el formulario y nuestro equipo te responderá a la brevedad.",
      showPhone: true,
      nameLabel: "Nombre",
      emailLabel: "Email",
      phoneLabel: "Teléfono",
      messageLabel: "Mensaje",
      emailActionLabel: "Enviar por Email",
      whatsappActionLabel: "Enviar por WhatsApp",
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
