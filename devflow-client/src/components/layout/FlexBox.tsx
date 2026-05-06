import type { ReactNode } from "react";
import { useFlexStyles } from "../../hooks/useFlexStyles";

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
  return (
    <div className={className} style={sx}>
      {css && <style>{css}</style>}
      {children}
    </div>
  );
}
