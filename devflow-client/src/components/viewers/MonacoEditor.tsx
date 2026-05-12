import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Editor, { loader, type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import { TensorPcContext } from "../../context/TensorPcContext";
import { LayoutContext } from "../../context/LayoutContext";
import { FrontendEventType } from "../../core/socketTypes";
import { useFlexStyles } from "../../hooks/useFlexStyles";

const monacoGlobal = self as unknown as {
  MonacoEnvironment?: {
    getWorker: (_moduleId: string, label: string) => Worker;
  };
};

const MonacoEditorControlType = {
  SetLineNumber: 0,
  Save: 1,
  SetValue: 2,
} as const;

monacoGlobal.MonacoEnvironment = {
  getWorker(_moduleId: string, label: string) {
    if (label === "json") return new jsonWorker();
    if (label === "css" || label === "scss" || label === "less") return new cssWorker();
    if (label === "html" || label === "handlebars" || label === "razor") return new htmlWorker();
    if (label === "typescript" || label === "javascript") return new tsWorker();
    return new editorWorker();
  },
};

loader.config({ monaco });

function currentThemeMode() {
  return document.querySelector(".tensorpc-dark") ? "dark" : "light";
}

function normalizeLanguage(language: string) {
  if (language === "py") return "python";
  if (language === "js") return "javascript";
  if (language === "ts") return "typescript";
  return language || "plaintext";
}

function editorOptions(raw: unknown) {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function safeModelPath(nodeId: string, compUid: string, language: string) {
  const raw = `${nodeId || "node"}-${compUid || "editor"}`;
  const safe = raw.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 120) || "editor";
  return `inmemory://tensorpc/${safe}.${language || "txt"}`;
}

function publishEditorValue(uid: string, value: string, path?: string) {
  if (!uid) return;
  window.dispatchEvent(
    new CustomEvent("tensorpc-monaco-value-change", {
      detail: { uid, path, value },
    }),
  );
}

export function MonacoEditor({
  props,
}: {
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  children: ReactNode[];
}) {
  const sx = useFlexStyles(props);
  const { sendUiEvent } = useContext(TensorPcContext);
  const { graphId, nodeId } = useContext(LayoutContext);
  const propValue = typeof props.value === "string" ? props.value : "";
  const [themeMode, setThemeMode] = useState<"dark" | "light">(() =>
    currentThemeMode(),
  );
  const timerRef = useRef<number | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const dirtyRef = useRef(false);
  const lastPropValueRef = useRef(propValue);
  const lastEditorIdentityRef = useRef("");
  const syncingFromPropsRef = useRef(false);
  const compUid = typeof props.compUid === "string" ? props.compUid : "";
  const language = normalizeLanguage(
    typeof props.language === "string" ? props.language : "plaintext",
  );
  const readOnly = props.readOnly === true;
  const options = editorOptions(props.options);
  const wordWrap =
    typeof options.wordWrap === "string"
      ? (options.wordWrap as "off" | "on" | "wordWrapColumn" | "bounded")
      : "off";
  const editorPath = useMemo(
    () => safeModelPath(nodeId ?? "", compUid, language),
    [compUid, language, nodeId],
  );
  const [value, setValue] = useState(propValue);

  useEffect(() => {
    const editorIdentity = `${nodeId ?? ""}:${compUid}:${editorPath}`;
    const editorChanged = lastEditorIdentityRef.current !== editorIdentity;
    if (editorChanged) {
      lastEditorIdentityRef.current = editorIdentity;
      dirtyRef.current = false;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
    if (!editorChanged && dirtyRef.current) {
      return;
    }
    syncingFromPropsRef.current = true;
    lastPropValueRef.current = propValue;
    dirtyRef.current = false;
    setValue(propValue);
    const timer = window.setTimeout(() => {
      syncingFromPropsRef.current = false;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [compUid, editorPath, nodeId, propValue]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const root = document.getElementById("root") ?? document.body;
    const syncTheme = () => setThemeMode(currentThemeMode());
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class"],
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, []);

  const sendEditorChange = useCallback(
    (nextValue: string) => {
      if (!graphId || !nodeId || !compUid) return;
      void sendUiEvent(graphId, nodeId, compUid, FrontendEventType.Change, {
        value: nextValue,
        viewState: editorRef.current?.saveViewState() ?? null,
      });
    },
    [compUid, graphId, nodeId, sendUiEvent],
  );

  const queueEditorChange = useCallback(
    (nextValue: string) => {
      const debounce =
        typeof props.debounce === "number" ? Math.max(0, props.debounce) : 300;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        sendEditorChange(nextValue);
      }, debounce);
    },
    [props.debounce, sendEditorChange],
  );

  const sendEditorSave = useCallback(
    (userdata?: unknown) => {
      if (!graphId || !nodeId || !compUid) return;
      const editor = editorRef.current;
      const model = editor?.getModel();
      const nextValue = editor?.getValue() ?? value;
      if (!dirtyRef.current && nextValue === lastPropValueRef.current && userdata === undefined) {
        return;
      }
      dirtyRef.current = false;
      lastPropValueRef.current = nextValue;
      publishEditorValue(compUid, nextValue, editorPath);
      void sendUiEvent(graphId, nodeId, compUid, FrontendEventType.EditorSave, {
        value: nextValue,
        saveVersionId: model?.getAlternativeVersionId?.() ?? 0,
        viewState: editor?.saveViewState() ?? null,
        userdata: userdata ?? null,
        lang: language,
        path: typeof props.path === "string" ? props.path : editorPath,
      });
    },
    [compUid, editorPath, graphId, language, nodeId, props.path, sendUiEvent, value],
  );

  const handleMount: OnMount = useCallback(
    (editor) => {
      editorRef.current = editor;
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        sendEditorSave();
      });
      editor.layout();
    },
    [sendEditorSave],
  );

  useEffect(() => {
    if (!compUid) return;
    const handleControlEvent = (event: Event) => {
      const custom = event as CustomEvent<{ uid?: string; data?: unknown }>;
      if (custom.detail?.uid !== compUid || !custom.detail.data || typeof custom.detail.data !== "object") return;
      const data = custom.detail.data as Record<string, unknown>;
      const type = Number(data.type);
      if (type === MonacoEditorControlType.Save) {
        sendEditorSave(data.userdata);
      } else if (type === MonacoEditorControlType.SetValue && typeof data.value === "string") {
        syncingFromPropsRef.current = true;
        lastPropValueRef.current = data.value;
        dirtyRef.current = false;
        editorRef.current?.setValue(data.value);
        setValue(data.value);
        window.setTimeout(() => {
          syncingFromPropsRef.current = false;
        }, 0);
      } else if (type === MonacoEditorControlType.SetLineNumber) {
        const lineNumber = typeof data.value === "number" ? data.value : 1;
        editorRef.current?.revealLineInCenter(lineNumber);
        if (data.selectLine === true) {
          editorRef.current?.setSelection({
            startLineNumber: lineNumber,
            startColumn: 1,
            endLineNumber: lineNumber,
            endColumn: 1,
          });
        }
      }
    };
    window.addEventListener("tensorpc-component-event", handleControlEvent);
    return () => window.removeEventListener("tensorpc-component-event", handleControlEvent);
  }, [compUid, sendEditorSave]);

  return (
    <div
      style={{
        ...sx,
        minHeight: sx.minHeight ?? sx.height ?? 0,
        height: "100%",
        width: sx.width ?? "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--td-surface)",
        color: "var(--td-text)",
        overflow: "hidden",
        borderTop: "1px solid var(--td-border)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      }}
    >
      <Editor
        value={value}
        language={language}
        path={editorPath}
        theme={themeMode === "dark" ? "vs-dark" : "vs"}
        onMount={handleMount}
        onChange={(nextValue) => {
          const safeValue = nextValue ?? "";
          setValue(safeValue);
          if (syncingFromPropsRef.current) return;
          dirtyRef.current = safeValue !== lastPropValueRef.current;
          publishEditorValue(compUid, safeValue, editorPath);
          queueEditorChange(safeValue);
        }}
        options={{
          readOnly,
          fontFamily: "JetBrains Mono, Fira Code, Menlo, Monaco, Consolas, monospace",
          fontSize: 13,
          lineHeight: 20,
          minimap: { enabled: true, side: "right", renderCharacters: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          insertSpaces: true,
          wordWrap,
          wrappingIndent:
            typeof options.wrappingIndent === "string"
              ? (options.wrappingIndent as "none" | "same" | "indent" | "deepIndent")
              : "same",
          renderWhitespace: "selection",
          folding: true,
          lineNumbersMinChars: 3,
          glyphMargin: options.glyphMargin === true,
          bracketPairColorization: { enabled: true },
          padding: { top: 10, bottom: 10 },
        }}
      />
    </div>
  );
}
