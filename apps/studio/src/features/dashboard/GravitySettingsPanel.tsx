import { ArrowCounterClockwise, FloppyDisk, X } from "@phosphor-icons/react";
import { useEffect, useId, useRef } from "react";
import type { GravityTelemetrySnapshot } from "./GravityField";
import {
  GRAVITY_NUMERIC_SETTINGS,
  GRAVITY_PRESET_IDS,
  GRAVITY_PRESET_META,
  GRAVITY_PRESETS,
  GRAVITY_TAA_QUALITY_IDS,
  GRAVITY_TAA_QUALITY_META,
  type GravityPresetId,
  type GravitySettings,
  type GravityTaaQuality,
  type NumericGravitySetting,
} from "./gravitySettings";

interface GravitySettingsPanelProps {
  id: string;
  open: boolean;
  settings: GravitySettings;
  customPresets: Array<GravitySettings | null>;
  selectedCustomPreset: number;
  activeCustomPreset: number | null;
  onChange(setting: NumericGravitySetting, value: number): void;
  onSelectBuiltInPreset(settings: GravitySettings): void;
  onSelectCustomPreset(index: number): void;
  onSaveCustomPreset(): void;
  onTaaQualityChange(value: GravityTaaQuality): void;
  telemetry: GravityTelemetrySnapshot | null;
  onTogglePauseWhenHidden(value: boolean): void;
  onReset(): void;
  onClose(): void;
}

interface RangeSettingProps {
  setting: NumericGravitySetting;
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format(value: number): string;
  onChange(setting: NumericGravitySetting, value: number): void;
}

const CUSTOM_PRESET_SLOTS = [
  { id: "gravity-custom-preset-0", index: 0 },
  { id: "gravity-custom-preset-1", index: 1 },
  { id: "gravity-custom-preset-2", index: 2 },
] as const;

function getActivePreset(settings: GravitySettings): GravityPresetId | undefined {
  return GRAVITY_PRESET_IDS.find((presetId) => {
    const preset = GRAVITY_PRESETS[presetId];
    return (
      GRAVITY_NUMERIC_SETTINGS.every((setting) => settings[setting] === preset[setting]) &&
      settings.pauseWhenHidden === preset.pauseWhenHidden &&
      settings.taaQuality === preset.taaQuality
    );
  });
}

