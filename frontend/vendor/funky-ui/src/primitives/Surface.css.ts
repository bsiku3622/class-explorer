/**
 * Surface 의 칠 — 흑백 면 · 테두리 · 그림자 · 상태 층 (fk.primitives).
 *
 * 면은 글자색도 정합니다: 흰 · 크림 면은 바깥 글자색을 그대로 물려받고(`<a>` 로 그려도 파란 링크색이
 * 남지 않습니다), 어두운 면(`inverse` · 보라 `brand`)은 흰 글자로 바꿔 검정 위 검정 글자가 생기지 않습니다.
 * `hoverable` 의 상태 층은 그 글자색을 묽혀 만들어서, 어느 면 위에서도 한 단 바뀝니다.
 */
import { style, styleVariants } from "@vanilla-extract/css";

import { primitives } from "../tokens/layers.css";
import { STATE_TRANSITION } from "../tokens/motion";
import { vars } from "../tokens/variables";
import type { Border, Shadow, SurfaceFill } from "../tokens/vocabulary";

const p = (rule: Record<string, unknown>) => ({ "@layer": { [primitives]: rule } });
const ENABLED = ":not(:disabled):not([aria-disabled='true'])";
const layer = (c: string) => `linear-gradient(${c}, ${c})`;

export const fillClass = styleVariants({
  none: p({ backgroundColor: "transparent", color: "inherit" }),
  canvas: p({ backgroundColor: vars.surface.canvas, color: "inherit" }),
  raised: p({ backgroundColor: vars.surface.raised, color: "inherit" }),
  sunken: p({ backgroundColor: vars.surface.sunken, color: "inherit" }),
  well: p({ backgroundColor: vars.surface.well, color: "inherit" }),
  inverse: p({ backgroundColor: vars.surface.inverse, color: vars.ink.inverse }),
  brand: p({ backgroundColor: vars.surface.brand, color: vars.ink.inverse }),
} satisfies Record<SurfaceFill, object>);

export const borderClass = styleVariants({
  none: p({}),
  line: p({ border: `${vars.stroke.base} solid ${vars.line.base}` }),
  soft: p({ border: `${vars.stroke.base} solid ${vars.line.soft}` }),
  subtle: p({ border: `${vars.stroke.base} solid ${vars.line.subtle}` }),
} satisfies Record<Border, object>);

/** hover · 누르는 중의 흑백 상태 층 — 면 · 글자 · 테두리는 그대로 두고 위에 덮습니다. 꺼진 요소(disabled · aria-disabled)에는 걸지 않습니다 */
export const hoverable = style(
  p({
    transitionProperty: STATE_TRANSITION,
    transitionDuration: vars.duration.fast,
    transitionTimingFunction: vars.easing.standard,
    selectors: {
      [`&${ENABLED}:hover`]: { backgroundImage: layer(vars.state.hover) },
      [`&${ENABLED}:active`]: { backgroundImage: layer(vars.state.press) },
    },
  }),
);

export const shadowClass = styleVariants({
  none: p({}),
  raised: p({ boxShadow: vars.shadow.raised }),
  floating: p({ boxShadow: vars.shadow.floating }),
} satisfies Record<Shadow, object>);
