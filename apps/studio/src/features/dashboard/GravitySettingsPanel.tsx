import { ArrowCounterClockwise, FloppyDisk, X } from "@phosphor-icons/react";
import { useEffect, useId, useRef } from "react";
import {
  GRAVITY_PRESET_IDS,
  GRAVITY_PRESET_META,
  GRAVITY_PRESETS,
  GRAVITY_TAA_QUALITY_IDS,
  GRAVITY_TAA_QUALITY_META,
  type GravityPresetId,
  type GravitySettings,
  type GravityTaaQuality,
  isGravityPresetActive,
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
  onToggleStaticDiskDetails(value: boolean): void;
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
    return isGravityPresetActive(settings, GRAVITY_PRESETS[presetId]);
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
  onToggleStaticDiskDetails,
  onTogglePauseWhenHidden,
  onReset,
  onClose,
}: GravitySettingsPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const activePreset = activeCustomPreset === null ? getActivePreset(settings) : undefined;
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
            Afiná la calidad del campo gravitacional en vivo. Los presets incorporados ajustan
            rendimiento y apariencia base, pero no modifican la cinemática avanzada. El resto del
            dashboard queda oculto mientras ajustás estos valores.
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
                  <p>
                    Combina entre 1 y 16 cuadros consecutivos para suavizar bordes y filamentos. No
                    cambia la resolución interna; los niveles altos usan más GPU.
                  </p>
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
                Sólo afecta la animación WebGL del fondo; no cambia tus tiendas ni su contenido.
              </p>
            </div>
            <RangeSetting
              setting="renderScaleMultiplier"
              label="Resolución interna"
              hint="Define los píxeles del canvas: más resolución conserva más detalle, pero procesa más carga de GPU."
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
              hint="Limita cuántos cuadros dibuja por segundo; baja el consumo sin cambiar el detalle de cada cuadro."
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
              hint="Repite el gas en 1–6 planos de profundidad; más planos dan volumen y exigen más pasadas de GPU."
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
              hint="Multiplica el reloj del shader: acelera o frena el flujo del gas, el polvo, las estrellas y el halo."
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
              hint="Amplía o reduce cuánto se desplaza el centro y el parallax del fondo cuando movés el puntero."
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
                <small>
                  Detiene nuevos cuadros al ocultar la pestaña y retoma la misma fase al volver.
                </small>
              </span>
              <input
                data-testid="gravity-setting-pauseWhenHidden"
                type="checkbox"
                checked={settings.pauseWhenHidden}
                onChange={(event) => onTogglePauseWhenHidden(event.target.checked)}
              />
            </label>
            <label className="dashboard-gargantua-settings__toggle">
              <span>
                <strong>Manchas estables del disco</strong>
                <small>
                  Conserva las manchas suaves de la zona exterior; desactivá esta opción para que
                  esa textura se anime junto con el resto del gas.
                </small>
              </span>
              <input
                data-testid="gravity-setting-staticDiskDetails"
                type="checkbox"
                checked={settings.staticDiskDetails}
                onChange={(event) => onToggleStaticDiskDetails(event.target.checked)}
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
              hint="Controla cuántas estrellas pasan el umbral de visibilidad en las tres escalas del fondo; no cambia su tamaño."
              value={settings.starDensity}
              min={0.1}
              max={10}
              step={0.05}
              format={(value) => `${value.toFixed(2)}×`}
              onChange={onChange}
            />
            <RangeSetting
              setting="dustIntensity"
              label="Nube de polvo"
              hint="Multiplica la banda de polvo detrás del disco: textura, grietas y granos; no agrega nuevas capas."
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
              hint="Multiplica los halos suaves del arco, la sombra y el borde exterior sin cambiar el gas interno."
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
              hint="Desplaza el color final: menos de 1 enfría la imagen y más de 1 la vuelve dorada."
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
              hint="Separa los tonos alrededor del punto medio: más contraste marca el negro y los detalles luminosos."
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
              hint="Aumenta los remolinos locales del gas y vuelve más irregular el flujo, sin mover el encuadre general."
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
              hint="Multiplica las vetas finas que genera el gas: más detalle dibuja filamentos más visibles y marcados."
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
              hint="Aumenta la opacidad óptica de cada capa: el gas frontal oculta más las capas que están detrás."
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
              hint="Inclina el plano orbital frente a la cámara: cambia el ángulo aparente, no la posición del centro."
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
              hint="Multiplica la desviación alrededor de la sombra: curva más el arco y el fondo, hasta 10.00×."
              value={settings.lensStrength}
              min={0.1}
              max={10}
              step={0.05}
              format={(value) => `${value.toFixed(2)}×`}
              onChange={onChange}
            />
            <RangeSetting
              setting="bloomSpread"
              label="Extensión del bloom"
              hint="Amplía o concentra el ancho del resplandor del arco y del halo exterior, sin mover la geometría."
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
              hint="Multiplica los destellos donde la capa frontal cruza el arco inferior; afecta su brillo, no su posición."
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
              hint="Multiplica la espiral distante del lado izquierdo; no modifica las estrellas cercanas ni el disco."
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
              hint="Amplía o reduce la oscilación temporal del brillo de cada estrella; no cambia cuántas aparecen."
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
              hint="Oscurece los bordes cuando supera 1.00×; por debajo de 1.00× los abre y 1.00× deja el borde neutro."
              value={settings.vignette}
              min={0.1}
              max={3}
              step={0.05}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={onChange}
            />
          </section>
        </div>
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
