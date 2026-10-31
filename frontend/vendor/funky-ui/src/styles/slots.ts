/**
 * Variant 슬롯 — 레시피(칸 이름)를 CSS 변수 값으로 옮기는 규칙. `.css.ts` 가 아닌 일반 모듈이라
 * 함수를 내보낼 수 있습니다 (vanilla-extract 는 .css.ts 에서 함수 export 를 막습니다).
 */
import type { Layer, Rung, VariantRecipe } from "../tokens/color-recipes";
import { vars } from "../tokens/variables";

export const SLOT = {
  fg: "--fk-fg",
  bg: "--fk-bg",
  border: "--fk-border",
  hoverLayer: "--fk-hover-layer",
  hoverFg: "--fk-hover-fg",
  hoverBorder: "--fk-hover-border",
  pressLayer: "--fk-press-layer",
} as const;

export const slot = {
  fg: `var(${SLOT.fg})`,
  bg: `var(${SLOT.bg})`,
  border: `var(${SLOT.border})`,
  hoverLayer: `var(${SLOT.hoverLayer})`,
  hoverFg: `var(${SLOT.hoverFg})`,
  hoverBorder: `var(${SLOT.hoverBorder})`,
  pressLayer: `var(${SLOT.pressLayer})`,
} as const;

const RUNG: Record<Rung, string> = {
  ink: vars.accent.ink,
  solidInk: vars.accent.solidInk,
  solid: vars.accent.solid,
  soft: vars.accent.soft,
  softInk: vars.accent.softInk,
  black: vars.ink.primary,
  gray: vars.ink.muted,
  line: vars.line.base,
  white: vars.surface.raised,
  none: "transparent",
};

const HOVER_LAYER: Record<Layer, string> = {
  white: vars.overlay.hoverWhite,
  gray: vars.overlay.hoverGray,
  tint: vars.accent.tint,
  none: "transparent",
};

const PRESS_LAYER: Record<Layer, string> = {
  white: vars.overlay.pressWhite,
  gray: vars.overlay.pressGray,
  tint: vars.accent.tintStrong,
  none: "transparent",
};

/** hover 층이 없는 variant 도 누르는 순간은 보여야 합니다 — 상자가 있으면 accent 오버레이를 얹습니다 */
function pressLayerOf(r: VariantRecipe): Layer {
  if (r.hover.layer) return r.hover.layer;
  return r.border === "none" ? "none" : "tint";
}

/**
 * ⚠️ 모든 variant 가 슬롯 일곱을 **전부** 씁니다. 변수는 상속되므로 하나라도 비워 두면
 * 바깥 컨트롤의 값이 새어 들어옵니다 (Card 안 Button 처럼 겹칠 때).
 */
export function slotValues(r: VariantRecipe): Record<string, string> {
  return {
    [SLOT.fg]: RUNG[r.fg],
    [SLOT.bg]: RUNG[r.bg],
    [SLOT.border]: RUNG[r.border],
    [SLOT.hoverLayer]: HOVER_LAYER[r.hover.layer ?? "none"],
    [SLOT.hoverFg]: RUNG[r.hover.fg ?? r.fg],
    [SLOT.hoverBorder]: RUNG[r.hover.border ?? r.border],
    [SLOT.pressLayer]: PRESS_LAYER[pressLayerOf(r)],
  };
}
