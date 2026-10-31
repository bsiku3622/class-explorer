/**
 * CSS 변수 — 토큰 tree 를 `--fk-*` 변수로 굽는 유일한 자리입니다.
 *
 * `vars` 는 tree 와 같은 모양의 `var(--fk-…)` 참조이고, `ROOT_VALUES` 는 `:root` 에 쓸 값입니다.
 * 이름이 해시가 아니라 고정이라, 소비 앱의 CSS(예: Tailwind 의 `bg-[var(--fk-surface-canvas)]`)도
 * 같은 변수를 읽을 수 있습니다.
 */
import { ACCENT_COLORS, FOCUS, GLASS, INK, LINE, OVERLAY, SELECTION, SHADOW_COLOR, STATE_LAYER, SURFACE } from "./color";
import { ELEVATION, SPACE } from "./layout";
import { DURATION, EASING, PRESS, ms } from "./motion";
import { FOCUS_RING, STROKE } from "./shape";
import { FONT_FAMILY } from "./typography";

const rem = (n: number) => (n === 0 ? "0" : `${n / 16}rem`);
const pxv = (n: number) => `${n}px`;
const shadow = (offset: number) => (offset === 0 ? "none" : `${offset}px ${offset}px 0 0 ${SHADOW_COLOR}`);

/** 변수로 굽는 값 tree. 숫자는 여기서 단위를 얻습니다 */
const TREE = {
  surface: SURFACE,
  ink: INK,
  line: LINE,
  overlay: OVERLAY,
  glass: GLASS,
  state: STATE_LAYER,
  focus: FOCUS,
  selection: SELECTION,
  shadowColor: SHADOW_COLOR,
  /** 지금 accent — `:root` 는 검정(시스템)이고, accent class 가 이 일곱 칸을 덮어씁니다 */
  accent: ACCENT_COLORS.black,
  font: FONT_FAMILY,
  stroke: { hair: pxv(STROKE.hair), base: pxv(STROKE.base), rail: pxv(STROKE.rail) },
  focusRing: { width: pxv(FOCUS_RING.width), offset: pxv(FOCUS_RING.offset) },
  space: Object.fromEntries(Object.entries(SPACE).map(([k, v]) => [k, rem(v)])) as Record<keyof typeof SPACE, string>,
  shadow: { raised: shadow(ELEVATION.raised.offset), floating: shadow(ELEVATION.floating.offset) },
  duration: Object.fromEntries(Object.entries(DURATION).map(([k, v]) => [k, ms(v)])) as Record<keyof typeof DURATION, string>,
  easing: EASING,
  press: {
    sink: pxv(PRESS.sink),
    scale: String(PRESS.activeScale),
    surfaceScale: String(PRESS.surfaceScale),
    grow: String(PRESS.grow),
    shrink: String(PRESS.shrink),
    shrinkActive: String(PRESS.shrinkActive),
  },
} as const;

type VarTree<T> = { readonly [K in keyof T]: T[K] extends string | number ? string : VarTree<T[K]> };

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

const flat: Record<string, string> = {};
function build<T extends object>(node: T, path: string[]): VarTree<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    const next = [...path, kebab(key)];
    if (typeof value === "object" && value !== null) out[key] = build(value as object, next);
    else {
      const name = `--fk-${next.join("-")}`;
      flat[name] = String(value);
      out[key] = `var(${name})`;
    }
  }
  return out as VarTree<T>;
}

/** `vars.surface.canvas` → `"var(--fk-surface-canvas)"` */
export const vars = build(TREE, []);

/** `:root` 에 쓸 변수 이름 → 값 */
export const ROOT_VALUES: Readonly<Record<string, string>> = flat;

/** 누르는 순간의 크기 변수 — 큰 면(카드)은 자기 class 에서 이 변수를 `PRESS.surfaceScale` 로 덮습니다 */
export const PRESS_SCALE_VAR = "--fk-press-scale";

/** accent 일곱 칸의 변수 이름 — accent class 가 이 이름들로 덮어씁니다 */
export const ACCENT_VAR_NAMES = {
  ink: "--fk-accent-ink",
  solidInk: "--fk-accent-solid-ink",
  solid: "--fk-accent-solid",
  soft: "--fk-accent-soft",
  softInk: "--fk-accent-soft-ink",
  tint: "--fk-accent-tint",
  tintStrong: "--fk-accent-tint-strong",
} as const;
