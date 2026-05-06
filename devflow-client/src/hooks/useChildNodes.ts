import { childUids } from "../utils/helpers";
import type { ComponentProps } from "./useLayoutModel";

export type ChildEntry = { uid: string; node: ComponentProps };

/** Extract child node references from props, looking them up in the layout map */
export function useChildNodes(
  props: Record<string, unknown>,
  layout: Record<string, ComponentProps>,
): ChildEntry[] {
  return childUids(props)
    .map((uid) => {
      const child = layout[uid];
      if (!child) return null;
      return { uid, node: child };
    })
    .filter((x): x is ChildEntry => x !== null);
}
