import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export function ResizableRowPair({
  left,
  right,
  initialLeft = 260,
  minLeft = 120,
  minRight = 320,
}: {
  left: ReactNode;
  right: ReactNode;
  initialLeft?: number;
  minLeft?: number;
  minRight?: number;
}) {
  const [leftPx, setLeftPx] = useState(initialLeft);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startLeft: number; maxLeft: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const clampLeft = () => {
      const maxLeft = Math.max(minLeft, container.clientWidth - minRight);
      setLeftPx((current) => Math.max(minLeft, Math.min(maxLeft, current)));
    };
    clampLeft();
    const observer = new ResizeObserver(clampLeft);
    observer.observe(container);
    return () => observer.disconnect();
  }, [minLeft, minRight]);

  const onMouseDown = useCallback(
    (event: React.MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      event.preventDefault();
      dragRef.current = {
        startX: event.clientX,
        startLeft: leftPx,
        maxLeft: Math.max(minLeft, rect.width - minRight),
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [leftPx, minLeft, minRight],
  );

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const next = drag.startLeft + event.clientX - drag.startX;
      setLeftPx(Math.max(minLeft, Math.min(drag.maxLeft, next)));
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
  }, [minLeft]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "row",
        flex: 1,
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: leftPx,
          minWidth: minLeft,
          flexShrink: 0,
          height: "100%",
          maxWidth: `calc(100% - ${minRight + 6}px)`,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={onMouseDown}
        style={{
          width: 6,
          flexShrink: 0,
          cursor: "col-resize",
          borderLeft: "1px solid var(--td-border)",
          borderRight: "1px solid var(--td-border)",
          background: "rgba(148, 163, 184, 0.12)",
        }}
      />
      <div
        style={{
          flex: "1 1 0%",
          width: 0,
          minWidth: minRight,
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {right}
      </div>
    </div>
  );
}
