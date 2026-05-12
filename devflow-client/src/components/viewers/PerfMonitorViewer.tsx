import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { UIType } from "../../render/uiTypes";
import { childUids } from "../../utils/helpers";
import { lookupLayoutNode } from "../../utils/layoutRefs";
import type { ComponentProps } from "../../hooks/useLayoutModel";
import { useSendEvent } from "../../hooks/useSendEvent";
import { FrontendEventType } from "../../core/socketTypes";

type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: [number, number, number, number];
  index: number;
  colorKey: number;
  phaseKey: string;
};

type GlState = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  buffer: WebGLBuffer;
  position: number;
  color: number;
};

type ViewState = {
  scaleX: number;
  scaleY: number;
  scrollX: number;
  scrollY: number;
};

const DETAIL_MIN = 180;
const DETAIL_MAX = 520;
const PERF_ROW_PX = 22;
const PERF_BAR_HEIGHT = 0.94;
const PERF_ROW_BACKGROUND_HALF = 0.5;
const CHANGE_EVENT = 20;
const DARK_BAR_PALETTE: Array<[number, number, number, number]> = [
  [0.86, 0.68, 0.65, 0.82],
  [0.48, 0.78, 0.74, 0.84],
  [0.56, 0.73, 0.82, 0.84],
  [0.72, 0.56, 0.78, 0.84],
  [0.86, 0.75, 0.38, 0.86],
];
const LIGHT_BAR_PALETTE: Array<[number, number, number, number]> = [
  [0.9, 0.76, 0.74, 0.72],
  [0.6, 0.84, 0.8, 0.74],
  [0.68, 0.82, 0.9, 0.74],
  [0.82, 0.66, 0.86, 0.76],
  [0.9, 0.78, 0.36, 0.82],
];
const OFFICIAL_PHASE_COLORS = [
  {
    test: /(data|loader|load|input|dataset|sample)/i,
    dark: [0.86, 0.68, 0.65, 0.82] as [number, number, number, number],
    light: [0.9, 0.76, 0.74, 0.72] as [number, number, number, number],
  },
  {
    test: /(fwd|forward|infer|model)/i,
    dark: [0.48, 0.78, 0.74, 0.84] as [number, number, number, number],
    light: [0.6, 0.84, 0.8, 0.74] as [number, number, number, number],
  },
  {
    test: /(bwd|backward|grad|loss)/i,
    dark: [0.56, 0.73, 0.82, 0.84] as [number, number, number, number],
    light: [0.68, 0.82, 0.9, 0.74] as [number, number, number, number],
  },
  {
    test: /(comm|all.?reduce|reduce|gather|scatter|nccl|sync)/i,
    dark: [0.72, 0.56, 0.78, 0.84] as [number, number, number, number],
    light: [0.82, 0.66, 0.86, 0.76] as [number, number, number, number],
  },
  {
    test: /(optim|optimizer|update|step)/i,
    dark: [0.86, 0.75, 0.38, 0.86] as [number, number, number, number],
    light: [0.9, 0.78, 0.36, 0.82] as [number, number, number, number],
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numericObjectToArray(value: Record<string, unknown>): number[] | null {
  const entries = Object.entries(value);
  if (!entries.length) return [];
  const out = new Array<number>(entries.length);
  for (const [key, item] of entries) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index >= entries.length) return null;
    if (typeof item !== "number" || !Number.isFinite(item)) return null;
    out[index] = item;
  }
  return out;
}

