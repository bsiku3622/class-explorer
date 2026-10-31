import { style } from "@vanilla-extract/css";

import { components } from "../tokens/layers.css";
import { SPACE } from "../tokens/layout";
import { CONTROL_TEXT, TEXT_ROLES, WEIGHT, em, px } from "../tokens/typography";
import { vars } from "../tokens/variables";

const c = (rule: Record<string, unknown>) => ({ "@layer": { [components]: rule } });

export const anchorWrap = style(c({ display: "inline-flex", maxWidth: "100%" }));

/** 설명 풍선의 글자 · 크기 — 층 · 위치 · 등장은 Floating, 검정 면은 Surface 입니다 */
export const tooltip = style(
  c({
    maxWidth: px(260),
    paddingInline: px(SPACE.md),
    paddingBlock: px(SPACE.xs),
    color: vars.ink.inverse,
    fontSize: px(TEXT_ROLES.label.size),
    lineHeight: px(TEXT_ROLES.label.leading),
    fontWeight: WEIGHT.black,
    pointerEvents: "none",
  }),
);

export const anchorBlock = style(c({ display: "block", width: "100%" }));

/** 내용이 있는 판 — 카드 · 요약을 담으므로 Tooltip 과 달리 누를 수 있고 폭이 넓습니다 */
export const popover = style(c({ maxWidth: `min(32rem, calc(100vw - ${px(SPACE.xl)}))`, color: vars.ink.primary }));

export const menu = style(c({ display: "flex", flexDirection: "column", paddingBlock: 0 }));

export const menuItem = style(
  c({
    display: "flex",
    alignItems: "center",
    gap: px(SPACE.md),
    width: "100%",
    paddingInline: px(SPACE.xl),
    paddingBlock: px(10),
    border: 0,
    textAlign: "start",
    whiteSpace: "nowrap",
    fontSize: px(CONTROL_TEXT.sm.size),
    letterSpacing: em(0.1),
    fontWeight: WEIGHT.black,
    textTransform: "uppercase",
    selectors: {
      // hover 층 · 골라진 칸의 검정 면은 Surface, 커서 · 꺼진 모양은 Pressable 이 맡습니다. 방향키로 온 칸도 hover 와 같은 층으로 보입니다
      "&:focus-visible": { backgroundImage: `linear-gradient(${vars.state.hover}, ${vars.state.hover})`, outlineOffset: "-4px" },
    },
  }),
);

export const menuItemCheck = style(c({ marginLeft: "auto" }));
