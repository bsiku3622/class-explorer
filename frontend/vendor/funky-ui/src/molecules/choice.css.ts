import { globalStyle, style } from "@vanilla-extract/css";

import { components } from "../tokens/layers.css";
import { vars } from "../tokens/variables";

const c = (rule: Record<string, unknown>) => ({ "@layer": { [components]: rule } });

/** 칸이 이어 붙은 줄 — 맞닿은 2px 테두리 둘을 하나로 겹칩니다. 골린 칸은 grow 의 z 로 이웃 위에 섭니다 */
export const choiceAttached = style(c({ flexWrap: "nowrap" }));
globalStyle(`${choiceAttached} > * + *`, c({ marginLeft: `calc(-1 * ${vars.stroke.base})` }));

export const choiceFill = style(c({ width: "100%", flexWrap: "nowrap" }));
export const choiceItemFill = style(c({ flex: "1 1 0", minWidth: 0 }));
export const tabPanel = style(c({ minWidth: 0 }));