function toNumberArray(value: unknown): number[] {
  if (ArrayBuffer.isView(value)) {
    if (value instanceof DataView) return [];
    return Array.from(value as unknown as ArrayLike<number>, Number);
  }
  if (Array.isArray(value)) {
    const out: number[] = [];
    for (const item of value) out.push(...toNumberArray(item));
    return out;
  }
  if (isRecord(value)) {
    const data = value.data ?? value.values ?? value.array;
    if (data !== undefined) return toNumberArray(data);
    const numeric = numericObjectToArray(value);
    if (numeric) return numeric;
  }
  return typeof value === "number" && Number.isFinite(value) ? [value] : [];
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toMaybeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function displayValue(value: number, fractionDigits: unknown) {
  const digits =
    typeof fractionDigits === "number" && Number.isFinite(fractionDigits)
      ? Math.max(0, Math.min(8, fractionDigits))
      : 0;
  return value.toFixed(digits);
}

function sliderHasRange(props: Record<string, unknown>) {
  const min = toNumber(props.min, 0);
  const max = toNumber(props.max, min);
  const value = toNumber(props.value ?? props.defaultValue, min);
  return max > min || value !== min;
}

function colorAt(colors: number[], index: number): [number, number, number, number] {
  const base = index * 3;
  if (base + 2 < colors.length) {
    const r = colors[base]!;
    const g = colors[base + 1]!;
    const b = colors[base + 2]!;
    const div = Math.max(r, g, b) > 1 ? 255 : 1;
    const nr = r / div;
    const ng = g / div;
    const nb = b / div;
    if (nr + ng + nb > 0.18) return [nr, ng, nb, 0.94];
  }
  const hue = (index * 37) % 360;
  const c = 0.72;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = 0.2;
  const rgb =
    hue < 60 ? [c, x, 0] :
    hue < 120 ? [x, c, 0] :
    hue < 180 ? [0, c, x] :
    hue < 240 ? [0, x, c] :
    hue < 300 ? [x, 0, c] :
    [c, 0, x];
  return [rgb[0]! + m, rgb[1]! + m, rgb[2]! + m, 0.92];
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rectColor(rect: Rect, isLight: boolean): [number, number, number, number] {
  const keyed = OFFICIAL_PHASE_COLORS.find((item) => item.test.test(rect.phaseKey));
  if (keyed) return isLight ? keyed.light : keyed.dark;
  const palette = isLight ? LIGHT_BAR_PALETTE : DARK_BAR_PALETTE;
  const base = palette[stableHash(rect.phaseKey || String(rect.colorKey)) % palette.length] ?? rect.color;
  return [
    Math.max(0, Math.min(1, base[0])),
    Math.max(0, Math.min(1, base[1])),
    Math.max(0, Math.min(1, base[2])),
    base[3],
  ];
}

function buildRects(model: Record<string, unknown>): Rect[] {
  const allEvents = Array.isArray(model.all_events) ? model.all_events : [];
  if (allEvents.length) {
    const rankIds = toNumberArray(model.rank_ids);
    const durations = toNumberArray(model.durations);
    const infoIdxes = toNumberArray(model.info_idxes);
    const infos = Array.isArray(model.infos) ? model.infos : [];
    const rects: Rect[] = [];
    const rankToLane = new Map<number, number>();
    const laneForRank = (rank: number) => {
      const key = Number.isFinite(rank) && rank >= 0 ? Math.trunc(rank) : -1;
      const cached = rankToLane.get(key);
      if (cached !== undefined) return cached;
      const next = rankToLane.size;
      rankToLane.set(key, next);
      return next;
    };

    for (let i = 0; i < allEvents.length; i += 1) {
      const event = allEvents[i];
      if (!isRecord(event)) continue;
      const ts = toNumber(event.ts, NaN);
      const dur = Math.max(toNumber(event.dur, durations[i] ?? NaN), 0);
      if (!Number.isFinite(ts) || !Number.isFinite(dur)) continue;
      const rank = rankIds[i] ?? -1;
      const lane = laneForRank(rank);
      const colorIndex = Math.trunc(infoIdxes[i] ?? i);
      const info = isRecord(infos[colorIndex]) ? infos[colorIndex] : {};
      const phaseKey = String(info.name ?? event.name ?? colorIndex);
      rects.push({
        x: ts + dur / 2,
        y: -lane,
        w: Math.max(dur, 1),
        h: PERF_BAR_HEIGHT,
        color: colorAt([], colorIndex),
        index: i,
        colorKey: colorIndex,
        phaseKey,
      });
    }
    if (rects.length) return rects;
  }

  const trs = toNumberArray(model.trs);
  const scales = toNumberArray(model.scales);
  const colors = toNumberArray(model.colors);
  const infoIdxes = toNumberArray(model.info_idxes);
  const rankIds = toNumberArray(model.rank_ids);
  const infos = Array.isArray(model.infos) ? model.infos : [];
  const count = Math.min(Math.floor(trs.length / 3), Math.floor(scales.length / 3));
  const rects: Rect[] = [];
  const rankToLane = new Map<number, number>();
  const laneForRank = (rank: number) => {
    const key = Number.isFinite(rank) && rank >= 0 ? Math.trunc(rank) : -1;
    const cached = rankToLane.get(key);
    if (cached !== undefined) return cached;
    const next = rankToLane.size;
    rankToLane.set(key, next);
    return next;
  };
  for (let i = 0; i < count; i += 1) {
    const tx = trs[i * 3]!;
    const rank = rankIds[i];
    const ty =
      rank !== undefined && Number.isFinite(rank)
        ? -laneForRank(rank)
        : typeof trs[i * 3 + 1] === "number" && Number.isFinite(trs[i * 3 + 1])
          ? trs[i * 3 + 1]!
          : -i;
    const sx = Math.max(Math.abs(scales[i * 3] ?? 0), 0.0001);
    const infoIndex = Math.trunc(infoIdxes[i] ?? i);
    const info = isRecord(infos[infoIndex]) ? infos[infoIndex] : {};
    rects.push({
      x: tx,
      y: ty,
      w: sx,
      h: PERF_BAR_HEIGHT,
      color: colorAt(colors, i),
      index: i,
      colorKey: infoIndex,
      phaseKey: String(info.name ?? infoIndex),
    });
  }
  return rects;
}

function boundsOf(rects: Rect[]) {
  if (!rects.length) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const rect of rects) {
    minX = Math.min(minX, rect.x - rect.w / 2);
    maxX = Math.max(maxX, rect.x + rect.w / 2);
    minY = Math.min(minY, rect.y - rect.h / 2);
    maxY = Math.max(maxY, rect.y + rect.h / 2);
  }
  if (maxY - minY < 12) {
    minY = maxY - 12;
  }
  const padX = Math.max((maxX - minX) * 0.02, 0.01);
  return { minX, maxX: maxX + padX, minY, maxY };
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("PerfMonitor shader compile failed", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function initGl(canvas: HTMLCanvasElement): GlState | null {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
  if (!gl) return null;
  const vertex = compileShader(gl, gl.VERTEX_SHADER, `
    attribute vec2 a_position;
    attribute vec4 a_color;
    varying vec4 v_color;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_color = a_color;
    }
  `);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, `
    precision mediump float;
    varying vec4 v_color;
    void main() {
      gl_FragColor = v_color;
    }
  `);
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  if (!vertex || !fragment || !program || !buffer) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("PerfMonitor program link failed", gl.getProgramInfoLog(program));
    return null;
  }
  return {
    gl,
    program,
    buffer,
    position: gl.getAttribLocation(program, "a_position"),
    color: gl.getAttribLocation(program, "a_color"),
  };
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function isLightTheme(element: Element | null) {
  return Boolean(element?.closest(".tensorpc-dark, .tensorpc-light")?.classList.contains("tensorpc-light"));
}

function scrollMetrics(rects: Rect[], view: ViewState, canvasSize: { width: number; height: number }) {
  if (!rects.length) {
    return {
      verticalSize: 1,
      verticalPos: 0,
      horizontalSize: 1,
      horizontalPos: 0,
    };
  }
  const rowKeys = new Set(rects.map((rect) => Math.round(rect.y * 1000) / 1000));
  const estimatedRows = Math.max(1, rowKeys.size);
  const contentHeight = Math.max(canvasSize.height, estimatedRows * PERF_ROW_PX * view.scaleY);
  const contentWidth = Math.max(canvasSize.width, canvasSize.width * view.scaleX);
  const verticalSize = clamp01(canvasSize.height / Math.max(contentHeight, 1));
  const horizontalSize = clamp01(canvasSize.width / Math.max(contentWidth, 1));
  return {
    verticalSize,
    verticalPos: clamp01(view.scrollY) * (1 - verticalSize),
    horizontalSize,
    horizontalPos: clamp01(view.scrollX) * (1 - horizontalSize),
  };
}

function canvasWorldHeight(view: ViewState, canvasHeight: number) {
  return Math.max(canvasHeight / (PERF_ROW_PX * Math.max(view.scaleY, 1)), 0.0001);
}

function viewBoundsForSize(
  rects: Rect[],
  view: ViewState,
  canvasSize: { width: number; height: number },
) {
  const bounds = boundsOf(rects);
  const width = Math.max(bounds.maxX - bounds.minX, 0.0001);
  const height = Math.max(bounds.maxY - bounds.minY, 0.0001);
  const visibleW = width / Math.max(view.scaleX, 1);
  const visibleH = canvasWorldHeight(view, canvasSize.height);
  const minX = bounds.minX + Math.max(width - visibleW, 0) * view.scrollX;
  const maxY = bounds.maxY - Math.max(height - visibleH, 0) * view.scrollY;
  return {
    minX,
    maxX: minX + visibleW,
    minY: maxY - visibleH,
    maxY,
    full: bounds,
  };
}

function scrollYForBottom(
  rects: Rect[],
  view: ViewState,
  canvasSize: { width: number; height: number },
  bottomY: number,
) {
  const bounds = boundsOf(rects);
  const height = Math.max(bounds.maxY - bounds.minY, 0.0001);
  const visibleH = canvasWorldHeight(view, canvasSize.height);
  const scrollable = Math.max(height - visibleH, 0);
  if (scrollable <= 0) return 0;
  return clamp01((bounds.maxY - visibleH - bottomY) / scrollable);
}

function clampViewState(next: ViewState): ViewState {
  return {
    scaleX: Math.max(1, Math.min(100, next.scaleX)),
    scaleY: Math.max(1, Math.min(100, next.scaleY)),
    scrollX: Math.max(0, Math.min(1, next.scrollX)),
    scrollY: Math.max(0, Math.min(1, next.scrollY)),
  };
}

function drawPerf(glState: GlState, rects: Rect[], view: ViewState, selected: number | null) {
  const { gl, program, buffer, position, color } = glState;
  const canvas = gl.canvas as HTMLCanvasElement;
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const isLight = isLightTheme(canvas);
  gl.viewport(0, 0, width, height);
  if (isLight) {
    gl.clearColor(0.88, 0.88, 0.88, 1);
  } else {
    gl.clearColor(0.08, 0.09, 0.1, 1);
  }
  gl.clear(gl.COLOR_BUFFER_BIT);

  const bounds = viewBoundsForSize(rects, view, {
    width: Math.max(1, canvas.clientWidth),
    height: Math.max(1, canvas.clientHeight),
  });
  const rangeX = Math.max(bounds.maxX - bounds.minX, 0.0001);
  const rangeY = Math.max(bounds.maxY - bounds.minY, 0.0001);
  const toX = (x: number) => ((x - bounds.minX) / rangeX) * 2 - 1;
  const toY = (y: number) => ((y - bounds.minY) / rangeY) * 2 - 1;
  const visibleRows = Array.from(
    new Set(
      rects
        .filter((rect) => rect.y + rect.h / 2 >= bounds.minY && rect.y - rect.h / 2 <= bounds.maxY)
        .map((rect) => rect.y),
    ),
  );
  const data = new Float32Array((rects.length * 5 + visibleRows.length + 4) * 6 * 6);
  let offset = 0;
  const pushQuad = (
    left: number,
    right: number,
    top: number,
    bottom: number,
    rgba: [number, number, number, number],
  ) => {
    const [r, g, b, a] = rgba;
    const verts = [
      left,
      top,
      right,
      top,
      left,
      bottom,
      left,
      bottom,
      right,
      top,
      right,
      bottom,
    ];
    for (let i = 0; i < verts.length; i += 2) {
      data[offset++] = verts[i]!;
      data[offset++] = verts[i + 1]!;
      data[offset++] = r;
      data[offset++] = g;
      data[offset++] = b;
      data[offset++] = a;
    }
  };

  for (let i = 0; i < visibleRows.length; i += 1) {
    const y = visibleRows[i]!;
    const rowTop = toY(y + PERF_ROW_BACKGROUND_HALF);
    const rowBottom = toY(y - PERF_ROW_BACKGROUND_HALF);
    pushQuad(
      -1,
      1,
      rowTop,
      rowBottom,
      isLight
        ? (i % 2 === 0 ? [0.9, 0.92, 0.94, 0.2] : [0.86, 0.88, 0.9, 0.16])
        : (i % 2 === 0 ? [0.15, 0.18, 0.21, 0.32] : [0.12, 0.15, 0.18, 0.26]),
    );
  }

  for (const rect of rects) {
    if (
      rect.x + rect.w / 2 < bounds.minX ||
      rect.x - rect.w / 2 > bounds.maxX ||
      rect.y + rect.h / 2 < bounds.minY ||
      rect.y - rect.h / 2 > bounds.maxY
    ) {
      continue;
    }
    const left = toX(rect.x - rect.w / 2);
    const right = toX(rect.x + rect.w / 2);
    const top = toY(rect.y + rect.h / 2);
    const bottom = toY(rect.y - rect.h / 2);
    const minW = 2 / width;
    const minH = 2 / height;
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    const halfW = Math.max(Math.abs(right - left) / 2, minW);
    const halfH = Math.max(Math.abs(bottom - top) / 2, minH);
    const visibleLeft = cx - halfW;
    const visibleRight = cx + halfW;
    const visibleTop = cy - halfH;
    const visibleBottom = cy + halfH;
    const isSelected = rect.index === selected;
    const [r, g, b, a] = rectColor(rect, isLight);
    pushQuad(visibleLeft, visibleRight, visibleTop, visibleBottom, [r, g, b, a]);
    const borderX = 2 / width;
    const borderY = 2 / height;
    const border: [number, number, number, number] = isLight
      ? [0.16, 0.28, 0.34, 0.14]
      : [0.82, 0.92, 1, 0.1];
    pushQuad(visibleLeft, visibleRight, visibleTop, Math.max(visibleBottom, visibleTop - borderY), border);
    pushQuad(visibleLeft, visibleRight, Math.min(visibleTop, visibleBottom + borderY), visibleBottom, border);
    pushQuad(visibleLeft, Math.min(visibleRight, visibleLeft + borderX), visibleTop, visibleBottom, border);
    pushQuad(Math.max(visibleLeft, visibleRight - borderX), visibleRight, visibleTop, visibleBottom, border);
    if (isSelected) {
      const lineX = 4 / width;
      const lineY = 4 / height;
      const red: [number, number, number, number] = [1, 0.08, 0.06, 0.96];
      pushQuad(visibleLeft, visibleRight, visibleTop, Math.max(visibleBottom, visibleTop - lineY), red);
      pushQuad(visibleLeft, visibleRight, Math.min(visibleTop, visibleBottom + lineY), visibleBottom, red);
      pushQuad(visibleLeft, Math.min(visibleRight, visibleLeft + lineX), visibleTop, visibleBottom, red);
      pushQuad(Math.max(visibleLeft, visibleRight - lineX), visibleRight, visibleTop, visibleBottom, red);
    }
  }

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, offset), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(color);
  gl.vertexAttribPointer(color, 4, gl.FLOAT, false, 24, 8);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.drawArrays(gl.TRIANGLES, 0, offset / 6);
}

function hitTest(
  rects: Rect[],
  view: ViewState,
  rect: DOMRect,
  clientX: number,
  clientY: number,
) {
  const bounds = viewBoundsForSize(rects, view, {
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
  });
  const x = bounds.minX + ((clientX - rect.left) / Math.max(rect.width, 1)) * (bounds.maxX - bounds.minX);
  const y = bounds.maxY - ((clientY - rect.top) / Math.max(rect.height, 1)) * (bounds.maxY - bounds.minY);
  for (let i = rects.length - 1; i >= 0; i -= 1) {
    const item = rects[i]!;
    if (
      x >= item.x - item.w / 2 &&
      x <= item.x + item.w / 2 &&
      y >= item.y - item.h / 2 &&
      y <= item.y + item.h / 2
    ) {
      return item.index;
    }
  }
  return null;
}

function findFirstType(
  layout: Record<string, ComponentProps>,
  roots: string[],
  type: number,
  seen = new Set<string>(),
): ComponentProps | null {
  for (const uid of roots) {
    if (seen.has(uid)) continue;
    seen.add(uid);
    const node = lookupLayoutNode(layout, uid);
    if (!node) continue;
    if (node.type === type) return node;
    const found = findFirstType(layout, childUids(node.props ?? {}), type, seen);
    if (found) return found;
  }
  return null;
}

function textFromUnknown(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(textFromUnknown).filter(Boolean).join(" ");
  if (isRecord(value)) return textFromUnknown(value.value ?? value.text ?? value.label ?? value.children);
  return "";
}

function textFromProps(props: Record<string, unknown>) {
  return textFromUnknown(props.value ?? props.text ?? props.label ?? props.children).trim();
}

function findFirstMatching(
  layout: Record<string, ComponentProps>,
  roots: string[],
  predicate: (node: ComponentProps) => boolean,
  seen = new Set<string>(),
): ComponentProps | null {
  for (const uid of roots) {
    if (seen.has(uid)) continue;
    seen.add(uid);
    const node = lookupLayoutNode(layout, uid);
    if (!node) continue;
    if (predicate(node)) return node;
    const found = findFirstMatching(layout, childUids(node.props ?? {}), predicate, seen);
    if (found) return found;
  }
  return null;
}

function nodeCompUid(node: ComponentProps | null) {
  if (!node) return "";
  return typeof node.uid === "string" ? node.uid : "";
}

function nodeUsesEvent(node: ComponentProps, eventType: number) {
  if (!Array.isArray(node.usedEvents)) return false;
  return node.usedEvents.some((item) => {
    if (item === eventType) return true;
    if (!isRecord(item)) return false;
    return item.type === eventType || item.eventType === eventType || item.event === eventType;
  });
}

function pointerPayloadForInstance(instanceId: number, offset: [number, number], pointLocal: [number, number, number]) {
  return {
    distance: 0,
    pointer: [0, 0],
    unprojectedPoint: [0, 0, 0],
    ray: {
      origin: [0, 0, 0],
      direction: [0, 0, -1],
    },
    offset,
    point: pointLocal,
    pointLocal,
    instanceId,
    numIntersections: 1,
  };
}

function parseStepHeader(text: string) {
  const match = text.match(/Step[-\s]*(\d+)(?:\s*\(([-+]?\d+(?:\.\d+)?)s?\))?/i);
  if (!match) return { step: null as number | null, duration: null as number | null, label: "" };
  const step = Number(match[1]);
  const duration = match[2] !== undefined ? Number(match[2]) : null;
  return {
    step: Number.isFinite(step) ? step : null,
    duration: duration !== null && Number.isFinite(duration) ? duration : null,
    label: match[0],
  };
}

function valueAtKey(source: unknown, key: number | string) {
  if (Array.isArray(source)) {
    const index = typeof key === "number" ? key : Number(key);
    return Number.isInteger(index) && index >= 0 ? source[index] : undefined;
  }
  if (isRecord(source)) {
    const stringKey = String(key);
    if (Object.prototype.hasOwnProperty.call(source, stringKey)) return source[stringKey];
  }
  return undefined;
}

function firstDefined(...values: unknown[]) {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return undefined;
}

function metaForModel(
  model: Record<string, unknown>,
  rank: number,
  instanceId: number,
  info: Record<string, unknown>,
  event: Record<string, unknown>,
) {
  const eventArgs = isRecord(event.args) ? event.args : {};
  const direct = firstDefined(
    event.meta,
    event.metadata,
    eventArgs.meta,
    eventArgs.metadata,
    info.meta,
    info.metadata,
  );
  if (direct !== undefined) return direct;
  const byRank = rank >= 0 ? valueAtKey(model.meta_datas, rank) : undefined;
  if (byRank !== undefined) return byRank;
  const byInstance = valueAtKey(model.meta_datas, instanceId);
  return byInstance !== undefined ? byInstance : null;
}

function infoFor(model: Record<string, unknown>, instanceId: number | null) {
  if (instanceId === null) return null;
  const infos = Array.isArray(model.infos) ? model.infos : [];
  const infoIdxes = toNumberArray(model.info_idxes);
  const rankIds = toNumberArray(model.rank_ids);
  const durations = toNumberArray(model.durations);
  const allEvents = Array.isArray(model.all_events) ? model.all_events : [];
  const infoIndex = Math.trunc(infoIdxes[instanceId] ?? -1);
  const info = isRecord(infos[infoIndex]) ? infos[infoIndex] : {};
  const event = isRecord(allEvents[instanceId]) ? allEvents[instanceId] : {};
  const rank = Math.trunc(rankIds[instanceId] ?? -1);
  const eventDuration = toMaybeNumber(event.dur);
  const duration = durations[instanceId] ?? (eventDuration !== null ? eventDuration / 1e9 : null);
  const eventTs = toMaybeNumber(event.ts);
  const allDuration = toMaybeNumber(info.duration);
  const rate = toMaybeNumber(info.rate);
  const cnt = firstDefined(event.cnt, info.cnt);
  const meta = metaForModel(model, rank, instanceId, info, event);
  return {
    name: info.name ?? event.name ?? null,
    instance_id: instanceId,
    info_index: infoIndex >= 0 ? infoIndex : null,
    phase: info.name ?? event.name ?? null,
    rank: Number.isFinite(rank) ? rank : null,
    duration,
    all_duration: allDuration,
    rate,
    start_ts: eventTs,
    end_ts: eventTs !== null && eventDuration !== null ? eventTs + eventDuration : null,
    cnt,
    meta,
    info,
    event,
  };
}

export function isPerfMonitorDataModel(props: Record<string, unknown>) {
  const model = props.dataObject;
  if (!isRecord(model)) return false;
  return "trs" in model && "scales" in model && "colors" in model && "info_idxes" in model && "rank_ids" in model;
}

export function PerfMonitorViewer({
  props,
  layout,
  children,
}: {
  props: Record<string, unknown>;
  layout: Record<string, ComponentProps>;
  children: ReactNode[];
}) {
  const sendEvent = useSendEvent();
  const model = (isRecord(props.dataObject) ? props.dataObject : {}) as Record<string, unknown>;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glRef = useRef<GlState | null>(null);
  const rectsRef = useRef<Rect[]>([]);
  const canvasSizeRef = useRef({ width: 1, height: 1 });
  const viewRef = useRef<ViewState>({
    scaleX: Math.max(1, toNumber(model.scaleX, 1)),
    scaleY: 1,
    scrollX: toNumber(model.scrollValueX, 0),
    scrollY: 0,
  });
  const keyHoldRef = useRef(new Set<string>());
  const cameraFrameRef = useRef(0);
  const cameraLastTsRef = useRef(0);
  const pointerAnchorXRef = useRef(0.5);
  const [view, setView] = useState<ViewState>({
    scaleX: Math.max(1, toNumber(model.scaleX, 1)),
    scaleY: 1,
    scrollX: toNumber(model.scrollValueX, 0),
    scrollY: 0,
  });
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [detailWidth, setDetailWidth] = useState(280);
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });
  const [themeRevision, setThemeRevision] = useState(0);
  const [sliderDraftValue, setSliderDraftValue] = useState<number | null>(null);
  const roots = useMemo(() => childUids(props), [props]);
  const clickTarget = useMemo(
    () =>
      findFirstMatching(
        layout,
        roots,
        (node) => node.type === UIType.ThreeInstancedMesh && nodeUsesEvent(node, FrontendEventType.Click),
      ) ?? findFirstType(layout, roots, UIType.ThreeInstancedMesh),
    [layout, roots],
  );
  const clickTargetUid = nodeCompUid(clickTarget);
  const slider = useMemo(() => findFirstType(layout, roots, UIType.BlenderSlider), [layout, roots]);
  const detailViewer = useMemo(() => findFirstType(layout, roots, UIType.JsonViewer), [layout, roots]);
  const backendDetail = detailViewer?.props?.value ?? detailViewer?.props?.data;
  const header = useMemo(
    () =>
      findFirstMatching(
        layout,
        roots,
        (node) => node.type === UIType.Typography && /Step/i.test(textFromProps(node.props ?? {})),
      ),
    [layout, roots],
  );
  const headerText = textFromProps(header?.props ?? {});
  const headerStep = parseStepHeader(headerText);
  const sliderProps = slider?.props ?? {};
  const sliderMin = toNumber(sliderProps.min, 0);
  const sliderMax = toNumber(sliderProps.max, sliderMin);
  const sliderValue = toNumber(sliderProps.value ?? sliderProps.defaultValue, sliderMin);
  const sliderStep = toNumber(sliderProps.step, 1);
  const sliderRange = Math.max(sliderMax - sliderMin, 0);
  const activeSliderValue = Math.max(sliderMin, Math.min(sliderMax, sliderDraftValue ?? sliderValue));
  const sliderPct = sliderRange > 0 ? Math.max(0, Math.min(100, ((activeSliderValue - sliderMin) / sliderRange) * 100)) : 0;
  const sliderCompUid = typeof sliderProps.compUid === "string" ? sliderProps.compUid : "";
  const rects = useMemo(() => buildRects(model), [model]);
  rectsRef.current = rects;
  const selectedInfo = useMemo(() => infoFor(model, selected), [model, selected]);
  const metrics = useMemo(() => scrollMetrics(rects, view, canvasSize), [canvasSize, rects, view]);
  const total = Math.max(toNumber(model.total_duration, 0) / 1e9, 0);
  const rawStep = toMaybeNumber(model.step);
  const modelStep = rawStep !== null && rawStep >= 0 ? Math.trunc(rawStep) : null;
  const displayStep = headerStep.step ?? modelStep;
  const displayDuration = headerStep.duration ?? (total > 0 ? total : toNumber(model.duration, 0));
  const hasStepDisplay = displayStep !== null;
  const stepTitle = hasStepDisplay
    ? `Step-${displayStep} (${displayDuration.toFixed(2)}s)`
    : headerText || "Step -- (0.00s)";
  const sliderLabel = `${displayValue(activeSliderValue, sliderProps.fractionDigits)} / ${displayValue(sliderMax, sliderProps.fractionDigits)}`;
  const metaJson = useMemo(() => {
    if (backendDetail !== undefined && backendDetail !== null) return JSON.stringify(backendDetail, null, 2);
    if (selectedInfo) return JSON.stringify(selectedInfo, null, 2);
    if (!rects.length) return "null";
    return JSON.stringify(
      {
        status: "select a performance bar",
        step: displayStep,
        trace_index: activeSliderValue,
        events: rects.length,
        duration: total ? Number(total.toFixed(4)) : 0,
      },
      null,
      2,
    );
  }, [activeSliderValue, backendDetail, displayStep, rects.length, selectedInfo, total]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    setSliderDraftValue(null);
  }, [sliderMax, sliderMin, sliderValue]);

  useEffect(() => () => {
    if (cameraFrameRef.current) {
      cancelAnimationFrame(cameraFrameRef.current);
      cameraFrameRef.current = 0;
    }
  }, []);

  useEffect(() => {
    const themeRoot = rootRef.current?.closest(".tensorpc-dark, .tensorpc-light");
    if (!themeRoot) return;
    const observer = new MutationObserver(() => {
      setThemeRevision((revision) => revision + 1);
    });
    observer.observe(themeRoot, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setSelected(null);
    setHovered(null);
    setView({
      scaleX: Math.max(1, toNumber(model.scaleX, 1)),
      scaleY: 1,
      scrollX: toNumber(model.scrollValueX, 0),
      scrollY: 0,
    });
  }, [model.step]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!glRef.current) glRef.current = initGl(canvas);
    if (glRef.current) drawPerf(glRef.current, rects, view, selected);
  }, [rects, selected, themeRevision, view]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateCanvasSize = () => {
      const nextSize = {
        width: Math.max(1, canvas.clientWidth),
        height: Math.max(1, canvas.clientHeight),
      };
      const previousSize = canvasSizeRef.current;
      if (previousSize.width === nextSize.width && previousSize.height === nextSize.height) return;
      const resizeRects = rectsRef.current;
      setView((current) => {
        const bottomY = viewBoundsForSize(resizeRects, current, previousSize).minY;
        return clampViewState({
          ...current,
          scrollY: scrollYForBottom(resizeRects, current, nextSize, bottomY),
        });
      });
      canvasSizeRef.current = nextSize;
      setCanvasSize(nextSize);
    };
    updateCanvasSize();
    const observer = new ResizeObserver(updateCanvasSize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (glRef.current) drawPerf(glRef.current, rects, view, selected);
  }, [canvasSize, rects, selected, themeRevision, view]);

  const adjustView = (patch: Partial<ViewState>) => {
    setView((current) => clampViewState({ ...current, ...patch }));
  };

  const stopCameraLoop = () => {
    keyHoldRef.current.clear();
    if (cameraFrameRef.current) {
      cancelAnimationFrame(cameraFrameRef.current);
      cameraFrameRef.current = 0;
    }
    cameraLastTsRef.current = 0;
  };

  const stepCamera = (ts: number) => {
    const held = keyHoldRef.current;
    if (!held.size) {
      cameraFrameRef.current = 0;
      cameraLastTsRef.current = 0;
      return;
    }
    const lastTs = cameraLastTsRef.current || ts;
    const deltaTime = Math.min(Math.max(ts - lastTs, 0), 50);
    cameraLastTsRef.current = ts;
    setView((current) => {
      let next = current;
      const zoomIn = held.has("KeyW");
      const zoomOut = held.has("KeyS");
      const panLeft = held.has("KeyA");
      const panRight = held.has("KeyD");
      if (zoomIn || zoomOut) {
        const direction = zoomIn ? 1 : -1;
        const prevScale = next.scaleX;
        const nextScale = Math.max(1, Math.min(100, prevScale + direction * deltaTime * 0.002 * prevScale));
        const realDx = nextScale - prevScale;
        const anchor = pointerAnchorXRef.current;
        const nextScrollX =
          nextScale <= 1
            ? 0
            : clamp01((anchor - next.scrollX) * realDx / Math.max(nextScale - 1, 1e-6) + next.scrollX);
        next = { ...next, scaleX: nextScale, scrollX: nextScrollX };
      }
      if (panLeft || panRight) {
        const direction = panLeft ? -1 : 1;
        const delta = direction * deltaTime * 0.002 / Math.max(next.scaleX, 1);
        next = { ...next, scrollX: next.scaleX <= 1 ? 0 : clamp01(next.scrollX + delta) };
      }
      return clampViewState(next);
    });
    cameraFrameRef.current = requestAnimationFrame(stepCamera);
  };

  const startCameraLoop = () => {
    if (cameraFrameRef.current) return;
    cameraLastTsRef.current = 0;
    cameraFrameRef.current = requestAnimationFrame(stepCamera);
  };

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.ctrlKey || event.metaKey) {
      const rect = event.currentTarget.getBoundingClientRect();
      pointerAnchorXRef.current = clamp01((event.clientX - rect.left) / Math.max(rect.width, 1));
      const scale = Math.exp(-event.deltaY * 0.0015);
      setView((current) => {
        const nextScale = Math.max(1, Math.min(100, current.scaleX * scale));
        const realDx = nextScale - current.scaleX;
        const anchor = pointerAnchorXRef.current;
        return clampViewState({
          ...current,
          scaleX: nextScale,
          scrollX:
            nextScale <= 1
              ? 0
              : clamp01((anchor - current.scrollX) * realDx / Math.max(nextScale - 1, 1e-6) + current.scrollX),
        });
      });
      return;
    }
    if (event.shiftKey) {
      if (metrics.horizontalSize >= 0.999) return;
      adjustView({ scrollX: view.scrollX + event.deltaY * 0.001 });
      return;
    }
    if (metrics.verticalSize >= 0.999) return;
    adjustView({ scrollY: view.scrollY + event.deltaY * 0.001 });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const code = event.code;
    if (!["KeyW", "KeyS", "KeyA", "KeyD"].includes(code)) return;
    event.preventDefault();
    keyHoldRef.current.add(code);
    startCameraLoop();
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const code = event.code;
    if (!["KeyW", "KeyS", "KeyA", "KeyD"].includes(code)) return;
    event.preventDefault();
    keyHoldRef.current.delete(code);
  };

  const sendSliderValue = (value: number) => {
    const stepped =
      sliderStep > 0
        ? sliderMin + Math.round((value - sliderMin) / sliderStep) * sliderStep
        : value;
    const next = Math.max(sliderMin, Math.min(sliderMax, stepped));
    setSliderDraftValue(next);
    if (sliderCompUid) void sendEvent(sliderCompUid, CHANGE_EVENT, next);
  };

  const startDetailResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = detailWidth;
    const handleMove = (moveEvent: PointerEvent) => {
      setDetailWidth(Math.max(DETAIL_MIN, Math.min(DETAIL_MAX, startWidth - (moveEvent.clientX - startX))));
    };
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  return (
    <div
      ref={rootRef}
      role="application"
      aria-label="performance monitor"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onBlur={stopCameraLoop}
      data-tensorpc-perf-monitor=""
      style={{
        width: "100%",
        height: "100%",
        flex: "1 1 0%",
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        flexDirection: "row",
        overflow: "hidden",
        background: "var(--td-bg)",
        color: "var(--td-text)",
      }}
    >
      <div
        style={{
          flex: "1 1 0%",
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flexShrink: 0,
            height: 28,
            display: "flex",
            alignItems: "center",
            borderBottom: "1px solid var(--td-border)",
            color: "var(--td-text-muted)",
            fontSize: 12,
            padding: "3px 6px",
            gap: 6,
            background: "var(--td-surface)",
          }}
        >
          <div
            style={{
              flex: "0 0 clamp(150px, 24%, 260px)",
              minWidth: 0,
              height: 18,
              display: "flex",
              alignItems: "center",
              padding: "0 6px",
              borderRadius: 2,
              background: "rgba(148, 163, 184, 0.14)",
              boxShadow: "inset 0 0 0 1px rgba(148, 163, 184, 0.18)",
              color: "var(--td-text)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            }}
            title={stepTitle}
          >
            {stepTitle}
          </div>
          {slider && sliderHasRange(slider.props ?? {}) ? (
            <div
              style={{
                position: "relative",
                flex: "1 1 0%",
                minWidth: 0,
                height: 18,
                borderRadius: 2,
                background: "color-mix(in srgb, var(--td-surface-3) 80%, var(--td-bg))",
                boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--td-border) 82%, transparent)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 34,
                  right: 34,
                  borderRadius: 2,
                  background: "color-mix(in srgb, var(--td-text-muted) 45%, var(--td-surface-2))",
                }}
              />
              <button
                type="button"
                aria-label="Previous performance step"
                disabled={sliderProps.disabled === true || activeSliderValue <= sliderMin}
                onClick={(event) => {
                  event.stopPropagation();
                  sendSliderValue(activeSliderValue - sliderStep);
                }}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 34,
                  zIndex: 2,
                  border: 0,
                  borderRight: "1px solid color-mix(in srgb, var(--td-border) 72%, transparent)",
                  background: "transparent",
                  color: "var(--td-text)",
                  cursor:
                    sliderProps.disabled === true || activeSliderValue <= sliderMin ? "default" : "pointer",
                  opacity: sliderProps.disabled === true || activeSliderValue <= sliderMin ? 0.38 : 1,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: 11,
                }}
              >
                {"<"}
              </button>
              <button
                type="button"
                aria-label="Next performance step"
                disabled={sliderProps.disabled === true || activeSliderValue >= sliderMax}
                onClick={(event) => {
                  event.stopPropagation();
                  sendSliderValue(activeSliderValue + sliderStep);
                }}
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: 34,
                  zIndex: 2,
                  border: 0,
                  borderLeft: "1px solid color-mix(in srgb, var(--td-border) 72%, transparent)",
                  background: "transparent",
                  color: "var(--td-text)",
                  cursor:
                    sliderProps.disabled === true || activeSliderValue >= sliderMax ? "default" : "pointer",
                  opacity: sliderProps.disabled === true || activeSliderValue >= sliderMax ? 0.38 : 1,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: 11,
                }}
              >
                {">"}
              </button>
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 34,
                  width: `calc((100% - 68px) * ${sliderPct / 100})`,
                  borderRadius: 2,
                  background: "color-mix(in srgb, var(--td-blue) 78%, var(--td-surface-2))",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--td-text)",
                  fontWeight: 600,
                  textShadow: "0 1px 1px color-mix(in srgb, var(--td-bg) 70%, transparent)",
                  pointerEvents: "none",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                }}
              >
                {sliderLabel}
              </div>
              <input
                aria-label="Performance step"
                type="range"
                min={sliderMin}
                max={sliderMax}
                step={sliderStep}
                value={activeSliderValue}
                disabled={sliderProps.disabled === true}
                onInput={(event) => sendSliderValue(Number(event.currentTarget.value))}
                onChange={(event) => sendSliderValue(Number(event.target.value))}
                style={{
                  position: "absolute",
                  left: 34,
                  right: 34,
                  top: 0,
                  width: "calc(100% - 68px)",
                  height: "100%",
                  margin: 0,
                  opacity: 0,
                  cursor: sliderProps.disabled === true ? "default" : "pointer",
                }}
              />
            </div>
          ) : (
            <div
              style={{
                position: "relative",
                flex: "1 1 0%",
                minWidth: 0,
                height: 18,
                borderRadius: 2,
                background: "color-mix(in srgb, var(--td-surface-3) 80%, var(--td-bg))",
                boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--td-border) 82%, transparent)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 36,
                  right: 36,
                  background: "color-mix(in srgb, var(--td-text-muted) 45%, var(--td-surface-2))",
                  borderRadius: 2,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--td-text)",
                  fontWeight: 600,
                  textShadow: "0 1px 1px color-mix(in srgb, var(--td-bg) 70%, transparent)",
                  pointerEvents: "none",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                }}
              >
                0 / 0
              </div>
            </div>
          )}
        </div>
        <div
          style={{
            position: "relative",
            flex: "1 1 0%",
            minHeight: 0,
            minWidth: 0,
            overflow: "hidden",
            background: "var(--td-surface-2)",
          }}
        >
          <canvas
            ref={canvasRef}
            onWheel={handleWheel}
            onPointerMove={(event) => {
              const canvas = canvasRef.current;
              if (!canvas) return;
              const rect = canvas.getBoundingClientRect();
              pointerAnchorXRef.current = clamp01((event.clientX - rect.left) / Math.max(rect.width, 1));
              setHovered(hitTest(rects, view, rect, event.clientX, event.clientY));
            }}
            onPointerLeave={() => setHovered(null)}
            onPointerDown={() => rootRef.current?.focus({ preventScroll: true })}
            onClick={(event) => {
              const canvas = canvasRef.current;
              if (!canvas) return;
              const rect = canvas.getBoundingClientRect();
              pointerAnchorXRef.current = clamp01((event.clientX - rect.left) / Math.max(rect.width, 1));
              const hit = hitTest(rects, view, rect, event.clientX, event.clientY);
              setSelected(hit);
              if (hit !== null && clickTargetUid) {
                const hitRect = rects.find((item) => item.index === hit);
                void sendEvent(
                  clickTargetUid,
                  FrontendEventType.Click,
                  pointerPayloadForInstance(
                    hit,
                    [event.clientX - rect.left, event.clientY - rect.top],
                    [hitRect?.x ?? 0, hitRect?.y ?? 0, 0],
                  ),
                );
              }
            }}
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              outline: "none",
              cursor: hovered !== null ? "pointer" : "crosshair",
            }}
          />
          {metrics.verticalSize < 0.999 && (
            <div
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                const rect = event.currentTarget.getBoundingClientRect();
                adjustView({ scrollY: (event.clientY - rect.top) / Math.max(rect.height, 1) });
              }}
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                width: 20,
                bottom: metrics.horizontalSize < 0.999 ? 24 : 4,
                border: "1px solid color-mix(in srgb, var(--td-border) 80%, transparent)",
                background: "color-mix(in srgb, var(--td-surface-3) 70%, transparent)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 3,
                  right: 3,
                  height: `${Math.max(14, metrics.verticalSize * 100)}%`,
                  top: `${metrics.verticalPos * 100}%`,
                  background: "#ffc32b",
                }}
              />
            </div>
          )}
          {metrics.horizontalSize < 0.999 && (
            <div
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                const rect = event.currentTarget.getBoundingClientRect();
                adjustView({ scrollX: (event.clientX - rect.left) / Math.max(rect.width, 1) });
              }}
              style={{
                position: "absolute",
                left: 4,
                right: metrics.verticalSize < 0.999 ? 28 : 4,
                bottom: 4,
                height: 18,
                border: "1px solid color-mix(in srgb, var(--td-border) 80%, transparent)",
                background: "color-mix(in srgb, var(--td-surface-3) 70%, transparent)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 3,
                  bottom: 3,
                  width: `${Math.max(14, metrics.horizontalSize * 100)}%`,
                  left: `${metrics.horizontalPos * 100}%`,
                  background: "#ffc32b",
                }}
              />
            </div>
          )}
        </div>
      </div>
      <div
        onPointerDown={startDetailResize}
        style={{
          width: 5,
          flexShrink: 0,
          cursor: "col-resize",
          background: "var(--td-border)",
        }}
      />
      <div
        style={{
          width: detailWidth,
          flexShrink: 0,
          minWidth: DETAIL_MIN,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          background: "var(--td-surface)",
          borderLeft: "1px solid var(--td-border)",
          color: "var(--td-text)",
        }}
      >
        <pre
          style={{
            flex: "1 1 0%",
            minHeight: 0,
            margin: 0,
            padding: 10,
            overflowX: "hidden",
            overflowY: "scroll",
            scrollbarGutter: "stable",
            scrollbarColor: "#ffc32b rgba(255,255,255,0.12)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            color: "var(--td-text)",
            fontSize: 12,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          }}
        >
          {metaJson}
        </pre>
      </div>
      {!slider && children.length > 0 && <div style={{ display: "none" }}>{children}</div>}
    </div>
  );
}
