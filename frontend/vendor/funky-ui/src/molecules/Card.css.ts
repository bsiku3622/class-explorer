import { style } from "@vanilla-extract/css";

import { components } from "../tokens/layers.css";
import { SPACE } from "../tokens/layout";
import { px } from "../tokens/typography";
import { PRESS_SCALE_VAR, vars } from "../tokens/variables";

const c = (rule: Record<string, unknown>) => ({ "@layer": { [components]: rule } });

export const cardBase = style(c({ minWidth: 0 }));

/** 누르는 카드 — 버튼 · 링크로 그려도 카드처럼 섭니다. 큰 면이라 누르는 순간 덜 작아집니다 */
export const cardPressable = style(
  c({
    display: "block",
    width: "100%",
    textAlign: "inherit",
    vars: { [PRESS_SCALE_VAR]: vars.press.surfaceScale },
  }),
);

export const cardHeader = style(c({ minWidth: 0, paddingInline: px(SPACE["3xl"]), paddingBlock: px(SPACE.xl) }));
export const cardHeaderTitle = style(c({ minWidth: 0, flex: 1 }));

/** 머리 막대 — 칠은 Paint(filled)가 하고, 여기서는 테두리를 아래 한 줄만 남깁니다 */
export const cardHeaderBar = style(
  c({
    borderWidth: `0 0 ${vars.stroke.base}`,
    borderColor: vars.line.base,
    paddingBlock: px(SPACE.lg),
  }),
);

/** 전폭 색 띠 — 칠은 Paint 가 하고, 테두리는 카드 쪽 한 줄만 남깁니다. 카드의 2px 테두리와 겹치지 않습니다 */
export const cardStrip = style(c({ minWidth: 0, paddingInline: px(SPACE["3xl"]), paddingBlock: px(SPACE.lg), borderColor: vars.line.base }));
export const cardStripBottom = style(c({ borderWidth: `${vars.stroke.base} 0 0` }));
export const cardStripTop = style(c({ borderWidth: `0 0 ${vars.stroke.base}` }));

export const cardSection = style(c({ minWidth: 0 }));
export const cardSectionDivided = style(c({ borderTop: `${vars.stroke.base} solid ${vars.line.subtle}` }));
