/**
 * 테두리의 변 · 선 (fk.primitives) — Surface 와 Paint 가 같이 씁니다. 두 칠의 테두리 규칙을 덮어야 하는데 2차 primitive 끼리는
 * 서로 import 하지 않고 CSS 가 실리는 순서에도 기대지 않으려고, `&&` 로 특이도를 한 단 올립니다.
 */
import { style, styleVariants } from "@vanilla-extract/css";

import { primitives } from "../tokens/layers.css";
import { vars } from "../tokens/variables";
import type { BorderSide, BorderStyle } from "../tokens/vocabulary";

const twice = (rule: Record<string, unknown>) => ({ "@layer": { [primitives]: { selectors: { "&&": rule } } } });
const w = vars.stroke.base;

export const borderSideClass = styleVariants({
  all: {},
  left: twice({ borderWidth: `0 0 0 ${w}` }),
  right: twice({ borderWidth: `0 ${w} 0 0` }),
  top: twice({ borderWidth: `${w} 0 0` }),
  bottom: twice({ borderWidth: `0 0 ${w}` }),
  x: twice({ borderWidth: `0 ${w}` }),
  y: twice({ borderWidth: `${w} 0` }),
} satisfies Record<BorderSide, object>);

export const borderStyleClass = styleVariants({
  solid: {},
  dashed: twice({ borderStyle: "dashed" }),
} satisfies Record<BorderStyle, object>);

/** 그림자 하나 — Paint 의 `shadow`. 움직임이 없는 색 면(지표 카드)에 씁니다 */
export const raisedClass = style({ "@layer": { [primitives]: { boxShadow: vars.shadow.raised } } });
export const floatingClass = style({ "@layer": { [primitives]: { boxShadow: vars.shadow.floating } } });
