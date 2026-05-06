import { useMemo, type ReactNode } from "react";
import { useFlexStyles } from "../../hooks/useFlexStyles";

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function imageSrc(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) {
    const decoded = new TextDecoder().decode(value);
    if (decoded.startsWith("data:image/")) return decoded;
    return `data:image/jpeg;base64,${bytesToBase64(value)}`;
  }
  if (ArrayBuffer.isView(value)) {
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return imageSrc(bytes);
  }
  if (value instanceof ArrayBuffer) {
    return imageSrc(new Uint8Array(value));
  }
  return undefined;
}

export function Image({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const src = useMemo(() => imageSrc(props.image), [props.image]);
  return (
    <img
      src={src}
      alt={String(props.alt ?? "")}
      style={{
        ...sx,
        width: sx.width ?? "100%",
        height: sx.height ?? "100%",
        objectFit: "contain",
        display: "block",
      }}
    />
  );
}
