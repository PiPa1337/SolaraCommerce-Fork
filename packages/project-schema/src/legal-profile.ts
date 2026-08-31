import { z } from "zod";

/** Referencias normativas fijas del perfil soportado por el producto. */
export const ARGENTINA_LEGAL_PROFILE = {
  countryCode: "AR",
  countryName: "Argentina",
  jurisdiction: "República Argentina",
  privacyLaw: {
    label: "Ley 25.326 de Protección de Datos Personales",
    href: "https://www.argentina.gob.ar/normativa/nacional/ley-25326-64790",
  },
  privacyAuthority: {
    label: "Agencia de Acceso a la Información Pública",
    href: "https://www.argentina.gob.ar/aaip",
  },
  consumerLaw: {
    label: "Ley 24.240 de Defensa del Consumidor",
    href: "https://www.argentina.gob.ar/normativa/nacional/ley-24240-638",
  },
  consumerAuthority: {
    label: "Defensa del Consumidor",
    href: "https://www.argentina.gob.ar/defensa-del-consumidor",
  },
  withdrawal: {
    label: "Derecho de arrepentimiento",
    defaultDays: 10,
    reference: "art. 34 Ley 24.240",
    href: "https://www.argentina.gob.ar/defensa-del-consumidor",
  },
} as const;

export const LegalProfileSchema = z.object({
  countryCode: z.literal(ARGENTINA_LEGAL_PROFILE.countryCode).default("AR"),
  revisionAt: z.string().datetime().optional(),
  taxId: z.string().max(120).default(""),
  jurisdiction: z.string().max(200).default(""),
  paymentMethods: z.array(z.string().min(1).max(120)).max(12).default([]),
  salesChannels: z.array(z.string().min(1).max(120)).max(12).default([]),
  consumerRights: z
    .object({
      enabled: z.boolean().default(true),
    })
    .default({ enabled: true }),
  privacyOverride: z.string().default(""),
  termsOverride: z.string().default(""),
});

export type LegalProfile = z.infer<typeof LegalProfileSchema>;

type LegalProject = {
  createdAt: string;
  legalProfile?: Partial<LegalProfile> | null;
  policies: { countryNames?: Record<string, string> };
};

export function resolveLegalRevisionAt(
  project: Pick<LegalProject, "createdAt" | "legalProfile">,
): string {
  return project.legalProfile?.revisionAt ?? project.createdAt;
}

export function formatLegalRevisionAt(
  project: Pick<LegalProject, "createdAt" | "legalProfile">,
): string {
  return resolveLegalRevisionAt(project).slice(0, 10);
}

export function resolveLegalCountryName(
  project: Pick<LegalProject, "policies">,
  countryCode: string,
): string | undefined {
  const configuredName = project.policies.countryNames?.[countryCode]?.trim();
  return (
    configuredName ||
    (countryCode === ARGENTINA_LEGAL_PROFILE.countryCode
      ? ARGENTINA_LEGAL_PROFILE.countryName
      : undefined)
  );
}

export function unresolvedLegalCountryCodes(
  project: Pick<LegalProject, "policies">,
  countryCodes: readonly string[],
): string[] {
  return countryCodes.filter((countryCode) => !resolveLegalCountryName(project, countryCode));
}

export function formatLegalCountryCoverage(
  project: Pick<LegalProject, "policies">,
  countryCodes: readonly string[],
): string {
  return countryCodes
    .map((countryCode) => resolveLegalCountryName(project, countryCode) ?? countryCode)
    .join(", ");
}
