import type { ReactNode } from "react";
import { ComponentNode } from "../ComponentNode";
import type { ComponentProps } from "../../hooks/useLayoutModel";

export function MatchCase({
  props,
  layout,
}: {
  props: Record<string, unknown>;
  layout: Record<string, ComponentProps>;
  children: ReactNode[];
}) {
  const cases = props.cases as Array<{ value: unknown; compUid: string }> | undefined;
  const switchValue = props.switchValue;

  if (!cases) return null;

  for (const c of cases) {
    if (c.value === switchValue) {
      const child = layout[c.compUid];
      if (child) {
        return <ComponentNode node={child} layout={layout} />;
      }
    }
  }

  // Default case
  const defaultUid = props.default as string | undefined;
  if (defaultUid) {
    const child = layout[defaultUid];
    if (child) {
      return <ComponentNode node={child} layout={layout} />;
    }
  }

  return null;
}
