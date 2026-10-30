import { style, styleVariants } from "@vanilla-extract/css";

import { ACCENT_COLORS } from "../tokens/color";
import { components } from "../tokens/layers.css";
import { SPACE } from "../tokens/layout";
import { CONTROL } from "../tokens/shape";
import { TEXT_ROLES, WEIGHT, px } from "../tokens/typography";
import { vars } from "../tokens/variables";
import type { ControlSize } from "../tokens/vocabulary";

const c = (rule: Record<string, unknown>) => ({ "@layer": { [components]: rule } });

export const searchWrap = style(c({ position: "relative", display: "block", width: "100%", minWidth: 0 }));

export const fieldError = style(c({ color: ACCENT_COLORS.red.solidInk }));
export const fieldWarning = style(c({ color: ACCENT_COLORS.orange.solidInk }));

/** 입력 아래에 붙는 제안 목록 — 고르는 동안에도 포커스는 입력에 남습니다 */
export const suggest = style(c({ display: "flex", flexDirection: "column", maxHeight: px(320), overflowY: "auto" }));
export const suggestHead = style(
  c({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: px(SPACE.md),
    paddingInline: px(SPACE.lg),
    paddingBlock: px(SPACE.sm),
    borderBottom: `${vars.stroke.base} solid ${vars.line.subtle}`,
  }),
);
export const suggestRow = style(c({ display: "flex", alignItems: "center", minWidth: 0 }));
export const suggestItem = style(
  c({
    flex: 1,
    minWidth: 0,
    paddingInline: px(SPACE.lg),
    paddingBlock: px(SPACE.md),
    border: 0,
    textAlign: "start",
    fontSize: px(TEXT_ROLES.body.size),
    fontWeight: WEIGHT.bold,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
);
export const suggestRemove = style(
  c({
    display: "inline-flex",
    flexShrink: 0,
    padding: px(SPACE.md),
    border: 0,
    background: "none",
    color: vars.ink.faint,
    cursor: "pointer",
    transitionProperty: "color",
    transitionDuration: vars.duration.fast,
    selectors: { "&:hover": { color: vars.ink.primary } },
  }),
);

const edge = (size: ControlSize) => CONTROL.inset[size] - 2;

export const searchIcon = styleVariants(CONTROL.height, (_, size) =>
  c({
    position: "absolute",
    top: "50%",
    left: px(edge(size as ControlSize)),
    transform: "translateY(-50%)",
    color: vars.ink.muted,
    pointerEvents: "none",
  }),
);

/** 앞 아이콘과 뒤 지우기 자리를 비웁니다. 브라우저의 기본 지우기 버튼은 숨깁니다 */
export const searchInput = styleVariants(CONTROL.height, (_, size) =>
  c({
    paddingLeft: px(edge(size as ControlSize) + CONTROL.icon[size as ControlSize] + CONTROL.gap[size as ControlSize]),
    paddingRight: px(edge(size as ControlSize) + CONTROL.icon[size as ControlSize] + CONTROL.gap[size as ControlSize]),
    "::-webkit-search-cancel-button": { display: "none" },
  }),
);

export const searchClear = styleVariants(CONTROL.height, (_, size) =>
  c({
    position: "absolute",
    top: "50%",
    right: px(edge(size as ControlSize) - 4),
    transform: "translateY(-50%)",
    display: "inline-flex",
    padding: px(4),
    border: 0,
    background: "none",
    color: vars.ink.faint,
    cursor: "pointer",
    transitionProperty: "color",
    transitionDuration: vars.duration.fast,
    selectors: { "&:hover": { color: vars.ink.primary } },
  }),
);
