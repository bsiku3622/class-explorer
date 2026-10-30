import { style, styleVariants } from "@vanilla-extract/css";

import { components } from "../tokens/layers.css";
import { SPACE } from "../tokens/layout";
import { TEXT_ROLES, WEIGHT, em, px } from "../tokens/typography";
import { vars } from "../tokens/variables";
import type { TableHead } from "../tokens/vocabulary";

const c = (rule: Record<string, unknown>) => ({ "@layer": { [components]: rule } });

/** 폭이 모자라면 표만 가로로 스크롤합니다 — 화면이 밀리지 않습니다 */
export const tableWrap = style(c({ minWidth: 0, overflowX: "auto" }));
export const table = style(c({ width: "100%", borderCollapse: "collapse", fontSize: px(TEXT_ROLES.caption.size), lineHeight: px(TEXT_ROLES.caption.leading), fontWeight: WEIGHT.bold }));

const headCell = {
  paddingInline: px(SPACE.lg),
  paddingBlock: px(SPACE.md),
  fontSize: px(TEXT_ROLES.micro.size),
  lineHeight: px(TEXT_ROLES.micro.leading),
  fontWeight: WEIGHT.black,
  letterSpacing: em(0.1),
  textTransform: "uppercase" as const,
  textAlign: "start" as const,
  whiteSpace: "nowrap" as const,
};

export const tableHeadCell = styleVariants({
  inverse: c({ ...headCell, backgroundColor: vars.surface.inverse, color: vars.ink.inverse }),
  well: c({ ...headCell, backgroundColor: vars.surface.well, color: vars.ink.primary, borderBottom: `${vars.stroke.base} solid ${vars.line.base}` }),
  // 워크북처럼 숫자가 빽빽한 표 — 면도 굵은 선도 없이 1px 선만 지나갑니다
  plain: c({ ...headCell, fontSize: px(TEXT_ROLES.label.size), lineHeight: px(TEXT_ROLES.label.leading), letterSpacing: em(0.05), color: vars.ink.muted, borderBottom: `1px solid ${vars.line.subtle}` }),
} satisfies Record<TableHead, object>);

export const tableCell = style(c({ paddingInline: px(SPACE.lg), paddingBlock: px(SPACE.md), borderTop: `${vars.stroke.base} solid ${vars.line.subtle}`, textAlign: "start", verticalAlign: "middle" }));
export const tableRowHeader = style(c({ fontWeight: WEIGHT.black, backgroundColor: vars.surface.well }));
export const tableNumeric = style(c({ textAlign: "end", fontVariantNumeric: "tabular-nums" }));
/** 열 묶음의 왼쪽 선 */
export const tableDivided = style(c({ borderLeft: `${vars.stroke.base} solid ${vars.line.base}` }));

/** `plain` 표의 칸 — 줄 사이 선과 머리 칸의 면을 뺍니다. 위 규칙들을 덮어야 해서 뒤에 둡니다 */
export const tableCellPlain = style(c({ borderTop: 0, backgroundColor: "transparent" }));
export const tableDividedPlain = style(c({ borderLeft: `1px solid ${vars.line.subtle}` }));
export const tableRowHover = style(c({ selectors: { "&:hover": { backgroundImage: `linear-gradient(${vars.state.hover}, ${vars.state.hover})` } } }));
