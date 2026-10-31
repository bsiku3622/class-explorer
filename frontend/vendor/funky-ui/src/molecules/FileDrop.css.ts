import { style } from "@vanilla-extract/css";

import { components } from "../tokens/layers.css";
import { SPACE } from "../tokens/layout";
import { px } from "../tokens/typography";
import { vars } from "../tokens/variables";

const c = (rule: Record<string, unknown>) => ({ "@layer": { [components]: rule } });

export const fileDrop = style(
  c({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: px(SPACE.md),
    paddingInline: px(SPACE["2xl"]),
    paddingBlock: px(SPACE["4xl"]),
    textAlign: "center",
    cursor: "pointer",
    selectors: {
      // 입력은 숨어 있으므로 키보드 포커스는 칸 전체가 보여 줍니다
      "&:has(input:focus-visible)": { outline: `${vars.focusRing.width} solid ${vars.focus}`, outlineOffset: vars.focusRing.offset },
    },
  }),
);

export const fileDropDisabled = style(c({ opacity: 0.4, cursor: "not-allowed" }));

/** 눈에는 안 보이지만 포커스는 받는 입력 — `display: none` 이면 키보드로 열 수 없습니다 */
export const fileDropInput = style(c({ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap" }));
