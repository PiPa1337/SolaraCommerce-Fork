import { createContext, type ReactNode, useContext, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const DockContext = createContext<{
  target: HTMLDivElement | null;
  register(): () => void;
} | null>(null);

export function InspectorDockProvider({ children, onOpenChange }: {
  children: ReactNode;
  onOpenChange(open: boolean): void;
}) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const [count, setCount] = useState(0);
  const value = useMemo(() => ({
    target,
    register() {
      setCount((current) => current + 1);
      return () => setCount((current) => current - 1);
    },
  }), [target]);
  useLayoutEffect(() => onOpenChange(count > 0), [count, onOpenChange]);
  return <DockContext.Provider value={value}>
    {children}
    <div ref={setTarget} className="studio-inspector-dock" hidden={count === 0} />
  </DockContext.Provider>;
}

/** Portals preserve the editor's state while placing inspectors beside the preview. */
export function DockedInspector({ children }: { children: ReactNode }) {
  const dock = useContext(DockContext);
  const register = dock?.register;
  useLayoutEffect(() => register?.(), [register]);
  return dock?.target ? createPortal(children, dock.target) : null;
}
