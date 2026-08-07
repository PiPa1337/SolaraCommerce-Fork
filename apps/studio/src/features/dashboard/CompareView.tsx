/**
 * Vista modal de comparación entre dos tiendas. Computa los diffs con
 * `buildCompareReport` (modelo puro) y los presenta sin duplicar decisiones.
 */
import { X } from "@phosphor-icons/react";
import { useEffect, useId, useMemo, useRef } from "react";
import { Button, IconButton } from "../../components/Ui";
import type { StoredProject } from "../../lib/repository";
import { buildCompareReport, type CompareReport } from "./compareModel";

export interface CompareViewProps {
  left: StoredProject | undefined;
  right: StoredProject | undefined;
  open: boolean;
  onClose(): void;
}

function DiffRow({ label, left, right }: { label: string; left: string; right: string }) {
  const differs = left !== right;
  return (
    <div className={`compare-view__row${differs ? " is-diff" : ""}`}>
      <span className="compare-view__label">{label}</span>
      <strong title={left}>{left}</strong>
      <strong title={right}>{right}</strong>
      {differs ? <span className="compare-view__badge">Difiere</span> : null}
    </div>
  );
}

function CountRow({ label, left, right }: { label: string; left: number; right: number }) {
  return <DiffRow label={label} left={String(left)} right={String(right)} />;
}

function SectionDiffs({ report }: { report: CompareReport }) {
  const onlyInLeft = report.sectionsOnlyInLeft;
  const onlyInRight = report.sectionsOnlyInRight;
  const motion = report.motionDiffs;
  if (onlyInLeft.length === 0 && onlyInRight.length === 0 && motion.length === 0) {
    return <p className="compare-view__empty">Misma estructura de secciones y mismo motion.</p>;
  }
  return (
    <ul className="compare-view__lists">
      {onlyInLeft.map((moduleId) => (
        <li key={`left-${moduleId}`}>
          <strong>{moduleId}</strong> está solo en {report.leftName}.
        </li>
      ))}
      {onlyInRight.map((moduleId) => (
        <li key={`right-${moduleId}`}>
          <strong>{moduleId}</strong> está solo en {report.rightName}.
        </li>
      ))}
      {motion.map((diff) => (
        <li key={`motion-${diff.moduleId}`} className="is-diff">
          <strong>{diff.moduleId}</strong>: motion {diff.leftPreset} → {diff.rightPreset}
        </li>
      ))}
    </ul>
  );
}

export function CompareView({ left, right, open, onClose }: CompareViewProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const countsTitleId = useId();
  const themeTitleId = useId();
  const sectionsTitleId = useId();
  const report = useMemo(
    () => (left && right ? buildCompareReport(left, right) : undefined),
    [left, right],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="dashboard-cosmic-dialog compare-dialog"
      aria-labelledby={titleId}
      data-testid="ui-compare-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        <header className="dashboard-cosmic-dialog__header">
          <div>
            <span className="dashboard-cosmic-kicker">Comparación</span>
            <h2 id={titleId}>Comparar tiendas</h2>
          </div>
          <IconButton icon={X} label="Cerrar comparación" onClick={onClose} />
        </header>
        {report ? (
          <>
            <div className="compare-view__pair">
              <div className="compare-view__store">
                <strong>{report.leftName}</strong>
                <span>{report.leftSiteStatus}</span>
              </div>
              <div className="compare-view__store">
                <strong>{report.rightName}</strong>
                <span>{report.rightSiteStatus}</span>
              </div>
            </div>
            <section className="compare-view__group" aria-labelledby={countsTitleId}>
              <h3 id={countsTitleId}>Inventario</h3>
              <div className="compare-view__table">
                {report.counts.map((row) => (
                  <CountRow key={row.label} label={row.label} left={row.left} right={row.right} />
                ))}
              </div>
            </section>
            <section className="compare-view__group" aria-labelledby={themeTitleId}>
              <h3 id={themeTitleId}>Tema</h3>
              <div className="compare-view__table">
                {report.theme.map((row) => (
                  <DiffRow key={row.label} label={row.label} left={row.left} right={row.right} />
                ))}
              </div>
            </section>
            <section className="compare-view__group" aria-labelledby={sectionsTitleId}>
              <h3 id={sectionsTitleId}>Secciones y motion</h3>
              <SectionDiffs report={report} />
            </section>
          </>
        ) : (
          <p className="compare-view__empty">Seleccioná dos tiendas para compararlas.</p>
        )}
        <footer className="dashboard-cosmic-dialog__actions">
          <Button variant="primary" type="submit">
            Cerrar
          </Button>
        </footer>
      </form>
    </dialog>
  );
}
