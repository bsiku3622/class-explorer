import { style, styleVariants } from "@vanilla-extract/css";

import { components } from "../tokens/layers.css";
import { BREAKPOINT, SPACE } from "../tokens/layout";
import { NUMERAL, TEXT_ROLES, WEIGHT, em, px } from "../tokens/typography";
import { vars } from "../tokens/variables";

const c = (rule: Record<string, unknown>) => ({ "@layer": { [components]: rule } });

export const statValue = styleVariants(NUMERAL, (n) =>
  c({ fontSize: px(n.size), lineHeight: px(n.leading), letterSpacing: em(n.tracking), fontWeight: WEIGHT.black, fontVariantNumeric: "tabular-nums" }),
);

export const statValueAccent = style(c({ color: vars.accent.solidInk }));

export const statUnit = styleVariants({ sm: TEXT_ROLES.micro, lg: TEXT_ROLES.caption }, (r) =>
  c({ fontSize: px(r.size), fontWeight: WEIGHT.black, textTransform: "uppercase", color: vars.ink.muted }),
);

export const meterTrack = style(
  c({
    position: "relative",
    height: px(16),
    overflow: "hidden",
  }),
);

/** 넓은 화면에서 이름 · 막대 · 값이 한 줄입니다. 좁으면 세 줄로 쌓입니다 */
export const meterRow = style(
  c({
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    alignItems: "center",
    gap: px(SPACE.xs),
    "@media": { [`(min-width: ${BREAKPOINT.sm}px)`]: { gridTemplateColumns: `${px(224)} minmax(0, 1fr) ${px(96)}`, gap: px(SPACE.xl) } },
  }),
);
export const meterRowValue = style(c({ "@media": { [`(min-width: ${BREAKPOINT.sm}px)`]: { textAlign: "end" } } }));

export const meterFill = style(
  c({
    height: "100%",
    backgroundColor: vars.accent.solid,
    borderRight: `${vars.stroke.base} solid ${vars.line.base}`,
    transitionProperty: "width",
    transitionDuration: vars.duration.slow,
    transitionTimingFunction: vars.easing.standard,
  }),
);
