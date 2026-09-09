import { X } from "@phosphor-icons/react";
import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { IconButton } from "../../components/Ui";

const DockContext = createContext<{
  target: HTMLDivElement | null;
  register(blocking: boolean): () => void;
} | null>(null);

export function InspectorDockProvider({
  children,
  onOpenChange,
  onBlockingChange,
}: {
  children: ReactNode;
  onOpenChange(open: boolean): void;
  onBlockingChange(blocking: boolean): void;
}) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const [count, setCount] = useState(0);
  const [blockingCount, setBlockingCount] = useState(0);
  const value = useMemo(
    () => ({
      target,
      register(blocking: boolean) {
        setCount((current) => current + 1);
        if (blocking) setBlockingCount((current) => current + 1);
        return () => {
          setCount((current) => current - 1);
          if (blocking) setBlockingCount((current) => current - 1);
        };
      },
    }),
    [target],
  );
  useLayoutEffect(() => onOpenChange(count > 0), [count, onOpenChange]);
  useLayoutEffect(() => onBlockingChange(blockingCount > 0), [blockingCount, onBlockingChange]);
  return (
    <DockContext.Provider value={value}>
      {children}
      <div ref={setTarget} className="studio-inspector-dock" hidden={count === 0} />
    </DockContext.Provider>
  );
}

/** Details replace the main editor surface while retaining the list's state and scroll. */
export function DockedInspector({
  children,
  blocking = false,
  onClose,
}: {
  children: ReactNode;
  blocking?: boolean;
  onClose(): void;
}) {
  const dock = useContext(DockContext);
  const register = dock?.register;
  useLayoutEffect(() => register?.(blocking), [register, blocking]);
  return dock?.target
    ? createPortal(
        <InspectorContent onClose={onClose} blocking={blocking}>
          {children}
        </InspectorContent>,
        dock.target,
      )
    : null;
}

function InspectorContent({
  children,
  onClose,
  blocking,
}: {
  children: ReactNode;
  onClose(): void;
  blocking: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() =>
      root.current
        ?.querySelector<HTMLElement>("button,input,select,textarea")
        ?.focus({ preventScroll: true }),
    );
    return () => {
      cancelAnimationFrame(frame);
      requestAnimationFrame(() => {
        if (opener?.isConnected) opener.focus({ preventScroll: true });
      });
    };
  }, []);
  return (
    <section
      ref={root}
      className="docked-inspector-content"
      aria-label="Panel de edición"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || document.querySelector("dialog:modal")) return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <div className="editor-detail-close">
        <IconButton
          icon={X}
          label={blocking ? "Cerrar editor" : "Cerrar detalle"}
          onClick={onClose}
        />
      </div>
      <div className={`editor-detail-scroll${blocking ? " editor-detail-scroll--product" : ""}`}>
        {children}
      </div>
    </section>
  );
}
