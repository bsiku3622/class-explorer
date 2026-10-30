import { style } from "@vanilla-extract/css";

import { components } from "../tokens/layers.css";
import { BREAKPOINT } from "../tokens/layout";
import { px } from "../tokens/typography";

const c = (rule: Record<string, unknown>) => ({ "@layer": { [components]: rule } });

export const sectionTitle = style(c({ minWidth: 0 }));

/** 좁은 화면에서는 동작이 제목 아래로 내려갑니다 */
export const pageHeaderRow = style(
  c({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: px(16),
    "@media": {
      [`(min-width: ${BREAKPOINT.sm}px)`]: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    },
  }),
);

export const pageHeaderIcon = style(
  c({
    width: px(48),
    height: px(48),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  }),
);

export const pageTitle = style(c({ margin: 0 }));