function RangeSetting({
  setting,
  label,
  hint,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: RangeSettingProps) {
  const id = useId();

  return (
    <div className="dashboard-gargantua-settings__range">
      <div className="dashboard-gargantua-settings__range-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{format(value)}</output>
      </div>
      <input
        id={id}
        data-testid={`gravity-setting-${setting}`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(setting, Number(event.target.value))}
      />
      <p>{hint}</p>
    </div>
  );
}

function formatTelemetryUsage(value: number | null, telemetry: GravityTelemetrySnapshot | null) {
  if (!telemetry) return "Midiendo…";
  return value === null ? "N/D" : `${Math.round(value)}%`;
}

export function GravitySettingsPanel({
  id,
  open,
  settings,
  customPresets,
  selectedCustomPreset,
  activeCustomPreset,
  onChange,
  onSelectBuiltInPreset,
  onSelectCustomPreset,
  onSaveCustomPreset,
  onTaaQualityChange,
  telemetry,
  onTogglePauseWhenHidden,
  onReset,
  onClose,
}: GravitySettingsPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const activePreset = getActivePreset(settings);
  const activePresetLabel =
    activeCustomPreset === null
      ? activePreset
        ? GRAVITY_PRESET_META[activePreset].label
        : "Personalizada"
      : `Usuario ${activeCustomPreset + 1}`;

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <aside
      id={id}
      className="dashboard-gargantua-settings"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <header className="dashboard-gargantua-settings__header">
        <div>
          <h1 id={titleId}>Ajustes del fondo</h1>
          <p id={descriptionId}>
            Afiná la calidad del campo gravitacional en vivo. El resto del dashboard queda oculto
            mientras ajustás estos valores.
          </p>
        </div>
        <button
          ref={closeButtonRef}
          className="dashboard-gargantua-settings__close"
          type="button"
          aria-label="Cerrar ajustes del fondo"
          title="Cerrar ajustes"
          onClick={onClose}
        >
          <X aria-hidden size={18} />
        </button>
      </header>

      <div className="dashboard-gargantua-settings__body">
        <div className="dashboard-gargantua-settings__body-main">
          <section
            className="dashboard-gargantua-settings__section"
            aria-labelledby={`${titleId}-quality`}
          >
            <div className="dashboard-gargantua-settings__section-head">
              <h2 id={`${titleId}-quality`}>Calidad de render</h2>
              <span className="dashboard-gargantua-settings__status">{activePresetLabel}</span>
            </div>
            <div className="dashboard-gargantua-settings__presets">
              {GRAVITY_PRESET_IDS.map((presetId) => {
                const preset = GRAVITY_PRESET_META[presetId];
                return (
                  <button
                    key={presetId}
                    className="dashboard-gargantua-settings__preset"
                    type="button"
                    aria-pressed={activePreset === presetId}
                    onClick={() => onSelectBuiltInPreset(GRAVITY_PRESETS[presetId])}
                  >
                    <strong>{preset.label}</strong>
                    <span>{preset.description}</span>
                  </button>
                );
              })}
            </div>
            <div className="dashboard-gargantua-settings__taa">
              <div className="dashboard-gargantua-settings__taa-head">
                <div>
                  <strong>Antialias temporal (TAA)</strong>
                  <p>Acumula muestras del fondo para limpiar bordes y filamentos en movimiento.</p>
                </div>
                <span>{GRAVITY_TAA_QUALITY_META[settings.taaQuality].label}</span>
              </div>
              <fieldset
                className="dashboard-gargantua-settings__taa-options"
                aria-label="Calidad de antialias temporal"
              >
                {GRAVITY_TAA_QUALITY_IDS.map((quality) => {
                  const meta = GRAVITY_TAA_QUALITY_META[quality];
                  return (
                    <button
                      key={quality}
                      className="dashboard-gargantua-settings__taa-option"
                      type="button"
                      data-testid={`gravity-taa-quality-${quality}`}
                      aria-pressed={settings.taaQuality === quality}
                      title={meta.description}
                      onClick={() => onTaaQualityChange(quality)}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </fieldset>
              <p className="dashboard-gargantua-settings__taa-hint">
                Sólo afecta la animación WebGL del fondo; el resto de la interfaz queda igual.
              </p>
            </div>
            <RangeSetting
              setting="renderScaleMultiplier"
              label="Resolución interna"
              hint="Límite del canvas antes del ajuste automático del navegador."
              value={settings.renderScaleMultiplier}
              min={0.1}
              max={2.5}
              step={0.01}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={onChange}
            />
            <RangeSetting
              setting="maxFps"
              label="Límite de cuadros"
              hint="Reducilo para bajar consumo sin detener el movimiento."
              value={settings.maxFps}
              min={1}
              max={120}
              step={1}
              format={(value) => `${Math.round(value)} FPS`}
              onChange={onChange}
            />
            <RangeSetting
              setting="diskLayers"
              label="Capas del disco"
              hint="Más capas agregan profundidad y también trabajo de GPU."
              value={settings.diskLayers}
              min={1}
              max={6}
              step={1}
              format={(value) => `${Math.round(value)} ${value === 1 ? "capa" : "capas"}`}
              onChange={onChange}
            />
          </section>

          <section
            className="dashboard-gargantua-settings__section"
            aria-labelledby={`${titleId}-saved`}
          >
            <div className="dashboard-gargantua-settings__section-head">
              <h2 id={`${titleId}-saved`}>Presets guardados</h2>
              <span className="dashboard-gargantua-settings__status">
                Ranura {selectedCustomPreset + 1}
              </span>
            </div>
            <div className="dashboard-gargantua-settings__presets">
              {CUSTOM_PRESET_SLOTS.map(({ id, index }) => {
                const preset = customPresets[index];
                return (
                  <button
                    key={id}
                    className="dashboard-gargantua-settings__preset"
                    type="button"
                    data-testid={id}
                    aria-pressed={activeCustomPreset === index}
                    onClick={() => onSelectCustomPreset(index)}
                  >
                    <strong>Usuario {index + 1}</strong>
                    <span>
                      {preset ? "Guardado y disponible" : "Vacío · guardar configuración"}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="dashboard-gargantua-settings__custom-save">
              <span>Guardá la configuración actual en la ranura seleccionada.</span>
              <button
                className="dashboard-gargantua-settings__save"
                type="button"
                data-testid="gravity-save-preset"
                onClick={onSaveCustomPreset}
              >
                <FloppyDisk aria-hidden size={16} />
                Guardar preset {selectedCustomPreset + 1}
              </button>
            </div>
          </section>

          <section
            className="dashboard-gargantua-settings__section"
            aria-labelledby={`${titleId}-motion`}
          >
            <div className="dashboard-gargantua-settings__section-head">
              <h2 id={`${titleId}-motion`}>Movimiento</h2>
            </div>
            <RangeSetting
              setting="materialSpeed"
              label="Velocidad del material"
              hint="Controla el flujo de gas, las estrellas y el halo."
              value={settings.materialSpeed}
              min={0.1}
              max={4}
              step={0.05}
              format={(value) => `${value.toFixed(2)}×`}
              onChange={onChange}
            />
            <RangeSetting
              setting="pointerResponse"
              label="Respuesta al puntero"
              hint="Intensidad del parallax al mover el cursor sobre el dashboard."
              value={settings.pointerResponse}
              min={0.1}
              max={4}
              step={0.05}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={onChange}
            />
            <label className="dashboard-gargantua-settings__toggle">
              <span>
                <strong>Pausar con la pestaña oculta</strong>
                <small>Evita gastar GPU cuando SolaraCommerce no está visible.</small>
              </span>
              <input
                data-testid="gravity-setting-pauseWhenHidden"
                type="checkbox"
                checked={settings.pauseWhenHidden}
                onChange={(event) => onTogglePauseWhenHidden(event.target.checked)}
              />
            </label>
          </section>

          <section
            className="dashboard-gargantua-settings__section"
            aria-labelledby={`${titleId}-presence`}
          >
            <div className="dashboard-gargantua-settings__section-head">
              <h2 id={`${titleId}-presence`}>Presencia</h2>
            </div>
            <RangeSetting
              setting="starDensity"
              label="Densidad de estrellas"
              hint="Ajusta cuántos puntos de luz aparecen en el vacío."
              value={settings.starDensity}
              min={0.1}
              max={3}
              step={0.05}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={onChange}
            />
            <RangeSetting
              setting="dustIntensity"
              label="Nube de polvo"
              hint="Más polvo suma textura; menos deja el espacio más limpio."
              value={settings.dustIntensity}
              min={0.1}
              max={3}
              step={0.05}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={onChange}
            />
            <RangeSetting
              setting="haloIntensity"
              label="Intensidad del halo"
              hint="Modifica el resplandor alrededor del disco y la sombra."
              value={settings.haloIntensity}
              min={0.1}
              max={3}
              step={0.05}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={onChange}
            />
          </section>

          <section
            className="dashboard-gargantua-settings__section"
            aria-labelledby={`${titleId}-finish`}
          >
            <div className="dashboard-gargantua-settings__section-head">
              <h2 id={`${titleId}-finish`}>Acabado</h2>
            </div>
            <RangeSetting
              setting="warmth"
              label="Temperatura de color"
              hint="Llevá el disco hacia una luz más fría o más dorada."
              value={settings.warmth}
              min={0.1}
              max={3}
              step={0.05}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={onChange}
            />
            <RangeSetting
              setting="contrast"
              label="Contraste de salida"
              hint="Define la separación entre el vacío negro y los detalles."
              value={settings.contrast}
              min={0.1}
              max={2.8}
              step={0.05}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={onChange}
            />
          </section>

          <section
            className="dashboard-gargantua-settings__section"
            aria-labelledby={`${titleId}-advanced`}
          >
            <div className="dashboard-gargantua-settings__section-head">
              <h2 id={`${titleId}-advanced`}>Cinemática avanzada</h2>
            </div>
            <RangeSetting
              setting="turbulence"
              label="Turbulencia orbital"
              hint="Deformá el flujo local del gas sin mover el encuadre."
              value={settings.turbulence}
              min={0.1}
              max={3}
              step={0.05}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={onChange}
            />
            <RangeSetting
              setting="filamentDetail"
              label="Detalle de filamentos"
              hint="Aumentá o suavizá las vetas finas del disco."
              value={settings.filamentDetail}
              min={0.1}
              max={3}
              step={0.05}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={onChange}
            />
            <RangeSetting
              setting="gasAbsorption"
              label="Absorción del gas"
              hint="Controlá cuánto oculta la materia las capas posteriores."
              value={settings.gasAbsorption}
              min={0.1}
              max={3}
              step={0.05}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={onChange}
            />
            <RangeSetting
              setting="diskTilt"
              label="Inclinación del disco"
              hint="Llevá el plano orbital de sutil a dramático."
              value={settings.diskTilt}
              min={0.1}
              max={3}
              step={0.05}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={onChange}
            />
            <RangeSetting
              setting="lensStrength"
              label="Fuerza de lente"
              hint="Intensificá o relajá la curvatura gravitacional del arco."
              value={settings.lensStrength}
              min={0.1}
              max={3}
              step={0.05}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={onChange}
            />
            <RangeSetting
              setting="bloomSpread"
              label="Extensión del bloom"
              hint="Definí qué tan cerca o lejos se dispersa el resplandor."
              value={settings.bloomSpread}
              min={0.1}
              max={3}
              step={0.05}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={onChange}
            />
            <RangeSetting
              setting="causticIntensity"
              label="Intensidad de caústicas"
              hint="Ajustá los destellos de contacto del material frontal."
              value={settings.causticIntensity}
              min={0.1}
              max={3}
              step={0.05}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={onChange}
            />
            <RangeSetting
              setting="galaxyIntensity"
              label="Galaxia de fondo"
              hint="Subí o bajá la presencia de la galaxia distante."
              value={settings.galaxyIntensity}
              min={0.1}
              max={3}
              step={0.05}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={onChange}
            />
            <RangeSetting
              setting="starTwinkle"
              label="Centelleo estelar"
              hint="Dale calma o nervio al parpadeo de las estrellas."
              value={settings.starTwinkle}
              min={0.1}
              max={3}
              step={0.05}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={onChange}
            />
            <RangeSetting
              setting="vignette"
              label="Viñeta cinematográfica"
              hint="Concentrá la atención en el centro o abrí los bordes."
              value={settings.vignette}
              min={0.1}
              max={3}
              step={0.05}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={onChange}
            />
          </section>
        </div>
        <section
          className="dashboard-gargantua-settings__telemetry"
          data-testid="gravity-telemetry-card"
          data-measuring={telemetry ? "true" : "pending"}
          aria-labelledby={`${titleId}-telemetry`}
        >
          <div className="dashboard-gargantua-settings__telemetry-head">
            <h2 id={`${titleId}-telemetry`}>Rendimiento</h2>
            <span>EN VIVO</span>
          </div>
          <div className="dashboard-gargantua-settings__telemetry-list">
            <div className="dashboard-gargantua-settings__telemetry-row">
              <div className="dashboard-gargantua-settings__telemetry-label">
                <strong>GPU</strong>
                <span>WebGL</span>
              </div>
              <strong
                className="dashboard-gargantua-settings__telemetry-name"
                data-testid="gravity-telemetry-gpu-name"
                title={telemetry?.gpuName ?? "Detectando GPU"}
              >
                {telemetry?.gpuName ?? "Detectando GPU…"}
              </strong>
              <div className="dashboard-gargantua-settings__telemetry-usage">
                <span>Uso estimado</span>
                <output data-testid="gravity-telemetry-gpu-usage">
                  {formatTelemetryUsage(telemetry?.gpuUsage ?? null, telemetry)}
                </output>
              </div>
            </div>
            <div className="dashboard-gargantua-settings__telemetry-row">
              <div className="dashboard-gargantua-settings__telemetry-label">
                <strong>CPU</strong>
                <span>Hilo principal</span>
              </div>
              <strong
                className="dashboard-gargantua-settings__telemetry-name"
                data-testid="gravity-telemetry-cpu-name"
                title={telemetry?.cpuName ?? "Detectando CPU"}
              >
                {telemetry?.cpuName ?? "Detectando CPU…"}
              </strong>
              <div className="dashboard-gargantua-settings__telemetry-usage">
                <span>Uso estimado</span>
                <output data-testid="gravity-telemetry-cpu-usage">
                  {formatTelemetryUsage(telemetry?.cpuUsage ?? null, telemetry)}
                </output>
              </div>
            </div>
          </div>
          <p>Se mide sólo mientras este menú está abierto.</p>
        </section>
      </div>

      <footer className="dashboard-gargantua-settings__footer">
        <span>Los cambios se aplican al instante y sólo afectan este dashboard.</span>
        <button className="dashboard-gargantua-settings__reset" type="button" onClick={onReset}>
          <ArrowCounterClockwise aria-hidden size={16} />
          Restablecer actual
        </button>
      </footer>
    </aside>
  );
}
