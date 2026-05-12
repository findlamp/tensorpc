import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export function ResizableColumnPair({
  top,
  bottom,
  initialTop = 300,
  minTop = 56,
  minBottom = 120,
  disabled = false,
}: {
  top: ReactNode;
  bottom: ReactNode;
  initialTop?: number;
  minTop?: number;
  minBottom?: number;
  disabled?: boolean;
}) {
  const [topPx, setTopPx] = useState(initialTop);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startTop: number; maxTop: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const clampTop = () => {
      const maxTop = Math.max(minTop, container.clientHeight - minBottom);
      setTopPx((current) => Math.max(minTop, Math.min(maxTop, current)));
    };
    clampTop();
    const observer = new ResizeObserver(clampTop);
    observer.observe(container);
    return () => observer.disconnect();
  }, [minBottom, minTop]);

  const onMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (disabled) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      event.preventDefault();
      dragRef.current = {
        startY: event.clientY,
        startTop: topPx,
        maxTop: Math.max(minTop, rect.height - minBottom),
      };
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [disabled, minBottom, minTop, topPx],
  );

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const next = drag.startTop + event.clientY - drag.startY;
      setTopPx(Math.max(minTop, Math.min(drag.maxTop, next)));
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
  }, [minTop]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: topPx,
          minHeight: minTop,
          flexShrink: 0,
          maxHeight: `calc(100% - ${minBottom + 6}px)`,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {top}
      </div>
      <div
        onMouseDown={onMouseDown}
        style={{
          height: 6,
          flexShrink: 0,
          cursor: disabled ? "default" : "row-resize",
          borderTop: "1px solid var(--td-border)",
          borderBottom: "1px solid var(--td-border)",
          background: "rgba(148, 163, 184, 0.12)",
          pointerEvents: disabled ? "none" : undefined,
        }}
      />
      <div
        style={{
          flex: "1 1 0%",
          height: 0,
          minHeight: minBottom,
          maxHeight: `calc(100% - ${topPx + 6}px)`,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {bottom}
      </div>
    </div>
  );
}
