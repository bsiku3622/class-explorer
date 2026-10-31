import { style, styleVariants } from "@vanilla-extract/css";

import { primitives, utilities } from "../tokens/layers.css";
import type { Align, Justify } from "../tokens/vocabulary";

const c = (rule: Record<string, unknown>) => ({ "@layer": { [primitives]: rule } });
const u = (rule: Record<string, unknown>) => ({ "@layer": { [utilities]: rule } });

export const stack = style(c({ display: "flex", flexDirection: "column", minWidth: 0 }));
export const inline = style(c({ display: "flex", flexDirection: "row", alignItems: "center", minWidth: 0 }));
export const grid = style(c({ display: "grid", minWidth: 0 }));

const ALIGN_VALUE: Record<Align, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
  baseline: "baseline",
};
const JUSTIFY_VALUE: Record<Justify, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  around: "space-around",
};

export const alignClass = styleVariants(ALIGN_VALUE, (v) => u({ alignItems: v }));
export const justifyClass = styleVariants(JUSTIFY_VALUE, (v) => u({ justifyContent: v }));
export const justifyItemsClass = styleVariants(ALIGN_VALUE, (v) => u({ justifyItems: v }));
export const wrapClass = style(u({ flexWrap: "wrap" }));
