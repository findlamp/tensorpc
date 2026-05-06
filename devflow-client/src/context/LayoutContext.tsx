import {
  createContext,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import type { LayoutModel } from "../hooks/useLayoutModel";

export interface LayoutContextValue {
  layout: LayoutModel | null;
  graphId: string | null;
  nodeId: string | null;
  setLayout: (layout: LayoutModel | null) => void;
  setGraphContext: (graphId: string, nodeId: string) => void;
}

export const LayoutContext = createContext<LayoutContextValue>({
  layout: null,
  graphId: null,
  nodeId: null,
  setLayout: () => {},
  setGraphContext: () => {},
});

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState<LayoutModel | null>(null);
  const [graphId, setGraphId] = useState<string | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);

  const handleSetLayout = useCallback((newLayout: LayoutModel | null) => {
    setLayout(newLayout);
  }, []);

  const setGraphContext = useCallback((gId: string, nId: string) => {
    setGraphId(gId);
    setNodeId(nId);
  }, []);

  return (
    <LayoutContext.Provider
      value={{
        layout,
        graphId,
        nodeId,
        setLayout: handleSetLayout,
        setGraphContext,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
}
