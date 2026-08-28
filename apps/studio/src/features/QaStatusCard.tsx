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
    <div
      className="qa-status-card"
      style={{ padding: "1rem", border: "1px solid #ddd", borderRadius: "8px", marginTop: "1rem" }}
    >
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem" }}>QA Perpetuo</h2>
      {cycle ? (
        <p style={{ margin: 0, fontSize: "0.85rem" }}>
          Ciclo activo: {cycle.backlogItem} ({cycle.phase}, intento {cycle.attempts + 1})
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: "0.85rem" }}>Sin ciclo activo</p>
      )}
      <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#666" }}>
        Completados: {status.completedCount} | Bloqueados: {status.blockedCount}
      </p>
    </div>
  );
}
