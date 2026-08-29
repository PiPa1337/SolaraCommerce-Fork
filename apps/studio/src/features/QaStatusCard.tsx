/**
 * Card de estado del QA perpetuo para el dashboard de Studio.
 * Muestra el ciclo activo, items restantes y ultimo commit del agente.
 */
import { useEffect, useState } from "react";

interface QaCycleInfo {
  backlogItem: string;
  phase: string;
  attempts: number;
}

interface QaStatus {
  activeCycle: QaCycleInfo | null;
  completedCount: number;
  blockedCount: number;
}

export function QaStatusCard() {
  const [status, setStatus] = useState<QaStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const response = await fetch("/__solara/storage/qa-status");
        if (!response.ok) throw new Error("unavailable");
        const data = await response.json();
        setStatus(data);
      } catch {
        setError("QA no disponible");
      }
    }
    void fetchStatus();
  }, []);

  if (error) return null;
  if (!status) return null;

  const cycle = status.activeCycle;

  return (
    <div className="qa-status-card">
      <h2>QA perpetuo</h2>
      {cycle ? (
        <p className="qa-status-card__state">
          Ciclo activo: {cycle.backlogItem} ({cycle.phase}, intento {cycle.attempts + 1})
        </p>
      ) : (
        <p className="qa-status-card__state">Sin ciclo activo</p>
      )}
      <p className="qa-status-card__counts">
        <span>
          <strong>{status.completedCount}</strong> completados
        </span>
        <span>
          <strong>{status.blockedCount}</strong> bloqueados
        </span>
      </p>
    </div>
  );
}
