import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { useFlexStyles } from "../../hooks/useFlexStyles";

function renderInlineTensorpcMarkup(value: string) {
  const parts: ReactNode[] = [];
  const regex = /:red\[(.*?)\]/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(value)) !== null) {
    if (match.index > last) parts.push(value.slice(last, match.index));
    parts.push(
      <span key={`${match.index}-${match[1]}`} style={{ color: "var(--td-red)" }}>
        {match[1]}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < value.length) parts.push(value.slice(last));
  return parts.length > 0 ? parts : null;
}

export function Markdown({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const value = typeof props.value === "string" ? props.value : String(props.value ?? "");
  const inlineMarkup = renderInlineTensorpcMarkup(value);

  return (
    <div style={{ ...sx, overflow: "auto" }}>
      {inlineMarkup ? (
        <span>{inlineMarkup}</span>
      ) : (
        <ReactMarkdown
          components={{
            p: ({ children }) => <p style={{ margin: 0 }}>{children}</p>,
          }}
        >
          {value}
        </ReactMarkdown>
      )}
    </div>
  );
}
