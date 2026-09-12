import { describe, expect, it } from "vitest";

import { GRAVITY_FRAGMENT_SHADER } from "./gravity-cinematic-shader";
import { clampGravitySceneDelta } from "./GravityField";

describe("lente gravitacional de Gargantua", () => {
  it("intensifica progresivamente la lente durante el viaje hacia el agujero negro", () => {
    expect(GRAVITY_FRAGMENT_SHADER).toContain(".038*50.0*uLensStrength");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("smoothstep(.16,.94,launch)");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("1.0+7.0*launchLens*launchLens");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("2.55+launchLens*1.15");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("mix(1.65,1.08,launchLens)");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("lensArgument/(1.0+lensArgument)");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("smoothstep(.12,.97,launch)");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("mix(1.0,.54,plunge*plunge)");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("1.0+1.20*smoothstep(.18,.72,launch)");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("uDisk.x * .48 * gargantuaScale");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("tangent*plungeShear");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("right*diskQ.x + up*diskQ.y");
  });

  it("permite quitar la envolvente casi estática en todo el disco sin quitar el gas", () => {
    expect(GRAVITY_FRAGMENT_SHADER).toContain("uStaticDiskDetails");
    expect(GRAVITY_FRAGMENT_SHADER).toContain(
      "float staticEnvelopeMix = uStaticDiskDetails * mix(1.0,uLensedStaticEnvelopeEnabled,lensedPass);",
    );
  });

  it("expone por separado los otros cuatro mecanismos visuales del disco", () => {
    expect(GRAVITY_FRAGMENT_SHADER).toContain("uniform float uDustBeltEnabled;");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("uniform float uProceduralDetailEnabled;");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("uniform float uDiskWarpEnabled;");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("uniform float uLensedSecondaryEnabled;");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("uDustIntensity * uDustBeltEnabled");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("*uProceduralDetailEnabled");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("(warp-.5)*.09*uDiskWarpEnabled");
    expect(GRAVITY_FRAGMENT_SHADER).toContain(
      "lensed * mix(lowerBreakup,3.6,upper) * uLensedSecondaryEnabled",
    );
  });

  it("expone veinticinco mecanismos adicionales del disco inferior para diagnóstico visual", () => {
    const uniforms = [
      "uCloudEnvelopeEnabled",
      "uErosionEnabled",
      "uLaneBrightnessEnabled",
      "uStreamersEnabled",
      "uHotRimEnabled",
      "uGasCloudBrightnessEnabled",
      "uStreaksEnabled",
      "uTemperatureCloudModulationEnabled",
      "uDensityEnvelopeEnabled",
      "uDensityLaneAbsorptionEnabled",
      "uGasCloudStructureEnabled",
      "uOrbitalLanePatternEnabled",
      "uLensedBreakupEnabled",
      "uLensedBaseEmissionEnabled",
      "uLensedDensityMaskEnabled",
      "uLensedGlowCloudEnabled",
      "uBroadWispsEnabled",
      "uLensedStaticEnvelopeEnabled",
      "uRimCloudModulationEnabled",
      "uFarSideDiskEnabled",
      "uNearSideDiskEnabled",
      "uThermalColorEnabled",
      "uRadialHeatEnabled",
      "uDepthAbsorptionEnabled",
      "uLayerCorrugationEnabled",
    ];
    for (const uniform of uniforms) {
      expect(GRAVITY_FRAGMENT_SHADER).toContain(`uniform float ${uniform};`);
    }
    expect(GRAVITY_FRAGMENT_SHADER).toContain("uCloudEnvelopeEnabled");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("uErosionEnabled");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("uLaneBrightnessEnabled");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("uStreamersEnabled");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("uHotRimEnabled");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("uGasCloudBrightnessEnabled");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("uStreaksEnabled");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("uTemperatureCloudModulationEnabled");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("envelope*.9*uDensityEnvelopeEnabled");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("(1.0-lanes)*.8*uDensityLaneAbsorptionEnabled");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("float cloudBase = mix(.5,gas.x,uGasCloudStructureEnabled);");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("lanes=mix(.5,lanes,uOrbitalLanePatternEnabled);");
    expect(GRAVITY_FRAGMENT_SHADER).toContain(
      "mix(1.0,mix(.24,.95,lowerLanes),uLensedBreakupEnabled)",
    );
    expect(GRAVITY_FRAGMENT_SHADER).toContain(
      "vec3 lensed = lensedGas.rgb * arcVisibility * merge * uLensedBaseEmissionEnabled;",
    );
    expect(GRAVITY_FRAGMENT_SHADER).toContain(
      "float lensedDensityMask = mix(1.0,smoothstep(.15,.8,lensedGas.a),uLensedDensityMaskEnabled);",
    );
    expect(GRAVITY_FRAGMENT_SHADER).toContain("broadWisps *= uBroadWispsEnabled;");
    expect(GRAVITY_FRAGMENT_SHADER).toContain(
      "float staticEnvelopeMix = uStaticDiskDetails * mix(1.0,uLensedStaticEnvelopeEnabled,lensedPass);",
    );
    expect(GRAVITY_FRAGMENT_SHADER).toContain(
      "mix(.5,texture(uDust,lensedOrbit*.06+vec2(t*.0002,0)).r,uLensedGlowCloudEnabled)",
    );
    expect(GRAVITY_FRAGMENT_SHADER).toContain("color += behind*uFarSideDiskEnabled;");
    expect(GRAVITY_FRAGMENT_SHADER).toContain(
      "float nearTransmission = mix(1.0,frontTransmission,uNearSideDiskEnabled);",
    );
    expect(GRAVITY_FRAGMENT_SHADER).toContain(
      "vec3 temperature = mix(vec3(1.0),thermalColor,uThermalColorEnabled);",
    );
    expect(GRAVITY_FRAGMENT_SHADER).toContain("float heat = mix(1.0,heatFalloff,uRadialHeatEnabled);");
    expect(GRAVITY_FRAGMENT_SHADER).toContain(
      "float density = inner*outer*mix(.18,depthAbsorption,uDepthAbsorptionEnabled);",
    );
    expect(GRAVITY_FRAGMENT_SHADER).toContain(
      "* uDiskWarpEnabled*uLayerCorrugationEnabled;",
    );
    expect(GRAVITY_FRAGMENT_SHADER).toContain(
      "mix(.5,noise(rotate(t*.037)*criticalDirection*7.0),uRimCloudModulationEnabled)",
    );
  });

  it("permite quitar sólo las nubes de erosión de la imagen secundaria lenteada", () => {
    expect(GRAVITY_FRAGMENT_SHADER).toContain("uniform float uLensedErosionCloudsEnabled;");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("vec4 matter(vec2 orbit, float t, float lensedPass)");
    expect(GRAVITY_FRAGMENT_SHADER).toContain(
      "float erosionGas = mix(cloudBase,0.0,lensedPass*(1.0-uLensedErosionCloudsEnabled));",
    );
    expect(GRAVITY_FRAGMENT_SHADER).toContain("vec4 gas = matter(orbit,t,0.0);");
    expect(GRAVITY_FRAGMENT_SHADER).toContain("vec4 lensedGas = matter(lensedOrbit,t,1.0);");
  });

  it("limita el salto temporal después de un stall del GPU", () => {
    expect(clampGravitySceneDelta(116, 100)).toBe(16);
    expect(clampGravitySceneDelta(250, 100)).toBe(34);
    expect(clampGravitySceneDelta(90, 100)).toBe(0);
  });
});
