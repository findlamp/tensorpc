import { useMemo } from "react";
import { flexStyles } from "../utils/helpers";
import type { FlexComponentBaseProps } from "../components/types";

export function useFlexStyles(props: Record<string, unknown>) {
  return useMemo(() => flexStyles(props as FlexComponentBaseProps), [props]);
}
