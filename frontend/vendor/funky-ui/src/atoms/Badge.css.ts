import { style, styleVariants } from "@vanilla-extract/css";

import { components } from "../tokens/layers.css";
import { BADGE, BADGE_SHADOW } from "../tokens/shape";
import { WEIGHT, px } from "../tokens/typography";
import { vars } from "../tokens/variables";
import type { BadgeSize } from "../tokens/vocabulary";

const c = (rule: Record<string, unknown>) => ({ "@layer": { [components]: rule } });

export const badgeBase = style(
  c({
    display: "inline-flex",
    alignItems: "center",
    flexShrink: 0,
    gap: px(4),
    maxWidth: "100%",
    fontWeight: WEIGHT.black,
    textTransform: "uppercase",
    lineHeight: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    verticalAlign: "middle",
  }),
);

export const badgeSize = styleVariants(BADGE.height, (h, size) =>
  c({ height: px(h), paddingInline: px(BADGE.inset[size as BadgeSize]), fontSize: px(BADGE.font[size as BadgeSize]) }),
);

/** 길이가 정해지지 않은 글자(거절 사유) — 줄바꿈되고 높이가 글자를 따라 늘어납니다 */
export const badgeWrap = style(c({ height: "auto", paddingBlock: px(4), whiteSpace: "normal", lineHeight: 1.3, flexShrink: 1 }));

export const badgeShadow = style(c({ boxShadow: `${px(BADGE_SHADOW)} ${px(BADGE_SHADOW)} 0 0 ${vars.shadowColor}` }));
