import { style, styleVariants } from "@vanilla-extract/css";

import { ACCENT_COLORS } from "../tokens/color";
import { components } from "../tokens/layers.css";
import { SPACE } from "../tokens/layout";
import { TEXT_ROLES, WEIGHT, WORDMARK, em, px } from "../tokens/typography";
import { vars } from "../tokens/variables";

const c = (rule: Record<string, unknown>) => ({ "@layer": { [components]: rule } });
const SKEW = "skewX(-6deg)";

export const link = style(
  c({
    color: vars.accent.solidInk,
    fontWeight: 900,
    textDecoration: "none",
    borderBottom: `${vars.stroke.base} solid ${vars.accent.solid}`,
    cursor: "pointer",
    transitionProperty: "background-color, color",
    transitionDuration: vars.duration.fast,
    selectors: {
      "&:hover": { backgroundColor: vars.accent.solid, color: vars.accent.ink },
    },
  }),
);

/** 조용한 링크 — 글자 · 굵기는 바깥 것이고 hover 때만 밑줄이 생깁니다. `as="button"` 으로 그려도 버튼의 틀이 남지 않습니다 */
export const linkQuiet = style(
  c({
    padding: 0,
    border: 0,
    background: "none",
    color: "inherit",
    fontWeight: "inherit",
    textAlign: "inherit",
    textDecoration: "none",
    textDecorationThickness: vars.stroke.base,
    textUnderlineOffset: px(SPACE.xs),
    cursor: "pointer",
    transitionProperty: "color",
    transitionDuration: vars.duration.fast,
    selectors: {
      "&:hover": { textDecorationLine: "underline" },
    },
  }),
);

/** `accent` 를 준 조용한 링크 — hover 때 그 색의 진한 글자가 됩니다 */
export const linkQuietAccent = style(
  c({
    selectors: {
      "&:hover": { color: vars.accent.solidInk },
    },
  }),
);

export const code = style(
  c({
    paddingInline: px(SPACE.sm),
    paddingBlock: px(SPACE["2xs"]),
    fontFamily: vars.font.sans,
    fontSize: px(TEXT_ROLES.caption.size),
    fontWeight: WEIGHT.black,
    WebkitBoxDecorationBreak: "clone",
    boxDecorationBreak: "clone",
  }),
);

export const wordmark = style(
  c({
    display: "inline-block",
    flexShrink: 0,
    lineHeight: 1,
    fontWeight: WEIGHT.black,
    letterSpacing: em(TEXT_ROLES.display.tracking),
    textTransform: "uppercase",
    transform: SKEW,
    whiteSpace: "nowrap",
    color: "inherit",
  }),
);

export const wordmarkSize = styleVariants(WORDMARK, (size) => c({ fontSize: px(size) }));

export const wordmarkPress = style(
  c({
    padding: 0,
    border: 0,
    background: "none",
    cursor: "pointer",
    transitionProperty: "transform",
    transitionDuration: vars.duration.fast,
    selectors: {
      "&:hover": { transform: `${SKEW} scale(${vars.press.grow})` },
      "&:active": { transform: `${SKEW} scale(${vars.press.scale})` },
    },
  }),
);

export const required = style(c({ marginLeft: "0.25em", color: ACCENT_COLORS.red.softInk }));

export const divider = styleVariants({
  horizontal: c({ width: "100%", height: 0, borderTopStyle: "solid", borderTopWidth: vars.stroke.base, flexShrink: 0 }),
  vertical: c({ alignSelf: "stretch", width: 0, borderLeftStyle: "solid", borderLeftWidth: vars.stroke.base, flexShrink: 0 }),
});

export const dividerTone = styleVariants({
  subtle: c({ borderColor: vars.line.subtle }),
  soft: c({ borderColor: vars.line.soft }),
  line: c({ borderColor: vars.line.base }),
});
