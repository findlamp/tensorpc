import type { ReactNode } from "react";
import { Handle, Position } from "reactflow";

function positionFromProp(value: unknown) {
  switch (value) {
    case "top":
      return Position.Top;
    case "bottom":
      return Position.Bottom;
    case "right":
      return Position.Right;
    case "left":
    default:
      return Position.Left;
  }
}

export function FlowHandle({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const className = typeof props.className === "string" ? props.className : undefined;
  return (
    <Handle
      id={typeof props.id === "string" ? props.id : undefined}
      className={className}
      type={props.type === "source" ? "source" : "target"}
      position={positionFromProp(props.handledPosition)}
    />
  );
}
