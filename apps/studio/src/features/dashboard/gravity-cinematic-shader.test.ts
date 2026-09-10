import { describe, expect, it } from "vitest";

import { GRAVITY_FRAGMENT_SHADER } from "./gravity-cinematic-shader";
import { clampGravitySceneDelta } from "./GravityField";

describe("lente gravitacional de Gargantua", () => {
  it("amplifica la base interna y concentra la desviacion cerca del agujero negro", () => {
    expect(GRAVITY_FRAGMENT_SHADER).toContain(".038*50.0*uLensStrength");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("1.0-smoothstep(.82,2.35,radial)");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("lensArgument/(1.0+lensArgument)");
  });

  it("permite animar los detalles lejanos del disco sin quitar el gas", () => {
    expect(GRAVITY_FRAGMENT_SHADER).toContain("uStaticDiskDetails");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("float distantDetails = smoothstep(2.6,4.8,r);");
    expect(GRAVITY_FRAGMENT_SHADER).toContain(
      "mix(staticEnvelope,gas.x,(1.0-uStaticDiskDetails)*distantDetails)",
    );
  });

  it("limita el salto temporal después de un stall del GPU", () => {
    expect(clampGravitySceneDelta(116, 100)).toBe(16);
    expect(clampGravitySceneDelta(250, 100)).toBe(34);
    expect(clampGravitySceneDelta(90, 100)).toBe(0);
  });
});
