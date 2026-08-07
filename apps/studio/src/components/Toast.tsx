/**
 * Toast global (T1.4): `ToastProvider` + `useToast()`. Autocierre 5s para
 * éxito/info y 8s para error; `role="status"`/`role="alert"` según gravedad.
 * El host se monta una sola vez en `App`; el resto del editor sólo consume.
 */
import { X } from "@phosphor-icons/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface ToastApi {
  success(message: string, duration?: number): void;
  error(message: string, duration?: number): void;
  info(message: string, duration?: number): void;
  push(kind: ToastKind, message: string, duration?: number): void;
}

const DEFAULT_DURATION: Record<ToastKind, number> = {
  success: 5000,
  info: 5000,
  error: 8000,
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string, duration?: number) => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((current) => [...current, { id, kind, message }]);
      const ms = duration ?? DEFAULT_DURATION[kind];
      const timer = setTimeout(() => dismiss(id), ms);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (message, duration) => push("success", message, duration),
      error: (message, duration) => push("error", message, duration),
      info: (message, duration) => push("info", message, duration),
    }),
    [push],
  );

  useEffect(
    () => () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
    },
    [],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <section className="toast-region" aria-label="Avisos">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast--${toast.kind}`}
            role={toast.kind === "error" ? "alert" : "status"}
            data-testid="ui-toast"
          >
            <span className="toast__message">{toast.message}</span>
            <button
              className="toast__close"
              type="button"
              aria-label="Cerrar aviso"
              title="Cerrar aviso"
              onClick={() => dismiss(toast.id)}
            >
              <X aria-hidden size={15} />
            </button>
          </div>
        ))}
      </section>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast requiere <ToastProvider> en un ancestro.");
  return api;
}
