import { style } from "@vanilla-extract/css";

import { components } from "../tokens/layers.css";
import { SPACE } from "../tokens/layout";
import { px } from "../tokens/typography";
import { vars } from "../tokens/variables";

const c = (rule: Record<string, unknown>) => ({ "@layer": { [components]: rule } });

export const notice = style(
  c({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: px(SPACE.lg),
    paddingInline: px(SPACE.xl),
    paddingBlock: px(SPACE.lg),
  }),
);

/** 좁은 폭에서 버튼이 글 아래로 내려갑니다 — 글이 30px 로 짜부라지지 않습니다 */
export const noticeWrap = style(c({ flexWrap: "wrap" }));
export const noticeBody = style(c({ flex: "1 1 12rem", minWidth: 0 }));

/** 영역을 덮는 불러오는 중 — 아래 내용은 흐려지고 눌리지 않습니다 */
export const busy = style(c({ position: "relative", minWidth: 0 }));
export const busyContent = style(c({ opacity: 0.4, pointerEvents: "none" }));
export const busyOverlay = style(
  c({
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: px(SPACE.md),
  }),
);

export const emptyState = style(c({ paddingBlock: px(SPACE["4xl"]), paddingInline: px(SPACE.xl), textAlign: "center" }));
export const emptyStateFramed = style(c({ border: `${vars.stroke.base} dashed ${vars.line.soft}` }));
