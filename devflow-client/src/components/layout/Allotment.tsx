import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type PaneDef = {
  component?: unknown;
  maxSize?: unknown;
  minSize?: unknown;
  priority?: unknown;
  preferredSize?: unknown;
  snap?: unknown;
  visible?: unknown;
};

function parsePaneDefs(complex: unknown): PaneDef[] {
  if (typeof complex === "object" && complex !== null) {
    const c = complex as Record<string, unknown>;
    if (Array.isArray(c.paneDefs)) return c.paneDefs as PaneDef[];
  }
  return [];
}

function parseDefaultSizes(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const sizes = raw
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);
  const total = sizes.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];
  // tensorpc uses relative ratios such as [1, 3], while CSS pane sizing here
  // expects percentages. Values already expressed as percentages are kept.
  if (Math.abs(total - 100) < 0.001) return sizes;
  return sizes.map((value) => (value / total) * 100);
}

export function Allotment({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const isVertical = Boolean(props.vertical);
  const paneDefs = parsePaneDefs(props.childsComplex);
  const defaultSizes = parseDefaultSizes(props.defaultSizes);

  const visibles: boolean[] = paneDefs.map((p) =>
    p.visible !== undefined ? Boolean(p.visible) : true,
  );

  const [sizes, setSizes] = useState<number[]>(() => {
    if (defaultSizes.length === children.length) return defaultSizes;
    const even = 100 / Math.max(children.length, 1);
    return children.map(() => even);
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    index: number;
    startPos: number;
    startSizes: number[];
    totalSize: number;
  } | null>(null);

  const onMouseDown = useCallback(
    (index: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const totalSize = isVertical ? rect.height : rect.width;
      dragRef.current = {
        index,
        startPos: isVertical ? e.clientY : e.clientX,
        startSizes: [...sizes],
        totalSize,
      };
      document.body.style.cursor = isVertical ? "row-resize" : "col-resize";
      document.body.style.userSelect = "none";
    },
    [sizes, isVertical],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const ds = dragRef.current;
      if (!ds) return;
      const delta = (isVertical ? e.clientY : e.clientX) - ds.startPos;
      const deltaPct = (delta / ds.totalSize) * 100;
      const next = [...ds.startSizes];
      next[ds.index] = Math.max(2, ds.startSizes[ds.index]! + deltaPct);
      next[ds.index + 1] = Math.max(
        2,
        ds.startSizes[ds.index + 1]! - deltaPct,
      );
      setSizes(next);
    };

    const onMouseUp = () => {
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isVertical]);

  const visibleIndices: number[] = [];
  children.forEach((_, i) => {
    if (visibles[i] ?? true) visibleIndices.push(i);
  });

  if (visibleIndices.length === 0) {
    return <div style={{ width: "100%", height: "100%" }} />;
  }

  return (
    <div
      ref={containerRef}
      data-tensorpc-allotment=""
      style={{
        display: "flex",
        flexDirection: isVertical ? "column" : "row",
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {visibleIndices.map((actualIdx, visIdx) => {
        const visibleCount = visibleIndices.length;
        const size =
          visibleCount === 1
            ? 100
            : sizes[actualIdx] ?? 100 / children.length;

        return (
          <div
            key={actualIdx}
            data-tensorpc-pane-index={actualIdx}
            data-tensorpc-pane-visible-index={visIdx}
            style={{
              display: "flex",
              flexDirection: isVertical ? "column" : "row",
              [isVertical ? "height" : "width"]: `${size}%`,
              flexShrink: 0,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                flex: 1,
                overflow: "hidden",
                minWidth: 0,
                minHeight: 0,
              }}
            >
              {children[actualIdx]}
            </div>
            {visIdx < visibleCount - 1 && (
              <div
                onMouseDown={onMouseDown(actualIdx)}
                style={{
                  [isVertical ? "height" : "width"]: 4,
                  [isVertical ? "width" : "height"]: "100%",
                  cursor: isVertical ? "row-resize" : "col-resize",
                  backgroundColor: "transparent",
                  flexShrink: 0,
                  zIndex: 10,
                  transition: "background-color 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.backgroundColor =
                    "rgba(128,128,128,0.25)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor =
                    "transparent";
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
