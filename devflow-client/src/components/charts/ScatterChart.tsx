import type { ReactNode } from "react";
import { ScatterChart as MuiScatterChart } from "@mui/x-charts/ScatterChart";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function ScatterChart({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const baseSx = useFlexStyles(props);

  const series = props.series as Array<{
    data: [number, number][];
    label?: string;
  }> | undefined;
  const width = typeof props.width === "number" ? props.width : 400;
  const height = typeof props.height === "number" ? props.height : 300;

  if (!series?.length) {
    return null;
  }

  return (
    <MuiScatterChart
      series={series.map((s) => ({
        data: s.data.map(([x, y]) => ({ x, y, id: 0 })),
        label: s.label,
      }))}
      width={width}
      height={height}
      sx={baseSx}
    />
  );
}
