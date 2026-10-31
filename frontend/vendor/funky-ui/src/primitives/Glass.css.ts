/**
 * Glass 의 칠 (fk.primitives) — 색 바 위의 반투명 흰 유리. 면 · 테두리는 어느 바 위에서도 흰색이고,
 * 글자색은 바에서 물려받습니다. 그래서 어느 accent 바 위에서도 글자가 읽힙니다.
 * 커서 · 꺼진 모양 · 누르는 순간의 몸짓은 Glass 가 아니라 Pressable 의 몫입니다.
 */
import { style } from "@vanilla-extract/css";

import { primitives } from "../tokens/layers.css";
import { STATE_TRANSITION } from "../tokens/motion";
import { vars } from "../tokens/variables";

const p = (rule: Record<string, unknown>) => ({ "@layer": { [primitives]: rule } });
const ENABLED = ":not(:disabled):not([aria-disabled='true'])";

export const glassBase = style(
  p({
    color: "inherit",
    backgroundColor: vars.glass.bg,
    border: `${vars.stroke.base} solid ${vars.glass.border}`,
  }),
);

/** 골라진 유리 — 더 짙은 면과 흰 테두리 */
export const glassSelected = style(p({ backgroundColor: vars.glass.bgSelected, borderColor: vars.glass.borderHover }));

/** hover 때 유리가 짙어지고 테두리가 흰색이 됩니다. 꺼진 요소(disabled · aria-disabled)에는 걸지 않습니다 */
export const glassHoverable = style(
  p({
    transitionProperty: STATE_TRANSITION,
    transitionDuration: vars.duration.fast,
    transitionTimingFunction: vars.easing.standard,
    selectors: {
      [`&${ENABLED}:hover`]: { backgroundColor: vars.glass.bgHover, borderColor: vars.glass.borderHover },
    },
  }),
);
