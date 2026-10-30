/**
 * 글자 지도 — 역할 · 줄 높이 · 굵기 · 잉크 · 서체 (fk.utilities).
 *
 * 정의 순서가 곧 우선순위입니다: 역할 → 줄 높이 → 굵기 → 잉크. 그래서 `overline` 의 기본 잉크(muted)를
 * `tone` 으로, 역할의 기본 굵기를 `weight` 로, 고정 줄 높이를 `leading` 으로 바꿀 수 있습니다.
 */
import { style, styleVariants } from "@vanilla-extract/css";

import { utilities } from "../tokens/layers.css";
import { BREAKPOINT } from "../tokens/layout";
import { LEADING, TEXT_ROLES, WEIGHT, px, type TextRole } from "../tokens/typography";
import { TONE_VALUE, textRule } from "../tokens/typography-recipes";
import { vars } from "../tokens/variables";
import type { Family, Leading, TextDecoration } from "../tokens/vocabulary";

const u = (rule: Record<string, unknown>) => ({ "@layer": { [utilities]: rule } });

export const textRoleClass = styleVariants(TEXT_ROLES, (role: TextRole) =>
  u({
    ...textRule(role),
    ...(role.md ? { "@media": { [`(min-width: ${BREAKPOINT.md}px)`]: { fontSize: px(role.md.size), lineHeight: px(role.md.leading) } } } : {}),
  }),
);

export const leadingClass = styleVariants({
  fixed: u({}),
  relaxed: u({ lineHeight: LEADING.relaxed }),
} satisfies Record<Leading, object>);

export const weightClass = styleVariants(WEIGHT, (w) => u({ fontWeight: w }));

export const toneClass = styleVariants(TONE_VALUE, (c) => u({ color: c }));

export const familyClass = styleVariants({
  sans: u({ fontFamily: vars.font.sans }),
  mono: u({ fontFamily: vars.font.mono, letterSpacing: "0" }),
} satisfies Record<Family, object>);

export const alignClass = styleVariants({
  start: u({ textAlign: "start" }),
  center: u({ textAlign: "center" }),
  end: u({ textAlign: "end" }),
});

/** 한 줄 자르기 — 폭이 있어야 잘리므로 블록으로 섭니다 (inline span 은 폭을 갖지 않아 잘리지 않습니다) */
export const truncateClass = style(u({ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }));

/** 역할과 상관없이 대문자로 — 역할이 `textTransform` 을 정하므로 같은 층의 뒤에 둡니다 */
export const uppercaseClass = style(u({ textTransform: "uppercase" }));

export const numericClass = style(u({ fontVariantNumeric: "tabular-nums" }));

export const decorationClass = styleVariants({
  strike: u({ textDecorationLine: "line-through" }),
  underline: u({ textDecorationLine: "underline", textDecorationThickness: vars.stroke.base, textUnderlineOffset: px(2) }),
} satisfies Record<TextDecoration, object>);
