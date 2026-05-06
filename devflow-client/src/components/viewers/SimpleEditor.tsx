import { useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { TensorPcContext } from "../../context/TensorPcContext";
import { LayoutContext } from "../../context/LayoutContext";
import { FrontendEventType } from "../../core/socketTypes";
import { useFlexStyles } from "../../hooks/useFlexStyles";

export function SimpleEditor({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const { sendUiEvent } = useContext(TensorPcContext);
  const { graphId, nodeId } = useContext(LayoutContext);
  const initialValue = typeof props.value === "string" ? props.value : "";
  const [value, setValue] = useState(initialValue);
  const timerRef = useRef<number | null>(null);
  const compUid = typeof props.compUid === "string" ? props.compUid : "";
  const padding = typeof props.editorPadding === "number" ? props.editorPadding : 4;
  const fontSize =
    typeof props.editorFontSize === "number" ? props.editorFontSize : 12;
  const fontFamily =
    typeof props.editorFontFamily === "string"
      ? props.editorFontFamily
      : "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const sendChange = useCallback(
    (nextValue: string) => {
      if (!graphId || !nodeId || !compUid) return;
      void sendUiEvent(
        graphId,
        nodeId,
        compUid,
        FrontendEventType.Change,
        nextValue,
      );
    },
    [compUid, graphId, nodeId, sendUiEvent],
  );

  const queueChange = useCallback(
    (nextValue: string) => {
      const debounce =
        typeof props.debounce === "number" ? Math.max(0, props.debounce) : 200;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        sendChange(nextValue);
      }, debounce);
    },
    [props.debounce, sendChange],
  );

  return (
    <textarea
      id={typeof props.textareaId === "string" ? props.textareaId : undefined}
      className={
        typeof props.textareaClassName === "string"
          ? props.textareaClassName
          : undefined
      }
      value={value}
      spellCheck={false}
      onChange={(event) => {
        const nextValue = event.target.value;
        setValue(nextValue);
        queueChange(nextValue);
      }}
      onBlur={() => sendChange(value)}
      style={{
        ...sx,
        width: sx.width ?? "100%",
        height: sx.height ?? "100%",
        minWidth: sx.minWidth ?? 0,
        minHeight: sx.minHeight ?? 0,
        margin: 0,
        padding,
        resize: "none",
        border: 0,
        outline: 0,
        overflow: "auto",
        color: "#294b77",
        background: "transparent",
        fontFamily,
        fontSize,
        lineHeight: "1.45",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
        tabSize: typeof props.tabSize === "number" ? props.tabSize : 4,
      }}
    />
  );
}
