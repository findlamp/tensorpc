import type { CSSProperties, ReactNode } from "react";

export function dataToText(data: unknown) {
  if (typeof data === "string") return data;
  if (data instanceof Uint8Array) return new TextDecoder().decode(data);
  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(
      new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    );
  }
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length > 0) {
      const bytes = new Uint8Array(entries.length);
      for (let i = 0; i < entries.length; i += 1) {
        const [key, value] = entries[i]!;
        const index = Number(key);
        if (
          !Number.isInteger(index) ||
          index < 0 ||
          index >= entries.length ||
          typeof value !== "number" ||
          value < 0 ||
          value > 255
        ) {
          return String(data ?? "");
        }
        bytes[index] = value;
      }
      return new TextDecoder().decode(bytes);
    }
  }
  return String(data ?? "");
}

function stripUnsupportedAnsi(value: string) {
  return value
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[(?![0-9;:]*m)[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b[=>]/g, "")
    .replace(/\x1b[()#%*+\-.\/]./g, "")
    .replace(/[^\x09\x0a\x0d\x1b\x20-\x7e\u00a0-\uffff]/g, "")
    .replace(/\ufffd/g, "");
}

function normalizeLineBreaks(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function lineForMatching(value: string) {
  return stripUnsupportedAnsi(value).replace(/\x1b\[[0-9;:]*m/g, "").replace(/\r/g, "");
}

function stripTensorpcInternalNoise(value: string) {
  const lines = value.split("\n");
  const plainLines = lines.map(lineForMatching);
  const kept: string[] = [];
  let skipping = false;
  let skippingStartupCommand = false;
  let maybeSkippingServerStartedAddress = false;

  const isTensorpcStartupCommand = (line: string) =>
    /\bpython\s+-m\s+tensorpc\.serve\b/.test(line) &&
    line.includes("tensorpc.dock.serv.flowapp::FlowApp");

  const isTensorpcStartupFlagLine = (line: string) => {
    const trimmed = line.trim();
    return (
      /\b(?:serv_config_b64|serv_config_is_gzip)\b/.test(line) ||
      /^http_port=\d+\b/.test(trimmed)
    );
  };

  const isTensorpcServerStartedLog = (line: string) =>
    /tensorpc\.(?:aioserver|http)\|server started at/.test(line);

  const isServerStartedAddressContinuation = (line: string) =>
    /^\s+(?:\[[^\]]+\]|[0-9.]+|[a-zA-Z0-9_.-]+):\d+\([^)]+\)\s*$/.test(line);

  const isTensorpcDynamicCodeLog = (line: string) =>
    /\bdcls\.is_dynamic_code\s+(?:True|False)\b/.test(line);

  const startsInternalTraceback = (index: number) => {
    if (!plainLines[index]?.includes("Traceback (most recent call last):")) {
      return false;
    }
    const lookahead = plainLines.slice(index, index + 18).join("\n");
    return (
      lookahead.includes("/tensorpc/dock/serv/flowapp.py") ||
      lookahead.includes("/tensorpc/core/asyncclient.py") ||
      lookahead.includes("grpc.aio._call.AioRpcError") ||
      lookahead.includes("_send_loop_v2") ||
      lookahead.includes("_send_loop_stream_main")
    );
  };

  const startsInternalTaskException = (index: number) => {
    if (!plainLines[index]?.includes("Task exception was never retrieved")) {
      return false;
    }
    return plainLines
      .slice(index, index + 8)
      .join("\n")
      .includes("async generator ignored GeneratorExit");
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const plainLine = plainLines[i] ?? "";
    const isTensorpcHttpLog = /tensorpc\.http\|(?:ws .* disconnected|New Websocket)/.test(plainLine);

    if (skippingStartupCommand) {
      if (plainLine.includes("serv_config_is_gzip=True")) {
        skippingStartupCommand = false;
      }
      continue;
    }

    if (maybeSkippingServerStartedAddress) {
      maybeSkippingServerStartedAddress = false;
      if (isServerStartedAddressContinuation(plainLine)) {
        continue;
      }
    }

    if (isTensorpcStartupCommand(plainLine)) {
      const commandIndex = line.indexOf("python -m tensorpc.serve");
      const promptPrefix = commandIndex > 0 ? line.slice(0, commandIndex).trimEnd() : "";
      if (promptPrefix) {
        kept.push(promptPrefix);
      }
      skippingStartupCommand = !plainLine.includes("serv_config_is_gzip=True");
      continue;
    }

    if (isTensorpcStartupFlagLine(plainLine)) {
      continue;
    }

    if (isTensorpcServerStartedLog(plainLine)) {
      maybeSkippingServerStartedAddress = !/\([^)]+\)\s*$/.test(plainLine);
      continue;
    }

    if (isTensorpcDynamicCodeLog(plainLine)) {
      continue;
    }

    const shouldStartSkip =
      startsInternalTraceback(i) ||
      startsInternalTaskException(i) ||
      isTensorpcHttpLog;

    if (shouldStartSkip) {
      skipping = !isTensorpcHttpLog;
      continue;
    }

    if (skipping) {
      if (/tensorpc\.http\|(?:ws .* disconnected|New Websocket)/.test(plainLine)) {
        skipping = false;
      }
      continue;
    }

    kept.push(line);
  }

  return kept.join("\n");
}

export function sanitizeTerminalContent(value: string) {
  return stripTensorpcInternalNoise(value)
    .replace(/node_id_to_remove\s+\[[^\n]*\]/g, "")
    .replace(/SAVE GRAPH\s+\d+/g, "")
    .replace(/\n{3,}/g, "\n\n");
}

export function normalizeTerminalText(data: unknown) {
  return sanitizeTerminalContent(normalizeLineBreaks(stripUnsupportedAnsi(dataToText(data))));
}

const ansi16: Record<number, string> = {
  30: "#1f2933",
  31: "#c62828",
  32: "#2e7d32",
  33: "#b7791f",
  34: "#1565c0",
  35: "#8e24aa",
  36: "#00838f",
  37: "#5f6368",
  90: "#8a9099",
  91: "#d32f2f",
  92: "#388e3c",
  93: "#f9a825",
  94: "#1976d2",
  95: "#ab47bc",
  96: "#00acc1",
  97: "#ffffff",
};

function ansi256Color(code: number) {
  if (code < 16) return ansi16[30 + (code % 8)] ?? "#263443";
  if (code >= 16 && code <= 231) {
    const value = code - 16;
    const r = Math.floor(value / 36);
    const g = Math.floor((value % 36) / 6);
    const b = value % 6;
    const channel = (n: number) => (n === 0 ? 0 : 55 + n * 40);
    return `rgb(${channel(r)}, ${channel(g)}, ${channel(b)})`;
  }
  if (code >= 232 && code <= 255) {
    const gray = 8 + (code - 232) * 10;
    return `rgb(${gray}, ${gray}, ${gray})`;
  }
  return undefined;
}

function styleKey(style: CSSProperties) {
  return JSON.stringify(style);
}

function appendSegment(
  segments: ReactNode[],
  text: string,
  style: CSSProperties,
  key: number,
) {
  if (!text) return;
  if (!Object.keys(style).length) {
    segments.push(text);
    return;
  }
  segments.push(
    <span key={`${key}-${styleKey(style)}`} style={style}>
      {text}
    </span>,
  );
}

function applySgrCodes(style: CSSProperties, rawCodes: string) {
  const codes = rawCodes
    .split(/[;:]/)
    .filter((part) => part.length > 0)
    .map((part) => Number(part));
  if (codes.length === 0) codes.push(0);

  const next: CSSProperties = { ...style };
  for (let index = 0; index < codes.length; index += 1) {
    const code = codes[index];
    if (code === 0) {
      Object.keys(next).forEach((key) => delete next[key as keyof CSSProperties]);
    } else if (code === 1) {
      next.fontWeight = 700;
    } else if (code === 2) {
      next.opacity = 0.72;
    } else if (code === 3) {
      next.fontStyle = "italic";
    } else if (code === 4) {
      next.textDecoration = "underline";
    } else if (code === 22) {
      delete next.fontWeight;
      delete next.opacity;
    } else if (code === 23) {
      delete next.fontStyle;
    } else if (code === 24) {
      delete next.textDecoration;
    } else if (code === 39) {
      delete next.color;
    } else if (code === 49) {
      delete next.backgroundColor;
    } else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
      next.color = ansi16[code];
    } else if (code >= 40 && code <= 47) {
      next.backgroundColor = ansi16[code - 10];
    } else if (code >= 100 && code <= 107) {
      next.backgroundColor = ansi16[code - 10];
    } else if ((code === 38 || code === 48) && codes[index + 1] === 5) {
      const color = ansi256Color(codes[index + 2]);
      if (color) {
        if (code === 38) next.color = color;
        else next.backgroundColor = color;
      }
      index += 2;
    } else if ((code === 38 || code === 48) && codes[index + 1] === 2) {
      const [r, g, b] = [codes[index + 2], codes[index + 3], codes[index + 4]];
      if ([r, g, b].every((value) => Number.isFinite(value))) {
        const color = `rgb(${r}, ${g}, ${b})`;
        if (code === 38) next.color = color;
        else next.backgroundColor = color;
      }
      index += 4;
    }
  }
  return next;
}

export function renderAnsiText(content: string, fallback = "$ _") {
  if (!content) return fallback;
  const segments: ReactNode[] = [];
  const pattern = /\x1b\[([0-9;:]*)m/g;
  let lastIndex = 0;
  let style: CSSProperties = {};
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(content))) {
    appendSegment(segments, content.slice(lastIndex, match.index), style, key);
    key += 1;
    style = applySgrCodes(style, match[1]);
    lastIndex = pattern.lastIndex;
  }

  appendSegment(segments, content.slice(lastIndex), style, key);
  return segments.length ? segments : fallback;
}
