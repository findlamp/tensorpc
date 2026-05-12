import type { ReactNode } from "react";
import { useFlexStyles } from "../../hooks/useFlexStyles";
import { ResizableColumnPair } from "./ResizableColumnPair";

function cssValue(value: unknown) {
  if (typeof value === "number") return `${value}px`;
  if (typeof value === "string") return value;
  return undefined;
}

function camelToKebab(value: string) {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function classCss(props: Record<string, unknown>) {
  return Object.entries(props)
    .filter(([key, value]) => key.startsWith(".") && value && typeof value === "object")
    .map(([selector, style]) => {
      const body = Object.entries(style as Record<string, unknown>)
        .map(([key, value]) => {
          if (value && typeof value === "object") return "";
          const css = cssValue(value);
          return css === undefined ? "" : `${camelToKebab(key)}:${css};`;
        })
        .filter(Boolean)
        .join("");
      return body ? `${selector}{${body}}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

export function FlexBox({
  props,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const className = typeof props.className === "string" ? props.className : undefined;
  const css = classCss(props);
  const compUid = typeof props.compUid === "string" ? props.compUid : "";
  const isDistSshMainPane =
    compUid.includes("paneDefs:0:component") &&
    !compUid.includes(".paneDefs:0:component.") &&
    sx.flexFlow === "column nowrap" &&
    children.length >= 5;

  if (isDistSshMainPane) {
    return (
      <div
        className={className}
        style={{
          ...sx,
          width: sx.width ?? "100%",
          height: sx.height ?? "100%",
          flex: sx.flex ?? 1,
          display: "flex",
          flexDirection: "column",
          flexWrap: "nowrap",
          minWidth: sx.minWidth ?? 0,
          minHeight: sx.minHeight ?? 0,
          overflow: sx.overflow ?? "hidden",
        }}
      >
        {css && <style>{css}</style>}
        {children.slice(0, 3)}
        <ResizableColumnPair
          top={children[3]}
          bottom={children[4]}
          initialTop={260}
          minTop={120}
          minBottom={140}
          disabled
        />
      </div>
    );
  }

  return (
    <div className={className} style={sx}>
      {css && <style>{css}</style>}
      {children}
    </div>
  );
}
