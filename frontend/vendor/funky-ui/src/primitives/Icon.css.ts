import { style, styleVariants } from "@vanilla-extract/css";

import { primitives } from "../tokens/layers.css";
import { ICON_MOTION } from "../tokens/motion";
import { vars } from "../tokens/variables";
import type { IconMotion } from "../tokens/vocabulary";

const p = (rule: Record<string, unknown>) => ({ "@layer": { [primitives]: rule } });

/** 글자 줄에 끼어도 줄 높이를 흔들지 않게 블록으로 두고, 좁아져도 찌그러지지 않습니다 */
export const iconBase = style(p({ display: "block", flexShrink: 0 }));

/** 불러오는 동안 제자리에서 돕니다 — 키프레임은 Spinner 와 같은 전역 `fk-spin` */
export const iconSpin = style(p({ animation: `fk-spin 1s linear infinite` }));

/** 바깥의 누르는 물건에 마우스를 올리면 아이콘만 움직입니다. Pressable 을 읽지 않으려고(1차 primitive) 요소로 고릅니다 */
const onHover = (transform: string) =>
  p({
    transitionProperty: "transform",
    transitionDuration: vars.duration.fast,
    selectors: { ':is(a, button, [role="button"]):hover &': { transform } },
  });

export const iconMotion = styleVariants({
  turn: onHover(`rotate(${ICON_MOTION.turn}deg)`),
  nudge: onHover(`translateX(${ICON_MOTION.nudge}px)`),
} satisfies Record<IconMotion, object>);
