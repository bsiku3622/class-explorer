/**
 * Paint 의 칠 (fk.primitives) — 색의 모든 상태입니다. 쉬는 색은 슬롯을 글자 · 면 · 테두리로 칠하고,
 * `hoverable` 이면 hover · 누르는 중의 색을 바꿉니다. 슬롯 값은 variant class 가(`styles/variant.css.ts`),
 * 색은 accent class 가 줍니다. 상태는 브라우저의 `:hover` · `:active` 가 켜므로 Pressable 없이도 동작합니다.
 * 움직임(가라앉기 · 떠오르기 · 작아지기)과 커서는 Paint 가 아니라 Pressable 의 몫입니다.
 */
import { style } from "@vanilla-extract/css";

import { primitives } from "../tokens/layers.css";
import { STATE_TRANSITION } from "../tokens/motion";
import { vars } from "../tokens/variables";
import { slot } from "../styles/slots";

const p = (rule: Record<string, unknown>) => ({ "@layer": { [primitives]: rule } });
const ENABLED = ":not(:disabled):not([aria-disabled='true'])";

/** 슬롯으로 칠하기만 합니다 */
export const paintBase = style(
  p({
    color: slot.fg,
    backgroundColor: slot.bg,
    borderColor: slot.border,
    borderStyle: "solid",
    borderWidth: vars.stroke.base,
  }),
);

/** hover · 누르는 중의 색 — variant 표의 Hover 칸(층 · 테두리 · 글자)과 press 층. 꺼진 요소(disabled · aria-disabled)에는 걸지 않습니다 */
export const hoverable = style(
  p({
    transitionProperty: STATE_TRANSITION,
    transitionDuration: vars.duration.fast,
    transitionTimingFunction: vars.easing.standard,
    selectors: {
      [`&${ENABLED}:hover`]: {
        backgroundImage: `linear-gradient(${slot.hoverLayer}, ${slot.hoverLayer})`,
        color: slot.hoverFg,
        borderColor: slot.hoverBorder,
      },
      [`&${ENABLED}:active`]: {
        backgroundImage: `linear-gradient(${slot.pressLayer}, ${slot.pressLayer})`,
      },
    },
  }),
);
